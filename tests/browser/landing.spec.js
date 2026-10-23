/* ==========================================================================
   Dynanca — landing page / catalog behaviour (Playwright + Chromium)
   -------------------------------------------------------------------------
   Every test drives the page the way a person would (type, click, keys,
   Back) and asserts on what is visible and on real URLs/requests — not on
   the presence of CSS strings. Expected values come from the manifest and
   the availability index through tests/browser/support.js.

   Run with:  npm run test:browser
   ========================================================================== */
"use strict";

const { test, expect } = require("@playwright/test");
const S = require("./support.js");

let server;
let baseURL;

test.beforeAll(async () => {
  ({ server, baseURL } = await S.startServer());
});
test.afterAll(async () => {
  await S.stopServer(server);
});

const summary = (page) => page.locator("#resultSummary");
const cards = (page) => page.locator("#bankGrid > li.bank");

// ---------------------------------------------------------------------------
// First view: branding, guidance, requests
// ---------------------------------------------------------------------------
test.describe("Landing — first view", () => {
  test("serves the real CSP, loads cleanly, and produces zero CSP violations or errors", async ({ page }) => {
    const problems = await S.watch(page);
    const response = await S.openLanding(page, baseURL);
    const csp = response.headers()["content-security-policy"];
    expect(csp).toContain("default-src 'self'");
    expect(csp).toContain("style-src 'self' 'unsafe-inline'");
    expect(csp).not.toMatch(/style-src[^;]*sha256-/);
    expect(csp).not.toMatch(/unsafe-eval/);
    await expect(cards(page).first()).toBeVisible();
    await page.waitForLoadState("networkidle");
    expect(await problems.collect()).toEqual(S.CLEAN);
  });

  for (const viewport of [{ width: 1280, height: 800 }, { width: 390, height: 844 }, { width: 320, height: 640 }]) {
    test(`official logo is loaded, undistorted and inside the first viewport at ${viewport.width}px`, async ({ page }) => {
      await page.setViewportSize(viewport);
      await S.openLanding(page, baseURL);
      const logo = page.locator("header img.brand__logo");
      await expect(logo).toBeVisible();
      const info = await logo.evaluate((img) => {
        const r = img.getBoundingClientRect();
        const cs = getComputedStyle(img);
        return {
          complete: img.complete, naturalWidth: img.naturalWidth, naturalHeight: img.naturalHeight,
          src: img.currentSrc, w: r.width, h: r.height, top: r.top, bottom: r.bottom, left: r.left, right: r.right,
          filter: cs.filter, objectFit: cs.objectFit, opacity: cs.opacity, loading: img.getAttribute("loading"),
        };
      });
      expect(info.complete).toBe(true);
      expect(info.naturalWidth).toBe(846);
      expect(info.naturalHeight).toBe(168);
      expect(info.src).toMatch(/assets\/img\/logo-dynanca\.png$/);
      // Aspect ratio preserved (never stretched): rendered ratio == intrinsic ratio.
      expect(Math.abs(info.w / info.h - 846 / 168)).toBeLessThan(0.02);
      // Large enough for the tagline to be legible, fully inside the first viewport.
      expect(info.h).toBeGreaterThanOrEqual(44);
      expect(info.top).toBeGreaterThanOrEqual(0);
      expect(info.bottom).toBeLessThanOrEqual(viewport.height);
      expect(info.left).toBeGreaterThanOrEqual(0);
      expect(info.right).toBeLessThanOrEqual(viewport.width);
      // Never recoloured, inverted, faded or lazy-loaded.
      expect(info.filter).toBe("none");
      expect(info.opacity).toBe("1");
      expect(info.loading).toBeNull();
    });
  }

  test("in dark mode the unmodified logo sits on a light plate", async ({ page }) => {
    await page.emulateMedia({ colorScheme: "dark" });
    await S.openLanding(page, baseURL);
    await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
    const plate = await page.locator(".brand__plate").evaluate((el) => getComputedStyle(el).backgroundColor);
    const [r, g, b] = plate.match(/\d+/g).map(Number);
    expect(Math.min(r, g, b)).toBeGreaterThan(230); // light surface behind the dark wordmark
    expect(await page.locator("img.brand__logo").evaluate((img) => getComputedStyle(img).filter)).toBe("none");
  });

  test("one h1, a sensible heading order, landmarks and a working skip link", async ({ page }) => {
    await S.openLanding(page, baseURL);
    await expect(page.locator("h1")).toHaveCount(1);
    await expect(page.locator("h1")).toHaveText("Build understanding, one question at a time.");
    const levels = await page.locator("h1, h2, h3").evaluateAll((hs) => hs.filter((h) => h.getClientRects().length).map((h) => Number(h.tagName[1])));
    expect(levels[0]).toBe(1);
    for (let i = 1; i < levels.length; i++) expect(levels[i] - levels[i - 1]).toBeLessThanOrEqual(1); // never skips a level going down
    await expect(page.getByRole("banner")).toBeVisible();
    await expect(page.getByRole("main")).toBeVisible();
    await expect(page.getByRole("contentinfo")).toBeVisible();
    await expect(page.getByRole("navigation", { name: "Main" })).toBeVisible();
    await expect(page.getByRole("search", { name: "Find a practice bank" })).toBeVisible();

    await page.keyboard.press("Tab");
    const skip = page.getByRole("link", { name: "Skip to main content" });
    await expect(skip).toBeFocused();
    await expect(skip).toBeInViewport();
    await page.keyboard.press("Enter");
    await expect(page.locator("#main")).toBeFocused();
  });

  test("the primary action 'Browse practice' lands on the catalog, not hidden under the sticky header", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 720 });
    await S.openLanding(page, baseURL);
    await page.getByRole("link", { name: "Browse practice" }).click();
    await expect(page).toHaveURL(/#catalog$/);
    const heading = page.getByRole("heading", { name: "Practice catalog" });
    await expect(heading).toBeInViewport();
    await page.waitForFunction(() => {
      const h = document.getElementById("catalogTitle").getBoundingClientRect();
      const head = document.getElementById("siteHead").getBoundingClientRect();
      return h.top >= head.bottom - 0.5 && h.top < window.innerHeight / 2;
    });
    // The search box is usable straight away.
    await expect(page.getByLabel("Search banks")).toBeInViewport();
  });

  test("'How it works' navigation reaches four real steps and names only features that exist", async ({ page }) => {
    await S.openLanding(page, baseURL);
    await page.getByRole("navigation", { name: "Main" }).getByRole("link", { name: "How it works" }).click();
    const how = page.locator("#how-it-works");
    await expect(how).toBeInViewport();
    await expect(how.locator("ol > li")).toHaveCount(4);
    await expect(how).toContainText("hint");
    await expect(how).toContainText("explanation");
    await expect(how).toContainText("review");
  });

  test("all collections are rendered from the manifest, in manifest order, with index-backed counts", async ({ page }) => {
    await S.openLanding(page, baseURL);
    const names = await page.locator("#collectionGrid .collection-card__name").allTextContents();
    expect(names).toEqual(S.manifest.subjects.map((s) => s.name));
    expect(names.length).toBe(S.manifest.subjects.length);
    for (const collection of S.catalog.collections) {
      const card = page.locator(`#collectionGrid a[data-collection="${collection.key}"]`);
      const banks = `${collection.total.toLocaleString("en-US")} ${collection.total === 1 ? "bank" : "banks"}`;
      const expected = collection.available === collection.total
        ? `${banks} available`
        : `${collection.available.toLocaleString("en-US")} of ${banks} available`;
      await expect(card.locator(".collection-card__count")).toHaveText(expected);
    }
    // Headline numbers: what can be OPENED, never the larger "listed" total.
    await expect(page.locator("#facts")).toContainText(S.catalog.totals.available.toLocaleString("en-US"));
    await expect(page.locator("#facts")).toContainText(S.catalog.totals.verifiedQuestions.toLocaleString("en-US"));
    if (S.catalog.totals.listedQuestions !== S.catalog.totals.verifiedQuestions) {
      await expect(page.locator("#facts")).not.toContainText(S.catalog.totals.listedQuestions.toLocaleString("en-US"));
    }
  });

  test("opening the landing fetches two small data files — no question bank, no probe per bank, no engine, no MathJax", async ({ page }) => {
    const requests = [];
    page.on("request", (req) => requests.push({ url: new URL(req.url()).pathname, method: req.method() }));
    await S.openLanding(page, baseURL);
    await page.waitForLoadState("networkidle");
    const paths = requests.map((r) => r.url);
    expect(paths.filter((p) => p.startsWith("/questions/"))).toEqual([]);
    expect(paths.filter((p) => /mathjax|practice-engine|practice-state|venn-renderer|math-visuals|data-loader|shell\.js/.test(p))).toEqual([]);
    expect(requests.filter((r) => r.method !== "GET")).toEqual([]);
    expect(paths.filter((p) => p.endsWith(".json")).sort()).toEqual(["/assets/data/bank-index.json", "/master-manifest.json"]);
    expect(requests.length).toBeLessThanOrEqual(12);
    // One page of cards in the DOM — never the whole catalog.
    expect(await cards(page).count()).toBe(S.Model.PAGE_SIZE);
    expect(await page.locator("body *").count()).toBeLessThan(900);
  });

  test("with JavaScript disabled the page says so honestly and still shows the brand", async ({ browser }) => {
    const context = await browser.newContext({ javaScriptEnabled: false });
    const page = await context.newPage();
    await page.goto(baseURL + "/");
    await expect(page.locator("img.brand__logo")).toBeVisible();
    await expect(page.locator("h1")).toBeVisible();
    // Chromium renders <noscript> content when scripting is off; it is read
    // here through the element's markup because, in that mode, automation
    // locators cannot look inside <noscript>.
    const notice = await page.locator("main noscript").innerHTML();
    expect(notice).toContain("JavaScript is turned off.");
    expect(notice).toMatch(/need JavaScript to load and to check your answers/);
    // Nothing pretends to be loading, and no dead controls or dead links are shown.
    await expect(page.locator("#catalog")).toBeHidden();
    await expect(page.locator(".collections")).toBeHidden();
    await expect(page.locator(".theme-switch")).toBeHidden();
    await expect(page.locator("#resultSummary")).toBeHidden();
    await expect(page.locator('a[href="#catalog"]')).toHaveCount(2);
    for (const link of await page.locator('a[href="#catalog"]').all()) await expect(link).toBeHidden();
    await expect(page.locator(".hero__actions").getByRole("link", { name: "How it works" })).toBeVisible();
    await context.close();
  });
});

