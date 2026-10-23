/* ==========================================================================
   Dynanca — shared helpers for the browser (Playwright + Chromium) suite
   -------------------------------------------------------------------------
   - starts the project's own preview server (tools/dev-server/serve.js),
     which sends the response headers from `_headers`, so every test runs
     under the real Content-Security-Policy;
   - computes EXPECTED values in Node from master-manifest.json and
     assets/data/bank-index.json with the same view-model code the page
     ships, so tests compare the UI against the data instead of against
     hardcoded numbers that would go stale when bank files are added;
   - never writes into the project. Fixture manifests are served by
     intercepting requests inside the test browser only.
   ========================================================================== */
"use strict";

const fs = require("fs");
const path = require("path");

const projectRoot = path.resolve(__dirname, "..", "..");
const { createServer } = require(path.join(projectRoot, "tools", "dev-server", "serve.js"));
const Traversal = require(path.join(projectRoot, "assets", "js", "manifest.js"));
const Model = require(path.join(projectRoot, "assets", "js", "catalog-model.js"));

const manifest = JSON.parse(fs.readFileSync(path.join(projectRoot, "master-manifest.json"), "utf8"));
const bankIndex = JSON.parse(fs.readFileSync(path.join(projectRoot, "assets", "data", "bank-index.json"), "utf8"));
const catalog = Model.buildCatalog(manifest, bankIndex, Traversal);

function startServer() {
  const server = createServer({ root: process.env.DYNANCA_TEST_ROOT || projectRoot });
  return new Promise((resolve) => {
    server.listen(0, "127.0.0.1", () => resolve({ server, baseURL: "http://127.0.0.1:" + server.address().port }));
  });
}

function stopServer(server) {
  return new Promise((resolve) => server.close(resolve));
}

/** Expected result of a catalog state, computed with the shipped model. */
function expectFor(rawState) {
  const state = Model.normalizeState(rawState || {}, catalog);
  const result = Model.filterEntries(catalog, state);
  const page = Model.paginate(result.items, state.page, Model.PAGE_SIZE);
  return { state, result, page, ids: page.items.map((e) => e.id) };
}

function readBank(id) {
  const entry = Traversal.findPracticeFile(manifest.subjects, id);
  return JSON.parse(fs.readFileSync(path.join(projectRoot, entry.path), "utf8"));
}

const availableEntries = catalog.entries.filter((e) => e.available);
const unavailableEntries = catalog.entries.filter((e) => !e.available);

/** First available bank of every collection (one real bank per collection). */
function firstAvailablePerCollection() {
  return catalog.collections
    .map((c) => availableEntries.find((e) => e.collectionKey === c.key))
    .filter(Boolean);
}

/**
 * Find a real question by content, searching small available banks first
 * so a test can reach it quickly. Never guesses from file names.
 * @param {(q: object) => boolean} predicate
 * @param {{maxBankSize?: number, collection?: string}} [options]
 */
function findQuestion(predicate, options) {
  const maxBankSize = (options && options.maxBankSize) || 60;
  const pool = availableEntries
    .filter((e) => e.verifiedCount <= maxBankSize && (!options || !options.collection || e.collectionKey === options.collection))
    .sort((a, b) => a.verifiedCount - b.verifiedCount || a.position - b.position);
  for (const entry of pool) {
    const bank = readBank(entry.id);
    const index = bank.questions.findIndex(predicate);
    if (index !== -1) return { bankId: entry.id, bank, question: bank.questions[index], index };
  }
  return null;
}

/**
 * Collect everything that should stay empty in a healthy page: console
 * errors, uncaught exceptions, failed requests and CSP violations (both
 * the browser's console report and the DOM securitypolicyviolation event).
 */
async function watch(page) {
  const problems = { console: [], pageErrors: [], failedRequests: [], csp: [] };
  page.on("console", (msg) => {
    const text = msg.text();
    if (/Refused to (load|execute|apply|connect|frame|send)|Content Security Policy/i.test(text)) problems.csp.push(text);
    else if (msg.type() === "error") problems.console.push(text);
  });
  page.on("pageerror", (err) => problems.pageErrors.push(String(err)));
  page.on("requestfailed", (req) => problems.failedRequests.push(req.url() + " " + (req.failure() ? req.failure().errorText : "")));
  await page.addInitScript(() => {
    window.__cspViolations = [];
    document.addEventListener("securitypolicyviolation", (e) => {
      window.__cspViolations.push(e.violatedDirective + " " + e.blockedURI);
    });
  });
  problems.collect = async () => {
    const dom = await page.evaluate(() => window.__cspViolations || []).catch(() => []);
    return {
      console: problems.console,
      pageErrors: problems.pageErrors,
      failedRequests: problems.failedRequests,
      csp: problems.csp.concat(dom),
    };
  };
  return problems;
}

