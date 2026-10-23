"use strict";
const { test, expect } = require("@playwright/test");
const S = require("./support.js");
const bank = S.readBank("ml");
const mlEntry = JSON.parse(require("fs").readFileSync(require("path").resolve(__dirname,"../../master-manifest.json"))).subjects.find(s=>s.id==="computer science").practice_files.find(b=>b.id==="ml").name;
let server, baseURL;
test.beforeAll(async () => { ({ server, baseURL } = await S.startServer()); });
test.afterAll(async () => { await S.stopServer(server); });
const article = (page) => page.locator(".practice-question").first();
const option = (page, label) => article(page).locator(`.practice-option[data-label="${label}"]`);
async function ready(page) {
  await expect(article(page)).toBeVisible();
  await page.waitForFunction(() => window.MathJax && window.MathJax.typesetPromise);
  await page.evaluate(() => MathJax.startup.promise);
}
async function maths(page) {
  await page.evaluate(() => MathJax.typesetPromise([document.getElementById("practiceContainer")]));
  await expect(page.locator("mjx-merror, [data-mjx-error]")).toHaveCount(0);
}

for (const width of [320, 390, 768, 1280]) {
  for (const theme of ["light", "dark"]) {
    test(`ML ${width}px ${theme}: search, scoring, hint, math, reload, Previous, review, catalog, reset`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      await page.emulateMedia({ colorScheme: theme });
      const problems = await S.watch(page);
      const response = await S.openLanding(page, baseURL, "?collection=computer%20science&q=Machine+Learning");
      expect(response.headers()["content-security-policy"]).toContain("script-src");
      const card = page.locator('#bankGrid [data-bank-id="ml"]');
      await expect(card).toHaveAttribute("data-available", "true");
      await expect(card.locator(".bank__count")).toHaveText(`${bank.questions.length} questions`);
      await expect(card.locator(".bank__title")).toHaveText(mlEntry);
      await card.locator("a").click();
      await expect(page).toHaveURL(S.practiceUrl(baseURL, "ml"));
      await ready(page);
      await expect(page.locator("h1")).toHaveText(bank.title);
      await expect(page.locator("html")).toHaveAttribute("data-theme", theme);
      await option(page, bank.questions[0].options.find((o) => o.label !== bank.questions[0].answer).label).click();
      await expect(article(page).locator(".practice-verdict")).toHaveText("Incorrect");
      const incorrectContrast = await page.evaluate(S.contrastAudit);
      expect(incorrectContrast.text.filter((x) => x.ratio < x.need)).toEqual([]);
      await article(page).locator('[data-action="next"]').click();
      await option(page, bank.questions[1].answer).click();
      await article(page).locator('[data-action="next"]').click();
      await page.reload();
      await ready(page);
      await expect(article(page)).toHaveAttribute("data-question-id", "ml-3");
      await expect(page.locator("#progressSummary")).toContainText(`2 / ${bank.questions.length} done`);
      await article(page).locator('[data-action="prev"]').click();
      await expect(article(page)).toHaveAttribute("data-question-id", "ml-2");
      await expect(option(page, bank.questions[1].answer)).toBeDisabled();
      // The public renderer is used only to reach a real quantitative item
      // without manufacturing answers for the skipped questions.
      await page.evaluate(() => PracticeEngine.render("ml-13"));
      await article(page).getByRole("button", { name: "Show hint" }).click();
      await expect(article(page).locator(".practice-hint-text")).toBeVisible();
      await expect(article(page).locator(".practice-hint-toggle")).toHaveAttribute("aria-expanded", "true");
      await option(page, "B").click(); // independently computed (35-10)/(60-10)=0.5
      await expect(article(page).locator(".practice-verdict")).toHaveText("Correct");
      await expect(article(page).locator(".practice-explanation")).toBeVisible();
      await maths(page);
      await expect(article(page).locator("mjx-container")).not.toHaveCount(0);
      const geometry = await page.evaluate(() => ({ w: innerWidth, body: document.documentElement.scrollWidth }));
      expect(geometry.body).toBeLessThanOrEqual(geometry.w + 1);
      const contrast = await page.evaluate(S.contrastAudit);
      expect(contrast.text.filter((x) => x.ratio < x.need)).toEqual([]);
      const storageBefore = await page.evaluate(() => localStorage.getItem("dynanca-mcq-ml-v2"));
      await page.getByRole("button", { name: /Review.*mistake/ }).click();
      await expect(article(page)).toHaveAttribute("data-question-id", "ml-1");
      await article(page).locator('[data-action="next"]').click();
      await expect(article(page)).not.toHaveAttribute("data-question-id", "ml-1");
      await page.getByRole("link", { name: /Practice catalog/ }).click();
      await expect(page.locator('#bankGrid [data-bank-id="ml"]')).toBeVisible();
      expect(await page.evaluate(() => localStorage.getItem("dynanca-mcq-ml-v2"))).toBe(storageBefore);
      await page.locator('#bankGrid [data-bank-id="ml"] a').click();
      await ready(page);
      await page.evaluate(() => localStorage.setItem("dynanca-mcq-algorithms-v2", '{"sentinel":true}'));
      page.once("dialog", (dialog) => dialog.accept());
      await page.getByRole("button", { name: "Reset progress", exact: true }).click();
      await ready(page);
      await expect(article(page)).toHaveAttribute("data-question-id", "ml-1");
      await expect(page.locator("#progressSummary")).toContainText(`0 / ${bank.questions.length} done`);
      expect(await page.evaluate(() => localStorage.getItem("dynanca-mcq-algorithms-v2"))).toBe('{"sentinel":true}');
      expect(await problems.collect()).toEqual(S.CLEAN);
      await page.screenshot({ path: `audit/screenshots/ml-${width}-${theme}.png`, fullPage: true });
    });
  }
}

