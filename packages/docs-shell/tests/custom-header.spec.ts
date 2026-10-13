import { expect, test, type Page } from "@playwright/test"

/**
 * A site that supplies its own header, against the static export of
 * `fixtures/docs-custom-header`: `components.header`, a 4rem
 * `--shell-header-height` and `mobileMenu.tools`. Run with `pnpm test:docs`.
 */

test.use({ baseURL: `http://localhost:${process.env.DOCS_CUSTOM_HEADER_PORT ?? 3122}` })

const HEADER_HEIGHT = 64
const header = (page: Page) => page.getByTestId("site-header")
const top = async (page: Page, selector: string) =>
  (await page.locator(selector).first().boundingBox())?.y ?? Number.NaN

test.describe("custom header", () => {
  test("replaces the shell's header, at the site's height", async ({ page }) => {
    await page.goto("/")
    await expect(header(page)).toBeVisible()
    await expect(header(page)).toContainText("CH Docs")
    // The shell's header (its breadcrumb portal) isn't rendered.
    await expect(page.locator("#header-breadcrumb")).toHaveCount(0)
    expect((await header(page).boundingBox())?.height).toBe(HEADER_HEIGHT)
  })

  test("links the site's sections, marking the current one", async ({ page, isMobile }) => {
    test.skip(isMobile, "the section links are desktop-only")
    await page.goto("/docs/guides/long-page/")
    const links = page.getByRole("navigation", { name: "Site sections" }).getByRole("link")
    await expect(links).toHaveText(["Documentation", "Guides"])
    await expect(links.nth(1)).toHaveAttribute("aria-current", "page")
  })

  test("nothing hides under it: sidebar, table of contents, anchors", async ({ page, isMobile }) => {
    test.skip(isMobile, "the sidebar and table of contents are desktop-only")
    await page.setViewportSize({ width: 1440, height: 600 })
    await page.goto("/docs/guides/long-page/#section-6")
    const heading = page.locator("h2#section-6")
    await expect(heading).toBeInViewport()
    expect(await top(page, "h2#section-6")).toBeGreaterThanOrEqual(HEADER_HEIGHT)
    // Scrolled down, the sticky sidebar and table of contents sit below it.
    expect(await page.evaluate(() => window.scrollY)).toBeGreaterThan(0)
    expect(await top(page, "aside:visible:has(nav[aria-label='Main navigation'])")).toBe(HEADER_HEIGHT)
    expect(await top(page, "nav[aria-label='On this page']")).toBeGreaterThanOrEqual(HEADER_HEIGHT)
  })

  test("the mobile menu carries search, language and theme", async ({ page, isMobile }) => {
    test.skip(!isMobile, "the mobile menu")
    await page.goto("/docs/welcome/")
    await page.getByRole("button", { name: "Toggle menu" }).click()
    const tools = page.getByTestId("mobile-menu-tools")
    await expect(tools).toBeVisible()
    expect(await top(page, "aside:visible:has([data-testid='mobile-menu-tools'])")).toBeGreaterThan(HEADER_HEIGHT)
    await expect(tools.getByRole("button", { name: "Cycle language" })).toBeVisible()
    await expect(tools.getByRole("button", { name: "Toggle theme" })).toBeVisible()
    await tools.getByRole("button", { name: "Search..." }).click()
    await expect(page.locator("[cmdk-input]")).toBeVisible()
  })

  test("Ctrl+K opens one search dialog", async ({ page }) => {
    await page.goto("/docs/welcome/")
    await page.keyboard.press("Control+k")
    await expect(page.locator("[cmdk-input]")).toBeVisible()
    await expect(page.getByRole("dialog")).toHaveCount(1)
  })
})