// ---------------------------------------------------------------------------
// Search, filters, pagination
// ---------------------------------------------------------------------------
test.describe("Catalog — search, filters, pagination", () => {
  test("default view: first page of AVAILABLE banks in manifest order, with canonical links", async ({ page }) => {
    await S.openLanding(page, baseURL);
    const expected = S.expectFor({});
    expect(await S.gridIds(page)).toEqual(expected.ids);
    await expect(summary(page)).toHaveText(
      `Showing 1–24 of ${expected.page.total.toLocaleString("en-US")} available banks.`
    );
    const hrefs = await page.locator("#bankGrid a.bank__link").evaluateAll((as) => as.map((a) => a.getAttribute("href")));
    expect(hrefs).toEqual(expected.ids.map((id) => "practice/index.html?quiz=" + encodeURIComponent(id)));
    // Valid interactive structure: one anchor per card, nothing nested.
    expect(await page.locator("a a, a button, button a, button button").count()).toBe(0);
    expect(await page.locator("#bankGrid > li.bank a").count()).toBe(expected.ids.length);
  });

  test("search is case-insensitive, trims input, and matches name, canonical id, collection and topic", async ({ page }) => {
    await S.openLanding(page, baseURL);
    const box = page.getByLabel("Search banks");

    await box.fill("   SET THEORY   ");
    await expect(summary(page)).toContainText("matching “SET THEORY”");
    expect(await S.gridIds(page)).toEqual(S.expectFor({ q: "SET THEORY" }).ids);
    expect(await S.gridIds(page)).toContain("mathematics-discrete-mathematics-sets-1");

    await box.fill("mathematics-discrete-mathematics-graph-1"); // an exact canonical id
    await expect(cards(page)).toHaveCount(1);
    await expect(cards(page).first()).toContainText("Graph Theory");

    await box.fill("discrete mathematics"); // a topic name from the trail
    await expect.poll(() => S.gridIds(page)).toEqual(S.expectFor({ q: "discrete mathematics" }).ids);
    expect((await S.gridIds(page)).length).toBeGreaterThanOrEqual(3);

    await box.fill("gaokao vectors"); // collection name + a word from the title
    await expect.poll(() => S.gridIds(page)).toEqual(S.expectFor({ q: "gaokao vectors" }).ids);
    for (const text of await page.locator("#bankGrid .bank__context").allTextContents()) expect(text).toBe("Math gaokao");
  });

  test("typing never steals focus, and the clear button and Escape both reset the search", async ({ page }) => {
    await S.openLanding(page, baseURL);
    const box = page.getByLabel("Search banks");
    const clear = page.getByRole("button", { name: "Clear search" });
    await expect(clear).toBeHidden();
    await box.click();
    await page.keyboard.type("alg", { delay: 60 });
    await expect(summary(page)).toContainText("“alg”");
    await expect(box).toBeFocused();
    await expect(box).toHaveValue("alg");

    await expect(clear).toBeVisible();
    await page.keyboard.press("Tab"); // the clear button is the next tab stop
    await expect(clear).toBeFocused();
    await page.keyboard.press("Enter");
    await expect(box).toHaveValue("");
    await expect(box).toBeFocused();
    await expect(summary(page)).toHaveText(/^Showing 1–24 of [\d,]+ available banks\.$/);
    await expect(page).toHaveURL(baseURL + "/");

    await page.keyboard.type("quiz");
    await expect(summary(page)).toContainText("“quiz”");
    await page.keyboard.press("Escape");
    await expect(box).toHaveValue("");
    await expect(summary(page)).not.toContainText("matching");
  });

  test("collection and topic filters come from the manifest; a flat collection shows no topic control", async ({ page }) => {
    await S.openLanding(page, baseURL);
    const collectionSelect = page.getByLabel("Collection", { exact: true });
    const topicSelect = page.getByLabel("Topic", { exact: true });
    const optionTexts = await collectionSelect.locator("option").allTextContents();
    expect(optionTexts.map((t) => t.replace(/ \([\d,]+\)$/, ""))).toEqual(["All collections"].concat(S.manifest.subjects.map((s) => s.name)));
    await expect(topicSelect).toBeHidden();

    await collectionSelect.selectOption("mathematics");
    await expect(topicSelect).toBeVisible();
    const mathematics = S.catalog.collectionByKey["mathematics"];
    const topicOptions = await topicSelect.locator("option").allTextContents();
    expect(topicOptions.map((t) => t.replace(/ \([\d,]+\)$/, ""))).toEqual(["All topics"].concat(mathematics.topics.map((t) => t.name)));
    expect(await S.gridIds(page)).toEqual(S.expectFor({ collection: "mathematics" }).ids);
    await expect(page).toHaveURL(/\?collection=mathematics$/);

    await topicSelect.selectOption("algebra");
    const algebra = S.expectFor({ collection: "mathematics", topic: "algebra" });
    expect(await S.gridIds(page)).toEqual(algebra.ids);
    await expect(summary(page)).toHaveText(`Showing 1–${algebra.page.total} of ${algebra.page.total} available banks in Mathematics › Algebra.`);
    for (const text of await page.locator("#bankGrid .bank__context").allTextContents()) expect(text).toBe("Mathematics › Algebra");

    await collectionSelect.selectOption("quiz"); // flat in the manifest
    await expect(topicSelect).toBeHidden();
    await expect(page).toHaveURL(/\?collection=quiz$/); // the stale topic is dropped
    expect(await S.gridIds(page)).toEqual(S.expectFor({ collection: "quiz" }).ids);
  });

  test("query + collection + topic + availability combine, and the count always matches what is shown", async ({ page }) => {
    await S.openLanding(page, baseURL);
    await page.getByLabel("Collection", { exact: true }).selectOption("mathematics");
    await page.getByLabel("Topic", { exact: true }).selectOption("statistics");
    await page.getByLabel("Search banks").fill("data");
    const expected = S.expectFor({ collection: "mathematics", topic: "statistics", q: "data" });
    await expect.poll(() => S.gridIds(page)).toEqual(expected.ids);
    expect(expected.ids.length).toBeGreaterThan(0);
    await expect(summary(page)).toContainText(`of ${expected.page.total} available bank`);
    await expect(summary(page)).toContainText("matching “data” in Mathematics › Statistics");
    await expect(page.getByRole("button", { name: "Reset filters" })).toBeVisible();

    await page.getByRole("button", { name: "Reset filters" }).click();
    await expect(page).toHaveURL(baseURL + "/");
    await expect(page.getByLabel("Search banks")).toHaveValue("");
    await expect(page.getByLabel("Collection", { exact: true })).toHaveValue("");
    expect(await S.gridIds(page)).toEqual(S.expectFor({}).ids);
    await expect(page.getByRole("button", { name: "Reset filters" })).toBeHidden();
  });

  test("clicking a collection card filters the catalog, marks the card current, and moves to the results", async ({ page }) => {
    await S.openLanding(page, baseURL);
    const card = page.locator('#collectionGrid a[data-collection="math gaokao"]');
    await expect(card).toHaveAttribute("href", "?collection=math%20gaokao#catalog");
    await card.click();
    await expect(page).toHaveURL(/\?collection=math%20gaokao$/);
    await expect(page.locator('#collectionGrid a[data-collection="math gaokao"]')).toHaveAttribute("aria-current", "true");
    await expect(page.locator('#collectionGrid a[aria-current="true"]')).toHaveCount(1);
    await expect(page.getByLabel("Collection", { exact: true })).toHaveValue("math gaokao");
    expect(await S.gridIds(page)).toEqual(S.expectFor({ collection: "math gaokao" }).ids);
    await expect(page.getByRole("heading", { name: "Practice catalog" })).toBeInViewport();
    await expect(summary(page)).toBeFocused();
  });

  test("the verified question count is shown (math-gaokao-71: 150 questions in the bank and in the manifest)", async ({ page }) => {
    await S.openLanding(page, baseURL, "?q=math-gaokao-71");
    const card = page.locator('#bankGrid li[data-bank-id="math-gaokao-71"]');
    await expect(card).toBeVisible();
    await expect(card.locator(".bank__count")).toHaveText("150 questions");
    expect(S.catalog.byId["math-gaokao-71"].verifiedCount).toBe(150);
    expect(S.catalog.byId["math-gaokao-71"].listedCount).toBe(150);
  });

  test("pagination: 24 per page, real links, aria-current, clamped ranges, resets when a filter changes", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await S.openLanding(page, baseURL);
    const pager = page.getByRole("navigation", { name: "Catalog pages" });
    const total = S.expectFor({}).page;
    await expect(cards(page)).toHaveCount(24);
    await expect(pager.locator('[aria-current="page"]')).toHaveText("1");
    // "Previous" on page 1 is not a link at all.
    await expect(pager.locator("a", { hasText: "Previous" })).toHaveCount(0);
    await expect(pager.locator('[aria-disabled="true"]')).toHaveText(/Previous/);
    await expect(pager.getByRole("link", { name: /Next/ })).toHaveAttribute("href", "?page=2");

    await pager.getByRole("link", { name: /Next/ }).click();
    await expect(page).toHaveURL(/\?page=2$/);
    await expect(pager.locator('[aria-current="page"]')).toHaveText("2");
    expect(await S.gridIds(page)).toEqual(S.expectFor({ page: 2 }).ids);
    await expect(summary(page)).toHaveText(`Showing 25–48 of ${total.total.toLocaleString("en-US")} available banks.`);
    await expect(summary(page)).toBeFocused();
    await expect(page.getByRole("heading", { name: "Practice catalog" })).toBeInViewport();

    // Last page: correct remainder, "Next" is not a link.
    await pager.getByRole("link", { name: `Page ${total.pageCount}`, exact: true }).click();
    const last = S.expectFor({ page: total.pageCount });
    expect(await S.gridIds(page)).toEqual(last.ids);
    await expect(summary(page)).toContainText(`–${total.total.toLocaleString("en-US")} of ${total.total.toLocaleString("en-US")}`);
    await expect(pager.locator("a", { hasText: "Next" })).toHaveCount(0);

    // A new filter can never leave the view on a page that no longer exists.
    await page.getByLabel("Search banks").fill("sets");
    await expect(page).toHaveURL(/\?q=sets$/);
    await expect(summary(page)).toContainText("Showing 1");
  });

  test("an out-of-range or malformed page / unknown filter in the URL is corrected to a valid view", async ({ page }) => {
    const algebra = S.expectFor({ collection: "mathematics", topic: "algebra" });
    await S.openLanding(page, baseURL, "?collection=mathematics&topic=algebra&page=9999");
    expect(await S.gridIds(page)).toEqual(algebra.ids);
    await expect(page).toHaveURL(/\?collection=mathematics&topic=algebra$/);

    await S.openLanding(page, baseURL, "?collection=nope&topic=x&page=abc&show=maybe&q=%E0%A4%A");
    expect(await S.gridIds(page)).toEqual(S.expectFor({}).ids);
    await expect(page).toHaveURL(baseURL + "/");
  });

  test("on a phone the pager is Previous / 'Page X of Y' / Next with comfortable targets", async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 740 });
    await S.openLanding(page, baseURL);
    const pager = page.getByRole("navigation", { name: "Catalog pages" });
    await expect(pager.locator(".pager__status")).toHaveText(`Page 1 of ${S.expectFor({}).page.pageCount}`);
    await expect(pager.locator(".pager__list")).toBeHidden();
    const next = pager.getByRole("link", { name: /Next/ });
    const box = await next.boundingBox();
    expect(box.height).toBeGreaterThanOrEqual(44);
    await next.click();
    await expect(pager.locator(".pager__status")).toContainText("Page 2 of");
    await expect(page).toHaveURL(/\?page=2$/);
  });
});