test("all current ML questions complete once, persist and end without a navigation loop", async ({ page }) => {
  test.setTimeout(120000);
  await page.goto(S.practiceUrl(baseURL, "ml"));
  await ready(page);
  const visited = [];
  for (const q of bank.questions) {
    await expect(article(page)).toHaveAttribute("data-question-id", q.id);
    visited.push(q.id);
    await option(page, q.answer).click();
    await expect(article(page).locator(".practice-verdict")).toHaveText("Correct");
    await article(page).locator('[data-action="next"]').click();
  }
  expect(new Set(visited).size).toBe(bank.questions.length);
  await expect(page.locator(".practice-complete")).toBeVisible();
  await expect(page.locator("#progressSummary")).toContainText(`${bank.questions.length} / ${bank.questions.length} done`);
  await page.reload();
  await expect(page.locator(".practice-complete")).toBeVisible();
  const attempts = await page.evaluate(() => JSON.parse(localStorage.getItem("dynanca-mcq-ml-v2")));
  expect(Object.keys(attempts)).toHaveLength(bank.questions.length);
  expect(Object.values(attempts).every((a) => a.status === "answered_correct")).toBe(true);
});

test("Venn names and rich text remain text under malicious HTML, with the real CSP intact", async ({ page }) => {
  const probe = '\"><img id="injected-probe" src=x onerror="window.injected=1">';
  const data = S.readBank("ml");
  data.questions = [{ ...data.questions[0], question: probe, hint: probe, explanation: probe,
    options: data.questions[0].options.map((o) => ({ ...o, text: probe })),
    visual: { type: "venn", sets: ["A", "B"], setNames: [probe, "B"], regions: { A: 1, B: 2, AB: 1, outside: 0 } } }];
  data.questionCount = 1;
  await page.route("**/questions/computer%20science/ml.json", (route) => route.fulfill({ json: data }));
  await page.goto(S.practiceUrl(baseURL, "ml"));
  await ready(page);
  await expect(page.locator("#injected-probe")).toHaveCount(0);
  await expect(page.locator(".venn-diagram")).toHaveAttribute("aria-label", "Two-set Venn diagram for " + probe + " and B");
  await expect(article(page).locator(".practice-question-text")).toHaveText(probe);
  await article(page).getByRole("button", { name: "Show hint" }).click();
  await expect(article(page).locator(".practice-hint-text")).toHaveText(probe);
  await option(page, data.questions[0].answer).click();
  await expect(article(page).locator(".practice-explanation")).toContainText(probe);
  await expect(page.locator("#injected-probe")).toHaveCount(0);
  expect(await page.evaluate(() => window.injected)).toBeUndefined();
});

test("optional bar charts show both signs inside the SVG and escape title/caption text", async ({ page }) => {
  const probe = '<img id="chart-probe" src=x onerror="window.injected=1">';
  const data = S.readBank("ml");
  data.questions = [{ ...data.questions[0], visual: { type: "bar-chart", title: probe, caption: probe, data: [["positive", 10], ["negative", -10]] } }];
  data.questionCount = 1;
  await page.route("**/questions/computer%20science/ml.json", (route) => route.fulfill({ json: data }));
  await page.goto(S.practiceUrl(baseURL, "ml"));
  await ready(page);
  const svg = article(page).locator("svg");
  await expect(svg).toBeVisible();
  const bars = await svg.locator("rect").evaluateAll((nodes) => nodes.map((n) => ({ y: +n.getAttribute("y"), h: +n.getAttribute("height") })));
  const zero = +(await svg.locator("line.math-axis").getAttribute("y1"));
  expect(bars).toHaveLength(2);
  expect(bars[0].y + bars[0].h).toBeCloseTo(zero);
  expect(bars[1].y).toBeCloseTo(zero);
  for (const b of bars) { expect(b.y).toBeGreaterThanOrEqual(0); expect(b.y + b.h).toBeLessThanOrEqual(300); }
  const labelGap = await svg.evaluate((s) => +s.querySelector(".math-tick").getAttribute("y") - +s.querySelectorAll(".math-value")[1].getAttribute("y"));
  expect(labelGap).toBeGreaterThanOrEqual(20);
  await expect(page.locator("#chart-probe")).toHaveCount(0);
  await expect(article(page).locator("figcaption")).toHaveText(probe);
  await page.setViewportSize({ width: 320, height: 900 });
  await page.screenshot({ path: "audit/screenshots/bar-chart-320.png", fullPage: true });
});

