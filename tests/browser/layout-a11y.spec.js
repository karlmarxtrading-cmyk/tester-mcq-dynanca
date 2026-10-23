/* ==========================================================================
   Dynanca — responsive layout, keyboard and contrast (Playwright + Chromium)
   -------------------------------------------------------------------------
   Measured, not assumed:
     - geometry comes from real bounding boxes of every visible element
       (an overflow hidden behind `overflow-x: hidden` would still fail);
     - contrast comes from the colours the browser actually computed for
       each piece of text and each control boundary, in light and dark;
     - keyboard tests press real keys and check where focus really is.

   Target-size note: WCAG 2.2 AA (2.5.8) requires 24 CSS px (or spacing /
   an exception). The ~44 px checked for primary controls is this product's
   own comfort target, not a WCAG minimum.

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

const WIDTHS = [320, 360, 390, 768, 1024, 1280, 1440];

// The catalog page that contains the longest title in the whole manifest.
const allInManifestOrder = S.catalog.entries;
const longest = allInManifestOrder.reduce((a, b) => (b.name.length > a.name.length ? b : a));
const longestScope = S.Model.filterEntries(S.catalog, S.Model.normalizeState({ collection: longest.collectionKey, show: "all" }, S.catalog)).items;
const longestPage = Math.floor(longestScope.findIndex((e) => e.id === longest.id) / S.Model.PAGE_SIZE) + 1;
const longestQuery = `?collection=${encodeURIComponent(longest.collectionKey)}&show=all&page=${longestPage}`;

function expectCleanLayout(audit, label) {
  expect(audit.scrollWidth, label + ": horizontal scroll width").toBeLessThanOrEqual(audit.viewport);
  expect(audit.offscreen, label + ": elements leaving the viewport").toEqual([]);
  expect(audit.clipped, label + ": clipped text").toEqual([]);
  expect(audit.overlaps, label + ": overlapping targets").toEqual([]);
  expect(audit.small, label + ": targets under 24 CSS px").toEqual([]);
  expect(audit.comfortable, label + ": primary controls under ~44 CSS px").toEqual([]);
}

// ---------------------------------------------------------------------------
// Responsive matrix
// ---------------------------------------------------------------------------
test.describe("Responsive layout — 320 to 1440 CSS px", () => {
  for (const width of WIDTHS) {
    test(`${width}px: default, filtered, longest-title, empty and error views have no overflow, clipping or overlapping targets`, async ({ page }) => {
      await page.setViewportSize({ width, height: width < 700 ? 760 : 900 });
      // The layout must not be relying on overflow-x:hidden to look fine.
      await S.openLanding(page, baseURL);
      const overflowX = await page.evaluate(() => [getComputedStyle(document.documentElement).overflowX, getComputedStyle(document.body).overflowX]);
      expect(overflowX).toEqual(["visible", "visible"]);
      expectCleanLayout(await page.evaluate(S.layoutAudit), "default");

      // Search + collection + topic active.
      await S.openLanding(page, baseURL, "?q=algebra&collection=mathematics&topic=algebra");
      await expect(page.getByLabel("Topic", { exact: true })).toBeVisible();
      await expect(page.getByRole("button", { name: "Clear search" })).toBeVisible();
      expectCleanLayout(await page.evaluate(S.layoutAudit), "search+filters");

      // The longest title in the catalog, on a page that mixes both availability states.
      await S.openLanding(page, baseURL, longestQuery);
      const card = page.locator(`#bankGrid li[data-bank-id="${longest.id}"]`);
      await expect(card.locator(".bank__title")).toHaveText(longest.name); // the full title, not an ellipsis
      const title = await card.locator(".bank__title").evaluate((el) => {
        const cs = getComputedStyle(el);
        return { overflow: cs.overflow, textOverflow: cs.textOverflow, whiteSpace: cs.whiteSpace, clamp: cs.webkitLineClamp, fits: el.scrollWidth <= el.clientWidth + 1 };
      });
      expect(title.textOverflow).not.toBe("ellipsis");
      expect(title.whiteSpace).toBe("normal");
      expect(["none", ""]).toContain(title.clamp);
      expect(title.fits).toBe(true);
      expectCleanLayout(await page.evaluate(S.layoutAudit), "longest title");

      // Empty result.
      await S.openLanding(page, baseURL, "?q=zzqqxx-nothing-matches-this&collection=quiz");
      await expect(page.locator("#catalogPanel .panel")).toBeVisible();
      expectCleanLayout(await page.evaluate(S.layoutAudit), "empty state");

      // Failed load.
      await page.route("**/master-manifest.json", (route) => route.abort("connectionrefused"));
      await page.goto(baseURL + "/");
      await expect(page.getByRole("alert")).toBeVisible();
      expectCleanLayout(await page.evaluate(S.layoutAudit), "error state");
      await page.unroute("**/master-manifest.json");
    });
  }

  for (const width of [320, 390, 1280]) {
    test(`${width}px: practice page — loaded bank, unavailable bank and failed load stay inside the viewport`, async ({ page }) => {
      await page.setViewportSize({ width, height: 800 });
      const check = async (label) => {
        const audit = await page.evaluate(S.layoutAudit);
        expect(audit.scrollWidth, label).toBeLessThanOrEqual(audit.viewport);
        expect(audit.offscreen, label).toEqual([]);
        expect(audit.comfortable, label).toEqual([]);
      };
      await page.goto(S.practiceUrl(baseURL, longest.available ? longest.id : S.availableEntries[0].id));
      await expect(page.locator(".practice-question").first()).toBeVisible();
      await expect(page.getByRole("link", { name: /Practice catalog/ })).toBeVisible();
      await check("loaded");
      if (S.unavailableEntries.length) {
        await page.goto(S.practiceUrl(baseURL, longest.available ? S.unavailableEntries[0].id : longest.id));
        await expect(page.getByRole("alert")).toBeVisible();
        await check("unavailable");
      }
      await page.route("**/questions/**", (route) => route.abort());
      await page.goto(S.practiceUrl(baseURL, S.availableEntries[0].id));
      await expect(page.getByRole("alert").getByRole("button", { name: "Try again" })).toBeVisible();
      await check("failed");
    });
  }

  test("200% browser zoom (1280px window -> 640 CSS px, 768 -> 384, 640 -> 320): everything reflows", async ({ browser }) => {
    for (const cssWidth of [640, 384, 320]) {
      const context = await browser.newContext({ viewport: { width: cssWidth, height: 450 }, deviceScaleFactor: 2 });
      const page = await context.newPage();
      await S.openLanding(page, baseURL, longestQuery);
      expectCleanLayout(await page.evaluate(S.layoutAudit), `zoomed to ${cssWidth} CSS px`);
      await S.openLanding(page, baseURL, "?q=algebra&collection=mathematics&topic=algebra");
      expectCleanLayout(await page.evaluate(S.layoutAudit), `zoomed to ${cssWidth} CSS px, filters`);
      await context.close();
    }
  });

  test("text-only resize to 200% (root font size doubled) does not clip or overflow", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.addInitScript(() => {
      document.addEventListener("DOMContentLoaded", () => { document.documentElement.style.fontSize = "200%"; });
    });
    await S.openLanding(page, baseURL, longestQuery);
    expect(await page.evaluate(() => parseFloat(getComputedStyle(document.documentElement).fontSize))).toBe(32);
    const audit = await page.evaluate(S.layoutAudit);
    expect(audit.scrollWidth).toBeLessThanOrEqual(audit.viewport);
    expect(audit.offscreen).toEqual([]);
    expect(audit.clipped).toEqual([]);
    expect(audit.overlaps).toEqual([]);
  });

  test("layout is stable while loading: the logo box and catalog skeleton reserve their space (CLS < 0.1)", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.addInitScript(() => {
      window.__cls = 0;
      new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) if (!entry.hadRecentInput) window.__cls += entry.value;
      }).observe({ type: "layout-shift", buffered: true });
    });
    // Delay the data so the loading state is really on screen first.
    await page.route("**/master-manifest.json", async (route) => { await new Promise((r) => setTimeout(r, 600)); await route.continue(); });
    await page.route("**/assets/img/logo-dynanca.png", async (route) => { await new Promise((r) => setTimeout(r, 300)); await route.continue(); });
    await S.openLanding(page, baseURL);
    await page.waitForTimeout(500);
    const cls = await page.evaluate(() => window.__cls);
    expect(cls).toBeLessThan(0.1);
    for (const width of [1280]) {
      await page.setViewportSize({ width, height: 800 });
      await S.openLanding(page, baseURL);
      await page.waitForTimeout(500);
      expect(await page.evaluate(() => window.__cls)).toBeLessThan(0.1);
    }
  });
});