// ---------------------------------------------------------------------------
// Availability: listed vs. available
// ---------------------------------------------------------------------------
test.describe("Catalog — availability", () => {
  test("'Available' and 'All banks' are two clearly different counts taken from the data", async ({ page }) => {
    await S.openLanding(page, baseURL);
    await expect(page.locator("#countAvailable")).toHaveText(S.catalog.totals.available.toLocaleString("en-US"));
    await expect(page.locator("#countAll")).toHaveText(S.catalog.totals.listed.toLocaleString("en-US"));
    await expect(page.getByRole("radio", { name: /^Available/ })).toBeChecked();
    if (S.unavailableEntries.length) {
      await expect(page.locator("#catalogScope")).toHaveText(
        `${S.catalog.totals.available.toLocaleString("en-US")} of ${S.catalog.totals.listed.toLocaleString("en-US")} listed banks are available in this release.`
      );
    }
  });

  test("a bank that is not shipped has no link, no Start action, and says 'Not available in this release'", async ({ page }) => {
    const pendingFixture = await S.unavailableFixture(page);
    const target = pendingFixture.target;
    await S.openLanding(page, baseURL, "?show=all&q=" + encodeURIComponent(target.id));
    const card = page.locator(`#bankGrid li[data-bank-id="${target.id}"]`);
    await expect(card).toBeVisible();
    await expect(card).toHaveAttribute("data-available", "false");
    await expect(card.locator(".badge")).toHaveText("Not available in this release");
    await expect(card.locator(".bank__title")).toHaveText(target.name);
    // Nothing to click, tab to, or open from a context menu.
    expect(await card.locator("a, button, [href], [tabindex], [role='link'], [onclick]").count()).toBe(0);
    await expect(card.getByText(/Start practice|Continue practice/)).toHaveCount(0);
    // The listed count is labelled as listed, not presented as verified.
    await expect(card.locator(".bank__count")).toHaveText(/ listed$/);
    // No promise of a date.
    await expect(card).not.toContainText(/soon|coming|\b20\d\d\b/i);
  });

  test("switching to 'All banks' with the keyboard shows listed banks; the summary separates the two numbers", async ({ page }) => {
    const pendingFixture = await S.unavailableFixture(page);
    await S.openLanding(page, baseURL, "?collection=comprehensive%20math");
    const before = pendingFixture.expectFor({ collection: "comprehensive math" });
    await expect(summary(page)).toContainText(`of ${before.page.total.toLocaleString("en-US")} available banks in Comprehensive math`);
    await expect(page.locator("#resultsNote")).toContainText(
      `${before.result.matchedUnavailable.toLocaleString("en-US")} more matching ${before.result.matchedUnavailable === 1 ? "bank is" : "banks are"} listed but not available in this release.`
    );

    await page.getByRole("radio", { name: /^Available/ }).focus();
    await page.keyboard.press("ArrowRight"); // native radio group behaviour
    await expect(page.getByRole("radio", { name: /^All banks/ })).toBeChecked();
    await expect(page).toHaveURL(/\?collection=comprehensive%20math&show=all$/);
    const all = pendingFixture.expectFor({ collection: "comprehensive math", show: "all" });
    await expect(summary(page)).toHaveText(
      `Showing 1–24 of ${all.page.total.toLocaleString("en-US")} banks in Comprehensive math (${all.result.matchedAvailable.toLocaleString("en-US")} available, ${all.result.matchedUnavailable.toLocaleString("en-US")} not available in this release).`
    );
    await expect(page.locator("#resultsNote")).toBeHidden();
    await expect(page.getByLabel("Collection", { exact: true }).locator("option:checked")).toHaveText(`Comprehensive math (${all.page.total.toLocaleString("en-US")})`);

    // The page where shipped and not-yet-shipped banks meet shows both states side by side.
    const boundary = Math.ceil(all.result.matchedAvailable / S.Model.PAGE_SIZE);
    await S.openLanding(page, baseURL, `?collection=comprehensive%20math&show=all&page=${boundary}`);
    const flags = await cards(page).evaluateAll((nodes) => nodes.map((n) => n.getAttribute("data-available")));
    expect(flags).toEqual(pendingFixture.expectFor({ collection: "comprehensive math", show: "all", page: boundary }).page.items.map((e) => String(e.available)));
    expect(await page.locator("#bankGrid li[data-available='false'] a").count()).toBe(0);
    expect(await page.locator("#bankGrid li[data-available='true'] a.bank__link").count()).toBe(flags.filter((f) => f === "true").length);
  });

  test("searching for a listed-but-unavailable bank explains why nothing shows and offers 'Show all banks'", async ({ page }) => {
    const pendingFixture = await S.unavailableFixture(page);
    const target = pendingFixture.target;
    await S.openLanding(page, baseURL);
    await page.getByLabel("Search banks").fill(target.id);
    await expect(summary(page)).toHaveText(`No available banks matching “${target.id}”.`);
    const panel = page.locator("#catalogPanel .panel");
    await expect(panel.getByRole("heading", { name: "No available banks match" })).toBeVisible();
    await expect(panel).toContainText("not available in this release");
    await expect(cards(page)).toHaveCount(0);
    await expect(page.getByRole("navigation", { name: "Catalog pages" })).toBeHidden();

    await panel.getByRole("button", { name: "Show all banks" }).click();
    await expect(page.locator(`#bankGrid li[data-bank-id="${target.id}"]`)).toBeVisible();
    await expect(page.getByRole("radio", { name: /^All banks/ })).toBeChecked();
    await expect(page).toHaveURL(new RegExp("show=all"));
  });
});