const CLEAN = { console: [], pageErrors: [], failedRequests: [], csp: [] };

/** Open the landing page and wait until the catalog has left "loading". */
async function openLanding(page, baseURL, search) {
  const response = await page.goto(baseURL + "/" + (search || ""));
  await page.waitForFunction(() => {
    const s = document.getElementById("resultSummary");
    return s && !/Loading/.test(s.textContent);
  }, null, { timeout: 15000 });
  return response;
}

function practiceUrl(baseURL, id) {
  return baseURL + "/practice/index.html?quiz=" + encodeURIComponent(id);
}

/** Bank ids currently rendered in the catalog grid, in DOM order. */
function gridIds(page) {
  return page.locator("#bankGrid > li.bank").evaluateAll((nodes) => nodes.map((n) => n.getAttribute("data-bank-id")));
}

/* ---------- In-page audits (serialised into the browser) ---------- */

/**
 * Geometry audit: real bounding boxes, not just "is there a scrollbar".
 * Returns every visible element that leaves the viewport horizontally,
 * every text container whose content is clipped, every pair of interactive
 * targets that overlap, and every interactive target that is too small.
 */
function layoutAudit() {
  const vw = document.documentElement.clientWidth;
  const out = { viewport: vw, scrollWidth: document.documentElement.scrollWidth, offscreen: [], clipped: [], overlaps: [], small: [], comfortable: [] };

  function describe(el) {
    return el.tagName.toLowerCase() + (el.id ? "#" + el.id : "") + (el.className && typeof el.className === "string" ? "." + el.className.trim().split(/\s+/).join(".") : "") +
      " “" + (el.textContent || "").trim().replace(/\s+/g, " ").slice(0, 40) + "”";
  }
  function visible(el) {
    if (!el.getClientRects().length) return false;
    const cs = getComputedStyle(el);
    return cs.visibility !== "hidden" && cs.display !== "none";
  }
  // Elements that are clipped ON PURPOSE for assistive technology.
  function isA11yClip(el) {
    for (let n = el; n && n !== document.body; n = n.parentElement) {
      const cs = getComputedStyle(n);
      if (cs.position === "absolute" && (cs.clipPath === "inset(50%)" || parseFloat(cs.width) <= 1)) return true;
      if (n.classList.contains("skip-link") && document.activeElement !== n) return true;
    }
    return false;
  }

  document.querySelectorAll("body *").forEach((el) => {
    if (!visible(el) || isA11yClip(el)) return;
    if (el.closest("svg") && el.tagName.toLowerCase() !== "svg") return;
    const r = el.getBoundingClientRect();
    if (r.width === 0 || r.height === 0) return;
    if (r.right > vw + 0.5 || r.left < -0.5) out.offscreen.push(describe(el) + " [" + Math.round(r.left) + "," + Math.round(r.right) + "]");
  });

  document.querySelectorAll(
    ".hero__title, .hero__lead, .how li, .bank__title, .bank__id, .bank__context, .bank__meta, .collection-card__name, .collection-card__count, " +
    ".results-bar__summary, .results-note, .panel__title, .panel__text, .btn, .pager__link, .pager__step, .segmented__option, .field__label, " +
    ".site-nav a, .section__title, .section__note, .badge, .facts dt, .facts dd, .practice-status__title, .practice-status__text, .hero__back-link"
  ).forEach((el) => {
    if (!visible(el)) return;
    const cs = getComputedStyle(el);
    if (cs.display === "inline") return;
    // Horizontal: content wider than its box is always a defect (it either
    // is cut off or spills over a neighbour). Vertical: only a defect when
    // the box actually clips (overflow not visible) — tight heading
    // line-heights legitimately let glyph descenders extend a pixel or two
    // past the line box without anything being cut.
    const clipsY = cs.overflowY !== "visible";
    if (el.scrollWidth > el.clientWidth + 1 || (clipsY && el.scrollHeight > el.clientHeight + 1)) {
      out.clipped.push(describe(el) + " scroll " + el.scrollWidth + "x" + el.scrollHeight + " > client " + el.clientWidth + "x" + el.clientHeight);
    }
  });

  // Interactive targets. A bank card is one target (its link is stretched
  // over the card); a radio is represented by its visible label.
  const targets = [];
  document.querySelectorAll("a[href], button, input, select, label.segmented__option").forEach((el) => {
    if (!visible(el) || el.disabled) return;
    if (el.matches("input.segmented__input")) return;
    if (isA11yClip(el)) return;
    let box = el.getBoundingClientRect();
    if (el.matches("a.bank__link")) box = el.closest(".bank").getBoundingClientRect();
    if (box.width === 0 || box.height === 0) return;
    targets.push({ el, box, name: describe(el) });
  });
  for (let i = 0; i < targets.length; i++) {
    for (let j = i + 1; j < targets.length; j++) {
      const a = targets[i], b = targets[j];
      if (a.el.contains(b.el) || b.el.contains(a.el)) continue;
      // The clear button sits inside the search box's reserved padding.
      const pair = [a.el.id, b.el.id].sort().join("+");
      if (pair === "q+qClear") continue;
      const w = Math.min(a.box.right, b.box.right) - Math.max(a.box.left, b.box.left);
      const h = Math.min(a.box.bottom, b.box.bottom) - Math.max(a.box.top, b.box.top);
      if (w > 1 && h > 1) out.overlaps.push(a.name + " ↔ " + b.name);
    }
  }
  targets.forEach((t) => {
    const inlineInText = t.el.tagName === "A" && getComputedStyle(t.el).display === "inline" && !t.el.matches("a.bank__link");
    if (!inlineInText && (t.box.width < 24 || t.box.height < 24)) out.small.push(t.name + " " + Math.round(t.box.width) + "x" + Math.round(t.box.height));
    // Primary controls are designed for a comfortable ~44px.
    if (t.el.matches(".control, .btn--primary, .btn--ghost, .pager__link, .pager__step, .site-nav a, .search__clear, .practice-status__retry, .practice-status__link, .hero__back-link") && t.box.height < 43.5) {
      out.comfortable.push(t.name + " height " + Math.round(t.box.height));
    }
  });
  return out;
}

