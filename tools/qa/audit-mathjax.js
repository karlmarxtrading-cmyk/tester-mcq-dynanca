#!/usr/bin/env node
"use strict";
// Compile every unique math expression found in every displayed bank field
// using the shipped MathJax, in a real browser under the actual CSP.
// This proves parser/renderability, not the mathematical truth of an expression.
const fs = require("fs");
const path = require("path");
const { chromium } = require("@playwright/test");
const { createServer } = require("../dev-server/serve.js");
const Engine = require("../../practice/practice-engine.js");
const root = path.resolve(__dirname, "../..");
const out = path.join(root, "audit/MATHJAX_CONTENT_AUDIT.json");
function walk(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = path.join(dir, e.name);
    return e.isDirectory() ? walk(p) : p.endsWith(".json") ? [p] : [];
  });
}
const expressions = new Map(), delimiterIssues = [];
let questions = 0, fields = 0, occurrences = 0;
function field(value, where) {
  if (typeof value !== "string") return;
  fields++;
  const source = Engine.autoWrapBareLatex(value).replace(/```[\s\S]*?```|`[^`]*`/g, "");
  const re = /\\\(([\s\S]*?)\\\)|\\\[([\s\S]*?)\\\]|\$\$([\s\S]*?)\$\$/g;
  const leftover = source.replace(re, (_, a, b, c) => {
    const tex = a !== undefined ? a : b !== undefined ? b : c;
    const display = a === undefined;
    const key = JSON.stringify([tex, display]);
    if (!expressions.has(key)) expressions.set(key, { tex, display, first: where, occurrences: 0 });
    expressions.get(key).occurrences++; occurrences++;
    return "";
  });
  if (/\\[()[\]]|\$\$/.test(leftover)) delimiterIssues.push({ ...where, sample: leftover.slice(0, 500) });
}
for (const file of walk(path.join(root, "questions"))) {
  const bank = JSON.parse(fs.readFileSync(file));
  for (const q of bank.questions) {
    questions++;
    for (const key of ["question", "hint", "explanation", "category", "concept", "difficulty", "cognitiveLevel", "learningObjective"]) {
      field(q[key], { file: path.relative(root, file), id: q.id, field: key });
    }
    for (const option of q.options || []) field(option.text, { file: path.relative(root, file), id: q.id, field: "option." + option.label });
  }
}
(async () => {
  const server = createServer({ root });
  let browser;
  const issues = [], csp = [], failedRequests = [];
  try {
    await new Promise((r) => server.listen(0, "127.0.0.1", r));
    browser = await chromium.launch();
    const page = await browser.newPage();
    page.on("console", (m) => { if (/Content Security Policy|Refused to/i.test(m.text())) csp.push(m.text()); });
    page.on("requestfailed", (r) => failedRequests.push(r.url()));
    const response = await page.goto(`http://127.0.0.1:${server.address().port}/practice/index.html?quiz=ml`);
    const policy = response.headers()["content-security-policy"];
    if (!policy) throw new Error("CSP header is missing");
    await page.waitForFunction(() => window.MathJax && MathJax.tex2chtml);
    await page.evaluate(() => MathJax.startup.promise);
    const items = Array.from(expressions.values());
    for (let start = 0; start < items.length; start += 400) {
      const batch = items.slice(start, start + 400);
      const result = await page.evaluate((batch) => batch.map((e) => {
        try {
          const node = MathJax.tex2chtml(e.tex, { display: e.display });
          const bad = node.querySelector("mjx-merror, [data-mjx-error]");
          // noundefined renders an unknown command in red without merror.
          const unknown = Array.from(node.querySelectorAll("[style]")).filter((n) => /(?:color|mathcolor):\s*red/i.test(n.getAttribute("style") || ""));
          return bad || unknown.length ? { ...e, error: bad ? bad.getAttribute("data-mjx-error") || bad.textContent : "Undefined command (red noundefined output)" } : null;
        } catch (err) { return { ...e, error: String(err) }; }
      }), batch);
      issues.push(...result.filter(Boolean));
      if (start % 4000 === 0) console.log(`Compiled ${Math.min(start + 400, items.length)}/${items.length} unique expressions`);
    }
    const report = { questions, fields, expressionOccurrences: occurrences, uniqueExpressions: items.length,
      browser: await browser.version(), cspHeader: policy, delimiterIssues, issues, cspViolations: csp, failedRequests,
      status: issues.length || delimiterIssues.length || csp.length || failedRequests.length ? "FAIL" : "PASS",
      scope: "All displayed textual fields in all shipped questions; actual bundled MathJax. Parser checks do not prove semantic correctness." };
    fs.mkdirSync(path.dirname(out), { recursive: true });
    fs.writeFileSync(out, JSON.stringify(report, null, 2) + "\n");
    console.log(JSON.stringify({ ...report, issues: issues.length, delimiterIssues: delimiterIssues.length, cspHeader: "present" }));
    process.exitCode = report.status === "PASS" ? 0 : 1;
  } catch (err) { console.error(err); process.exitCode = 1; }
  finally { if (browser) await browser.close(); server.close(); }
})();
