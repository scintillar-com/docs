import { expect, test, type Page } from "@playwright/test"

/**
 * Nested docs end to end, against the static export of
 * `fixtures/docs-nested` (sections, nested folders with and without an
 * `_index` page, locale folders). Run with `pnpm test:docs`.
 */

test.use({ baseURL: `http://localhost:${process.env.DOCS_NESTED_PORT ?? 3121}` })

const horizontalOverflow = (page: Page) =>
  page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
const sidebar = (page: Page) => page.locator("aside").getByRole("navigation", { name: "Main navigation" })

test.describe("nested docs", () => {
  test("header has a tab per section, landing on the section's own page", async ({ page, isMobile }) => {
    test.skip(isMobile, "the header tabs are desktop-only")
    await page.goto("/")
    const tabs = page.getByRole("navigation", { name: "Sections" })
    await expect(tabs.getByRole("link")).toHaveText(["Documentation", "User guide", "Reference"])
    await tabs.getByRole("link", { name: "User guide" }).click()
    await expect(page).toHaveURL(/\/docs\/guides\/$/)
    await expect(page.getByRole("heading", { level: 1, name: "User guide" })).toBeVisible()
    // A section with no _index page lands on its first page.
    await tabs.getByRole("link", { name: "Reference" }).click()
    await expect(page).toHaveURL(/\/docs\/reference\/api\/$/)
  })

  test("a deep page renders with its folders open and itself active", async ({ page, isMobile }) => {
    test.skip(isMobile, "the desktop sidebar")
    const errors: string[] = []
    page.on("pageerror", (e) => errors.push(e.message))
    await page.goto("/docs/guides/advanced/caching/")
    await expect(page.getByRole("heading", { level: 1, name: "Caching" })).toBeVisible()
    const nav = sidebar(page)
    await expect(nav.getByRole("link", { name: "Caching" })).toHaveClass(/font-medium/)
    // Only the active section on desktop.
    await expect(nav.getByText("API")).toHaveCount(0)
    // The section heading links to the section's page.
    await expect(nav.getByRole("link", { name: "User guide" })).toHaveAttribute("href", "/docs/guides/")
    expect(errors).toEqual([])
  })

  test("a folder's _index page answers at the folder's URL", async ({ page }) => {
    const res = await page.goto("/docs/guides/advanced/")
    expect(res?.status()).toBe(200)
    await expect(page.getByRole("heading", { level: 1, name: "Advanced" })).toBeVisible()
    // A folder without an _index page has no URL of its own.
    expect((await page.goto("/docs/guides/recipes/"))?.status()).toBe(404)
  })

  test("a nested page switches to its translation, sidebar title included", async ({ page, isMobile }) => {
    await page.goto("/docs/guides/advanced/caching/")
    await page.getByRole("button", { name: "Cycle language" }).click()
    await expect(page.getByRole("heading", { level: 2, name: "Fonctionnement" })).toBeVisible()
    if (!isMobile) await expect(sidebar(page).getByRole("link", { name: "Mise en cache" })).toBeVisible()
  })

  test("a collapsed folder stays collapsed after a reload", async ({ page, isMobile }) => {
    test.skip(isMobile, "the desktop sidebar")
    await page.goto("/docs/guides/start/")
    const nav = sidebar(page)
    await expect(nav.getByRole("link", { name: "Deploying" })).toBeVisible()
    await nav.getByRole("button", { name: "Collapse Recipes" }).click()
    await expect(nav.getByRole("link", { name: "Deploying" })).toHaveCount(0)
    await page.reload()
    await expect(sidebar(page).getByRole("button", { name: "Expand Recipes" })).toBeVisible()
    await expect(sidebar(page).getByRole("link", { name: "Deploying" })).toHaveCount(0)
  })

  test("the sidebar resizes, within limits, and remembers its width", async ({ page, isMobile }) => {
    test.skip(isMobile, "the desktop sidebar")
    await page.setViewportSize({ width: 1400, height: 900 })
    await page.goto("/docs/guides/start/")
    // The desktop inline sidebar: the only visible aside at this width.
    const aside = page.locator("aside").filter({ visible: true }).filter({
      has: page.getByRole("navigation", { name: "Main navigation" }),
    })
    const width = async () => Math.round((await aside.boundingBox())!.width)
    expect(await width()).toBe(256)

    const box = (await aside.boundingBox())!
    const grip = { x: box.x + box.width - 2, y: box.y + 200 }
    await page.mouse.move(grip.x, grip.y)
    await page.mouse.down()
    await page.mouse.move(400, grip.y, { steps: 5 })
    await page.mouse.up()
    expect(await width()).toBe(400)
    await page.reload()
    await expect.poll(width).toBe(400)

    // Clamped: at most 520px and 40% of the window (560px here).
    const box2 = (await aside.boundingBox())!
    await page.mouse.move(box2.x + box2.width - 2, grip.y)
    await page.mouse.down()
    await page.mouse.move(1100, grip.y, { steps: 5 })
    await page.mouse.up()
    expect(await width()).toBe(520)
  })

  test.describe("search", () => {
    const openSearch = async (page: Page) => {
      await page.keyboard.press("Control+k")
      await expect(page.locator("[cmdk-input]")).toBeVisible()
    }
    const results = (page: Page) => page.locator("[cmdk-item]")

    test("indexes headings, deep-linked, per locale", async ({ request }) => {
      const en = (await (await request.get("/api/search-index.json")).json()) as Array<Record<string, string>>
      expect(en).toContainEqual(
        expect.objectContaining({
          label: "Install docs-shell",
          page: "Getting started",
          href: "/docs/guides/start/#install-docs-shell",
          group: "docs:guides",
          kind: "heading",
        }),
      )
      expect(en).toContainEqual(expect.objectContaining({ href: "/docs/welcome/", group: "docs", kind: "page" }))
      // A `# comment` inside a code sample is not a heading.
      expect(en.some((r) => r.label.includes("not a heading"))).toBe(false)
      const fr = (await (await request.get("/api/search-index.fr.json")).json()) as Array<Record<string, string>>
      expect(fr).toContainEqual(expect.objectContaining({ label: "Invalidation", page: "Mise en cache" }))
    })

    test("a heading with inline code gets its anchor", async ({ page }) => {
      await page.goto("/docs/guides/start/")
      await expect(page.locator("h2#install-docs-shell")).toHaveText(/Install docs-shell/)
    })

    test("a link to a section opens on that section", async ({ page }) => {
      await page.setViewportSize({ width: 1280, height: 500 })
      await page.goto("/docs/guides/start/#theme-tokens")
      await expect(page.locator("h3#theme-tokens")).toBeInViewport()
    })

    test("a word in a paragraph finds its heading and lands on it", async ({ page }) => {
      await page.goto("/docs/welcome/")
      await openSearch(page)
      await page.locator("[cmdk-input]").fill("chartreuse")
      await expect(results(page)).toHaveCount(1)
      await expect(results(page).first()).toContainText("Theme tokens")
      await expect(results(page).first()).toContainText("Getting started")
      await expect(results(page).first()).toContainText("chartreuse primary")
      await results(page).first().click()
      await expect(page).toHaveURL(/\/docs\/guides\/start\/#theme-tokens$/)
      await expect(page.locator("h3#theme-tokens")).toBeInViewport()
    })

    test("searches the active language", async ({ page }) => {
      await page.goto("/docs/welcome/")
      await openSearch(page)
      await page.locator("[cmdk-input]").fill("purge")
      await expect(page.getByText("No results found.")).toBeVisible()
      await page.keyboard.press("Escape")
      await page.getByRole("button", { name: "Cycle language" }).click()
      await openSearch(page)
      await page.locator("[cmdk-input]").fill("purge")
      await expect(results(page).first()).toContainText("Invalidation")
      await expect(results(page).first()).toContainText("Mise en cache")
    })

    test("filters by section once results span several", async ({ page }) => {
      await page.goto("/")
      await openSearch(page)
      await page.locator("[cmdk-input]").fill("page")
      const chips = page.getByRole("group", { name: "Filter results" })
      await expect(chips.getByRole("button", { name: /Documentation/ })).toBeVisible()
      await chips.getByRole("button", { name: /User guide/ }).click()
      await expect(page.locator("[cmdk-group-heading]")).toHaveText(["User guide"])
      // The active chip toggles back to everything.
      await chips.getByRole("button", { name: /User guide/ }).click()
      await expect(page.locator("[cmdk-group-heading]")).toHaveCount(2)
    })
  })

  test("no horizontal scrolling", async ({ page, isMobile }) => {
    for (const url of ["/", "/docs/guides/", "/docs/guides/advanced/caching/"]) {
      await page.goto(url)
      expect(await horizontalOverflow(page), url).toBeLessThanOrEqual(0)
    }
    if (isMobile) {
      await page.getByRole("button", { name: "Toggle menu" }).click()
      await expect(page.getByRole("link", { name: "Deploying" }).first()).toBeVisible()
      expect(await horizontalOverflow(page), "open mobile menu").toBeLessThanOrEqual(0)
      await page.getByRole("button", { name: "Toggle menu" }).click()
      // The open search, with section chips and long excerpts.
      await page.getByRole("button", { name: "Search", exact: true }).click()
      await page.locator("[cmdk-input]").fill("the")
      await expect(page.locator("[cmdk-item]").first()).toBeVisible()
      expect(await horizontalOverflow(page), "open search").toBeLessThanOrEqual(0)
      const dialog = await page.getByRole("dialog").boundingBox()
      expect(dialog!.width, "search dialog width").toBeLessThanOrEqual(page.viewportSize()!.width)
    }
  })
})
