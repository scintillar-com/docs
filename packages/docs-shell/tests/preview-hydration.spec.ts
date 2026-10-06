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