// ---------------------------------------------------------------------------
// Empty / loading / error states
// ---------------------------------------------------------------------------
test.describe("Catalog — empty, loading and failure states", () => {
  test("no results: a clear reason, working 'Clear search' and 'Reset filters', no leftover pager", async ({ page }) => {
    await S.openLanding(page, baseURL, "?collection=quiz&show=all");
    await page.getByLabel("Search banks").fill("zzqqxx-nothing");
    await expect(summary(page)).toHaveText("No banks matching “zzqqxx-nothing” in Quiz.");
    const panel = page.locator("#catalogPanel .panel");
    await expect(panel.getByRole("heading", { name: "No banks match" })).toBeVisible();
    await expect(panel).toContainText("Search looks at bank names, IDs, collections and topics");
    await expect(cards(page)).toHaveCount(0);
    await expect(page.locator("#bankGrid")).toBeHidden();
    await expect(page.getByRole("navigation", { name: "Catalog pages" })).toBeHidden();

    await panel.getByRole("button", { name: "Clear search" }).click();
    await expect(page.getByLabel("Search banks")).toHaveValue("");
    await expect(page.getByLabel("Search banks")).toBeFocused();
    expect(await S.gridIds(page)).toEqual(S.expectFor({ collection: "quiz", show: "all" }).ids);

    await page.getByLabel("Search banks").fill("zzqqxx-nothing");
    await page.locator("#catalogPanel").getByRole("button", { name: "Reset filters" }).click();
    await expect(page).toHaveURL(baseURL + "/");
    expect(await S.gridIds(page)).toEqual(S.expectFor({}).ids);
  });

  test("a failed catalog request ends in a readable error with a working 'Try again' — never a permanent spinner", async ({ page }) => {
    let block = true;
    await page.route("**/master-manifest.json", (route) => (block ? route.abort("connectionrefused") : route.continue()));
    await page.goto(baseURL + "/");
    const alert = page.getByRole("alert");
    await expect(alert.getByRole("heading", { name: "The practice catalog could not be loaded" })).toBeVisible();
    await expect(alert).toContainText("Check your internet connection, then try again.");
    await expect(page.locator("body")).not.toContainText(/console|developer tools|F12/i);
    // The alert is the single announcement; controls that cannot act are gone.
    await expect(summary(page)).toBeHidden();
    await expect(page.locator("#bankGrid .skeleton")).toHaveCount(0);
    await expect(page.getByLabel("Search banks")).toBeHidden();
    await expect(page.getByRole("navigation", { name: "Catalog pages" })).toBeHidden();
    await expect(page.locator(".collections")).toBeHidden();
    // Brand, guidance and theme still work while the data is unavailable.
    await expect(page.locator("img.brand__logo")).toBeVisible();
    await page.getByRole("button", { name: "Dark" }).click();
    await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");

    block = false;
    await alert.getByRole("button", { name: "Try again" }).click();
    await expect(cards(page).first()).toBeVisible();
    await expect(page.getByRole("alert")).toHaveCount(0);
    await expect(page.getByLabel("Search banks")).toBeEnabled();
    await expect(page.locator(".collections")).toBeVisible();
    expect(await S.gridIds(page)).toEqual(S.expectFor({}).ids);
  });

  test("a request that never answers hits the deadline; a late answer from it can never overwrite the retry", async ({ page }) => {
    await page.clock.install();
    const held = [];
    let hold = true;
    await page.route("**/master-manifest.json", (route) => {
      if (hold) held.push(route); // never answered
      else route.continue();
    });
    await page.goto(baseURL + "/");
    await expect(summary(page)).toHaveText("Loading the practice catalog…");
    await expect(page.getByLabel("Search banks")).toBeDisabled(); // visible but inactive while loading
    await page.clock.fastForward(16000); // past the 15 s deadline
    const alert = page.getByRole("alert");
    await expect(alert.getByRole("heading", { name: "The practice catalog is taking too long to load" })).toBeVisible();
    await expect(page.locator("#bankGrid .skeleton")).toHaveCount(0);

    hold = false;
    await alert.getByRole("button", { name: "Try again" }).click();
    await expect(cards(page).first()).toBeVisible();
    const good = await S.gridIds(page);
    expect(good).toEqual(S.expectFor({}).ids);

    // The superseded request finally "answers" with different data.
    for (const route of held) {
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ subjects: [] }) }).catch(() => {});
    }
    await page.clock.fastForward(1000);
    expect(await S.gridIds(page)).toEqual(good);
    await expect(page.getByRole("alert")).toHaveCount(0);
  });

  for (const [name, body] of [
    ["truncated JSON", '{"schemaVersion":"1.0","subjects":[{"id":"x"'],
    ["wrong shape (subjects is not an array)", JSON.stringify({ schemaVersion: "1.0", subjects: "nope" })],
    ["an HTML page instead of JSON", "<!doctype html><title>Oops</title>"],
  ]) {
    test(`a malformed manifest (${name}) is reported as a recoverable error`, async ({ page }) => {
      let broken = true;
      await page.route("**/master-manifest.json", (route) =>
        broken ? route.fulfill({ status: 200, contentType: "application/json", body }) : route.continue()
      );
      const errors = [];
      page.on("pageerror", (e) => errors.push(String(e)));
      await page.goto(baseURL + "/");
      const alert = page.getByRole("alert");
      await expect(alert.getByRole("heading", { name: "The practice catalog did not load correctly" })).toBeVisible();
      await expect(cards(page)).toHaveCount(0);
      expect(errors).toEqual([]); // handled, not an uncaught exception
      broken = false;
      await alert.getByRole("button", { name: "Try again" }).click();
      await expect(cards(page).first()).toBeVisible();
    });
  }

  test("a missing or malformed availability index is an error with retry — never a guess about what can be opened", async ({ page }) => {
    let mode = "missing";
    await page.route("**/assets/data/bank-index.json", (route) => {
      if (mode === "missing") return route.fulfill({ status: 404, contentType: "text/html", body: "Not found" });
      if (mode === "malformed") return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ available: [] }) });
      return route.continue();
    });
    await page.goto(baseURL + "/");
    await expect(page.getByRole("alert").getByRole("heading", { name: "The practice catalog could not be loaded" })).toBeVisible();
    await expect(page.locator("#bankGrid a")).toHaveCount(0);

    mode = "malformed";
    await page.getByRole("button", { name: "Try again" }).click();
    await expect(page.getByRole("alert").getByRole("heading", { name: "The practice catalog did not load correctly" })).toBeVisible();

    mode = "ok";
    await page.getByRole("button", { name: "Try again" }).click();
    await expect(cards(page).first()).toBeVisible();
  });

  test("an empty manifest shows an honest empty state", async ({ page }) => {
    await page.route("**/master-manifest.json", (route) =>
      route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ schemaVersion: "1.0", manifestType: "dynanca-master", subjects: [] }) })
    );
    await page.goto(baseURL + "/");
    await expect(page.getByRole("status").getByRole("heading", { name: "No practice banks are listed yet" })).toBeVisible();
    await expect(summary(page)).toBeHidden();
    await expect(page.getByLabel("Search banks")).toBeHidden();
    await expect(cards(page)).toHaveCount(0);
    await expect(page.locator("#bankGrid .skeleton")).toHaveCount(0);
    await expect(page.getByRole("alert")).toHaveCount(0);
  });
});

