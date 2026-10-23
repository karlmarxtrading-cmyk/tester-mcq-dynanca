#!/usr/bin/env node
/* ==========================================================================
   Dynanca — QA evidence capture (real browser screenshots + measurements)
   -------------------------------------------------------------------------
   Drives headless Chromium (Playwright) against the project's own preview
   server — the one that sends the `_headers` response headers — and writes:

     <out>/screenshots/*.png       real screenshots of every documented state
     <out>/layout-matrix.json      bounding-box audit per viewport and state
     <out>/contrast-report.json    WCAG contrast of computed colours
     <out>/performance-lab.json    lab timings, request counts, transfer sizes

   Nothing in the project is written; the output directory is outside the
   deployable site by default.

   Usage:
     node tools/qa/capture-evidence.js [--out <dir>]     (default: ./qa-evidence)
     npm run qa:evidence

   Requires the dev dependency (@playwright/test) and a Chromium build:
     npm ci && npx playwright install chromium
   ========================================================================== */
"use strict";

const fs = require("fs");
const path = require("path");
const zlib = require("zlib");

const projectRoot = path.resolve(__dirname, "..", "..");
const S = require(path.join(projectRoot, "tests", "browser", "support.js"));
const { chromium } = require("@playwright/test");

function argValue(flag, fallback) {
  const i = process.argv.indexOf(flag);
  return i !== -1 && process.argv[i + 1] ? process.argv[i + 1] : fallback;
}

const outDir = path.resolve(argValue("--out", path.join(projectRoot, "qa-evidence")));
const shotDir = path.join(outDir, "screenshots");
fs.mkdirSync(shotDir, { recursive: true });

const shots = [];
async function shot(page, name, note, options) {
  const file = path.join(shotDir, name + ".png");
  await page.screenshot(Object.assign({ path: file }, options || {}));
  const vp = page.viewportSize();
  shots.push({ file: "screenshots/" + name + ".png", viewport: vp.width + "x" + vp.height, note });
}

async function landing(page, baseURL, query) {
  await S.openLanding(page, baseURL, query);
  await page.waitForLoadState("networkidle");
}

async function toCatalog(page) {
  await page.evaluate(() => document.getElementById("catalog").scrollIntoView({ behavior: "instant", block: "start" }));
  await page.waitForTimeout(150);
}