// ---------------------------------------------------------------------------
// Keyboard
// ---------------------------------------------------------------------------
test.describe("Keyboard", () => {
  async function tabThroughPage(page, limit) {
    const visited = [];
    const problems = [];
    for (let i = 0; i < limit; i++) {
      await page.keyboard.press("Tab");
      const info = await page.evaluate(() => {
        const el = document.activeElement;
        if (!el || el === document.body) return null;
        el.scrollIntoView({ block: "nearest" });
        const target = el.matches("input.segmented__input") ? document.querySelector('label[for="' + el.id + '"]') : el;
        const r = target.getBoundingClientRect();
        const cs = getComputedStyle(el.matches("a.bank__link") ? el : target, el.matches("a.bank__link") ? "::after" : null);
        const ownOutline = getComputedStyle(target);
        const outlined = (parseFloat(cs.outlineWidth) > 0 && cs.outlineStyle !== "none") || (parseFloat(ownOutline.outlineWidth) > 0 && ownOutline.outlineStyle !== "none");
        const cx = Math.min(Math.max(r.left + r.width / 2, 1), window.innerWidth - 1);
        const cy = r.top + Math.min(r.height / 2, 12);
        const top = document.elementFromPoint(cx, cy);
        return {
          key: (el.id ? "#" + el.id : el.tagName.toLowerCase()) + "|" + (el.getAttribute("href") || el.getAttribute("data-theme-option") || "") + "|" + el.textContent.trim().replace(/\s+/g, " ").slice(0, 24),
          tag: el.tagName.toLowerCase(),
          repeat: (function () { const seen = !!el.__dynancaTabVisited; el.__dynancaTabVisited = true; return seen; })(),
          inViewport: r.bottom > 0 && r.top < window.innerHeight && r.right > 0 && r.left < window.innerWidth,
          covered: !!top && !(target.contains(top) || top.contains(target) || (el.closest(".bank") && el.closest(".bank").contains(top))),
          outlined,
          isFooterLink: !!el.closest("footer"),
        };
      });
      if (!info) break;
      visited.push(info);
      if (info.repeat) problems.push("focus came back to an element already visited (loop/trap): " + info.key);
      if (!info.inViewport) problems.push("focused element not in viewport: " + info.key);
      // elementFromPoint is what is really painted on top at the focused
      // element: it catches a sticky header (or anything else) covering it.
      if (info.covered) problems.push("focused element hidden behind something: " + info.key);
      if (!info.outlined) problems.push("no visible focus indicator: " + info.key);
      if (info.isFooterLink) break;
    }
    return { visited, problems };
  }

  for (const viewport of [{ width: 1280, height: 800, label: "desktop" }, { width: 360, height: 700, label: "small phone" }]) {
    test(`${viewport.label}: Tab reaches every control in a logical order, focus is always visible, nothing traps it`, async ({ page }) => {
      await page.setViewportSize(viewport);
      await S.openLanding(page, baseURL, "?collection=mathematics");
      const { visited, problems } = await tabThroughPage(page, 80);
      expect(problems).toEqual([]);
      const keys = visited.map((v) => v.key);
      // No trap: no element was visited twice (checked above) and the walk ends at the footer.
      expect(visited[visited.length - 1].isFooterLink).toBe(true);
      // Logical order: skip link, brand, navigation, theme, hero actions, collections, filters, cards, pager, footer.
      const order = (needle) => keys.findIndex((k) => k.includes(needle));
      const sequence = ["#main", "./", "#catalog", "light", "dark", "system", "?collection=mathematics#catalog", "#q", "#collection", "#topic", "#showAvailable", "practice/index.html?quiz=", "?collection=mathematics&page=2"];
      const positions = sequence.map(order);
      positions.forEach((pos, i) => expect(pos, "tab stop for " + sequence[i]).toBeGreaterThanOrEqual(0));
      for (let i = 1; i < positions.length; i++) expect(positions[i], sequence[i] + " should come after " + sequence[i - 1]).toBeGreaterThan(positions[i - 1]);
      // Exactly one tab stop per bank card.
      expect(keys.filter((k) => k.includes("practice/index.html?quiz=")).length).toBe(S.Model.PAGE_SIZE);
    });
  }

  test("a whole task with the keyboard only: search, filter, open a bank, come back", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await S.openLanding(page, baseURL);
    await page.getByLabel("Search banks").focus();
    await page.keyboard.type("sets");
    await expect(page.locator("#resultSummary")).toContainText("“sets”");
    await expect(page.getByLabel("Search banks")).toBeFocused();
    await page.keyboard.press("Tab"); // clear button
    await page.keyboard.press("Tab"); // collection
    await expect(page.getByLabel("Collection", { exact: true })).toBeFocused();
    await page.keyboard.type("Math"); // native select type-ahead: "Mathematics"
    await expect(page.getByLabel("Collection", { exact: true })).toHaveValue("mathematics");
    await expect(page.getByLabel("Collection", { exact: true })).toBeFocused(); // filtering did not move focus
    const expected = S.expectFor({ q: "sets", collection: "mathematics" });
    await expect.poll(() => S.gridIds(page)).toEqual(expected.ids);

    await page.keyboard.press("Tab"); // topic
    await page.keyboard.press("Tab"); // availability radios (one tab stop)
    await expect(page.getByRole("radio", { name: /^Available/ })).toBeFocused();
    await page.keyboard.press("Tab"); // reset filters
    await expect(page.getByRole("button", { name: "Reset filters" })).toBeFocused();
    await page.keyboard.press("Tab"); // first card
    const firstLink = page.locator("#bankGrid a.bank__link").first();
    await expect(firstLink).toBeFocused();
    await page.keyboard.press("Enter");
    await expect(page).toHaveURL(S.practiceUrl(baseURL, expected.ids[0]));
    await expect(page.locator(".practice-question").first()).toBeVisible();

    // On the practice page the back link is reachable and works with Enter.
    const back = page.getByRole("link", { name: /Practice catalog/ });
    await back.focus();
    await expect(back).toBeFocused();
    await page.keyboard.press("Enter");
    await expect(page).toHaveURL(/\?q=sets&collection=mathematics#catalog$/);
    await expect.poll(() => S.gridIds(page)).toEqual(expected.ids);
  });

  test("pagination by keyboard moves focus to the new results; unavailable cards are not tab stops", async ({ page }) => {
    const pendingFixture = await S.unavailableFixture(page);
    await page.setViewportSize({ width: 1280, height: 800 });
    const all = pendingFixture.expectFor({ collection: "comprehensive math", show: "all" });
    const boundary = Math.ceil(all.result.matchedAvailable / S.Model.PAGE_SIZE);
    await S.openLanding(page, baseURL, `?collection=comprehensive%20math&show=all&page=${boundary}`);
    const expected = pendingFixture.expectFor({ collection: "comprehensive math", show: "all", page: boundary }).page.items;
    const availableOnPage = expected.filter((e) => e.available).length;
    // Tab from the last control before the grid through the grid.
    await page.getByRole("button", { name: "Reset filters" }).focus();
    const stops = [];
    for (let i = 0; i < expected.length + 2; i++) {
      await page.keyboard.press("Tab");
      const where = await page.evaluate(() => {
        const el = document.activeElement;
        return el.closest("#bankGrid") ? "card:" + el.closest("li").getAttribute("data-bank-id") : el.closest("#pager") ? "pager" : "other";
      });
      stops.push(where);
      if (where === "pager") break;
    }
    expect(stops.filter((s) => s.startsWith("card:"))).toEqual(expected.filter((e) => e.available).map((e) => "card:" + e.id));
    expect(stops.filter((s) => s.startsWith("card:")).length).toBe(availableOnPage);
    expect(stops[stops.length - 1]).toBe("pager");

    await page.getByRole("navigation", { name: "Catalog pages" }).getByRole("link", { name: /Next/ }).focus();
    await page.keyboard.press("Enter");
    await expect(page).toHaveURL(new RegExp("page=" + (boundary + 1) + "$"));
    await expect(page.locator("#resultSummary")).toBeFocused();
    await expect(page.locator("#resultSummary")).toBeInViewport();
  });

  test("the result summary is the only live region, and it announces the outcome of a search", async ({ page }) => {
    await S.openLanding(page, baseURL);
    const live = await page.locator("[aria-live], [role='status'], [role='alert']").evaluateAll((nodes) => nodes.filter((n) => n.getClientRects().length).map((n) => n.id || n.className));
    expect(live).toEqual(["resultSummary"]);
    expect(await page.locator("#bankGrid").getAttribute("aria-live")).toBeNull();
    await page.getByLabel("Search banks").fill("probability");
    const expected = S.expectFor({ q: "probability" });
    await expect(page.locator("#resultSummary")).toHaveText(new RegExp(`of ${expected.page.total} available banks? matching “probability”\\.$`));
    await expect(page.locator("#resultSummary")).toHaveAttribute("aria-atomic", "true");
  });

  test("selected states are exposed to assistive technology (aria-current, aria-pressed, checked)", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await S.openLanding(page, baseURL, "?collection=quiz&page=2");
    await expect(page.getByRole("navigation", { name: "Catalog pages" }).getByRole("link", { name: "Page 2", exact: true })).toHaveAttribute("aria-current", "page");
    await expect(page.locator('#collectionGrid a[aria-current="true"] .collection-card__name')).toHaveText("Quiz");
    await expect(page.getByRole("button", { name: "System" })).toHaveAttribute("aria-pressed", "true");
    await expect(page.getByRole("radio", { name: /^Available/ })).toBeChecked();
    await expect(page.getByRole("group", { name: "Color theme" })).toBeVisible();
    await expect(page.getByRole("radiogroup", { name: "Show" })).toBeVisible();
  });
});

