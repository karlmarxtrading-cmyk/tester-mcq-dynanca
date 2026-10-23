/* ==========================================================================
   Dynanca — practice page (Playwright + Chromium, real CSP enforced)
   -------------------------------------------------------------------------
   The practice engine, state module, renderers and MathJax are protected.
   Reviewed renderer fixes are recorded in baseline history. These tests
   check flow compatibility around the shell (theme module, back link, status states),
   using real banks from every collection.

   Banks and questions are chosen from the data (through the manifest and
   by content), never by guessing from file names. Where a test must reach
   one particular question it uses the app's own "resume where I left off"
   record in an isolated browser context — no production file is touched.

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

const question = (page) => page.locator(".practice-question").first();

async function openBank(page, id) {
  const response = await page.goto(S.practiceUrl(baseURL, id));
  await expect(page.locator(".practice-question, .practice-complete").first()).toBeVisible({ timeout: 20000 });
  return response;
}

async function currentQuestion(page, bank) {
  const id = await question(page).getAttribute("data-question-id");
  const q = bank.questions.find((x) => String(x.id) === id);
  expect(q, "the rendered question should exist in the bank file").toBeTruthy();
  return q;
}

/** Answer the question on screen correctly or incorrectly, using the bank's own answer key. */
async function answer(page, bank, wantCorrect) {
  const q = await currentQuestion(page, bank);
  const label = wantCorrect ? q.answer : q.options.find((o) => o.label !== q.answer).label;
  await question(page).locator(`.practice-option[data-label="${label}"]`).click();
  await expect(question(page).locator(".practice-verdict")).toBeVisible();
  return q;
}

/** Start the page on one specific question via the engine's own resume record. */
async function resumeAt(page, bankId, questionId) {
  await page.addInitScript(([key, value]) => {
    try {
      if (!window.localStorage.getItem(key)) window.localStorage.setItem(key, value);
    } catch (e) { /* ignore */ }
  }, ["dynanca-mcq-session-" + bankId + "-v2", JSON.stringify({ currentId: String(questionId), stepsSinceReview: 0, historyStack: [] })]);
}

async function mathSettled(page) {
  await page.waitForFunction(() => window.MathJax && typeof window.MathJax.typesetPromise === "function", null, { timeout: 20000 });
  await page.waitForTimeout(700);
}

const RAW_TEX = /\\\(|\\\)|\\\[|\\\]|\$\$/;

// The smallest shipped bank keeps a genuine full run short.
const smallest = S.availableEntries.slice().sort((a, b) => a.verifiedCount - b.verifiedCount || a.position - b.position)[0];

// ---------------------------------------------------------------------------
// Every collection opens through the canonical deep link
// ---------------------------------------------------------------------------
test.describe("Practice — one real bank from every collection", () => {
  for (const entry of S.firstAvailablePerCollection()) {
    test(`${entry.collectionName}: "${entry.id}" loads from its exact manifest path and renders a question`, async ({ page }) => {
      const problems = await S.watch(page);
      const bankRequests = [];
      page.on("response", (res) => {
        const url = new URL(res.url());
        if (url.pathname.startsWith("/questions/")) bankRequests.push({ path: decodeURIComponent(url.pathname), status: res.status() });
      });
      const bank = S.readBank(entry.id);
      const manifestEntry = S.Traversal.findPracticeFile(S.manifest.subjects, entry.id);
      await openBank(page, entry.id);

      // Exactly one bank file, the manifest's own path (spaces/capitals intact).
      expect(bankRequests).toEqual([{ path: "/" + manifestEntry.path, status: 200 }]);
      await expect(page.locator(".hero__title")).toHaveText(bank.title);
      await expect(page).toHaveTitle(bank.title + " | Dynanca");
      await expect(page.locator(".hero__lead")).not.toHaveText(/Loading/);

      // First question, in the bank's own order, with all of its options.
      const first = bank.questions[0];
      await expect(question(page)).toHaveAttribute("data-question-id", String(first.id));
      await expect(question(page).locator(".practice-option")).toHaveCount(first.options.length);
      await expect(page.locator("#progressSummary")).toContainText("0 / " + bank.questions.length);
      await mathSettled(page);
      expect(await problems.collect()).toEqual(S.CLEAN);
    });
  }

  test("the legacy deep-link forms still work, and the brand link still goes home", async ({ page }) => {
    const id = smallest.id;
    for (const url of [
      `${baseURL}/practice/index.html?quiz=${encodeURIComponent(id)}`,
      `${baseURL}/practice/?quiz=${encodeURIComponent(id)}`,
    ]) {
      await page.goto(url);
      await expect(question(page)).toBeVisible();
      await expect(page.locator(".hero__title")).toHaveText(S.readBank(id).title);
    }
    const brand = page.locator("header a.brand");
    await expect(brand).toHaveAttribute("href", "../");
    await brand.click();
    await expect(page).toHaveURL(baseURL + "/");
    await expect(page.locator("#bankGrid > li.bank").first()).toBeVisible();
  });

  test("every external request stays on the site's own origin (local MathJax, no CDN)", async ({ page }) => {
    const hosts = new Set();
    const mathjax = [];
    page.on("request", (req) => {
      const url = new URL(req.url());
      hosts.add(url.origin);
      if (url.pathname.includes("/assets/vendor/mathjax/")) mathjax.push(url.pathname);
    });
    await openBank(page, smallest.id);
    await mathSettled(page);
    expect(Array.from(hosts)).toEqual([baseURL]);
    expect(mathjax).toContain("/assets/vendor/mathjax/tex-chtml-full.js");
    expect(await page.evaluate(() => window.MathJax.version)).toBe("3.2.1");
  });
});