(async () => {
  const { server, baseURL } = await S.startServer();
  const browser = await chromium.launch();
  const layout = [];
  const contrast = [];
  const consoleProblems = [];

  async function newPage(width, height, extra) {
    const context = await browser.newContext(Object.assign({ viewport: { width, height }, reducedMotion: "reduce" }, extra || {}));
    const page = await context.newPage();
    page.on("pageerror", (e) => consoleProblems.push("pageerror: " + e));
    page.on("console", (m) => {
      if (/Refused to|Content Security Policy/i.test(m.text())) consoleProblems.push("CSP: " + m.text());
    });
    return page;
  }

  // The catalog page holding the longest title in the manifest.
  const longest = S.catalog.entries.reduce((a, b) => (b.name.length > a.name.length ? b : a));
  const scope = S.Model.filterEntries(S.catalog, S.Model.normalizeState({ collection: longest.collectionKey, show: "all" }, S.catalog)).items;
  const longestPage = Math.floor(scope.findIndex((e) => e.id === longest.id) / S.Model.PAGE_SIZE) + 1;
  const longestQuery = `?collection=${encodeURIComponent(longest.collectionKey)}&show=all&page=${longestPage}`;
  const filterQuery = "?q=algebra&collection=mathematics&topic=algebra";
  const emptyQuery = "?q=zzqqxx-nothing-matches&collection=quiz";
  const pending = S.unavailableEntries[0] || null;

  /* ---------- 1. First view, light + dark, desktop + mobile ---------- */
  for (const [w, h, label] of [[1280, 800, "desktop-1280"], [390, 844, "mobile-390"]]) {
    for (const theme of ["light", "dark"]) {
      const page = await newPage(w, h, { colorScheme: theme });
      await landing(page, baseURL, "");
      await shot(page, `01-landing-first-view-${label}-${theme}`, `Landing, first viewport, ${theme} theme`);
      if (theme === "light") await shot(page, `02-landing-full-page-${label}`, "Landing, full page (one page of 24 cards)", { fullPage: true });
      await page.context().close();
    }
  }

  /* ---------- 2. Width matrix: first viewport + geometry audit ---------- */
  for (const w of [320, 360, 390, 768, 1024, 1280, 1440]) {
    const page = await newPage(w, w < 700 ? 760 : 900);
    const states = [["default", ""], ["search+filters", filterQuery], ["longest title / mixed availability", longestQuery], ["empty", emptyQuery]];
    for (const [state, query] of states) {
      await landing(page, baseURL, query);
      const a = await page.evaluate(S.layoutAudit);
      layout.push({ page: "landing", width: w, state, scrollWidth: a.scrollWidth, viewport: a.viewport, offscreen: a.offscreen.length, clipped: a.clipped.length, overlaps: a.overlaps.length, under24px: a.small.length, primaryUnder44px: a.comfortable.length });
      if (state === "default") await shot(page, `03-width-${String(w).padStart(4, "0")}-top`, `Landing top at ${w} CSS px`);
      if (state === "longest title / mixed availability") {
        await page.locator(`#bankGrid li[data-bank-id="${longest.id}"]`).scrollIntoViewIfNeeded();
        await page.evaluate(() => window.scrollBy(0, -120));
        if (w === 320 || w === 1440) await shot(page, `04-longest-title-${String(w).padStart(4, "0")}`, `Longest catalog title (${longest.name.length} characters) at ${w} CSS px`);
      }
    }
    await page.route("**/master-manifest.json", (route) => route.abort());
    await page.goto(baseURL + "/");
    await page.getByRole("alert").waitFor();
    const e = await page.evaluate(S.layoutAudit);
    layout.push({ page: "landing", width: w, state: "error", scrollWidth: e.scrollWidth, viewport: e.viewport, offscreen: e.offscreen.length, clipped: e.clipped.length, overlaps: e.overlaps.length, under24px: e.small.length, primaryUnder44px: e.comfortable.length });
    await page.context().close();
  }

  /* ---------- 3. Catalog states, desktop + mobile ---------- */
  for (const [w, h, label] of [[1280, 800, "desktop-1280"], [390, 844, "mobile-390"]]) {
    const page = await newPage(w, h);
    await landing(page, baseURL, filterQuery);
    await toCatalog(page);
    await shot(page, `05-catalog-search-filter-${label}`, "Catalog with search “algebra” + collection Mathematics + topic Algebra");

    await landing(page, baseURL, longestQuery);
    await toCatalog(page);
    await shot(page, `06-catalog-all-banks-mixed-${label}`, "“All banks”: available and not-available cards side by side");

    await landing(page, baseURL, emptyQuery);
    await toCatalog(page);
    await shot(page, `07-catalog-empty-${label}`, "No results: reason + Clear search / Reset filters");

    if (pending) {
      await landing(page, baseURL, "?q=" + encodeURIComponent(pending.id));
      await toCatalog(page);
      await shot(page, `08-catalog-empty-hidden-matches-${label}`, "Search for a listed-but-unavailable bank: explanation + Show all banks");
    }

    // Loading (data held back) and failed load.
    await page.route("**/master-manifest.json", () => {});
    await page.goto(baseURL + "/", { waitUntil: "domcontentloaded" });
    await toCatalog(page);
    await shot(page, `09-catalog-loading-${label}`, "Loading state (catalog data held back)");
    await page.unroute("**/master-manifest.json");
    await page.route("**/master-manifest.json", (route) => route.abort());
    await page.goto(baseURL + "/");
    await page.getByRole("alert").waitFor();
    await toCatalog(page);
    await shot(page, `10-catalog-load-error-${label}`, "Catalog failed to load: message + Try again");
    await page.unroute("**/master-manifest.json");

    // Pagination + keyboard focus ring.
    await landing(page, baseURL, "?collection=math%20gaokao&page=3");
    await page.locator("#pager").scrollIntoViewIfNeeded();
    await page.locator("#pager a").first().focus();
    await page.keyboard.press("Tab");
    await shot(page, `11-pagination-focus-${label}`, "Pagination with a keyboard focus ring");
    await page.context().close();
  }

  /* ---------- 4. Continue practice (real local progress) ---------- */
  {
    const page = await newPage(1280, 800);
    const entry = S.availableEntries.find((e) => e.collectionKey === "dynanca") || S.availableEntries[0];
    await page.goto(S.practiceUrl(baseURL, entry.id));
    for (let i = 0; i < 3; i++) {
      const q = page.locator(".practice-question").first();
      await q.locator(".practice-option").first().click();
      await q.locator('[data-action="next"]').click();
    }
    await landing(page, baseURL, "");
    await page.locator("#continue").scrollIntoViewIfNeeded();
    await page.evaluate(() => window.scrollBy(0, -100));
    await shot(page, "12-continue-practice-desktop-1280", "“Continue practice”, built from 3 real answers saved in this browser");
    await page.context().close();
  }

  /* ---------- 5. 200% zoom, text-only 200%, no JavaScript, 404 ---------- */
  {
    const page = await newPage(640, 450, { deviceScaleFactor: 2 });
    await landing(page, baseURL, "");
    await shot(page, "13-zoom-200-percent-of-1280", "1280 px window at 200% zoom (640 CSS px, 2x scale)");
    await toCatalog(page);
    await shot(page, "13b-zoom-200-percent-catalog", "Catalog at 200% zoom");
    await page.context().close();

    const noJs = await newPage(390, 844, { javaScriptEnabled: false });
    await noJs.goto(baseURL + "/");
    await shot(noJs, "14-no-javascript-mobile-390", "JavaScript disabled: honest notice, no dead controls", { fullPage: true });
    await noJs.context().close();

    const nf = await newPage(1280, 800);
    await nf.goto(baseURL + "/this/page/does-not-exist");
    await shot(nf, "15-not-found-desktop-1280", "404 page");
    await nf.context().close();
  }

  /* ---------- 6. Practice page: loaded, math, Venn, failures ---------- */
  {
    const seed = async (page, bankId, questionId) => page.addInitScript(([k, v]) => { try { if (!localStorage.getItem(k)) localStorage.setItem(k, v); } catch (e) { /* ignore */ } },
      ["dynanca-mcq-session-" + bankId + "-v2", JSON.stringify({ currentId: String(questionId), stepsSinceReview: 0, historyStack: [] })]);
    const settle = async (page) => { await page.waitForFunction(() => window.MathJax && window.MathJax.typesetPromise); await page.waitForTimeout(900); };

    const display = S.findQuestion((q) => /\\\[|\$\$/.test(q.explanation || "") && /\\\(/.test(q.question || "") && (q.options || []).length >= 2);
    for (const [w, h, label, theme] of [[1280, 800, "desktop-1280", "light"], [390, 844, "mobile-390", "dark"]]) {
      const page = await newPage(w, h, { colorScheme: theme });
      await seed(page, display.bankId, display.question.id);
      await page.goto(S.practiceUrl(baseURL, display.bankId));
      await page.locator(".practice-question").first().waitFor();
      await settle(page);
      await shot(page, `16-practice-loaded-${label}-${theme}`, `Practice page (${display.bankId}): back link, title, inline MathJax`);
      const q = page.locator(".practice-question").first();
      await q.locator(".practice-hint-toggle").click();
      await q.locator(`.practice-option[data-label="${display.question.answer}"]`).click();
      await settle(page);
      await q.locator(".practice-explanation").scrollIntoViewIfNeeded();
      await shot(page, `17-practice-answered-explanation-${label}-${theme}`, "After answering: verdict, hint, explanation with display MathJax");
      await page.context().close();
    }

    const venn = S.findQuestion((q) => q.visual && q.visual.type === "venn" && (q.visual.setNames || []).length === 3, { maxBankSize: 1000 });
    if (venn) {
      const page = await newPage(1280, 900);
      await seed(page, venn.bankId, venn.question.id);
      await page.goto(S.practiceUrl(baseURL, venn.bankId));
      await page.locator(".practice-question svg").first().waitFor();
      await page.locator(".practice-question").first().scrollIntoViewIfNeeded();
      await shot(page, "18-practice-venn-diagram-desktop", `Venn diagram question (${venn.bankId} / ${venn.question.id})`);
      await page.context().close();
    }

    for (const [w, h, label] of [[1280, 800, "desktop-1280"], [390, 844, "mobile-390"]]) {
      const page = await newPage(w, h);
      if (pending) {
        await page.goto(S.practiceUrl(baseURL, pending.id));
        await page.getByRole("alert").waitFor();
        await page.waitForTimeout(350);
        await shot(page, `19-practice-not-available-${label}`, `Direct link to a bank that is not in this release (${pending.id})`);
        const a = await page.evaluate(S.layoutAudit);
        layout.push({ page: "practice", width: w, state: "not available", scrollWidth: a.scrollWidth, viewport: a.viewport, offscreen: a.offscreen.length });
      }
      await page.route("**/questions/**", (route) => route.abort());
      await page.goto(S.practiceUrl(baseURL, S.availableEntries[0].id));
      await page.getByRole("alert").waitFor();
      await page.waitForTimeout(350);
      await shot(page, `20-practice-network-error-${label}`, "Bank download failed: Try again + Back to the catalog");
      await page.unroute("**/questions/**");
      await page.goto(baseURL + "/practice/index.html");
      await page.getByRole("alert").waitFor();
      await page.waitForTimeout(350);
      await shot(page, `21-practice-no-bank-selected-${label}`, "Practice URL without ?quiz=");
      await page.context().close();
    }
  }

  /* ---------- 7. Contrast on computed colours ---------- */
  for (const theme of ["light", "dark"]) {
    const page = await newPage(1280, 900, { colorScheme: theme });
    const states = [["default", ""], ["all banks, mixed", longestQuery], ["search + topic", filterQuery], ["empty", emptyQuery]];
    for (const [state, query] of states) {
      await landing(page, baseURL, query);
      const a = await page.evaluate(S.contrastAudit);
      const worstText = a.text.slice().sort((x, y) => x.ratio / x.need - y.ratio / y.need).slice(0, 5);
      contrast.push({
        theme, state, textSamples: a.text.length,
        minNormalText: Math.min.apply(null, a.text.filter((t) => t.need === 4.5).map((t) => t.ratio)),
        minLargeText: Math.min.apply(null, a.text.filter((t) => t.need === 3).map((t) => t.ratio).concat([99])),
        minBoundary: Math.min.apply(null, a.boundaries.map((b) => b.ratio)),
        failing: a.text.filter((t) => t.ratio < t.need).length + a.boundaries.filter((b) => b.ratio < b.need).length,
        closestToThreshold: worstText,
      });
    }
    await page.context().close();
  }

  /* ---------- 8. Lab performance (throttled, with compression) ---------- */
  const performance = [];
  for (const profile of [
    { name: "Mobile lab: 390x844, 4x CPU slowdown, 1.6 Mbps down / 750 kbps up / 150 ms RTT", width: 390, height: 844, cpu: 4, down: (1.6 * 1024 * 1024) / 8, up: (750 * 1024) / 8, latency: 150 },
    { name: "Desktop lab: 1280x800, no throttling", width: 1280, height: 800, cpu: 1, down: -1, up: -1, latency: 0 },
  ]) {
    const context = await browser.newContext({ viewport: { width: profile.width, height: profile.height } });
    const page = await context.newPage();
    const client = await context.newCDPSession(page);
    await client.send("Network.enable");
    await client.send("Network.emulateNetworkConditions", { offline: false, downloadThroughput: profile.down, uploadThroughput: profile.up, latency: profile.latency });
    await client.send("Emulation.setCPUThrottlingRate", { rate: profile.cpu });
    await page.addInitScript(() => {
      window.__perf = { lcp: 0, cls: 0 };
      new PerformanceObserver((l) => { for (const e of l.getEntries()) window.__perf.lcp = e.startTime; }).observe({ type: "largest-contentful-paint", buffered: true });
      new PerformanceObserver((l) => { for (const e of l.getEntries()) if (!e.hadRecentInput) window.__perf.cls += e.value; }).observe({ type: "layout-shift", buffered: true });
    });
    const requests = [];
    client.on("Network.loadingFinished", (e) => requests.push(e.encodedDataLength));
    const t0 = Date.now();
    await S.openLanding(page, baseURL, "");
    const catalogReadyMs = Date.now() - t0;
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(600);
    // Interaction latency of a search keystroke -> filtered results painted.
    const interactionMs = await page.evaluate(() => new Promise((resolve) => {
      const input = document.getElementById("q");
      const summary = document.getElementById("resultSummary");
      const start = performance.now();
      const observer = new MutationObserver(() => { observer.disconnect(); requestAnimationFrame(() => resolve(Math.round(performance.now() - start))); });
      observer.observe(summary, { childList: true, characterData: true, subtree: true });
      input.value = "algebra";
      input.dispatchEvent(new Event("input", { bubbles: true }));
    }));
    const perf = await page.evaluate(() => ({
      lcpMs: Math.round(window.__perf.lcp), cls: Math.round(window.__perf.cls * 1000) / 1000,
      domNodes: document.querySelectorAll("*").length, cards: document.querySelectorAll("#bankGrid > li.bank").length,
      fcpMs: Math.round((performance.getEntriesByName("first-contentful-paint")[0] || {}).startTime || 0),
    }));
    performance.push(Object.assign({ profile: profile.name, catalogReadyMs, searchKeystrokeToResultsMs: interactionMs + " (includes the 140 ms input debounce)", requests: requests.length, transferredBytes: requests.reduce((a, b) => a + b, 0) }, perf));
    await context.close();
  }

  // Static payload budget (gzip level 9, the way a CDN would send it).
  const gz = (rel) => zlib.gzipSync(fs.readFileSync(path.join(projectRoot, rel)), { level: 9 }).length;
  const raw = (rel) => fs.statSync(path.join(projectRoot, rel)).size;
  const landingAssets = ["assets/css/catalog.css", "assets/js/theme.js", "assets/js/catalog-model.js", "assets/js/catalog.js"];
  const budget = {
    note: "Landing-page JS+CSS added by this work (gzip -9). Excludes the manifest, the availability index, the logo and the pre-existing assets/js/manifest.js.",
    files: landingAssets.map((rel) => ({ file: rel, bytes: raw(rel), gzipBytes: gz(rel) })),
    totalGzipBytes: landingAssets.reduce((a, rel) => a + gz(rel), 0),
    budgetGzipBytes: 80 * 1024,
    data: ["index.html", "master-manifest.json", "assets/data/bank-index.json", "assets/js/manifest.js", "assets/img/logo-dynanca.png"].map((rel) => ({ file: rel, bytes: raw(rel), gzipBytes: gz(rel) })),
  };

  await browser.close();
  await S.stopServer(server);

  fs.writeFileSync(path.join(outDir, "layout-matrix.json"), JSON.stringify(layout, null, 2) + "\n");
  fs.writeFileSync(path.join(outDir, "contrast-report.json"), JSON.stringify(contrast, null, 2) + "\n");
  fs.writeFileSync(path.join(outDir, "performance-lab.json"), JSON.stringify({ lab: performance, budget }, null, 2) + "\n");
  fs.writeFileSync(path.join(outDir, "screenshots.json"), JSON.stringify(shots, null, 2) + "\n");

  const layoutProblems = layout.filter((r) => r.scrollWidth > r.viewport || r.offscreen || r.clipped || r.overlaps || r.under24px || r.primaryUnder44px);
  console.log("Screenshots:            " + shots.length + " -> " + path.relative(process.cwd(), shotDir));
  console.log("Layout audits:          " + layout.length + " (" + layoutProblems.length + " with a finding)");
  console.log("Contrast audits:        " + contrast.length + " (" + contrast.filter((c) => c.failing).length + " with a failing pair)");
  contrast.forEach((c) => console.log("  " + c.theme + " / " + c.state + ": min normal text " + c.minNormalText + ":1, min large text " + (c.minLargeText === 99 ? "n/a" : c.minLargeText + ":1") + ", min control boundary " + c.minBoundary + ":1 (" + c.textSamples + " text samples)"));
  performance.forEach((p) => console.log("Lab — " + p.profile + ": FCP " + p.fcpMs + " ms, LCP " + p.lcpMs + " ms, CLS " + p.cls + ", catalog ready " + p.catalogReadyMs + " ms, " + p.requests + " requests, " + p.transferredBytes + " bytes, " + p.domNodes + " DOM nodes, " + p.cards + " cards"));
  console.log("Landing JS+CSS (gzip):  " + budget.totalGzipBytes + " bytes of an 81,920-byte budget");
  console.log("Console problems (page errors / CSP): " + consoleProblems.length);
  consoleProblems.slice(0, 10).forEach((p) => console.log("  " + p));
  if (layoutProblems.length || contrast.some((c) => c.failing) || consoleProblems.length) process.exitCode = 1;
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