// ---------------------------------------------------------------------------
// Motion
// ---------------------------------------------------------------------------
test.describe("Motion preferences", () => {
  test("reduced motion: no smooth scrolling, no pulsing skeleton, no transitions", async ({ browser }) => {
    const context = await browser.newContext({ reducedMotion: "reduce" });
    const page = await context.newPage();
    await page.route("**/master-manifest.json", () => {}); // stay in the loading state
    await page.goto(baseURL + "/", { waitUntil: "domcontentloaded" });
    await expect(page.locator("#bankGrid .skeleton").first()).toBeVisible();
    const reduced = await page.evaluate(() => ({
      scroll: getComputedStyle(document.documentElement).scrollBehavior,
      skeleton: getComputedStyle(document.querySelector("#bankGrid .skeleton"), "::before").animationName,
      button: getComputedStyle(document.querySelector(".btn")).transitionDuration,
    }));
    expect(reduced).toEqual({ scroll: "auto", skeleton: "none", button: "0s" });
    await context.close();

    const motion = await browser.newContext({ reducedMotion: "no-preference" });
    const page2 = await motion.newPage();
    await page2.route("**/master-manifest.json", () => {});
    await page2.goto(baseURL + "/", { waitUntil: "domcontentloaded" });
    expect(await page2.evaluate(() => getComputedStyle(document.documentElement).scrollBehavior)).toBe("smooth");
    await motion.close();
  });
});