// ---------------------------------------------------------------------------
// Generic rendering: other manifest shapes and hostile text (fixtures are
// served to the test browser only — nothing is written to the project)
// ---------------------------------------------------------------------------
test.describe("Catalog — manifest shapes and untrusted text", () => {
  const pf = (id, name, count) => ({ id, name, file: id + ".json", path: "questions/fx/" + id + ".json", questionCount: count });
  const fixtureManifest = {
    schemaVersion: "1.0", manifestType: "dynanca-master",
    subjects: [
      { id: "robotics", name: "Robotics", practice_files: [pf("rob-direct", "Robotics Direct Bank", 5)],
        topics: [{ id: "kinematics", name: "Kinematics", practice_files: [pf("rob-kin-1", "Forward Kinematics", 7)],
          subtopics: [{ id: "inverse", name: "Inverse", practice_files: [pf("rob-kin-inv-1", "Inverse Kinematics Drills", 9)] }] }] },
      { id: "flat one", name: "Flat & <Plain>", practice_files: [pf("flat-1", "Flat bank one", 3), pf("flat-2", "Flat bank two", 4)] },
    ],
  };
  const fixtureIndex = { schemaVersion: "1.0", summary: { listedBanks: 5 }, available: { "rob-direct": 5, "rob-kin-1": 7, "rob-kin-inv-1": 12, "flat-1": 3 } };

  async function serveFixture(page, manifestBody, indexBody) {
    await page.route("**/master-manifest.json", (route) => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(manifestBody) }));
    await page.route("**/assets/data/bank-index.json", (route) => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(indexBody) }));
  }

  test("a never-seen collection with direct files, a topic and a subtopic renders through the same generic UI", async ({ page }) => {
    await serveFixture(page, fixtureManifest, fixtureIndex);
    await S.openLanding(page, baseURL);
    expect(await page.locator("#collectionGrid .collection-card__name").allTextContents()).toEqual(["Robotics", "Flat & <Plain>"]);
    expect(await S.gridIds(page)).toEqual(["rob-direct", "rob-kin-1", "rob-kin-inv-1", "flat-1"]);
    await expect(page.locator('li[data-bank-id="rob-kin-inv-1"] .bank__context')).toHaveText("Robotics › Kinematics › Inverse");
    await expect(page.locator('li[data-bank-id="rob-kin-inv-1"] .bank__count')).toHaveText("12 questions");
    await expect(page.locator('li[data-bank-id="rob-direct"] .bank__context')).toHaveText("Robotics");

    await page.getByLabel("Collection", { exact: true }).selectOption("robotics");
    const topic = page.getByLabel("Topic", { exact: true });
    expect(await topic.locator("option").allTextContents()).toEqual([
      "All topics (3)", "Not in a topic (1)", "Kinematics (2)", "— Inverse (1)",
    ]);
    await topic.selectOption("kinematics"); // a parent topic includes its subtopics
    expect(await S.gridIds(page)).toEqual(["rob-kin-1", "rob-kin-inv-1"]);
    await topic.selectOption("kinematics/inverse");
    expect(await S.gridIds(page)).toEqual(["rob-kin-inv-1"]);
    await topic.selectOption(".");
    expect(await S.gridIds(page)).toEqual(["rob-direct"]);
    await expect(page).toHaveURL(/\?collection=robotics&topic=\.$/);

    await page.getByLabel("Collection", { exact: true }).selectOption("flat one");
    await expect(topic).toBeHidden();
    expect(await S.gridIds(page)).toEqual(["flat-1"]);
  });

  test("markup in manifest names is shown as text and never executed", async ({ page }) => {
    const hostile = JSON.parse(JSON.stringify(fixtureManifest));
    hostile.subjects[0].name = '<img src=x onerror="window.__xss=1">Robotics';
    hostile.subjects[0].topics[0].name = "<script>window.__xss=2</script>";
    hostile.subjects[0].practice_files[0].name = '<svg onload="window.__xss=3"></svg><b>Bold?</b>';
    hostile.subjects[0].practice_files[0].id = 'x" onmouseover="window.__xss=4';
    const index = { available: { 'x" onmouseover="window.__xss=4': 5, "rob-kin-1": 7 } };
    await serveFixture(page, hostile, index);
    await S.openLanding(page, baseURL);
    await page.getByLabel("Collection", { exact: true }).selectOption({ index: 1 });
    const card = cards(page).first();
    await expect(card.locator(".bank__title")).toHaveText('<svg onload="window.__xss=3"></svg><b>Bold?</b>');
    await card.hover();
    expect(await page.evaluate(() => window.__xss)).toBeUndefined();
    expect(await page.locator("#bankGrid img, #bankGrid svg, #bankGrid b, #bankGrid script, #collectionGrid img, #collection script").count()).toBe(0);
    // The odd id still round-trips exactly through the canonical link.
    const href = await card.locator("a.bank__link").getAttribute("href");
    expect(href).toBe("practice/index.html?quiz=" + encodeURIComponent('x" onmouseover="window.__xss=4'));
  });
});

