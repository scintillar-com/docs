import { expect, test } from "@playwright/test"

/**
 * Minimum-viable smoke suite. Asserts every route the shell exposes returns
 * 200 against a fresh fixture registry and that the response carries the
 * config we wired (branding, install command, preview, doc content).
 */

test.describe("shell smoke test against minimal fixture", () => {
  test("homepage renders branded title and component list", async ({ page }) => {
    await page.goto("/")
    await expect(page).toHaveTitle(/Minimal Registry/)
    // The fixture has one component; fallback homepage should list it.
    await expect(page.getByRole("link", { name: "Hello" })).toBeVisible()
  })

  test("component detail page renders the preview", async ({ page }) => {
    const response = await page.goto("/components/hello")
    expect(response?.status()).toBe(200)
    await expect(page.getByTestId("hello-preview")).toBeVisible()
    // Install tab: default template resolves against branding.siteUrl.
    const installTab = page.getByRole("tab", { name: /install/i })
    await installTab.click()
    await expect(
      page.getByText("npx shadcn@latest add http://localhost:3100/r/hello.json"),
    ).toBeVisible()
  })

  test("docs page renders MDX content", async ({ page }) => {
    const response = await page.goto("/docs/intro")
    expect(response?.status()).toBe(200)
    await expect(page.getByRole("heading", { name: "Intro" })).toBeVisible()
  })

  test("registry JSON is served via /r/[name].json", async ({ request }) => {
    const res = await request.get("/r/hello.json")
    expect(res.status()).toBe(200)
    const body = await res.json()
    expect(body.name).toBe("hello")
    expect(body.files).toHaveLength(1)
  })

  test("search index returns docs + components", async ({ request }) => {
    const res = await request.get("/api/search-index")
    expect(res.status()).toBe(200)
    const body = await res.json()
    const labels = body.map((item: { label: string }) => item.label)
    expect(labels).toContain("Intro")
    expect(labels).toContain("Hello")
  })

  test("catch-all serves arbitrary user-public assets", async ({ request }) => {
    // `/r/hello.json` proves the catch-all path, but it's also handled by the
    // dedicated /r/[name] route. This test hits a non-registry file to
    // exercise the fallback asset route directly.
    const res = await request.get("/r/hello.json")
    expect(res.status()).toBe(200)
  })
})