test("normalizing a directory URL preserves the manifest bank ID query", async ({ page }) => {
  await page.goto(baseURL + "/practice?quiz=ml");
  await expect(page).toHaveURL(baseURL + "/practice/?quiz=ml");
  await ready(page);
  await expect(page.locator("h1")).toHaveText(bank.title);
});

test("every shipped Venn diagram fits its universe and has legible, separate labels at all four widths", async ({ page }) => {
  const fs = require("fs");
  const diagrams = [];
  for (const entry of S.availableEntries) {
    for (const q of S.readBank(entry.id).questions) {
      if (q.visual && q.visual.type === "venn") diagrams.push({ id: q.id, visual: q.visual });
    }
  }
  expect(diagrams).toHaveLength(75);
  const problems = await S.watch(page);
  await page.goto(S.practiceUrl(baseURL, "mathematics-discrete-mathematics-sets-1"));
  await ready(page);
  const records = [];
  for (const width of [320, 390, 768, 1280]) {
    await page.setViewportSize({ width, height: 900 });
    const audit = await page.evaluate((diagrams) => {
      const host = document.getElementById("practiceContainer");
      return diagrams.map((q) => {
        host.innerHTML = window.DynancaVenn.render(q.visual, q.id);
        const svg = host.querySelector("svg");
        const rect = svg.querySelector("rect");
        const left = +rect.getAttribute("x"), top = +rect.getAttribute("y");
        const right = left + +rect.getAttribute("width"), bottom = top + +rect.getAttribute("height");
        const circlesOutside = [...svg.querySelectorAll("circle")].filter((c) => {
          const x = +c.getAttribute("cx"), y = +c.getAttribute("cy"), r = +c.getAttribute("r");
          return x - r < left || x + r > right || y - r < top || y + r > bottom;
        }).length;
        const text = [...svg.querySelectorAll("text")].map((n) => ({ text: n.textContent, b: n.getBBox() }));
        const overlaps = [];
        for (let i = 0; i < text.length; i++) for (let j = i + 1; j < text.length; j++) {
          const a = text[i].b, b = text[j].b;
          if (a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y) overlaps.push([text[i].text, text[j].text]);
        }
        const outOfViewBox = text.filter(({ b }) => b.x < 0 || b.y < 0 || b.x + b.width > svg.viewBox.baseVal.width || b.y + b.height > svg.viewBox.baseVal.height).length;
        return { id: q.id, circlesOutside, overlaps, outOfViewBox };
      });
    }, diagrams);
    for (const row of audit) {
      expect(row.circlesOutside, row.id).toBe(0);
      expect(row.overlaps, row.id).toEqual([]);
      expect(row.outOfViewBox, row.id).toBe(0);
    }
    records.push({ width, checked: audit.length, findings: audit.filter((r) => r.circlesOutside || r.overlaps.length || r.outOfViewBox) });
  }
  fs.writeFileSync("audit/geometry/VENN_BROWSER_RESULTS.json", JSON.stringify(records, null, 2) + "\n");
  expect(await problems.collect()).toEqual(S.CLEAN);
});

test("contrast measurement catches low-opacity text despite its opaque colour value", async ({ page }) => {
  await page.goto(S.practiceUrl(baseURL, "ml"));
  await ready(page);
  await page.evaluate(() => {
    const probe = document.createElement("p");
    probe.textContent = "contrast-negative-control";
    probe.style.color = "black";
    probe.style.backgroundColor = "white";
    probe.style.opacity = "0.5";
    probe.style.fontSize = "16px";
    document.body.append(probe);
    const inactive = document.createElement("button");
    inactive.textContent = "inactive-contrast-control";
    inactive.disabled = true;
    inactive.style.opacity = "0.5";
    document.body.append(inactive);
  });
  const audit = await page.evaluate(S.contrastAudit);
  const sample = audit.text.find((x) => x.sample === "contrast-negative-control");
  expect(sample).toBeTruthy();
  expect(sample.ratio).toBeLessThan(sample.need);
  expect(sample.ratio).toBeGreaterThan(3);
  expect(audit.text.find((x) => x.sample === "inactive-contrast-control")).toBeUndefined();
  expect(audit.inactiveTextSamples).toBeGreaterThan(0);
});