// ---------------------------------------------------------------------------
// URL state, history, returning from practice
// ---------------------------------------------------------------------------
test.describe("Catalog — URL state and history", () => {
  test("a deep link restores query, collection, topic, availability and page", async ({ page }) => {
    const raw = { q: "algebra", collection: "mathematics", topic: "algebra", show: "all", page: 1 };
    await S.openLanding(page, baseURL, "?q=algebra&collection=mathematics&topic=algebra&show=all");
    expect(await S.gridIds(page)).toEqual(S.expectFor(raw).ids);
    await expect(page.getByLabel("Search banks")).toHaveValue("algebra");
    await expect(page.getByLabel("Collection", { exact: true })).toHaveValue("mathematics");
    await expect(page.getByLabel("Topic", { exact: true })).toHaveValue("algebra");
    await expect(page.getByRole("radio", { name: /^All banks/ })).toBeChecked();
    await page.reload();
    await page.waitForFunction(() => !/Loading/.test(document.getElementById("resultSummary").textContent));
    expect(await S.gridIds(page)).toEqual(S.expectFor(raw).ids);
  });

  test("browser Back and Forward step through filter and page changes", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await S.openLanding(page, baseURL);
    await page.getByLabel("Collection", { exact: true }).selectOption("math gaokao");
    await expect(page).toHaveURL(/\?collection=math%20gaokao$/);
    await page.getByRole("navigation", { name: "Catalog pages" }).getByRole("link", { name: "Page 3", exact: true }).click();
    await expect(page).toHaveURL(/collection=math%20gaokao&page=3$/);
    expect(await S.gridIds(page)).toEqual(S.expectFor({ collection: "math gaokao", page: 3 }).ids);

    await page.goBack();
    await expect(page).toHaveURL(/\?collection=math%20gaokao$/);
    await expect.poll(() => S.gridIds(page)).toEqual(S.expectFor({ collection: "math gaokao" }).ids);
    await expect(page.getByLabel("Collection", { exact: true })).toHaveValue("math gaokao");

    await page.goBack();
    await expect(page).toHaveURL(baseURL + "/");
    await expect.poll(() => S.gridIds(page)).toEqual(S.expectFor({}).ids);
    await expect(page.getByLabel("Collection", { exact: true })).toHaveValue("");

    await page.goForward();
    await page.goForward();
    await expect(page).toHaveURL(/collection=math%20gaokao&page=3$/);
    await expect.poll(() => S.gridIds(page)).toEqual(S.expectFor({ collection: "math gaokao", page: 3 }).ids);
    await expect(page.getByRole("navigation", { name: "Catalog pages" }).locator('[aria-current="page"]')).toHaveText("3");
  });

  test("typing in the search box does not flood the history: one Back leaves the search", async ({ page }) => {
    await S.openLanding(page, baseURL);
    await page.getByLabel("Collection", { exact: true }).selectOption("quiz");
    await page.getByLabel("Search banks").pressSequentially("quiz - 1", { delay: 40 });
    await expect(page).toHaveURL(/\?q=quiz%20-%201&collection=quiz$/);
    await page.goBack();
    await expect(page).toHaveURL(baseURL + "/");
  });

  test("returning from a practice page (browser Back, and the page's own back link) restores the same catalog view", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    const raw = { collection: "quiz", q: "quiz", page: 2 };
    const expected = S.expectFor(raw);
    await S.openLanding(page, baseURL, "?q=quiz&collection=quiz&page=2");
    expect(await S.gridIds(page)).toEqual(expected.ids);

    const target = cards(page).nth(7);
    const targetId = await target.getAttribute("data-bank-id");
    await target.scrollIntoViewIfNeeded();
    const scrollBefore = await page.evaluate(() => window.scrollY);
    expect(scrollBefore).toBeGreaterThan(200);
    await target.locator("a.bank__link").click();
    await expect(page).toHaveURL(S.practiceUrl(baseURL, targetId));
    await expect(page.locator(".practice-question").first()).toBeVisible();

    // The practice page's own link returns to the same search/filter/page.
    const back = page.getByRole("link", { name: /Practice catalog/ });
    await expect(back).toHaveAttribute("href", "../?q=quiz&collection=quiz&page=2#catalog");

    // 1) Browser Back: same URL, same cards, scroll position restored.
    await page.goBack();
    await expect(page).toHaveURL(/\?q=quiz&collection=quiz&page=2$/);
    await expect.poll(() => S.gridIds(page)).toEqual(expected.ids);
    await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(scrollBefore - 150);
    expect(await page.evaluate(() => window.scrollY)).toBeLessThan(scrollBefore + 150);

    // 2) The in-page back link: same filters, positioned at the catalog.
    await page.goForward();
    await expect(page.locator(".practice-question").first()).toBeVisible();
    await page.getByRole("link", { name: /Practice catalog/ }).click();
    await expect(page).toHaveURL(/\?q=quiz&collection=quiz&page=2#catalog$/);
    await expect.poll(() => S.gridIds(page)).toEqual(expected.ids);
    await expect(page.getByRole("heading", { name: "Practice catalog" })).toBeInViewport();
  });

  test("a bank link is a normal link: it can be opened in a new tab and the catalog stays put", async ({ page, context }) => {
    await S.openLanding(page, baseURL, "?collection=comprehensive%20math");
    const first = cards(page).first();
    const id = await first.getAttribute("data-bank-id");
    const [popup] = await Promise.all([
      context.waitForEvent("page"),
      first.locator("a.bank__link").click({ modifiers: ["ControlOrMeta"] }),
    ]);
    await popup.waitForURL(S.practiceUrl(baseURL, id));
    await expect(popup.locator(".practice-question").first()).toBeVisible();
    await expect(page).toHaveURL(/\?collection=comprehensive%20math$/);
    await popup.close();
  });
});