/**
 * Contrast audit on ACTUAL computed colours. For every element that owns
 * visible text it resolves the text colour and the nearest opaque
 * background and returns the WCAG contrast ratio, plus the ratio of form
 * control / button boundaries against the surface they sit on.
 */
function contrastAudit() {
  function parse(color) {
    const m = /rgba?\(([^)]+)\)/.exec(color);
    if (!m) return null;
    const p = m[1].split(/[,\s/]+/).filter(Boolean).map(Number);
    return { r: p[0], g: p[1], b: p[2], a: p.length > 3 ? p[3] : 1 };
  }
  function blend(top, bottom) {
    const a = top.a;
    const resultAlpha = a + bottom.a * (1 - a);
    if (!resultAlpha) return { r: 0, g: 0, b: 0, a: 0 };
    const channel = (key) => (top[key] * a + bottom[key] * bottom.a * (1 - a)) / resultAlpha;
    return { r: channel("r"), g: channel("g"), b: channel("b"), a: resultAlpha };
  }
  function lum(c) {
    const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); };
    return 0.2126 * f(c.r) + 0.7152 * f(c.g) + 0.0722 * f(c.b);
  }
  function ratio(a, b) {
    const la = lum(a), lb = lum(b);
    return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
  }
  function painted(el, foreground) {
    let paint = foreground || { r: 0, g: 0, b: 0, a: 0 };
    for (let n = el; n; n = n.parentElement) {
      const cs = getComputedStyle(n);
      const c = parse(cs.backgroundColor);
      if (c) paint = blend(paint, c);
      paint.a *= Number(cs.opacity);
    }
    return blend(paint, { r: 255, g: 255, b: 255, a: 1 });
  }
  function background(el) { return painted(el); }
  function hex(c) {
    return "#" + [c.r, c.g, c.b].map((v) => Math.round(v).toString(16).padStart(2, "0")).join("").toUpperCase();
  }
  function label(el) {
    return el.tagName.toLowerCase() + (el.className && typeof el.className === "string" ? "." + el.className.trim().split(/\s+/)[0] : "");
  }
  function inactive(el) {
    if (el.closest(":disabled, [aria-disabled='true']")) return true;
    const associated = el.closest("label");
    return !!(associated && associated.control && associated.control.disabled);
  }

  const text = [];
  let inactiveTextSamples = 0;
  document.querySelectorAll("body *").forEach((el) => {
    if (!el.getClientRects().length) return;
    const cs = getComputedStyle(el);
    if (cs.visibility === "hidden" || cs.display === "none" || parseFloat(cs.opacity) === 0) return;
    if (el.closest("svg, noscript, script, style")) return;
    const ownText = Array.from(el.childNodes).some((n) => n.nodeType === 3 && n.textContent.trim());
    const isControlText = el.matches("input, select") && (el.value || el.placeholder);
    if (!ownText && !isControlText) return;
    // WCAG SC 1.4.3 exempts text in genuinely inactive controls, including
    // a disabled input's associated label. Keep enabled text under test.
    if (inactive(el)) { inactiveTextSamples += 1; return; }
    const bg = background(el);
    const fgRaw = parse(cs.color);
    if (!fgRaw) return;
    // Group opacity affects the painted foreground, not just rgba colour.
    const fg = painted(el, fgRaw);
    const size = parseFloat(cs.fontSize);
    const weight = parseInt(cs.fontWeight, 10) || 400;
    const large = size >= 24 || (size >= 18.66 && weight >= 700);
    text.push({
      el: label(el), sample: (el.textContent || el.value || el.placeholder || "").trim().replace(/\s+/g, " ").slice(0, 32),
      ratio: ratio(fg, bg), need: large ? 3 : 4.5, fg: hex(fg), bg: hex(bg), size: Math.round(size * 10) / 10, weight,
    });
    if (el.matches("input") && el.placeholder && !el.value) {
      const ph = parse(getComputedStyle(el, "::placeholder").color);
      if (ph) {
        ph.a *= Number(getComputedStyle(el, "::placeholder").opacity);
        const phPaint = painted(el, ph);
        text.push({ el: "input::placeholder", sample: el.placeholder.slice(0, 32), ratio: ratio(phPaint, bg), need: 4.5, fg: hex(phPaint), bg: hex(bg), size: Math.round(size * 10) / 10, weight });
      }
    }
  });

  const boundaries = [];
  let inactiveBoundarySamples = 0;
  document.querySelectorAll(".control, .segmented, .theme-switch, .btn--ghost, a.pager__link, a.pager__step, .btn--primary, .segmented__input:checked + .segmented__option, [aria-pressed='true'], .pager__link[aria-current='page']").forEach((el) => {
    if (!el.getClientRects().length) return;
    if (inactive(el)) { inactiveBoundarySamples += 1; return; }
    const cs = getComputedStyle(el);
    const outside = background(el.parentElement);
    const own = background(el);
    const border = parse(cs.borderTopColor);
    const borderWidth = parseFloat(cs.borderTopWidth);
    // A control is identifiable either by its border or by its own fill.
    const byBorder = border && borderWidth > 0 ? ratio(blend(border, outside), outside) : 0;
    const byFill = ratio(own, outside);
    boundaries.push({ el: label(el), ratio: Math.max(byBorder, byFill), need: 3 });
  });

  return { text, boundaries, inactiveTextSamples, inactiveBoundarySamples };
}

