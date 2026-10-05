import { expect, test, type Page } from "@playwright/test"

/**
 * Docs-only site end to end, against the static export of
 * `fixtures/docs-basic` (no components, `intro.fr.mdx` translation).
 * Run with `pnpm test:docs` (see playwright.docs.config.ts).
 */

const horizontalOverflow = (page: Page) =>
  page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)

test.describe("docs-only site", () => {
  test("homepage lists the pages, with no registry chrome", async ({ page }) => {
    const errors: string[] = []
    page.on("pageerror", (e) => errors.push(e.message))
    await page.goto("/")
    await expect(page.getByRole("heading", { level: 1, name: "Docs Basic" })).toBeVisible()
    await expect(page.getByText("A documentation site with no component registry.")).toBeVisible()
    const main = page.locator("main")
    for (const title of ["Introduction", "Guide", "1.2 notes"]) {
      await expect(main.getByRole("link", { name: new RegExp(title) })).toBeVisible()
    }
    await expect(page.getByText("No registry wired")).toHaveCount(0)
    await expect(page.getByRole("link", { name: "Components", exact: true })).toHaveCount(0)
    // Branding reaches client components too (no hydration mismatch, React #418).
    expect(errors).toEqual([])
  })

  test("registry routes don't exist", async ({ page }) => {
    for (const url of ["/components/button/", "/preview/button/"]) {
      const res = await page.goto(url)
      expect(res?.status(), url).toBe(404)
    }
  })

  test("a page renders with its sidebar and switches to its translation", async ({ page, isMobile }) => {
    await page.goto("/docs/intro/")
    await expect(page.getByRole("heading", { level: 1, name: "Introduction" })).toBeVisible()
    if (!isMobile) {
      const nav = page.getByRole("navigation", { name: "Main navigation" }).first()
      await expect(nav.getByRole("link", { name: "Guide" })).toBeVisible()
      await expect(nav.getByText("Components")).toHaveCount(0)
    }
    // `intro.fr.mdx` is the French version of the page, picked by the toggle.
    await page.getByRole("button", { name: "Cycle language" }).click()
    await expect(page.getByText("Ce site a des pages de documentation")).toBeVisible()
    await expect(page.getByText("This site has documentation pages")).toHaveCount(0)
  })

  test("a page with a dot in its name keeps its URL", async ({ page }) => {
    const res = await page.goto("/docs/v1.2-notes/")
    expect(res?.status()).toBe(200)
    await expect(page.getByRole("heading", { level: 1, name: "1.2 notes" })).toBeVisible()
  })

  test("no horizontal scrolling", async ({ page, isMobile }) => {
    for (const url of ["/", "/docs/intro/", "/docs/guide/"]) {
      await page.goto(url)
      expect(await horizontalOverflow(page), url).toBeLessThanOrEqual(0)
    }
    if (isMobile) {
      await page.getByRole("button", { name: "Toggle menu" }).click()
      await expect(page.getByRole("link", { name: "Guide" }).first()).toBeVisible()
      expect(await horizontalOverflow(page), "open mobile menu").toBeLessThanOrEqual(0)
    }
  })
})