// ---------------------------------------------------------------------------
// Theme
// ---------------------------------------------------------------------------
test.describe("Theme", () => {
  test("defaults to the system setting and follows a live system change", async ({ page }) => {
    await page.emulateMedia({ colorScheme: "light" });
    await S.openLanding(page, baseURL);
    await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
    await expect(page.getByRole("button", { name: "System" })).toHaveAttribute("aria-pressed", "true");
    const lightBg = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
    await page.emulateMedia({ colorScheme: "dark" }); // the OS switches while the page is open
    await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
    const darkBg = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
    expect(darkBg).not.toBe(lightBg);
    await page.emulateMedia({ colorScheme: "light" });
    await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
  });

  test("an explicit choice persists under the existing key and carries to the practice page and back", async ({ page }) => {
    await page.emulateMedia({ colorScheme: "light" });
    await S.openLanding(page, baseURL);
    await page.getByRole("button", { name: "Dark" }).click();
    await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
    await expect(page.getByRole("button", { name: "Dark" })).toHaveAttribute("aria-pressed", "true");
    await expect(page.getByRole("button", { name: "System" })).toHaveAttribute("aria-pressed", "false");
    expect(await page.evaluate(() => localStorage.getItem("dynanca-mfc-theme-mode"))).toBe("dark");
    await page.emulateMedia({ colorScheme: "light" }); // a system change must not override an explicit choice
    await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");

    await cards(page).first().locator("a.bank__link").click();
    await expect(page.locator(".practice-question").first()).toBeVisible();
    await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
    await expect(page.locator('.theme-switch__btn[data-theme-option="dark"]')).toHaveAttribute("aria-pressed", "true");

    await page.locator('.theme-switch__btn[data-theme-option="light"]').click();
    await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
    await page.goBack();
    await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
    await expect(page.getByRole("button", { name: "Light" })).toHaveAttribute("aria-pressed", "true");
  });

  test("the stored theme is applied before first paint (no flash of the wrong theme)", async ({ page }) => {
    await page.emulateMedia({ colorScheme: "light" });
    await page.addInitScript(() => { try { localStorage.setItem("dynanca-mfc-theme-mode", "dark"); } catch (e) { /* ignore */ } });
    // Hold the catalog data so the page is observed while still loading.
    await page.route("**/master-manifest.json", () => {});
    await page.goto(baseURL + "/", { waitUntil: "domcontentloaded" });
    await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
    const bg = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
    expect(bg.match(/\d+/g).map(Number).every((v) => v < 60)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Storage: denied, corrupt, and strictly read-only towards practice data
// ---------------------------------------------------------------------------
test.describe("Storage robustness", () => {
  test("with localStorage and sessionStorage denied the catalog, search and theme all still work", async ({ page }) => {
    const problems = await S.watch(page);
    await page.addInitScript(() => {
      const deny = { get() { throw new DOMException("The operation is insecure.", "SecurityError"); } };
      Object.defineProperty(window, "localStorage", deny);
      Object.defineProperty(window, "sessionStorage", deny);
    });
    await S.openLanding(page, baseURL);
    expect(await S.gridIds(page)).toEqual(S.expectFor({}).ids);
    await page.getByLabel("Search banks").fill("sets");
    await expect.poll(() => S.gridIds(page)).toEqual(S.expectFor({ q: "sets" }).ids);
    await page.getByRole("button", { name: "Dark" }).click();
    await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
    await expect(page.getByRole("button", { name: "Dark" })).toHaveAttribute("aria-pressed", "true");
    await expect(page.locator("#continue")).toBeHidden();
    const seen = await problems.collect();
    expect(seen.pageErrors).toEqual([]);
    expect(seen.console).toEqual([]);

    // The practice page copes too (in-memory fallback): a question renders.
    await page.goto(S.practiceUrl(baseURL, S.availableEntries[0].id));
    await expect(page.locator(".practice-question").first()).toBeVisible();
    expect((await problems.collect()).pageErrors).toEqual([]);
  });

  test("corrupt stored values are ignored and left exactly as found", async ({ page }) => {
    const problems = await S.watch(page);
    const seeded = {
      "dynanca-mfc-theme-mode": "<<garbage>>",
      ["dynanca-mcq-" + S.availableEntries[0].id + "-v2"]: "{not json",
      ["dynanca-mcq-session-" + S.availableEntries[0].id + "-v2"]: "[1,2",
      "gp-practice-v1": "null",
    };
    await page.addInitScript((data) => {
      if (window.name === "seeded") return; // seed once, not on every navigation
      window.name = "seeded";
      Object.keys(data).forEach((k) => localStorage.setItem(k, data[k]));
      sessionStorage.setItem("dynanca-catalog-scroll-v1", "{{{");
      sessionStorage.setItem("dynanca-catalog-return-v1", "javascript:alert(1)");
    }, seeded);
    await S.openLanding(page, baseURL);
    expect(await S.gridIds(page)).toEqual(S.expectFor({}).ids);
    await expect(page.locator("html")).toHaveAttribute("data-theme", /light|dark/);
    await expect(page.locator("#continue")).toBeHidden();
    await page.getByLabel("Search banks").fill("quiz");
    await page.reload();
    await page.waitForFunction(() => !/Loading/.test(document.getElementById("resultSummary").textContent));
    expect(await page.evaluate(() => JSON.parse(JSON.stringify(localStorage)))).toEqual(seeded);
    const seen = await problems.collect();
    expect(seen.pageErrors).toEqual([]);
    expect(seen.console).toEqual([]);
  });

  test("a hostile 'return to catalog' value in sessionStorage is never used as a link", async ({ page }) => {
    await page.addInitScript(() => {
      sessionStorage.setItem("dynanca-catalog-return-v1", "?x=1\"><script>alert(1)</script>");
    });
    await page.goto(S.practiceUrl(baseURL, S.availableEntries[0].id));
    await expect(page.getByRole("link", { name: /Practice catalog/ })).toHaveAttribute("href", "../#catalog");
  });
});

// ---------------------------------------------------------------------------
// Saved progress on the landing page (read-only)
// ---------------------------------------------------------------------------
test.describe("Continue practice (real local progress, read-only)", () => {
  test("without saved answers there is no 'Continue practice' section at all", async ({ page }) => {
    await S.openLanding(page, baseURL);
    await expect(page.locator("#continue")).toBeHidden();
    await expect(page.getByRole("heading", { name: "Continue practice" })).toHaveCount(0);
    await expect(page.locator(".bank__progress")).toHaveCount(0);
    await expect(page.locator("#bankGrid .bank__cta").first()).toHaveText(/^Start practice/);
  });

  test("answers given in a real practice session appear on the landing page, most recent first", async ({ page }) => {
    const [first, second] = [S.availableEntries.find((e) => e.collectionKey === "comprehensive math"), S.availableEntries.find((e) => e.collectionKey === "quiz")];
    for (const [entry, answers] of [[first, 2], [second, 1]]) {
      await page.goto(S.practiceUrl(baseURL, entry.id));
      for (let i = 0; i < answers; i++) {
        const question = page.locator(".practice-question").first();
        await expect(question).toBeVisible();
        await question.locator(".practice-option").first().click();
        await question.locator('[data-action="next"]').click();
      }
    }
    await S.openLanding(page, baseURL);
    const section = page.locator("#continue");
    await expect(section).toBeVisible();
    await expect(section.getByRole("heading", { name: "Continue practice" })).toBeVisible();
    await expect(section).toContainText("From answers saved in this browser on this device.");
    const items = section.locator("li.bank");
    await expect(items).toHaveCount(2);
    expect(await items.evaluateAll((n) => n.map((x) => x.getAttribute("data-bank-id")))).toEqual([second.id, first.id]);
    await expect(items.nth(0)).toContainText("1 answer saved in this browser");
    await expect(items.nth(1)).toContainText("2 answers saved in this browser");
    await expect(items.nth(1)).toContainText(/last answered \d{1,2} \w{3} \d{4}/);
    await expect(items.nth(0).locator("a.bank__link")).toHaveAttribute("href", "practice/index.html?quiz=" + encodeURIComponent(second.id));
    // The same bank in the catalog grid offers "Continue practice".
    await page.getByLabel("Search banks").fill(first.id);
    const gridCard = page.locator(`#bankGrid li[data-bank-id="${first.id}"]`);
    await expect(gridCard).toContainText("2 answers saved in this browser");
    await expect(gridCard.locator(".bank__cta")).toHaveText(/^Continue practice/);
    // And it really continues: the third question is the resume point.
    await gridCard.locator("a.bank__link").click();
    await expect(page.locator("#progressSummary")).toContainText("2 / " + first.verifiedCount);
    const resumed = await page.locator(".practice-question").first().getAttribute("data-question-id");
    expect(resumed).toBe(String(S.readBank(first.id).questions[2].id));
  });

  test("the landing page never writes, migrates or removes practice storage — every key stays byte-identical", async ({ page }) => {
    const entry = S.availableEntries.find((e) => e.collectionKey === "quiz");
    const bank = S.readBank(entry.id);
    const seeded = {
      ["dynanca-mcq-" + entry.id + "-v2"]: JSON.stringify({
        [bank.questions[0].id]: { status: "answered_correct", selectedLabel: "A", answeredAt: 1750000000000, category: "x" },
        [bank.questions[1].id]: { status: "answered_wrong", selectedLabel: "B", answeredAt: 1750000100000, category: null },
        "stale-question-id": { status: "answered_wrong", selectedLabel: "C", answeredAt: 5 },
      }),
      ["dynanca-mcq-session-" + entry.id + "-v2"]: JSON.stringify({ currentId: String(bank.questions[2].id), stepsSinceReview: 1, historyStack: [String(bank.questions[0].id)] }),
      // Legacy pre-migration key: only the practice page may migrate it.
      "gp-practice-v1": JSON.stringify({ old: { status: "answered_correct", selectedLabel: "A", answeredAt: 1 } }),
      "dynanca-mcq-unknown-bank-v2": JSON.stringify({ q: { status: "answered_wrong", selectedLabel: "A", answeredAt: 2 } }),
      "some-other-app": "untouched",
    };
    await page.addInitScript((data) => {
      if (window.name === "seeded") return;
      window.name = "seeded";
      Object.keys(data).forEach((k) => localStorage.setItem(k, data[k]));
    }, seeded);

    await S.openLanding(page, baseURL);
    await expect(page.locator("#continue li.bank")).toHaveCount(1);
    await expect(page.locator("#continue li.bank")).toContainText("3 answers saved in this browser");
    // Use the page the way a person would.
    await page.getByLabel("Search banks").fill("algebra");
    await page.getByLabel("Collection", { exact: true }).selectOption("mathematics");
    await page.locator('label[for="showAll"]').click(); // the visible half of the radio
    await expect(page.getByRole("radio", { name: /^All banks/ })).toBeChecked();
    await page.getByRole("button", { name: "Reset filters" }).click();
    await page.getByRole("navigation", { name: "Catalog pages" }).getByRole("link", { name: /Next/ }).click();
    await page.reload();
    await page.waitForFunction(() => !/Loading/.test(document.getElementById("resultSummary").textContent));

    expect(await page.evaluate(() => JSON.parse(JSON.stringify(localStorage)))).toEqual(seeded);
    // Catalog state lives in its own sessionStorage namespace.
    const sessionKeys = await page.evaluate(() => Object.keys(sessionStorage).sort());
    expect(sessionKeys).toEqual(["dynanca-catalog-return-v1", "dynanca-catalog-scroll-v1"]);
  });
});

// ---------------------------------------------------------------------------
// 404
// ---------------------------------------------------------------------------
test.describe("Not-found page", () => {
  test("an unknown address returns HTTP 404 with a branded page that leads back to the catalog", async ({ page }) => {
    const problems = await S.watch(page);
    const response = await page.goto(baseURL + "/no/such/page");
    expect(response.status()).toBe(404);
    await expect(page.locator("h1")).toHaveText("This page could not be found.");
    await expect(page.locator("img.brand__logo")).toBeVisible();
    expect(await page.locator("img.brand__logo").evaluate((img) => img.naturalWidth)).toBe(846);
    await page.getByRole("link", { name: "Go to the practice catalog" }).click();
    await expect(page).toHaveURL(baseURL + "/#catalog");
    await expect(cards(page).first()).toBeVisible();
    expect((await problems.collect()).csp).toEqual([]);
  });

  test("a missing bank file is a real 404, not a page disguised as JSON", async ({ request }) => {
    const res = await request.get(baseURL + "/questions/" + encodeURIComponent("comprehensive math") + "/" + encodeURIComponent("definitely-not-a-bank.json"));
    expect(res.status()).toBe(404);
  });
});
