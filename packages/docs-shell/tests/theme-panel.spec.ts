import { expect, test, type Frame, type Page } from "@playwright/test"

/**
 * Theme panel end to end, against the dev-registry fixture (`themePanel: {}`).
 * Run with `pnpm test:theme-panel` (see playwright.theme-panel.config.ts).
 */

const rootVar = (page: Page, name: string) =>
  page.evaluate((n) => document.documentElement.style.getPropertyValue(n), name)

const frameVar = (frame: Frame, name: string) =>
  frame.evaluate((n) => document.documentElement.style.getPropertyValue(n), name)

async function previewFrame(page: Page): Promise<Frame> {
  const iframe = page.locator("iframe[data-component-preview-iframe]").first()
  await iframe.scrollIntoViewIfNeeded()
  const handle = await iframe.elementHandle()
  const frame = await handle?.contentFrame()
  if (!frame) throw new Error("preview iframe not found")
  // Wait for the preview app to hydrate (the sync component runs in an effect).
  await frame.waitForLoadState("load")
  return frame
}

test.describe("theme panel", () => {
  test.beforeEach(async ({ context }) => {
    await context.grantPermissions(["clipboard-read", "clipboard-write"])
  })

  test("edits apply live, sync to previews, persist and copy as CSS", async ({ page }) => {
    const consoleErrors: string[] = []
    page.on("console", (msg) => {
      if (msg.type() === "error") consoleErrors.push(msg.text())
    })
    await page.goto("/components/button/")
    const trigger = page.getByRole("button", { name: "Theme settings" })
    await expect(trigger).toBeVisible()

    // Open: popover is a labelled dialog and takes focus.
    await trigger.click()
    const panel = page.getByRole("dialog", { name: "Theme" })
    await expect(panel).toBeVisible()
    await expect(panel.locator(":focus")).toHaveCount(1)

    // Mode.
    await panel.getByRole("button", { name: "Dark" }).click()
    await expect(page.locator("html")).toHaveClass(/\bdark\b/)
    await expect(panel.getByRole("button", { name: "Dark" })).toHaveAttribute("aria-pressed", "true")

    // Primary color via the hex input.
    const hex = panel.getByRole("textbox", { name: "Primary color", exact: true })
    await hex.fill("#ff3300")
    await expect.poll(() => rootVar(page, "--primary")).toBe("#ff3300")

    // Invalid hex is flagged and not applied.
    await hex.fill("#zz")
    await expect(hex).toHaveAttribute("aria-invalid", "true")
    await expect(panel.getByText("Enter a hex color such as #3b82f6.")).toBeVisible()
    await expect.poll(() => rootVar(page, "--primary")).toBe("#ff3300")
    await hex.fill("#ff3300")

    // Tint slider.
    await panel.getByRole("slider", { name: "Surface tint" }).fill("1.5")
    await expect.poll(() => rootVar(page, "--surface-tint")).toBe("1.5")

    // Preview iframe follows.
    const frame = await previewFrame(page)
    await expect.poll(() => frameVar(frame, "--primary")).toBe("#ff3300")
    await expect.poll(() => frameVar(frame, "--surface-tint")).toBe("1.5")

    // Copy CSS.
    await panel.getByRole("button", { name: "Copy CSS" }).click()
    await expect(panel.getByRole("status")).toHaveText("CSS copied to the clipboard.")
    // The OS clipboard may turn LF into CRLF (Windows).
    const css = (await page.evaluate(() => navigator.clipboard.readText())).replace(/\r\n/g, "\n")
    expect(css).toBe(":root {\n  --primary: #ff3300;\n  --surface-tint: 1.5;\n}\n")

    // Escape closes and returns focus to the trigger.
    await page.keyboard.press("Escape")
    await expect(panel).toBeHidden()
    await expect(trigger).toBeFocused()

    // Persisted per browser: applied again after a reload, iframe included.
    await page.reload()
    await expect.poll(() => rootVar(page, "--primary")).toBe("#ff3300")
    await expect.poll(() => rootVar(page, "--surface-tint")).toBe("1.5")
    const reloadedFrame = await previewFrame(page)
    await expect.poll(() => frameVar(reloadedFrame, "--primary")).toBe("#ff3300")

    // Reset all clears the overrides everywhere.
    await page.getByRole("button", { name: "Theme settings" }).click()
    await page.getByRole("dialog", { name: "Theme" }).getByRole("button", { name: "Reset all" }).click()
    await expect.poll(() => rootVar(page, "--primary")).toBe("")
    await expect.poll(() => rootVar(page, "--surface-tint")).toBe("")
    await expect.poll(() => frameVar(reloadedFrame, "--primary")).toBe("")
    expect(consoleErrors).toEqual([])
  })

  test("tint reset and keyboard operation", async ({ page }) => {
    // A component page: docs pages hit a known dev-mode MDX runtime issue.
    await page.goto("/components/card/")
    const trigger = page.getByRole("button", { name: "Theme settings" })
    await trigger.focus()
    await page.keyboard.press("Enter")
    const panel = page.getByRole("dialog", { name: "Theme" })
    await expect(panel).toBeVisible()

    const slider = panel.getByRole("slider", { name: "Surface tint" })
    await slider.focus()
    await page.keyboard.press("ArrowRight")
    await expect.poll(() => rootVar(page, "--surface-tint")).not.toBe("")

    await panel.getByRole("button", { name: "Reset surface tint" }).click()
    await expect.poll(() => rootVar(page, "--surface-tint")).toBe("")
  })

  test("fits a phone-width viewport", async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 740 })
    await page.goto("/components/card/")
    await page.getByRole("button", { name: "Theme settings" }).click()
    const panel = page.getByRole("dialog", { name: "Theme" })
    await expect(panel).toBeVisible()
    const box = await panel.boundingBox()
    expect(box).not.toBeNull()
    expect(box!.x).toBeGreaterThanOrEqual(0)
    expect(box!.x + box!.width).toBeLessThanOrEqual(360)
  })
})