// ---------------------------------------------------------------------------
// Full learner flow on a real small bank
// ---------------------------------------------------------------------------
test.describe("Practice — answer, hint, explanation, next, previous, review, completion", () => {
  test("a complete run through the smallest shipped bank behaves as before", async ({ page }) => {
    const problems = await S.watch(page);
    const bank = S.readBank(smallest.id);
    const total = bank.questions.length;
    expect(total).toBeLessThanOrEqual(20);
    await openBank(page, smallest.id);

    // Hint: hidden until asked for, toggles, announces its state.
    const q1 = await currentQuestion(page, bank);
    const hintToggle = question(page).locator(".practice-hint-toggle");
    const hintText = question(page).locator(".practice-hint-text");
    await expect(hintText).toBeHidden();
    await expect(hintToggle).toHaveAttribute("aria-expanded", "false");
    await hintToggle.click();
    await expect(hintText).toBeVisible();
    await expect(hintToggle).toHaveAttribute("aria-expanded", "true");
    await expect(hintToggle).toHaveText("Hide hint");
    await hintToggle.click();
    await expect(hintText).toBeHidden();

    // Before answering: no verdict, no explanation, no Next.
    await expect(question(page).locator(".practice-verdict")).toBeHidden();
    await expect(question(page).locator(".practice-explanation")).toBeHidden();
    await expect(question(page).locator('[data-action="next"]')).toBeHidden();

    // A wrong answer: verdict, the right option revealed, explanation shown.
    await answer(page, bank, false);
    await expect(question(page).locator(".practice-verdict")).toHaveText("Incorrect");
    await expect(question(page).locator(`.practice-option[data-label="${q1.answer}"]`)).toHaveClass(/is-correct/);
    await expect(question(page).locator(".practice-option.is-wrong")).toHaveCount(1);
    await expect(question(page).locator(".practice-explanation")).toBeVisible();
    for (const option of await question(page).locator(".practice-option").all()) await expect(option).toBeDisabled();
    await expect(page.locator("#progressSummary")).toHaveText(`1 / ${total} done · 0 correct`);
    await expect(page.getByRole("button", { name: "Review 1 mistake" })).toBeVisible();

    // Next, then Previous returns to the answered question unchanged.
    await question(page).locator('[data-action="next"]').click();
    await expect(question(page)).toHaveAttribute("data-question-id", String(bank.questions[1].id));
    await question(page).locator('[data-action="prev"]').click();
    await expect(question(page)).toHaveAttribute("data-question-id", String(q1.id));
    await expect(question(page).locator(".practice-verdict")).toHaveText("Incorrect");
    await question(page).locator('[data-action="next"]').click();
    await expect(question(page)).toHaveAttribute("data-question-id", String(bank.questions[1].id));

    // Answer the rest correctly, in the bank's own order.
    for (let i = 1; i < total; i++) {
      await expect(question(page)).toHaveAttribute("data-question-id", String(bank.questions[i].id));
      await answer(page, bank, true);
      await expect(question(page).locator(".practice-verdict")).toHaveText("Correct");
      await expect(page.locator("#progressSummary")).toHaveText(`${i + 1} / ${total} done · ${i} correct`);
      await question(page).locator('[data-action="next"]').click();
    }

    // Deterministic completion screen.
    const complete = page.locator(".practice-complete");
    await expect(complete).toBeVisible();
    await expect(complete.locator(".practice-complete-heading")).toHaveText("Quiz complete.");
    await expect(complete.locator(".practice-complete-summary")).toHaveText(`${total - 1} / ${total} correct.`);
    await expect(question(page)).toHaveCount(0);

    // Review mode: exactly the missed question, then a defined end.
    await page.getByRole("button", { name: "Review 1 mistake" }).click();
    await expect(question(page)).toHaveAttribute("data-question-id", String(q1.id));
    await expect(question(page).locator(".practice-tag--review")).toHaveText("Review");
    await expect(page.getByRole("button", { name: /Back to practice/ })).toBeVisible();
    await question(page).locator('[data-action="next"]').click();
    await expect(page.locator(".practice-complete")).toBeVisible();

    // A reload keeps the finished state and the score.
    await page.reload();
    await expect(page.locator(".practice-complete")).toBeVisible();
    await expect(page.locator("#progressSummary")).toHaveText(`${total} / ${total} done · ${total - 1} correct`);
    expect(await problems.collect()).toEqual(S.CLEAN);
  });

  test("refresh resumes on the same question with progress and the Previous trail intact", async ({ page }) => {
    const bank = S.readBank(smallest.id);
    await openBank(page, smallest.id);
    for (let i = 0; i < 3; i++) {
      await answer(page, bank, i !== 1);
      await question(page).locator('[data-action="next"]').click();
    }
    await expect(question(page)).toHaveAttribute("data-question-id", String(bank.questions[3].id));
    const before = await page.evaluate(() => JSON.stringify(Object.keys(localStorage).sort().map((k) => [k, localStorage.getItem(k)])));

    await page.reload();
    await expect(question(page)).toHaveAttribute("data-question-id", String(bank.questions[3].id));
    await expect(page.locator("#progressSummary")).toHaveText(`3 / ${bank.questions.length} done · 2 correct`);
    await expect(page.getByRole("button", { name: "Review 1 mistake" })).toBeVisible();
    await question(page).locator('[data-action="prev"]').click();
    await expect(question(page)).toHaveAttribute("data-question-id", String(bank.questions[2].id));
    await expect(question(page).locator(".practice-verdict")).toHaveText("Correct");

    const after = await page.evaluate(() => Object.keys(localStorage).sort());
    expect(after).toEqual(JSON.parse(before).map((pair) => pair[0]));
    expect(after).toEqual([`dynanca-mcq-${smallest.id}-v2`, `dynanca-mcq-session-${smallest.id}-v2`].sort());
  });

  test("Reset progress asks first, clears only this bank's keys, and leaves the theme and other banks alone", async ({ page }) => {
    const bank = S.readBank(smallest.id);
    const other = S.availableEntries.find((e) => e.id !== smallest.id && e.collectionKey !== smallest.collectionKey);
    const otherBank = S.readBank(other.id);

    await openBank(page, other.id);
    await answer(page, otherBank, true);
    await page.locator('.theme-switch__btn[data-theme-option="dark"]').click();
    await openBank(page, smallest.id);
    await answer(page, bank, true);
    await question(page).locator('[data-action="next"]').click();
    await expect(page.locator("#progressSummary")).toContainText("1 / " + bank.questions.length);
    const otherKey = `dynanca-mcq-${other.id}-v2`;
    const otherValue = await page.evaluate((k) => localStorage.getItem(k), otherKey);
    expect(otherValue).toBeTruthy();

    // Declining the confirmation changes nothing.
    page.once("dialog", (dialog) => dialog.dismiss());
    await page.getByRole("button", { name: "Reset progress" }).click();
    await expect(page.locator("#progressSummary")).toContainText("1 / " + bank.questions.length);
    expect(await page.evaluate((k) => localStorage.getItem(k), `dynanca-mcq-${smallest.id}-v2`)).toBeTruthy();

    // Accepting clears this bank only, then reloads to a clean start.
    let message = "";
    page.once("dialog", (dialog) => { message = dialog.message(); dialog.accept(); });
    await Promise.all([page.waitForEvent("load"), page.getByRole("button", { name: "Reset progress" }).click()]);
    expect(message).toMatch(/Reset all practice progress on this page/);
    await expect(question(page)).toHaveAttribute("data-question-id", String(bank.questions[0].id));
    await expect(page.locator("#progressSummary")).toContainText("0 / " + bank.questions.length);
    const storage = await page.evaluate(() => JSON.parse(JSON.stringify(localStorage)));
    expect(storage[`dynanca-mcq-${smallest.id}-v2`]).toBeUndefined();
    expect(storage[otherKey]).toBe(otherValue);
    expect(storage["dynanca-mfc-theme-mode"]).toBe("dark");
    await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  });

  test("an existing legacy 'gp-practice-v1' record is still migrated by the practice page exactly as before", async ({ page }) => {
    const bank = S.readBank(smallest.id);
    const legacy = { [bank.questions[0].id]: { status: "answered_correct", selectedLabel: bank.questions[0].answer, answeredAt: 1700000000000, category: null } };
    await page.addInitScript((value) => {
      if (window.name === "seeded") return;
      window.name = "seeded";
      localStorage.setItem("gp-practice-v1", value);
    }, JSON.stringify(legacy));
    await openBank(page, smallest.id);
    const storage = await page.evaluate(() => JSON.parse(JSON.stringify(localStorage)));
    expect(storage["gp-practice-v1"]).toBeUndefined();
    expect(JSON.parse(storage[`dynanca-mcq-${smallest.id}-v2`])).toEqual(legacy);
    await expect(page.locator("#progressSummary")).toHaveText(`1 / ${bank.questions.length} done · 1 correct`);
    await expect(question(page)).toHaveAttribute("data-question-id", String(bank.questions[1].id));
  });

  test("using the landing page between two practice visits neither loses nor rewrites progress", async ({ page }) => {
    const bank = S.readBank(smallest.id);
    await openBank(page, smallest.id);
    await answer(page, bank, true);
    await question(page).locator('[data-action="next"]').click();
    await answer(page, bank, false);
    const snapshot = () => page.evaluate(() => {
      const out = {};
      Object.keys(localStorage).filter((k) => /^dynanca-mcq-|^gp-practice/.test(k)).sort().forEach((k) => { out[k] = localStorage.getItem(k); });
      return out;
    });
    const before = await snapshot();
    expect(Object.keys(before).length).toBe(2);

    await page.getByRole("link", { name: /Practice catalog/ }).click();
    await S.openLanding(page, baseURL, "?collection=" + encodeURIComponent(smallest.collectionKey));
    await page.getByLabel("Search banks").fill(smallest.id);
    await page.getByRole("button", { name: "Dark" }).click();
    await page.getByRole("button", { name: "Reset filters" }).click();
    await page.getByRole("navigation", { name: "Catalog pages" }).getByRole("link", { name: /Next/ }).click();
    expect(await snapshot()).toEqual(before);

    // Back in practice: the attempt records are exactly what they were. (The
    // engine itself then moves its "current question" pointer on to the next
    // unanswered question — its normal resume behaviour, not the landing's.)
    await openBank(page, smallest.id);
    const attemptKey = `dynanca-mcq-${smallest.id}-v2`;
    expect((await snapshot())[attemptKey]).toBe(before[attemptKey]);
    await expect(page.locator("#progressSummary")).toHaveText(`2 / ${bank.questions.length} done · 1 correct`);
    await expect(question(page)).toHaveAttribute("data-question-id", String(bank.questions[2].id));
  });

  test("a corrupted attempt record does not crash the practice page", async ({ page }) => {
    const problems = await S.watch(page);
    await page.addInitScript((key) => {
      try { window.localStorage.setItem(key, "{not-json"); } catch (e) { /* ignore */ }
    }, `dynanca-mcq-${smallest.id}-v2`);
    await openBank(page, smallest.id);
    await expect(question(page)).toBeVisible();
    await expect(page.locator("#progressSummary")).toContainText("0 / ");
    const seen = await problems.collect();
    expect(seen.pageErrors).toEqual([]);
    expect(seen.console).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// MathJax and diagrams (real questions, found by content)
// ---------------------------------------------------------------------------
test.describe("Practice — mathematics rendering is unchanged", () => {
  const hasInline = (s) => typeof s === "string" && /\\\(/.test(s);
  const hasDisplay = (s) => typeof s === "string" && /\\\[|\$\$/.test(s);

  test("inline math in the question text and in every option is typeset (no raw delimiters left)", async ({ page }) => {
    const problems = await S.watch(page);
    const found = S.findQuestion((q) => hasInline(q.question) && (q.options || []).length >= 2 && q.options.every((o) => hasInline(o.text)));
    expect(found, "a real question with inline math in text and options").toBeTruthy();
    await resumeAt(page, found.bankId, found.question.id);
    await openBank(page, found.bankId);
    await expect(question(page)).toHaveAttribute("data-question-id", String(found.question.id));
    await mathSettled(page);

    const text = question(page).locator(".practice-question-text");
    expect(await text.locator("mjx-container").count()).toBeGreaterThan(0);
    expect(await text.innerText()).not.toMatch(RAW_TEX);
    const options = question(page).locator(".practice-option-text");
    await expect(options).toHaveCount(found.question.options.length);
    for (const option of await options.all()) {
      expect(await option.locator("mjx-container").count()).toBeGreaterThan(0);
      expect(await option.innerText()).not.toMatch(RAW_TEX);
    }
    // CHTML output with its runtime stylesheet in place: glyphs have size.
    const box = await text.locator("mjx-container").first().boundingBox();
    expect(box.width).toBeGreaterThan(3);
    expect(box.height).toBeGreaterThan(3);
    expect(await page.locator("#MJX-CHTML-styles").count()).toBe(1);
    expect(await problems.collect()).toEqual(S.CLEAN);
  });

  test("display math in a question is typeset as a display equation", async ({ page }) => {
    const found = S.findQuestion((q) => hasDisplay(q.question));
    expect(found, "a real question with display math").toBeTruthy();
    await resumeAt(page, found.bankId, found.question.id);
    await openBank(page, found.bankId);
    await expect(question(page)).toHaveAttribute("data-question-id", String(found.question.id));
    await mathSettled(page);
    const text = question(page).locator(".practice-question-text");
    expect(await text.locator('mjx-container[display="true"]').count()).toBeGreaterThan(0);
    expect(await text.innerText()).not.toMatch(RAW_TEX);
  });

  test("math inside a hint is typeset when the hint is opened", async ({ page }) => {
    const found = S.findQuestion((q) => hasInline(q.hint));
    expect(found, "a real question with math in its hint").toBeTruthy();
    await resumeAt(page, found.bankId, found.question.id);
    await openBank(page, found.bankId);
    await expect(question(page)).toHaveAttribute("data-question-id", String(found.question.id));
    await mathSettled(page);
    await question(page).locator(".practice-hint-toggle").click();
    const hint = question(page).locator(".practice-hint-text");
    await expect(hint).toBeVisible();
    await expect.poll(() => hint.locator("mjx-container").count()).toBeGreaterThan(0);
    expect(await hint.innerText()).not.toMatch(RAW_TEX);
  });

  test("inline and display math inside an explanation are typeset after answering", async ({ page }) => {
    const problems = await S.watch(page);
    const found = S.findQuestion((q) => hasDisplay(q.explanation) && hasInline(q.explanation) && (q.options || []).length >= 2);
    expect(found, "a real question with display + inline math in its explanation").toBeTruthy();
    await resumeAt(page, found.bankId, found.question.id);
    await openBank(page, found.bankId);
    await expect(question(page)).toHaveAttribute("data-question-id", String(found.question.id));
    await mathSettled(page);
    await answer(page, found.bank, true);
    const explanation = question(page).locator(".practice-explanation");
    await expect(explanation).toBeVisible();
    await expect.poll(() => explanation.locator('mjx-container[display="true"]').count()).toBeGreaterThan(0);
    await expect.poll(() => explanation.locator('mjx-container:not([display="true"])').count()).toBeGreaterThan(0);
    expect(await explanation.innerText()).not.toMatch(RAW_TEX);
    expect(await problems.collect()).toEqual(S.CLEAN);
  });

  test("a Venn question renders its SVG diagram with the set names from the data", async ({ page }) => {
    const problems = await S.watch(page);
    const found = S.findQuestion(
      (q) => q.visual && q.visual.type === "venn" && Array.isArray(q.visual.setNames) && q.visual.setNames.length === 3,
      { maxBankSize: 1000 }
    );
    expect(found, "a real three-set Venn question").toBeTruthy();
    await resumeAt(page, found.bankId, found.question.id);
    await openBank(page, found.bankId);
    await expect(question(page)).toHaveAttribute("data-question-id", String(found.question.id));
    const svg = question(page).locator("svg").first();
    await expect(svg).toBeVisible();
    const labels = await svg.locator("text").allTextContents();
    for (const name of found.question.visual.setNames) expect(labels).toContain(name);
    for (const value of Object.values(found.question.visual.regions)) expect(labels).toContain(String(value));
    const box = await svg.boundingBox();
    expect(box.width).toBeGreaterThan(150);
    expect(await problems.collect()).toEqual(S.CLEAN);
  });

  test("the full practice + math + Venn flow produces zero CSP violations in both themes", async ({ page }) => {
    const problems = await S.watch(page);
    const venn = S.findQuestion((q) => q.visual && q.visual.type === "venn", { maxBankSize: 1000 });
    const math = S.findQuestion((q) => hasDisplay(q.explanation) && (q.options || []).length >= 2);
    for (const theme of ["light", "dark"]) {
      await page.emulateMedia({ colorScheme: theme });
      const response = await openBank(page, math.bankId);
      expect(response.headers()["content-security-policy"]).toContain("script-src 'self' 'sha256-");
      await mathSettled(page);
      await question(page).locator(".practice-hint-toggle").click();
      await question(page).locator(".practice-option").first().click();
      await mathSettled(page);
      await openBank(page, venn.bankId);
      await mathSettled(page);
    }
    const seen = await problems.collect();
    expect(seen.csp).toEqual([]);
    expect(seen.pageErrors).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// Status layer: every failure ends in a real, recoverable state
// ---------------------------------------------------------------------------
test.describe("Practice — loading failures are readable and recoverable", () => {
  async function expectFailureShell(page, expected) {
    const container = page.locator("#practiceContainer");
    await expect(container).toHaveAttribute("data-error-kind", expected.kind);
    // The hero no longer says "Loading…" and carries a real status title.
    await expect(page.locator(".hero__title")).toHaveText(expected.title);
    await expect(page.locator(".hero__lead")).not.toHaveText(/Loading/);
    await expect(page.locator(".hero__lead")).toContainText(expected.lead);
    await expect(page).toHaveTitle(expected.title + " | Dynanca");
    const alert = page.getByRole("alert");
    await expect(alert).toBeVisible();
    await expect(alert).toContainText(expected.title);
    await expect(page.locator("body")).not.toContainText(/console|developer tools/i);
    // A way back, always.
    await expect(alert.getByRole("link", { name: "Back to the catalog" })).toHaveAttribute("href", "../#catalog");
    await expect(page.getByRole("link", { name: /Practice catalog/ })).toBeVisible();
    await expect(page.locator("header a.brand")).toHaveAttribute("href", "../");
    // "Try again" only where trying again can help.
    await expect(alert.getByRole("button", { name: "Try again" })).toHaveCount(expected.retry ? 1 : 0);
    // Nothing to reset in a failed state; no question, no stale progress.
    await expect(page.getByRole("button", { name: "Reset progress" })).toBeHidden();
    await expect(page.locator(".practice-question")).toHaveCount(0);
    await expect(page.locator("#progressSummary")).toHaveText("");
    // The theme works even though the data did not load.
    await page.locator('.theme-switch__btn[data-theme-option="dark"]').click();
    await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
    await expect(page.locator('.theme-switch__btn[data-theme-option="dark"]')).toHaveAttribute("aria-pressed", "true");
    await page.locator('.theme-switch__btn[data-theme-option="light"]').click();
    await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
  }

  test("no ?quiz= in the address", async ({ page }) => {
    const errors = [];
    page.on("pageerror", (e) => errors.push(String(e)));
    await page.goto(baseURL + "/practice/index.html");
    await expectFailureShell(page, { kind: "no-quiz", title: "No practice bank selected", lead: "does not name a practice bank", retry: false });
    expect(errors).toEqual([]); // handled state, not an unhandled rejection
  });

  test("an id that is not in the manifest (ids are never guessed or slugified)", async ({ page }) => {
    const errors = [];
    page.on("pageerror", (e) => errors.push(String(e)));
    const real = S.availableEntries[0].id;
    await page.goto(S.practiceUrl(baseURL, real.toUpperCase() + " "));
    await expectFailureShell(page, { kind: "not-found", title: "Practice bank not found", lead: "No bank in the catalog matches this address.", retry: false });
    expect(errors).toEqual([]);
  });

  test("a listed bank whose file is not in this release, opened directly", async ({ page }) => {
    const pendingFixture = await S.unavailableFixture(page);
    const target = pendingFixture.target;
    await page.goto(S.practiceUrl(baseURL, target.id));
    await expectFailureShell(page, { kind: "unavailable", title: "Not available in this release", lead: target.name, retry: false });
    await expect(page.locator(".hero__lead")).toContainText("its questions are not included in this release");
    await expect(page.locator("body")).not.toContainText(/soon|coming/i);
    // Recovery leads to a working catalog.
    await page.getByRole("alert").getByRole("link", { name: "Back to the catalog" }).click();
    await expect(page).toHaveURL(baseURL + "/#catalog");
    await expect(page.locator("#bankGrid > li.bank").first()).toBeVisible();
  });

  test("a host that answers a missing bank with an HTML page (HTTP 200) is still treated as not available", async ({ page }) => {
    const id = S.availableEntries[0].id;
    await page.route("**/questions/**", (route) => route.fulfill({ status: 200, contentType: "text/html; charset=utf-8", body: "<!doctype html><title>Home</title>" }));
    await page.goto(S.practiceUrl(baseURL, id));
    await expectFailureShell(page, { kind: "unavailable", title: "Not available in this release", lead: S.catalog.byId[id].name, retry: false });
  });

  test("a network failure while downloading the bank can be retried and then works", async ({ page }) => {
    const id = smallest.id;
    let block = true;
    await page.route("**/questions/**", (route) => (block ? route.abort("internetdisconnected") : route.continue()));
    await page.goto(S.practiceUrl(baseURL, id));
    await expectFailureShell(page, { kind: "bank-unreachable", title: "Practice could not be loaded", lead: "could not be downloaded", retry: true });

    block = false;
    await page.getByRole("alert").getByRole("button", { name: "Try again" }).click();
    await expect(question(page)).toBeVisible();
    await expect(page.locator(".hero__title")).toHaveText(S.readBank(id).title);
    await expect(page.getByRole("alert")).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Reset progress" })).toBeVisible();
    await expect(page.locator("html")).toHaveAttribute("data-theme", "light"); // the choice made on the error page was kept
  });

  test("a server error for the bank, a damaged bank file and an empty bank each get the right state", async ({ page }) => {
    const id = smallest.id;
    let mode = "500";
    await page.route("**/questions/**", (route) => {
      if (mode === "500") return route.fulfill({ status: 500, contentType: "text/plain", body: "error" });
      if (mode === "damaged") return route.fulfill({ status: 200, contentType: "application/json", body: '{"questions":[{"id":"1"' });
      return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ questions: [] }) });
    });
    await page.goto(S.practiceUrl(baseURL, id));
    await expectFailureShell(page, { kind: "bank-unreachable", title: "Practice could not be loaded", lead: "could not be downloaded", retry: true });
    mode = "damaged";
    await page.reload();
    await expectFailureShell(page, { kind: "bank-damaged", title: "This practice bank could not be opened", lead: "incomplete or damaged", retry: true });
    mode = "empty";
    await page.reload();
    await expectFailureShell(page, { kind: "bank-empty", title: "This practice bank has no questions", lead: "nothing to practise", retry: false });
  });

  test("the catalog file failing or being malformed stops 'Loading…' with a retryable state", async ({ page }) => {
    let mode = "abort";
    await page.route("**/master-manifest.json", (route) => {
      if (mode === "abort") return route.abort("connectionrefused");
      return route.fulfill({ status: 200, contentType: "application/json", body: '{"subjects": 5}' });
    });
    await page.goto(S.practiceUrl(baseURL, smallest.id));
    await expectFailureShell(page, { kind: "catalog-unreachable", title: "Practice could not be loaded", lead: "practice catalog could not be reached", retry: true });
    mode = "malformed";
    await page.reload();
    await expectFailureShell(page, { kind: "catalog-unreachable", title: "Practice could not be loaded", lead: "practice catalog could not be reached", retry: true });
  });

  test("a download that never finishes hits the deadline instead of loading forever", async ({ page }) => {
    await page.clock.install();
    await page.route("**/questions/**", () => { /* never answered */ });
    await page.goto(S.practiceUrl(baseURL, smallest.id));
    await expect(page.locator(".hero__lead")).toHaveText("Loading…");
    await page.clock.fastForward(31000);
    await expect(page.locator("#practiceContainer")).toHaveAttribute("data-error-kind", "bank-unreachable");
    await expect(page.locator(".hero__title")).toHaveText("Practice could not be loaded");
    await expect(page.getByRole("alert").getByRole("button", { name: "Try again" })).toBeVisible();
  });

  test("with JavaScript disabled the practice page explains itself instead of showing 'Loading…'", async ({ browser }) => {
    const context = await browser.newContext({ javaScriptEnabled: false });
    const page = await context.newPage();
    await page.goto(S.practiceUrl(baseURL, smallest.id));
    const notice = await page.locator("noscript").innerHTML();
    expect(notice).toContain("JavaScript is turned off.");
    expect(notice).toContain("needs JavaScript to load the questions and check your answers");
    expect(notice).toContain('href="../"');
    await expect(page.locator(".hero__lead")).toBeHidden();
    await expect(page.getByRole("link", { name: /Practice catalog/ })).toBeVisible();
    await context.close();
  });
});

// ---------------------------------------------------------------------------
// Computer science / algorithms — catalog → practice, end to end
// (regression for the stale assets/data/bank-index.json that hid this bank)
// ---------------------------------------------------------------------------
test.describe("Computer science — the Algorithms bank end to end", () => {
  test("visible under the default AVAILABLE filter with its verified count, opens, answers, explains, advances and survives a reload", async ({ page }) => {
    const problems = await S.watch(page);
    const bank = S.readBank("algorithms");
    const verified = bank.questions.length;
    expect(S.bankIndex.available["algorithms"]).toBe(verified);

    await S.openLanding(page, baseURL);
    const collectionCard = page.locator('#collectionGrid a[data-collection="computer science"]');
    await expect(collectionCard).toBeVisible();
    const available = S.availableEntries.filter((e) => e.collectionKey === "computer science").length;
    await expect(collectionCard.locator(".collection-card__count")).toHaveText(`${available} ${available === 1 ? "bank" : "banks"} available`);
    await collectionCard.click();
    await expect(page).toHaveURL(/\?collection=computer%20science$/);
    const card = page.locator('#bankGrid li[data-bank-id="algorithms"]');
    await expect(card).toBeVisible();
    await expect(card).toHaveAttribute("data-available", "true");
    await expect(card.locator(".bank__count")).toHaveText(`${verified} questions`);

    const bankRequest = page.waitForResponse((res) => decodeURIComponent(new URL(res.url()).pathname) === "/questions/computer science/algorithms.json");
    await card.locator("a.bank__link").click();
    await page.waitForURL(S.practiceUrl(baseURL, "algorithms"));
    const res = await bankRequest;
    expect(res.status()).toBe(200);
    expect(res.headers()["content-type"]).toMatch(/application\/json/);

    await expect(question(page)).toHaveAttribute("data-question-id", String(bank.questions[0].id));
    await expect(question(page).locator(".practice-option")).toHaveCount(bank.questions[0].options.length);
    await answer(page, bank, true);
    await expect(question(page).locator(".practice-verdict")).toHaveText("Correct");
    await expect(question(page).locator(".practice-explanation")).toBeVisible();
    await question(page).locator('[data-action="next"]').click();
    await expect(question(page)).toHaveAttribute("data-question-id", String(bank.questions[1].id));

    await page.reload();
    await expect(question(page)).toBeVisible({ timeout: 20000 });
    await expect(page.locator("#progressSummary")).toContainText(`1 / ${verified} done`);
    expect(await problems.collect()).toEqual(S.CLEAN);
  });
});