module.exports = {
  projectRoot, Traversal, Model, manifest, bankIndex, catalog,
  startServer, stopServer, expectFor, readBank,
  availableEntries, unavailableEntries, firstAvailablePerCollection, findQuestion,
  watch, CLEAN, openLanding, practiceUrl, gridIds, layoutAudit, contrastAudit,
};

// Exercise unavailable-bank states even when the owner's corpus is complete.
module.exports.unavailableFixture = async function(page) {
 if(unavailableEntries.length) return {target:unavailableEntries[0],expectFor};
 const fixture=structuredClone(manifest),target={id:"pending-test-bank",name:"Pending fixture",file:"pending-test-bank.json",path:"questions/pending-test-bank.json",questionCount:1};
 const subject=fixture.subjects.find(s=>s.id==="comprehensive math");
 for(let i=0;i<=Model.PAGE_SIZE;i++) subject.practice_files.push(i===0?target:{...target,id:target.id+"-"+i,file:"pending-test-"+i+".json",path:"questions/pending-test-"+i+".json"});
 const model=Model.buildCatalog(fixture,bankIndex,Traversal);
 await page.route("**/master-manifest.json",route=>route.fulfill({json:fixture}));
 return {target,expectFor(raw){const state=Model.normalizeState(raw||{},model),result=Model.filterEntries(model,state),page=Model.paginate(result.items,state.page,Model.PAGE_SIZE);return {state,result,page,ids:page.items.map(e=>e.id)};}};
};