// ---------------------------------------------------------------------------
// Contrast (computed colours, light + dark, every state)
// ---------------------------------------------------------------------------
test.describe("Colour contrast (WCAG 2.2 AA) on computed colours", () => {
  function failures(audit) {
    return {
      text: audit.text.filter((t) => t.ratio < t.need).map((t) => `${t.el} "${t.sample}" ${t.fg} on ${t.bg} = ${t.ratio} (needs ${t.need})`),
      boundaries: audit.boundaries.filter((b) => b.ratio < b.need).map((b) => `${b.el} boundary ${b.ratio} (needs ${b.need})`),
    };
  }

  for (const theme of ["light", "dark"]) {
    test(`${theme}: every text and control boundary on the landing page meets AA in all catalog states`, async ({ page }) => {
      await page.setViewportSize({ width: 1280, height: 900 });
      await page.emulateMedia({ colorScheme: theme });
      const states = [
        ["default", ""],
        ["all banks, mixed availability, selected collection and page", longestQuery],
        ["search + topic", "?q=algebra&collection=mathematics&topic=algebra"],
        ["empty", "?q=zzqqxx-nothing&collection=quiz"],
      ];
      if (S.unavailableEntries.length) states.push(["empty with hidden matches", "?q=" + encodeURIComponent(S.unavailableEntries[0].id)]);
      let measured = 0;
      for (const [label, query] of states) {
        await S.openLanding(page, baseURL, query);
        await expect(page.locator("html")).toHaveAttribute("data-theme", theme);
        const audit = await page.evaluate(S.contrastAudit);
        measured += audit.text.length;
        expect(failures(audit), label).toEqual({ text: [], boundaries: [] });
      }
      expect(measured).toBeGreaterThan(300);

      // Saved-progress state.
      const entry = S.availableEntries[0];
      await page.evaluate(([key, value]) => localStorage.setItem(key, value), [
        "dynanca-mcq-" + entry.id + "-v2",
        JSON.stringify({ a: { status: "answered_correct", selectedLabel: "A", answeredAt: Date.now() } }),
      ]);
      await S.openLanding(page, baseURL);
      await expect(page.locator("#continue")).toBeVisible();
      expect(failures(await page.evaluate(S.contrastAudit)), "continue practice").toEqual({ text: [], boundaries: [] });

      // Error state.
      await page.route("**/master-manifest.json", (route) => route.abort());
      await page.goto(baseURL + "/");
      await expect(page.getByRole("alert")).toBeVisible();
      expect(failures(await page.evaluate(S.contrastAudit)), "error").toEqual({ text: [], boundaries: [] });
      await page.unroute("**/master-manifest.json");

      // Loading state.
      await page.route("**/master-manifest.json", () => {});
      await page.goto(baseURL + "/", { waitUntil: "domcontentloaded" });
      await expect(page.locator("#resultSummary")).toHaveText(/Loading/);
      expect(failures(await page.evaluate(S.contrastAudit)), "loading").toEqual({ text: [], boundaries: [] });
    });

    test(`${theme}: hover and focus states keep AA contrast and a visible focus ring`, async ({ page }) => {
      await page.setViewportSize({ width: 1280, height: 900 });
      await page.emulateMedia({ colorScheme: theme, reducedMotion: "reduce" });
      await S.openLanding(page, baseURL, "?collection=mathematics");
      const targets = [
        ".btn--primary", ".btn--ghost", ".site-nav a", ".theme-switch__btn[aria-pressed='false']", "#collectionGrid a:not([aria-current])",
        "#bankGrid li.bank--available", "#pager a.pager__link:not([aria-current])", "#pager a.pager__step", "label[for='showAll']", "#resetFilters", "#q", "#collection",
      ];
      for (const selector of targets) {
        const target = page.locator(selector).first();
        await target.scrollIntoViewIfNeeded();
        await target.hover();
        const audit = await page.evaluate(S.contrastAudit);
        expect(failures(audit), "hover " + selector).toEqual({ text: [], boundaries: [] });
      }
      await page.mouse.move(0, 0);

      // Focus ring: present on every kind of control and >= 3:1 against its surroundings.
      const ringSelectors = [".skip-link", ".brand", ".site-nav a", ".theme-switch__btn", ".btn--primary", "#collectionGrid a", "#q", "#collection", "#showAvailable", "#resetFilters", "#bankGrid a.bank__link", "#pager a"];
      for (const selector of ringSelectors) {
        const result = await page.evaluate((sel) => {
          const el = document.querySelector(sel);
          el.focus({ preventScroll: false });
          // Programmatic focus on a link/button does not always match :focus-visible; a real key press does.
          return el === document.activeElement;
        }, selector);
        expect(result, selector + " should be focusable").toBe(true);
        await page.keyboard.press("Shift+Tab");
        await page.keyboard.press("Tab");
        const ring = await page.evaluate(() => {
          const el = document.activeElement;
          const parse = (c) => { const p = c.match(/[\d.]+/g).map(Number); return { r: p[0], g: p[1], b: p[2], a: p.length > 3 ? p[3] : 1 }; };
          const lum = (c) => { const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }; return 0.2126 * f(c.r) + 0.7152 * f(c.g) + 0.0722 * f(c.b); };
          const bg = (node) => { for (let n = node; n; n = n.parentElement) { const c = parse(getComputedStyle(n).backgroundColor); if (c.a >= 1) return c; } return { r: 255, g: 255, b: 255, a: 1 }; };
          const host = el.matches("input.segmented__input") ? document.querySelector('label[for="' + el.id + '"]') : el;
          const cs = el.matches("a.bank__link") ? getComputedStyle(el, "::after") : getComputedStyle(host);
          const outline = parse(cs.outlineColor);
          const around = bg(host.parentElement);
          const la = lum(outline), lb = lum(around);
          return { id: el.id || el.className, width: parseFloat(cs.outlineWidth), style: cs.outlineStyle, ratio: (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05) };
        });
        expect(ring.style, selector + " focus ring").not.toBe("none");
        expect(ring.width, selector + " focus ring width").toBeGreaterThanOrEqual(2);
        expect(ring.ratio, selector + " focus ring contrast").toBeGreaterThanOrEqual(3);
      }
    });

    test(`${theme}: practice page status layer (back link, failure state) meets AA`, async ({ page }) => {
      await page.emulateMedia({ colorScheme: theme });
      const statusOnly = (audit) => audit.text
        .filter((t) => /hero__back|practice-status|hero__title|hero__lead/.test(t.el) || /Back to the catalog|Try again|Practice catalog/.test(t.sample))
        .filter((t) => t.ratio < t.need)
        .map((t) => `${t.el} "${t.sample}" ${t.fg} on ${t.bg} = ${t.ratio}`);
      await page.goto(S.practiceUrl(baseURL, S.availableEntries[0].id));
      await expect(page.locator(".practice-question").first()).toBeVisible();
      await page.waitForTimeout(400); // colour transition of the shell
      expect(statusOnly(await page.evaluate(S.contrastAudit))).toEqual([]);
      await page.route("**/questions/**", (route) => route.abort());
      await page.reload();
      await expect(page.getByRole("alert")).toBeVisible();
      await page.waitForTimeout(400);
      const audit = await page.evaluate(S.contrastAudit);
      expect(audit.text.some((t) => /practice-status/.test(t.el))).toBe(true);
      expect(statusOnly(audit)).toEqual([]);
    });
  }
});
