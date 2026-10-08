import { expect, test } from "@playwright/test"

/**
 * Preview routes must hydrate without mismatches. The dev-registry fixture's
 * `hello` preview renders `React.useId()` into `data-use-id`, so any
 * difference between the server and client component trees above it
 * (e.g. the user's `next/dynamic` preview map rendered from a Client
 * Component, or preview state read from sessionStorage during render) shows
 * up as a hydration warning. Runs with the theme-panel suite against
 * fixtures/dev-registry (`pnpm test:theme-panel`).
 */
const cases = [
  { route: "/preview/hello/", stored: false },
  { route: "/preview-snapshot/hello/", stored: false },
  // A visitor who left the preview fullscreen with controls open.
  { route: "/preview/hello/", stored: true },
]

for (const { route, stored } of cases) {
  const name = `${route} hydrates without mismatches${stored ? " (saved preview state)" : ""}`
  test(name, async ({ page }) => {
    if (stored) {
      await page.addInitScript(() => {
        sessionStorage.setItem("preview-fullscreen", "true")
        sessionStorage.setItem("preview-controls", "true")
      })
    }
    const problems: string[] = []
    page.on("console", (msg) => {
      if (/hydrat/i.test(msg.text())) problems.push(msg.text())
    })
    page.on("pageerror", (err) => problems.push(err.message))

    await page.goto(route)
    const preview = page.getByTestId("hello-preview")
    await expect(preview).toBeVisible()
    await expect(preview).toHaveAttribute("data-use-id", /\S/)
    // Hydration warnings are logged once React has hydrated; give it a beat.
    await page.waitForLoadState("networkidle")
    expect(problems).toEqual([])
  })
}

/**
 * The component page's preview frame. Its height used to be read from
 * sessionStorage and `matchMedia` during render, so a phone (600px default)
 * or a visitor who had resized or fullscreened a preview got a different
 * first client render from the server's (384px).
 */
const componentCases = [
  { label: "on a phone", viewport: { width: 375, height: 800 }, stored: {}, height: 600 },
  { label: "on a desktop", viewport: { width: 1280, height: 800 }, stored: {}, height: 384 },
  { label: "with a saved height", viewport: { width: 1280, height: 800 }, stored: { "preview-height": "450" }, height: 450 },
  { label: "with saved fullscreen", viewport: { width: 1280, height: 800 }, stored: { "preview-fullscreen": "true" }, height: null },
]

for (const { label, viewport, stored, height } of componentCases) {
  test(`/components/hello/ hydrates without mismatches ${label}`, async ({ page }) => {
    await page.setViewportSize(viewport)
    await page.addInitScript((entries) => {
      for (const [key, value] of Object.entries(entries)) sessionStorage.setItem(key, value)
    }, stored)
    const problems: string[] = []
    page.on("console", (msg) => {
      if (/hydrat/i.test(msg.text())) problems.push(msg.text())
    })
    page.on("pageerror", (err) => problems.push(err.message))

    await page.goto("/components/hello/")
    const frame = page.getByTestId("preview-frame")
    await expect(frame).toBeVisible()
    await page.waitForLoadState("networkidle")
    expect(problems).toEqual([])
    if (height !== null) {
      await expect.poll(async () => (await frame.boundingBox())?.height).toBe(height)
    } else {
      await expect(frame).toHaveCSS("position", "fixed")
    }
  })
}
