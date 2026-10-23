#!/usr/bin/env node
/* ==========================================================================
   Dynanca — automated regression test suite (Node, no test framework)
   -------------------------------------------------------------------------
   Dependency-free so `node tools/tests/run-tests.js` (or `npm test`) works
   with nothing but Node.js.

   CONTRACT THESE TESTS ASSUME: master-manifest.json and every shipped
   question bank are FINAL. Tests locate banks and questions THROUGH the
   manifest (by manifest entry id) — they never expect production files to
   be renamed, regenerated or rewritten to match a test.

   Covers:
     1.  CSV parser edge cases (legacy tool)
     2.  Legacy CSV->manifest generator: determinism on fixtures
     3.  Manifest contract: byte-identical to the protected baseline; the
         legacy generator refuses to overwrite it
     4.  Scalability fixture for the generator + shared traversal
     5.  Path-safety rejection (traversal / absolute / protocol paths)
     6.  Ecosystem validator: UI-release scope passes, full scope fails
         ONLY on pending bank files, accepted exception is honoured
     7.  node --check on every hand-written JS file
     8.  Renderer: bare-LaTeX auto-delimiting, media URL allowlist
     9.  Data regression: no double-escaped \n/\t
     10. Validator fixtures (schema failure, duplicate-content warning)
     11. Generator slug-collision warning
     12. Landing page security/CSP shape (no HTML injection, no inline code)
     13. PracticeEngine/PracticeState flow
     14. PracticeState stats, Venn renderer, percent notation
     15-17. Content regressions, looked up via manifest ids
     18. Venn data integrity, re-derived from each question's own wording
     19. Catalog view model (the adapter the landing page uses)
     20. Bank availability index (deterministic, read-only, rebuildable)
     21. Standalone theme module
     22. Page wiring + link integrity + storage safety
     23. Protected content is byte-identical to the baseline
   ========================================================================== */
"use strict";
const fs = require("fs");
const path = require("path");
const { execFileSync } = require("child_process");
const assert = require("assert");

const projectRoot = path.resolve(__dirname, "..", "..");
const { parseCsv } = require("../lib/csv-parse.js");
const generatorMod = require("../manifest-generator/generate-manifest.js");
const manifestUtil = require(path.join(projectRoot, "assets", "js", "manifest.js"));
const { validateVennQuestion } = require("../lib/venn-validate.js");

const os = require("os");
const crypto = require("crypto");

/* ---------- Real-project lookups: always through the manifest ---------- */
const realManifestPath = path.join(projectRoot, "master-manifest.json");
const realManifestBytes = fs.readFileSync(realManifestPath);
const realManifest = JSON.parse(realManifestBytes.toString("utf8"));
function sha256Hex(buf) { return crypto.createHash("sha256").update(buf).digest("hex"); }

/** Manifest entry for an exact manifest id (throws a readable error if the id is not listed). */
function manifestEntry(id) {
  const entry = manifestUtil.findPracticeFile(realManifest.subjects, id);
  assert.ok(entry, `manifest entry "${id}" should exist in master-manifest.json`);
  return entry;
}
/** Parsed bank for a manifest id, resolved through the manifest's own path. */
function bankByManifestId(id) {
  const entry = manifestEntry(id);
  return JSON.parse(fs.readFileSync(path.join(projectRoot, entry.path), "utf8"));
}
/** The Nth question of a bank by its id suffix (-q004), independent of the bank's id prefix. */
function questionBySuffix(bank, suffix) {
  const q = bank.questions.find((x) => String(x.id).endsWith(suffix));
  assert.ok(q, `expected a question whose id ends with "${suffix}"`);
  return q;
}

let pass = 0, fail = 0;
function test(name, fn) {
  try {
    fn();
    pass += 1;
    console.log("  ok  -", name);
  } catch (e) {
    fail += 1;
    console.log("  FAIL -", name);
    console.log("        " + (e && e.message ? e.message : e));
  }
}
function section(title) { console.log("\n" + title); }

// ---------------------------------------------------------------------
section("1. CSV parser edge cases");
// ---------------------------------------------------------------------
test("quoted field with embedded comma", () => {
  const { rows } = parseCsv('folder,name\nquiz,"Quiz, Advanced"\n');
  assert.strictEqual(rows[0].name, "Quiz, Advanced");
});
test("escaped quote inside a quoted field", () => {
  const { rows } = parseCsv('folder,name\nquiz,"say ""hi"" now"\n');
  assert.strictEqual(rows[0].name, 'say "hi" now');
});
test("leading zeros are preserved as-is (never numeric-normalized)", () => {
  const { rows } = parseCsv("folder,file\nquiz,quiz - 010.json\n");
  assert.strictEqual(rows[0].file, "quiz - 010.json");
});
test("internal spaces and hyphens survive untouched", () => {
  const { rows } = parseCsv("folder,name\nquiz,QUIZ - 08\n");
  assert.strictEqual(rows[0].name, "QUIZ - 08");
});
test("CRLF line endings parse the same as LF", () => {
  const { rows } = parseCsv("folder,file\r\nquiz,a.json\r\nquiz,b.json\r\n");
  assert.strictEqual(rows.length, 2);
  assert.strictEqual(rows[1].file, "b.json");
});
test("blank lines are skipped, not treated as rows", () => {
  const { rows } = parseCsv("folder,file\nquiz,a.json\n\n\nquiz,b.json\n");
  assert.strictEqual(rows.length, 2);
});
test("header names are trimmed", () => {
  const { header } = parseCsv(" folder , file \nquiz,a.json\n");
  assert.deepStrictEqual(header, ["folder", "file"]);
});

// ---------------------------------------------------------------------
section("2. Legacy CSV generator: determinism (fixtures only)");
// ---------------------------------------------------------------------
const sampleCsv =
  "folder,sub-folder,file,id,name,path,questionCount\n" +
  "mathematics,calculus,calc-01.json,math-calc-01,Calc 01,questions/mathematics/calculus/calc-01.json,10\n" +
  "quiz,,quiz - 01.json,quiz-quiz - 01,QUIZ 01,questions/quiz/quiz - 01.json,20\n";
test("running generate() twice on identical input yields identical output", () => {
  const a = generatorMod.generate(sampleCsv);
  const b = generatorMod.generate(sampleCsv);
  assert.deepStrictEqual(a.manifest, b.manifest);
});
test("a shorter hierarchy (Case B: subject -> practice_files directly) survives conversion", () => {
  const { manifest } = generatorMod.generate(sampleCsv);
  const quiz = manifest.subjects.find((s) => s.id === "quiz");
  assert.ok(quiz, "quiz subject should exist");
  assert.ok(Array.isArray(quiz.practice_files) && quiz.practice_files.length === 1, "quiz should have direct practice_files");
  assert.strictEqual(quiz.topics, undefined, "quiz should not get a fabricated topics array");
});
test("a longer hierarchy (Case A: subject -> topic -> practice_files) still works alongside Case B", () => {
  const { manifest } = generatorMod.generate(sampleCsv);
  const math = manifest.subjects.find((s) => s.id === "mathematics");
  assert.ok(math && Array.isArray(math.topics) && math.topics.length === 1);
  assert.strictEqual(math.topics[0].practice_files[0].id, "math-calc-01");
});

// ---------------------------------------------------------------------
section("3. Manifest contract (master-manifest.json is final and protected)");
// ---------------------------------------------------------------------
// BEFORE: this section regenerated the manifest from master-manifest.csv
// and required the result to equal master-manifest.json. The CSV is a
// legacy 130-row export, so that test could only be satisfied by
// overwriting the final 2,527-entry JSON.
// NOW: the JSON is the contract. It must be byte-identical to the hash
// recorded from the owner's archive, and the legacy generator must refuse
// to write over it.
const protectedBaseline = JSON.parse(fs.readFileSync(path.join(projectRoot, "tools", "integrity", "protected-baseline.json"), "utf8"));
test("master-manifest.json is byte-for-byte the protected baseline", () => {
  assert.strictEqual(sha256Hex(realManifestBytes), protectedBaseline.files["master-manifest.json"]);
});
test("master-manifest.json keeps its contract header (schemaVersion 1.0, dynanca-master, subjects[])", () => {
  assert.strictEqual(realManifest.schemaVersion, "1.0");
  assert.strictEqual(realManifest.manifestType, "dynanca-master");
  assert.ok(Array.isArray(realManifest.subjects) && realManifest.subjects.length > 0);
});
test("every manifest practice_files id is a unique, non-empty string and every path is safe", () => {
  const seen = new Set();
  manifestUtil.eachPracticeFile(realManifest.subjects, (p) => {
    assert.ok(typeof p.id === "string" && p.id, "practice_files id must be a non-empty string");
    assert.ok(!seen.has(p.id), `duplicate manifest id ${p.id}`);
    seen.add(p.id);
    assert.ok(manifestUtil.isSafeRelativePath(p.path), `unsafe path for ${p.id}: ${p.path}`);
  });
  assert.ok(seen.size > 0);
});
test("the legacy generator CLI refuses to overwrite master-manifest.json (default args and explicit path)", () => {
  const cli = path.join(projectRoot, "tools", "manifest-generator", "generate-manifest.js");
  [[], ["master-manifest.csv", "master-manifest.json"]].forEach((args) => {
    let exitCode = 0;
    try {
      execFileSync(process.execPath, [cli].concat(args), { cwd: projectRoot, encoding: "utf8", stdio: "pipe" });
    } catch (e) {
      exitCode = e.status;
    }
    assert.strictEqual(exitCode, 1, "generator must exit 1 instead of writing the manifest");
  });
  assert.strictEqual(sha256Hex(fs.readFileSync(realManifestPath)), protectedBaseline.files["master-manifest.json"], "manifest must be untouched");
});
test("modifying a fixture CSV row and regenerating changes the output (proves CSV really drives the JSON)", () => {
  const before = generatorMod.generate(sampleCsv).manifest;
  const changed = sampleCsv.replace("QUIZ 01", "QUIZ 01 RENAMED");
  const after = generatorMod.generate(changed).manifest;
  const beforeName = before.subjects.find((s) => s.id === "quiz").practice_files[0].name;
  const afterName = after.subjects.find((s) => s.id === "quiz").practice_files[0].name;
  assert.strictEqual(beforeName, "QUIZ 01");
  assert.strictEqual(afterName, "QUIZ 01 RENAMED");
});

// ---------------------------------------------------------------------
section("4. Scalability fixture (100 quizzes + multi-subject, no hardcoded names)");
// ---------------------------------------------------------------------
function buildScalabilityCsv() {
  const header = "folder,sub-folder,file,id,name,path,questionCount\n";
  const lines = [];
  for (let i = 1; i <= 100; i++) {
    const n = String(i).padStart(3, "0");
    lines.push(`quiz,,quiz-${n}.json,quiz-quiz-${n},QUIZ ${n},questions/quiz/quiz-${n}.json,20`);
  }
  const csTopics = [
    ["programming", ["intro-01", "intro-02"]],
    ["data-structures", ["lists-01", "trees-01"]],
    ["algorithms", ["sorting-01"]],
  ];
  csTopics.forEach(([topic, files]) => {
    files.forEach((f) => {
      lines.push(`computer-science,${topic},${f}.json,cs-${topic}-${f},${f.toUpperCase()},questions/computer-science/${topic}/${f}.json,15`);
    });
  });
  return header + lines.join("\n") + "\n";
}
const scalabilityCsv = buildScalabilityCsv();
let scalabilityManifest = null;
test("generator produces a Quiz subject with 100 direct practice_files from 100 CSV rows", () => {
  const { manifest, totalRows, validRows } = generatorMod.generate(scalabilityCsv);
  scalabilityManifest = manifest;
  assert.strictEqual(totalRows, 105);
  assert.strictEqual(validRows, 105);
  const quiz = manifest.subjects.find((s) => s.id === "quiz");
  assert.strictEqual(quiz.practice_files.length, 100);
  assert.strictEqual(quiz.practice_files[0].name, "QUIZ 001");
  assert.strictEqual(quiz.practice_files[99].name, "QUIZ 100");
});
test("generator produces a 3-subject, multi-topic catalog with no code changes needed", () => {
  const cs = scalabilityManifest.subjects.find((s) => s.id === "computer-science");
  assert.ok(cs);
  assert.strictEqual(cs.topics.length, 3);
  const programming = cs.topics.find((t) => t.id === "programming");
  assert.strictEqual(programming.practice_files.length, 2);
});
test("shared frontend traversal (assets/js/manifest.js) discovers all 100+ entries via the same generic code path used for Quiz today", () => {
  let count = 0;
  manifestUtil.eachPracticeFile(scalabilityManifest.subjects, () => { count += 1; });
  assert.strictEqual(count, 105);
});
test("shared frontend lookup finds a deeply-nested entry and a direct subject-level entry with the same function", () => {
  const direct = manifestUtil.findPracticeFile(scalabilityManifest.subjects, "quiz-quiz-057");
  assert.ok(direct && direct.name === "QUIZ 057");
  const nested = manifestUtil.findPracticeFile(scalabilityManifest.subjects, "cs-data-structures-trees-01");
  assert.ok(nested && nested.name === "TREES-01");
});
test("a brand-new subject (never seen by any frontend code) renders/looks-up correctly purely from manifest data", () => {
  const newSubjectCsv = "folder,file,id,name,path,questionCount\nrobotics,intro.json,robotics-intro,Intro to Robotics,questions/robotics/intro.json,12\n";
  const { manifest } = generatorMod.generate(newSubjectCsv);
  const found = manifestUtil.findPracticeFile(manifest.subjects, "robotics-intro");
  assert.ok(found && found.name === "Intro to Robotics");
});

// ---------------------------------------------------------------------
section("5. Path safety");
// ---------------------------------------------------------------------
test("traversal path (../) is rejected", () => {
  assert.strictEqual(manifestUtil.isSafeRelativePath("questions/../../etc/passwd"), false);
});
test("absolute path is rejected", () => {
  assert.strictEqual(manifestUtil.isSafeRelativePath("/etc/passwd"), false);
});
test("protocol/URL path is rejected", () => {
  assert.strictEqual(manifestUtil.isSafeRelativePath("http://evil.example/x.json"), false);
});
test("path outside questions/ is rejected", () => {
  assert.strictEqual(manifestUtil.isSafeRelativePath("assets/js/manifest.js"), false);
});
test("a normal questions/-relative path is accepted", () => {
  assert.strictEqual(manifestUtil.isSafeRelativePath("questions/quiz/quiz - 01.json"), true);
});
test("generator silently-but-visibly drops a row with an unsafe path (warns, does not crash, does not include it)", () => {
  const unsafeCsv = "folder,file,id,name,path,questionCount\nquiz,x.json,quiz-x,X,../outside.json,5\n";
  const { manifest, warnings } = generatorMod.generate(unsafeCsv);
  const quiz = manifest.subjects.find((s) => s.id === "quiz");
  assert.ok(!quiz || !quiz.practice_files || quiz.practice_files.length === 0);
  assert.ok(warnings.some((w) => /not a safe/i.test(w)));
});

// ---------------------------------------------------------------------
section("6. Ecosystem validator against the real project (read-only)");
// ---------------------------------------------------------------------
// BEFORE: "validator exits 0". That could only be true by (a) regenerating
// the manifest from the legacy CSV and (b) every listed bank file existing.
// NOW, two honest scopes:
//   --allow-pending  everything that IS shipped must be valid (exit 0),
//                    and the output must say content is still pending;
//   full             may fail ONLY because listed bank files are pending.
const validatorPath = path.join(projectRoot, "tools", "ecosystem-validator", "validate-ecosystem.js");
function runValidator(args) {
  try {
    const out = execFileSync(process.execPath, [validatorPath].concat(args || []), { cwd: projectRoot, encoding: "utf8", stdio: "pipe", maxBuffer: 64 * 1024 * 1024 });
    return { code: 0, out };
  } catch (e) {
    return { code: e.status, out: (e.stdout || "") + (e.stderr || "") };
  }
}
const { computeIndex: computeBankIndex, serializeIndex: serializeBankIndex, assertWritableTarget: assertIndexTarget } =
  require(path.join(projectRoot, "tools", "bank-index", "build-bank-index.js"));
const realIndexResult = computeBankIndex(projectRoot);

test("validator --allow-pending: every shipped bank is valid (exit 0, zero errors)", () => {
  const r = runValidator(["--allow-pending"]);
  assert.strictEqual(r.code, 0, "expected exit 0 for the UI-release scope:\n" + r.out.slice(-2000));
  assert.ok(!/\bERROR:/.test(r.out), "no ERROR lines expected:\n" + r.out.slice(-2000));
  if (realIndexResult.report.unavailableBanks > 0) {
    assert.ok(/PASS WITH PENDING CONTENT/.test(r.out), "pending content must be stated, never a plain PASS");
  } else {
    assert.ok(/\nPASS\n?$/.test(r.out.trim() + "\n"), "expected a plain PASS once nothing is pending");
  }
});
test("validator (full scope): fails only because listed bank files are pending — or passes when none are", () => {
  const r = runValidator([]);
  const pendingCount = realIndexResult.report.missingFiles.length;
  if (pendingCount > 0) {
    assert.strictEqual(r.code, 1, "full validation must not claim success while content is pending");
    assert.ok(/FAIL — content incomplete/.test(r.out) && /No other error/.test(r.out), r.out.slice(-1500));
    const m = /(\d+) listed bank file\(s\) are not present/.exec(r.out);
    assert.ok(m && Number(m[1]) === pendingCount, "validator and bank index must agree on the pending count");
  } else {
    assert.strictEqual(r.code, 0, r.out.slice(-2000));
  }
});
test("math-gaokao-71 is no longer a count mismatch (manifest 150 = bank 150), so it is neither ACCEPTED nor an error", () => {
  // History: the manifest used to list questionCount 10 for this 150-question
  // bank and accepted-exceptions.json recorded that. The owner's manifest
  // revision set it to 150, so the exception was removed; a stale exception
  // is itself reported as an ERROR by the validator (section Q).
  assert.strictEqual(manifestEntry("math-gaokao-71").questionCount, bankByManifestId("math-gaokao-71").questions.length);
  const exceptions = JSON.parse(fs.readFileSync(path.join(projectRoot, "tools", "ecosystem-validator", "accepted-exceptions.json"), "utf8"));
  assert.ok(!(exceptions.questionCountMismatch || []).some((x) => x && x.id === "math-gaokao-71"), "obsolete exception must not come back");
  const r = runValidator(["--allow-pending"]);
  assert.ok(!/math-gaokao-71/.test(r.out), r.out.slice(0, 1500));
});
test("validator never writes: manifest and CSV hashes are unchanged after running it", () => {
  ["master-manifest.json", "master-manifest.csv"].forEach((rel) => {
    assert.strictEqual(sha256Hex(fs.readFileSync(path.join(projectRoot, rel))), protectedBaseline.files[rel], rel + " changed");
  });
});

// ---------------------------------------------------------------------
section("7. node --check on every hand-written JS file");
// ---------------------------------------------------------------------
function listJsFiles(dir) {
  let out = [];
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (["node_modules", "vendor", "dist", "reports", "audit"].includes(e.name) || e.name.startsWith(".dist-stage-")) continue;
    const full = path.join(dir, e.name);
    if (e.isDirectory()) out = out.concat(listJsFiles(full));
    else if (e.name.endsWith(".js")) out.push(full);
  }
  return out;
}
const jsFiles = listJsFiles(projectRoot).filter((f) => !f.includes(path.join("assets", "vendor")));
jsFiles.forEach((f) => {
  test(`node --check ${path.relative(projectRoot, f)}`, () => {
    execFileSync(process.execPath, ["--check", f], { encoding: "utf8" });
  });
});

// ---------------------------------------------------------------------
section("8. Renderer: bare-LaTeX auto-delimiting (practice/practice-engine.js)");
// ---------------------------------------------------------------------
// Regression coverage for the audit finding that ~600 explanation/hint
// fields contain LaTeX commands (\times, \frac, ...) with no MathJax
// delimiters. Fixed as a renderer-level auto-wrap (formatText ->
// autoWrapBareLatex) rather than by hand-editing hundreds of records, so
// the test exercises the renderer directly.
const practiceEnginePathV8 = path.join(projectRoot, "practice", "practice-engine.js");
delete require.cache[practiceEnginePathV8];
const PracticeEngineStatic = require(practiceEnginePathV8);

test("wraps the exact bare-LaTeX pattern found in the audit (no delimiters at all)", () => {
  const out = PracticeEngineStatic.formatText("Since y = k/x, k = x \\times y = 7 \\times 9 = 63.");
  assert.ok(
    out.indexOf("\\(y = k/x, k = x \\times y = 7 \\times 9 = 63\\)") !== -1,
    "expected the bare expression to be auto-wrapped: " + out
  );
});
test("leaves text with no backslash commands completely untouched", () => {
  const input = "No math here at all.";
  assert.strictEqual(PracticeEngineStatic.autoWrapBareLatex(input), input);
});
test("leaves already-delimited math untouched (no double-wrapping)", () => {
  const input = "Already \\(\\frac{1}{2}\\) fully delimited, nothing to do.";
  assert.strictEqual(PracticeEngineStatic.autoWrapBareLatex(input), input);
});
test("does not wrap a LaTeX-looking sequence inside an inline code span", () => {
  const input = "A pseudocode snippet: `a \\times b` stays as code.";
  assert.strictEqual(PracticeEngineStatic.autoWrapBareLatex(input), input);
});
test("does not wrap a LaTeX-looking sequence inside a fenced code block", () => {
  const input = "```\nfoo \\times bar\n```";
  assert.strictEqual(PracticeEngineStatic.autoWrapBareLatex(input), input);
});
test("wraps two independent bare expressions in the same string separately", () => {
  const out = PracticeEngineStatic.autoWrapBareLatex("First 2 \\times 2 = 4. Second 3 \\times 3 = 9.");
  assert.ok(out.indexOf("\\(2 \\times 2 = 4\\)") !== -1, out);
  assert.ok(out.indexOf("\\(3 \\times 3 = 9\\)") !== -1, out);
});
test("every bare-LaTeX field across the real question banks is fully wrapped (zero remaining)", () => {
  const LATEX_NAMES = ["times", "div", "frac", "sqrt", "neq", "leq", "geq", "approx", "to", "pm"];
  const CMD_RE = new RegExp("\\\\(" + LATEX_NAMES.join("|") + ")\\b");
  const DELIM_RE = /\\\((?:[^\\]|\\(?!\)))*\\\)|\\\[(?:[^\\]|\\(?!\]))*\\\]|\$\$[\s\S]*?\$\$/g;
  function stripDelimited(s) { return s.replace(/```[\s\S]*?```/g, "").replace(/`[^`]*`/g, "").replace(DELIM_RE, ""); }
  function stillBare(s) { return typeof s === "string" && CMD_RE.test(stripDelimited(PracticeEngineStatic.autoWrapBareLatex(s))); }
  const offenders = [];
  (function walk(dir) {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, e.name);
      if (e.isDirectory()) { walk(full); continue; }
      if (!e.name.toLowerCase().endsWith(".json")) continue;
      const data = JSON.parse(fs.readFileSync(full, "utf8"));
      (data.questions || []).forEach((q) => {
        ["question", "hint", "explanation", "code"].forEach((k) => {
          if (stillBare(q[k])) offenders.push(`${full} ${q.id} ${k}`);
        });
        (Array.isArray(q.options) ? q.options : []).forEach((o, i) => {
          if (o && stillBare(o.text)) offenders.push(`${full} ${q.id} options[${i}]`);
        });
      });
    }
  })(path.join(projectRoot, "questions"));
  assert.deepStrictEqual(offenders, []);
});

// Regression coverage for the defensive fix to renderImage()/isSafeMediaUrl():
// question `image`/visual `src` values are validated against a URL-scheme
// allowlist before ever reaching a DOM `src` attribute, so an unusual
// scheme (javascript:, vbscript:, ...) in a future data file can never be
// emitted, even though no current question bank exercises this path.
test("isSafeMediaUrl allows relative paths, http(s), protocol-relative, and data:image URIs", () => {
  assert.strictEqual(PracticeEngineStatic.isSafeMediaUrl("assets/img/x.png"), true);
  assert.strictEqual(PracticeEngineStatic.isSafeMediaUrl("http://example.com/x.png"), true);
  assert.strictEqual(PracticeEngineStatic.isSafeMediaUrl("https://example.com/x.png"), true);
  assert.strictEqual(PracticeEngineStatic.isSafeMediaUrl("//example.com/x.png"), true);
  assert.strictEqual(PracticeEngineStatic.isSafeMediaUrl("data:image/png;base64,AAAA"), true);
});
test("isSafeMediaUrl rejects javascript:, vbscript:, and other non-image URL schemes", () => {
  assert.strictEqual(PracticeEngineStatic.isSafeMediaUrl("javascript:alert(1)"), false);
  assert.strictEqual(PracticeEngineStatic.isSafeMediaUrl("vbscript:msgbox(1)"), false);
  assert.strictEqual(PracticeEngineStatic.isSafeMediaUrl("data:text/html,<script>1</script>"), false);
  assert.strictEqual(PracticeEngineStatic.isSafeMediaUrl(""), false);
  assert.strictEqual(PracticeEngineStatic.isSafeMediaUrl(null), false);
});
test("no current question-bank image/visual src exercises the rejection path (confirmed-safe today)", () => {
  const offenders = [];
  (function walk(dir) {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, e.name);
      if (e.isDirectory()) { walk(full); continue; }
      if (!e.name.toLowerCase().endsWith(".json")) continue;
      const data = JSON.parse(fs.readFileSync(full, "utf8"));
      (data.questions || []).forEach((q) => {
        const srcs = [];
        if (q.image) srcs.push(typeof q.image === "string" ? q.image : q.image.src);
        if (Array.isArray(q.images)) q.images.forEach((im) => srcs.push(typeof im === "string" ? im : (im && (im.src || im.url))));
        if (q.visual && q.visual.type === "image") srcs.push(q.visual.src || q.visual.url);
        srcs.filter(Boolean).forEach((src) => {
          if (!PracticeEngineStatic.isSafeMediaUrl(src)) offenders.push(`${full} ${q.id} ${src}`);
        });
      });
    }
  })(path.join(projectRoot, "questions"));
  assert.deepStrictEqual(offenders, []);
});

// ---------------------------------------------------------------------
section("9. Data regression: no double-escaped \\n/\\t literal text in any question bank");
// ---------------------------------------------------------------------
// Regression coverage for the questions/quiz/quiz - 75.json bug: pseudocode
// meant to contain real line breaks instead contained the literal two
// characters "\" + "n" (the JSON source double-escaped the backslash). Fixed
// as a one-time data normalization (this is a genuine encoding bug, not a
// rendering-pipeline gap) — this test guards against it recurring anywhere.
test("no question-bank field contains a literal double-escaped \\n or \\t", () => {
  const LITERAL_ESCAPE_RE = /\\([nt])(?![A-Za-z])/;
  const DELIM_RE = /\\\((?:[^\\]|\\(?!\)))*\\\)|\\\[(?:[^\\]|\\(?!\]))*\\\]|\$\$[\s\S]*?\$\$/g;
  function stripDelimited(s) { return s.replace(/```[\s\S]*?```/g, "").replace(/`[^`]*`/g, "").replace(DELIM_RE, ""); }
  function isBad(s) { return typeof s === "string" && LITERAL_ESCAPE_RE.test(stripDelimited(s)); }
  const offenders = [];
  (function walk(dir) {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, e.name);
      if (e.isDirectory()) { walk(full); continue; }
      if (!e.name.toLowerCase().endsWith(".json")) continue;
      const data = JSON.parse(fs.readFileSync(full, "utf8"));
      (data.questions || []).forEach((q) => {
        ["question", "hint", "explanation", "code"].forEach((k) => {
          if (isBad(q[k])) offenders.push(`${full} ${q.id} ${k}`);
        });
        (Array.isArray(q.options) ? q.options : []).forEach((o, i) => {
          if (o && isBad(o.text)) offenders.push(`${full} ${q.id} options[${i}]`);
        });
      });
    }
  })(path.join(projectRoot, "questions"));
  assert.deepStrictEqual(offenders, []);
});
test("the specific quiz - 75.json pseudocode now renders as real line breaks", () => {
  const data = JSON.parse(fs.readFileSync(path.join(projectRoot, "questions", "quiz", "quiz - 75.json"), "utf8"));
  const q4 = data.questions.find((q) => /q004$/.test(String(q.id || "")));
  assert.ok(q4, "expected quiz - 75 question 4 to be discoverable by its current q004 id");
  assert.ok(q4.question.indexOf("\n") !== -1, "expected a real newline character");
  assert.ok(q4.question.indexOf("\\n") === -1, "should not contain a literal backslash-n anymore");
});

// ---------------------------------------------------------------------
section("10. Ecosystem validator: schema + content-quality checks (Phase 3/10 hardening)");
// ---------------------------------------------------------------------
const generatorModForFixtures = require(path.join(projectRoot, "tools", "manifest-generator", "generate-manifest.js"));
const { execFileSync: execFileSyncFixture } = require("child_process");

function withTempProject(files, run) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "dynanca-validator-fixture-"));
  try {
    Object.keys(files).forEach((rel) => {
      const full = path.join(dir, rel);
      fs.mkdirSync(path.dirname(full), { recursive: true });
      fs.writeFileSync(full, files[rel]);
    });
    return run(dir);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

test("validator FAILS a question bank missing a required schema field (e.g. \"category\")", () => {
  const csv = "folder,file,id,name,path,questionCount\nquiz,q.json,quiz-q,Q,questions/quiz/q.json,1\n";
  const bank = {
    schemaVersion: "1.0", type: "mcq", id: "x",
    // "category" intentionally omitted — schemas/question-bank.schema.json requires it.
    title: "T", description: "D", questionCount: 1,
    questions: [{ id: "1", question: "Q?" }],
  };
  withTempProject({
    "master-manifest.csv": csv,
    "questions/quiz/q.json": JSON.stringify(bank),
  }, (dir) => {
    fs.copyFileSync(path.join(projectRoot, "schemas", "question-bank.schema.json"), (() => { const p = path.join(dir, "schemas"); fs.mkdirSync(p, { recursive: true }); return path.join(p, "question-bank.schema.json"); })());
    const { manifest } = generatorModForFixtures.generate(csv);
    fs.writeFileSync(path.join(dir, "master-manifest.json"), JSON.stringify(manifest, null, 2));
    let threw = false, output = "";
    try {
      execFileSyncFixture(process.execPath, [path.join(projectRoot, "tools", "ecosystem-validator", "validate-ecosystem.js")], {
        cwd: dir, encoding: "utf8", env: Object.assign({}, process.env, { DYNANCA_TEST_PROJECT_ROOT: dir }),
      });
    } catch (e) {
      threw = true;
      output = (e.stdout || "") + (e.stderr || "");
    }
    assert.ok(threw, "validator should exit non-zero when a required schema field is missing");
    assert.ok(/category/.test(output), "expected the error to mention the missing \"category\" field:\n" + output);
  });
});

test("validator warns (but still PASSes) on an accidental full-bank content duplicate", () => {
  const csv =
    "folder,file,id,name,path,questionCount\n" +
    "quiz,a.json,quiz-a,A,questions/quiz/a.json,1\n" +
    "quiz,b.json,quiz-b,B,questions/quiz/b.json,1\n";
  const makeBank = (title) => JSON.stringify({
    schemaVersion: "1.0", type: "mcq", id: "x", category: "Quiz", title, description: "D", questionCount: 1,
    questions: [{ id: "1", question: "2 + 2?", options: [{ label: "A", text: "4" }, { label: "B", text: "5" }], answer: "A" }],
  });
  withTempProject({
    "master-manifest.csv": csv,
    "questions/quiz/a.json": makeBank("A"),
    "questions/quiz/b.json": makeBank("B"),
  }, (dir) => {
    const schemaDir = path.join(dir, "schemas");
    fs.mkdirSync(schemaDir, { recursive: true });
    fs.copyFileSync(path.join(projectRoot, "schemas", "question-bank.schema.json"), path.join(schemaDir, "question-bank.schema.json"));
    const { manifest } = generatorModForFixtures.generate(csv);
    fs.writeFileSync(path.join(dir, "master-manifest.json"), JSON.stringify(manifest, null, 2));
    const out = execFileSyncFixture(process.execPath, [path.join(projectRoot, "tools", "ecosystem-validator", "validate-ecosystem.js")], {
      cwd: dir, encoding: "utf8", env: Object.assign({}, process.env, { DYNANCA_TEST_PROJECT_ROOT: dir }),
    });
    assert.ok(/PASS/.test(out), "duplicate content must warn, not fail, the build:\n" + out);
    assert.ok(/DUPLICATE BANK CONTENT/.test(out), "expected a duplicate-bank warning:\n" + out);
  });
});

// ---------------------------------------------------------------------
section("11. Manifest generator: slugification collision is surfaced as a warning");
// ---------------------------------------------------------------------
test("two different raw folder names that slugify to the same id produce a warning, not a silent merge", () => {
  const csv =
    "folder,file,id,name,path,questionCount\n" +
    "Algebra,a.json,algebra-a,A,questions/algebra/a.json,1\n" +
    "algebra!,b.json,algebra-b,B,questions/algebra%21/b.json,1\n";
  const { warnings } = generatorModForFixtures.generate(csv);
  assert.ok(
    warnings.some((w) => /slugifies to id/.test(w)),
    "expected a slug-collision warning; got: " + JSON.stringify(warnings)
  );
});
// (Removed: "the real project's master-manifest.csv has zero slug
// collisions". The CSV is a legacy export and no longer describes the
// catalog; id/path uniqueness of the REAL catalog is asserted on
// master-manifest.json itself in section 3.)

// ---------------------------------------------------------------------
section("12. Landing page security shape (index.html + catalog scripts)");
// ---------------------------------------------------------------------
// The catalog is now rendered by external modules. Manifest text must
// only ever reach the DOM as text, and the landing page must ship no
// inline script/style (so script-src needs no hash for it).
const landingHtml = fs.readFileSync(path.join(projectRoot, "index.html"), "utf8");
const catalogJs = fs.readFileSync(path.join(projectRoot, "assets", "js", "catalog.js"), "utf8");
const catalogModelJs = fs.readFileSync(path.join(projectRoot, "assets", "js", "catalog-model.js"), "utf8");
test("catalog scripts never build markup from strings (no innerHTML / outerHTML / insertAdjacentHTML / document.write)", () => {
  [catalogJs, catalogModelJs].forEach((src) => {
    assert.ok(!/\.innerHTML\b|\.outerHTML\b|insertAdjacentHTML|document\.write/.test(src), "found an HTML-string sink");
  });
  assert.ok(/textContent/.test(catalogJs), "expected text to be written with textContent");
});
test("index.html and 404.html contain no inline <script> body, no inline <style>, and no style=\"\" attribute", () => {
  ["index.html", "404.html"].forEach((rel) => {
    const html = fs.readFileSync(path.join(projectRoot, rel), "utf8");
    assert.ok(!/<script(?![^>]*\bsrc=)[^>]*>[\s\S]*?\S[\s\S]*?<\/script>/.test(html), rel + ": inline script found");
    assert.ok(!/<style[\s>]/.test(html), rel + ": inline <style> found");
    assert.ok(!/\sstyle\s*=/.test(html), rel + ": inline style attribute found");
  });
});
test("no eval / new Function anywhere in the landing scripts", () => {
  [catalogJs, catalogModelJs, fs.readFileSync(path.join(projectRoot, "assets", "js", "theme.js"), "utf8")].forEach((src) => {
    assert.ok(!/\beval\s*\(|new\s+Function\s*\(/.test(src));
  });
});

// ---------------------------------------------------------------------
section("13. PracticeEngine/PracticeState flow: completion + review-mode termination");
// ---------------------------------------------------------------------
// These simulate the DOM with a minimal stub (no querySelector matching is
// needed: the tests assert on the container's actual innerHTML string,
// which is exactly what a browser would receive) so the real, unmodified
// practice-engine.js / practice-state.js run end to end through their
// public API.
function makeStubElement() {
  const el = {
    _html: "",
    classList: { add() {}, remove() {}, contains() { return false; } },
    style: {},
    disabled: false,
    hidden: false,
    setAttribute() {}, getAttribute() { return null; },
    addEventListener() {}, removeEventListener() {},
    appendChild() {}, focus() {}, scrollIntoView() {},
    querySelector() { return null; }, querySelectorAll() { return []; },
    closest() { return null; }, contains() { return false; },
  };
  Object.defineProperty(el, "innerHTML", { get() { return el._html; }, set(v) { el._html = v; } });
  return el;
}
function makeFakeContainer() {
  const el = makeStubElement();
  el._events = [];
  el.dispatchEvent = (evt) => { el._events.push({ type: evt.type, detail: evt.detail }); return true; };
  return el;
}
function setupFakePracticeEnv(practices) {
  const enginePath = path.join(projectRoot, "practice", "practice-engine.js");
  const statePath = path.join(projectRoot, "practice", "practice-state.js");
  delete require.cache[enginePath];
  delete require.cache[statePath];

  const container = makeFakeContainer();
  global.window = {};
  global.window.DynancaPracticeId = "flow-test-" + Math.random().toString(36).slice(2);
  global.document = {
    getElementById: (id) => (id === "practiceContainer" ? container : null),
    createElement: () => makeStubElement(),
  };
  global.PRACTICES = practices;

  const PracticeState = require(statePath);
  global.PracticeState = PracticeState;
  global.window.PracticeState = PracticeState;

  const PracticeEngine = require(enginePath);
  global.window.PracticeEngine = PracticeEngine;

  PracticeEngine.init("practiceContainer");
  return { PracticeEngine, PracticeState, container };
}
function twoChoiceQuestion(id, correctLabel) {
  return {
    id, question: id + "?",
    options: [{ label: "A", text: "a" }, { label: "B", text: "b" }],
    answer: correctLabel,
  };
}

test("answering the last question ends in a deterministic complete state, not a Next-button loop back to the last question", () => {
  const practices = [twoChoiceQuestion("q1", "A"), twoChoiceQuestion("q2", "A")];
  const { PracticeEngine, container } = setupFakePracticeEnv(practices);
  PracticeEngine.start();
  assert.ok(container.innerHTML.indexOf('data-question-id="q1"') !== -1, container.innerHTML);

  PracticeEngine.handleAnswer("q1", "A");
  PracticeEngine.advance();
  assert.ok(container.innerHTML.indexOf('data-question-id="q2"') !== -1, "expected to advance to q2:\n" + container.innerHTML);

  PracticeEngine.handleAnswer("q2", "B");
  PracticeEngine.advance();
  assert.ok(container.innerHTML.indexOf("Quiz complete") !== -1, "expected a completion screen:\n" + container.innerHTML);

  // The old bug: clicking Next again from here silently re-rendered q1/q2.
  const afterComplete = container.innerHTML;
  PracticeEngine.advance();
  assert.strictEqual(container.innerHTML, afterComplete, "advance() from the complete state must be a no-op");
  assert.ok(container.innerHTML.indexOf('data-question-id="q1"') === -1, "must never resurrect a previously-answered question");
});

test("a single-mistake review pass ends deterministically instead of re-showing the same question forever", () => {
  const practices = [twoChoiceQuestion("q1", "A"), twoChoiceQuestion("q2", "A")];
  const { PracticeEngine, container } = setupFakePracticeEnv(practices);
  PracticeEngine.start();
  PracticeEngine.handleAnswer("q1", "B"); // wrong -> the only mistake
  PracticeEngine.advance();
  PracticeEngine.handleAnswer("q2", "A"); // correct -> stream fully answered
  PracticeEngine.advance();
  assert.ok(container.innerHTML.indexOf("Quiz complete") !== -1);

  assert.strictEqual(PracticeEngine.enterReviewMode(), true);
  assert.ok(container.innerHTML.indexOf('data-question-id="q1"') !== -1, container.innerHTML);

  PracticeEngine.advance(); // the old bug: (idx+1) % 1 === idx -> shows q1 again, forever
  assert.strictEqual(PracticeEngine.getMode(), "stream", "a 1-item review pass must end, not stay in review mode");
  assert.ok(container.innerHTML.indexOf("complete") !== -1, "expected a complete/back-to-stream screen:\n" + container.innerHTML);

  const afterReview = container.innerHTML;
  PracticeEngine.advance();
  assert.strictEqual(container.innerHTML, afterReview, "advance() must not loop back into review once it has ended");
});

test("a multi-mistake review pass visits each mistake exactly once, then ends (no ring-buffer cycling)", () => {
  const practices = [twoChoiceQuestion("q1", "A"), twoChoiceQuestion("q2", "A"), twoChoiceQuestion("q3", "A")];
  const { PracticeEngine, container } = setupFakePracticeEnv(practices);
  PracticeEngine.start();
  PracticeEngine.handleAnswer("q1", "B"); PracticeEngine.advance(); // wrong
  PracticeEngine.handleAnswer("q2", "B"); PracticeEngine.advance(); // wrong
  PracticeEngine.handleAnswer("q3", "A"); PracticeEngine.advance(); // correct -> complete
  assert.ok(container.innerHTML.indexOf("Quiz complete") !== -1);

  PracticeEngine.enterReviewMode();
  const seen = [];
  for (let i = 0; i < 6; i++) {
    const m = /data-question-id="(q\d)"/.exec(container.innerHTML);
    if (!m) break;
    seen.push(m[1]);
    PracticeEngine.advance();
  }
  assert.strictEqual(seen.length, 2, "expected exactly the 2 mistakes, each shown once; got: " + JSON.stringify(seen));
  assert.deepStrictEqual(seen.slice().sort(), ["q1", "q2"]);
  assert.strictEqual(PracticeEngine.getMode(), "stream");
});

// ---------------------------------------------------------------------
section("14. PracticeState: stats and mistake list ignore stale/removed question ids");
// ---------------------------------------------------------------------
test("getStats() and getMistakeIds() only count ids that exist in the currently active bank", () => {
  const statePath = path.join(projectRoot, "practice", "practice-state.js");
  delete require.cache[statePath];
  global.window = {};
  global.window.DynancaPracticeId = "stale-test-" + Math.random().toString(36).slice(2);
  global.PRACTICES = [{ id: "q1" }, { id: "q2" }];
  const PracticeState = require(statePath);

  PracticeState.saveAttempt("q1", "A", true, null);
  PracticeState.saveAttempt("q2", "B", false, null);
  // Simulates a question that was removed/renamed in a later edit of the
  // bank, but whose old attempt record still sits under the same
  // per-quiz storage key.
  PracticeState.saveAttempt("removed-question-from-old-version", "A", true, null);

  const stats = PracticeState.getStats();
  assert.strictEqual(stats.total, 2, "total must reflect the ACTIVE bank, not stale records");
  assert.strictEqual(stats.answered, 2);
  assert.strictEqual(stats.correct, 1);
  assert.strictEqual(stats.wrong, 1);
  assert.strictEqual(stats.unanswered, 0);
  assert.deepStrictEqual(PracticeState.getMistakeIds(), ["q2"], "a stale wrong-answer record must never surface as a reviewable mistake");
});

// ---------------------------------------------------------------------


test("Venn renderer uses semantic setNames and falls back to A/B/C when names are absent", () => {
  const rendererPath = path.join(projectRoot, "practice", "venn-renderer.js");
  delete require.cache[rendererPath];
  global.window = {};
  require(rendererPath);
  const named = global.window.DynancaVenn.render({
    type: "venn", sets: ["A","B","C"], setNames: ["History","Art","Geography"],
    regions: { A_only: 1, B_only: 2, C_only: 3, AB_only: 4, AC_only: 5, BC_only: 6, ABC: 7 },
    highlight: []
  }, "venn-test");
  assert.ok(named.includes(">History</text>") && named.includes(">Art</text>") && named.includes(">Geography</text>"));
  const fallback = global.window.DynancaVenn.render({
    type: "venn", sets: ["A","B"], setNames: [],
    regions: { A_only: 1, B_only: 2, intersection: 3, outside: 0 }, highlight: []
  }, "venn-fallback");
  assert.ok(fallback.includes(">A</text>") && fallback.includes(">B</text>"));
});

test("percentage notation remains ordinary text and is never rewritten by math cleanup", () => {
  const hits = [];
  (function walk(dir) {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, e.name);
      if (e.isDirectory()) { walk(full); continue; }
      if (!e.name.toLowerCase().endsWith(".json")) continue;
      const data = JSON.parse(fs.readFileSync(full, "utf8"));
      (data.questions || []).forEach((q) => {
        ["question","hint","explanation"].forEach((k) => {
          if (typeof q[k] === "string" && /\d+(?:\.\d+)?%/.test(q[k])) hits.push(q[k]);
        });
        (q.options || []).forEach(o => {
          if (o && typeof o.text === "string" && /\d+(?:\.\d+)?%/.test(o.text)) hits.push(o.text);
        });
      });
    }
  })(path.join(projectRoot, "questions"));
  assert.ok(hits.length > 0, "expected percentage examples to remain represented as literal percent notation");
  hits.forEach((s) => assert.ok(/\d+(?:\.\d+)?%/.test(s)));
});

// ---------------------------------------------------------------------
section("15. Data regression: literal \\% and \\_ outside math delimiters (final-hardening audit)");
// ---------------------------------------------------------------------
// Regression coverage for the audit finding that some question banks
// contained a LaTeX-escaped percent sign ("\%") or escaped underscores
// ("\_\_\_") sitting in PLAIN TEXT (outside any \( \)/\[ \] math span),
// which renders as a literal backslash character instead of "%" / "___".
// The fix was a one-time, context-aware data cleanup (never a blind
// find/replace — that would have corrupted legitimate LaTeX like
// "\(14\%\)"), applied to basic-algebra-600.json, math-snack-07.json,
// statistics-learning-04.json (the "\%" bug) and quiz - 01.json (the
// "\_\_\_" bug). This test guards against either ever recurring anywhere
// in the ecosystem, including in banks added after this fix.
function mathSpans(s) {
  const spans = [];
  let i = 0;
  const n = s.length;
  while (i < n) {
    if (s.slice(i, i + 2) === "\\(") {
      const j = s.indexOf("\\)", i + 2);
      if (j === -1) break;
      spans.push([i, j + 2]); i = j + 2; continue;
    }
    if (s.slice(i, i + 2) === "\\[") {
      const j = s.indexOf("\\]", i + 2);
      if (j === -1) break;
      spans.push([i, j + 2]); i = j + 2; continue;
    }
    i++;
  }
  return spans;
}
function inAnySpan(pos, spans) { return spans.some(([a, b]) => pos >= a && pos < b); }
function plainTextBadMatches(s, re) {
  if (typeof s !== "string") return [];
  const spans = mathSpans(s);
  const hits = [];
  let m;
  const r = new RegExp(re.source, "g");
  while ((m = r.exec(s)) !== null) {
    if (!inAnySpan(m.index, spans)) hits.push(m[0]);
  }
  return hits;
}
function walkAllQuestions(visit) {
  (function walk(dir) {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, e.name);
      if (e.isDirectory()) { walk(full); continue; }
      if (!e.name.toLowerCase().endsWith(".json")) continue;
      const data = JSON.parse(fs.readFileSync(full, "utf8"));
      (data.questions || []).forEach((q) => visit(full, q));
    }
  })(path.join(projectRoot, "questions"));
}
test("no field in any question bank contains a literal \\% outside a math delimiter", () => {
  const offenders = [];
  walkAllQuestions((full, q) => {
    ["question", "hint", "explanation"].forEach((k) => {
      if (plainTextBadMatches(q[k], /\\%/).length) offenders.push(`${full} ${q.id} ${k}`);
    });
    (Array.isArray(q.options) ? q.options : []).forEach((o, i) => {
      if (o && plainTextBadMatches(o.text, /\\%/).length) offenders.push(`${full} ${q.id} options[${i}]`);
    });
  });
  assert.deepStrictEqual(offenders, []);
});
// The next two look banks up through the manifest (ids are final). They
// used to open hardcoded paths (basic-algebra-600.json, statistics.json)
// that do not exist in the final package.
test("plain percentages (e.g. \"14%\") are still ordinary text (manifest id mathematics-algebra-learn-algebra-1, question …-q004)", () => {
  const q = questionBySuffix(bankByManifestId("mathematics-algebra-learn-algebra-1"), "-q004");
  assert.ok(/14%/.test(q.question), "expected a plain 14% in the question text: " + q.question);
  assert.ok(!/14\\%/.test(q.question), "must not contain the literal backslash-percent form");
});
test("math-mode percentages (e.g. \"\\(20\\%\\)\") are still present inside math (manifest id mathematics-statistics-learn-statistics-1)", () => {
  const data = bankByManifestId("mathematics-statistics-learn-statistics-1");
  const hasMathPct = data.questions.some((q) => typeof q.explanation === "string" && q.explanation.indexOf("\\%") !== -1);
  assert.ok(hasMathPct, "expected legitimate math-mode \\% usage (e.g. inside \\(...\\times100\\%\\))");
});
test("no field in any question bank contains a plain-text escaped-underscore placeholder (\\_\\_\\_) outside a math delimiter", () => {
  const offenders = [];
  walkAllQuestions((full, q) => {
    ["question", "hint", "explanation"].forEach((k) => {
      if (plainTextBadMatches(q[k], /\\_/).length) offenders.push(`${full} ${q.id} ${k}`);
    });
    (Array.isArray(q.options) ? q.options : []).forEach((o, i) => {
      if (o && plainTextBadMatches(o.text, /\\_/).length) offenders.push(`${full} ${q.id} options[${i}]`);
    });
  });
  assert.deepStrictEqual(offenders, []);
});
// (Removed: "quiz - 01.json question q005 reads as plain ___". In the final
// bank that question is a different item with no blank, so the fixture no
// longer exists. The behaviour it guarded is covered for EVERY bank by the
// two generic tests above, and by this one:)
test("fill-in-the-blank placeholders that exist in the final banks are plain underscores, never escaped ones", () => {
  let plain = 0;
  walkAllQuestions((full, q) => {
    if (typeof q.question !== "string") return;
    if (q.question.indexOf("___") !== -1) plain += 1;
  });
  assert.ok(plain > 0, "expected at least one real ___ placeholder in the final banks");
});

// ---------------------------------------------------------------------
section("16. Content correctness regression: simplifying-radicals answer chain (manifest id mathematics-algebra-learn-algebra-1)");
// ---------------------------------------------------------------------
// Same four items as before, now found through the manifest. Their ids in
// the final bank end in -q080 / -q232 / -q371 / -q469 (formerly mfc-80 …);
// each test first checks it really is the intended question.
const algebraBank = (function () {
  try { return bankByManifestId("mathematics-algebra-learn-algebra-1"); } catch (e) { return null; }
})();
function radicalQuestion(suffix, radicand) {
  assert.ok(algebraBank, "bank for manifest id mathematics-algebra-learn-algebra-1 should load");
  const q = questionBySuffix(algebraBank, suffix);
  assert.ok(q.question.indexOf("\\sqrt{" + radicand + "}") !== -1, `${suffix} should be the sqrt(${radicand}) question, got: ${q.question}`);
  const correct = q.options.find((o) => o.label === q.answer);
  assert.ok(correct, "answer must reference a real option");
  return { q, correct };
}
test("sqrt(36) (…-q080) simplifies to the fully-reduced integer 6, and is internally consistent", () => {
  const { q, correct } = radicalQuestion("-q080", 36);
  assert.strictEqual(correct.text, "\\(6\\)");
  assert.strictEqual(Math.sqrt(36), 6);
  assert.ok(q.explanation.indexOf("6") !== -1);
});
test("sqrt(72) (…-q232) simplifies to 6*sqrt(2), numerically equal to sqrt(72)", () => {
  const { correct } = radicalQuestion("-q232", 72);
  assert.strictEqual(correct.text, "\\(6\\sqrt{2}\\)");
  assert.ok(Math.abs(6 * Math.sqrt(2) - Math.sqrt(72)) < 1e-9);
});
test("sqrt(32) (…-q371) offers the fully-simplified 4*sqrt(2) as the correct option", () => {
  const { q, correct } = radicalQuestion("-q371", 32);
  assert.ok(q.options.map((o) => o.text).indexOf("\\(4\\sqrt{2}\\)") !== -1, "4*sqrt(2) must be an available option");
  assert.strictEqual(correct.text, "\\(4\\sqrt{2}\\)");
  assert.ok(Math.abs(4 * Math.sqrt(2) - Math.sqrt(32)) < 1e-9);
});
test("sqrt(100) (…-q469) simplifies to the fully-reduced integer 10", () => {
  const { correct } = radicalQuestion("-q469", 100);
  assert.strictEqual(correct.text, "\\(10\\)");
  assert.strictEqual(Math.sqrt(100), 10);
});

// ---------------------------------------------------------------------
section("17. Content correctness regression: no accidental multimodal \"mode\" data set has a single-answer key");
// ---------------------------------------------------------------------
// Regression coverage for statistics.json's mfc-28: the data set
// [5,14,17,15,15,14] is genuinely bimodal (14 and 15 both occur twice),
// but the question offered only a single-letter answer ("15"), silently
// treating the tie as if it didn't exist. Fixed by a minimal data-set
// edit that removes the tie. This test generalizes the check across
// every "Mode" question in every statistics bank, so a future addition
// can't reintroduce a single-answer question over tied-frequency data.
test("every single-answer \"mode\" question's data set has a unique, unambiguous mode", () => {
  const offenders = [];
  walkAllQuestions((full, q) => {
    if (q.concept !== "Mode") return;
    if (!Array.isArray(q.options) || !q.options.length) return; // multi-select / free-form not in scope
    const m = /\[\s*([\d.,\s-]+?)\s*\]/.exec(q.question || "");
    if (!m) return; // dataset not expressed as a bracketed literal list; not automatically checkable
    const values = m[1].split(",").map((s) => s.trim()).filter(Boolean).map(Number);
    if (values.some((v) => Number.isNaN(v))) return;
    const freq = new Map();
    values.forEach((v) => freq.set(v, (freq.get(v) || 0) + 1));
    const maxFreq = Math.max(...freq.values());
    const modes = [...freq.entries()].filter(([, c]) => c === maxFreq).map(([v]) => v);
    if (modes.length > 1) offenders.push(`${full} ${q.id}: data set ${JSON.stringify(values)} is multimodal (${modes.join(", ")}) but has a single-letter answer key.`);
  });
  assert.deepStrictEqual(offenders, []);
});
test("the mode question …-q028 (manifest id mathematics-statistics-learn-statistics-1) has a single, unambiguous mode of 15", () => {
  const q = questionBySuffix(bankByManifestId("mathematics-statistics-learn-statistics-1"), "-q028");
  assert.strictEqual(q.concept, "Mode", "…-q028 should be the Mode question");
  const m = /\[\s*([\d.,\s-]+?)\s*\]/.exec(q.question);
  assert.ok(m, "expected a bracketed data set in the question text: " + q.question);
  const values = m[1].split(",").map((s) => Number(s.trim()));
  const freq = new Map();
  values.forEach((v) => freq.set(v, (freq.get(v) || 0) + 1));
  const maxFreq = Math.max(...freq.values());
  const modes = [...freq.entries()].filter(([, c]) => c === maxFreq).map(([v]) => v);
  assert.deepStrictEqual(modes, [15]);
  const correct = q.options.find((o) => o.label === q.answer);
  assert.strictEqual(correct.text, "\\(15\\)");
});

// ---------------------------------------------------------------------
section("18. Venn diagram data integrity (manifest id mathematics-discrete-mathematics-sets-1)");
// ---------------------------------------------------------------------
// Regression coverage for the set-theory bank. BEFORE: this section opened
// a hardcoded questions/.../sets.json (ENOENT — the final file is
// "SETS 1.json") and compared 20 questions against hardcoded mfc-N ids
// that no longer exist, which stopped the whole suite. NOW: the bank is
// resolved through the manifest, and each expected region value is
// RE-DERIVED from the question's own wording, so the checks keep meaning
// regardless of how question ids are numbered.
const setsEntry = manifestUtil.findPracticeFile(realManifest.subjects, "mathematics-discrete-mathematics-sets-1");
const setsBankPath = setsEntry ? path.join(projectRoot, setsEntry.path) : null;
const setsBank = setsBankPath && fs.existsSync(setsBankPath) ? JSON.parse(fs.readFileSync(setsBankPath, "utf8")) : { questions: [] };
test("the set-theory bank is reachable through its manifest entry (path with a space and capitals)", () => {
  assert.ok(setsEntry, "manifest entry mathematics-discrete-mathematics-sets-1 should exist");
  assert.strictEqual(setsEntry.path, "questions/mathematics/discrete-mathematics/SETS 1.json");
  assert.ok(setsBank.questions.length > 0);
});

test("generic Venn validator: every Venn question in the set-theory bank passes with zero problems", () => {
  const offenders = [];
  setsBank.questions.forEach((q) => {
    if (!q.visual || q.visual.type !== "venn") return;
    const problems = validateVennQuestion(q);
    if (problems.length) offenders.push(`${q.id}: ${problems.join("; ")}`);
  });
  assert.deepStrictEqual(offenders, []);
});

test("generic Venn validator flags the exact 'outside absorbed the total' bug pattern (negative control)", () => {
  const bugged = {
    question: "A survey of 61 people found 13 drink only water, 7 drink only coffee, and 7 drink both. How many drink neither?",
    visual: { type: "venn", sets: ["A", "B"], regions: { A_only: 0, B_only: 0, intersection: 0, outside: 61 }, setNames: [] },
  };
  const problems = validateVennQuestion(bugged);
  assert.ok(problems.length > 0, "expected the uninitialized-regions heuristic to catch this");
});

test("generic Venn validator flags corrupted setNames containing leaked question text (negative control)", () => {
  const corrupted = {
    question: "x",
    visual: {
      type: "venn",
      sets: ["A", "B", "C"],
      regions: { A_only: 0, B_only: 0, C_only: 0, AB_only: 1, AC_only: 1, BC_only: 1, ABC: 1 },
      setNames: ["A", "B", "C clubs shows regions of 6 (A∩B only). How many students are in EXACTLY two"],
    },
  };
  const problems = validateVennQuestion(corrupted);
  assert.ok(problems.some((p) => p.indexOf("corrupted") !== -1));
});

const NEITHER_RE = /^A survey of (\d+) people found (\d+) drink only (\w+), (\d+) drink only (\w+), and (\d+) drink both\. How many drink neither\?$/;
function capitalize(word) { return word.charAt(0).toUpperCase() + word.slice(1); }
test("every 'only A / only B / both / neither' survey question has regions and setNames derived from its own text", () => {
  let checked = 0;
  setsBank.questions.forEach((q) => {
    const m = NEITHER_RE.exec(q.question || "");
    if (!m) return;
    const total = Number(m[1]), onlyA = Number(m[2]), onlyB = Number(m[4]), both = Number(m[6]);
    assert.ok(q.visual && q.visual.type === "venn", `${q.id} should carry a Venn visual`);
    assert.deepStrictEqual(
      q.visual.regions,
      { A_only: onlyA, B_only: onlyB, intersection: both, outside: total - onlyA - onlyB - both },
      `${q.id} regions do not match its question text`
    );
    assert.deepStrictEqual(q.visual.setNames, [capitalize(m[3]), capitalize(m[5])], `${q.id} setNames mismatch`);
    checked += 1;
  });
  // The repaired set contained 14 such questions; fewer would mean the
  // bank (protected content) or this test's pattern changed.
  assert.strictEqual(checked, 14, `expected 14 survey questions of this form, found ${checked}`);
});

const EXACTLY_TWO_RE = /^A Venn diagram for (.+?), (.+?), and (.+?) clubs shows regions of (\d+) \(A∩B only\), (\d+) \(A∩C only\), (\d+) \(B∩C only\), and (\d+) \(all three\)\. How many students are in EXACTLY two of the three clubs\?$/;
test("every three-set 'exactly two' question has AB/AC/BC/ABC regions and setNames derived from its own text", () => {
  let checked = 0;
  setsBank.questions.forEach((q) => {
    const m = EXACTLY_TWO_RE.exec(q.question || "");
    if (!m) return;
    assert.ok(q.visual && q.visual.type === "venn", `${q.id} should carry a Venn visual`);
    assert.strictEqual(q.visual.regions.AB_only, Number(m[4]), `${q.id} AB_only`);
    assert.strictEqual(q.visual.regions.AC_only, Number(m[5]), `${q.id} AC_only`);
    assert.strictEqual(q.visual.regions.BC_only, Number(m[6]), `${q.id} BC_only`);
    assert.strictEqual(q.visual.regions.ABC, Number(m[7]), `${q.id} ABC (all three)`);
    assert.deepStrictEqual(q.visual.setNames, [m[1], m[2], m[3]], `${q.id} setNames mismatch`);
    q.visual.setNames.forEach((n) => assert.ok(n.length <= 40, `${q.id} setName too long: ${n}`));
    checked += 1;
  });
  assert.strictEqual(checked, 6, `expected 6 'exactly two' questions, found ${checked}`);
});

test("all 53 two-set Venn questions in the set-theory bank have exactly 2 setNames", () => {
  const twoSet = setsBank.questions.filter((q) => q.visual && q.visual.type === "venn" && q.visual.sets.length === 2);
  assert.strictEqual(twoSet.length, 53, `expected 53 two-set Venn questions, found ${twoSet.length}`);
  twoSet.forEach((q) => {
    assert.ok(Array.isArray(q.visual.setNames) && q.visual.setNames.length === 2, `${q.id} missing setNames`);
  });
});

test("the set-theory bank retains all 556 questions; every question on disk belongs to a catalogued bank", () => {
  // BEFORE: a hardcoded project-wide total (8,356) from an older, smaller
  // package. NOW: the total is whatever the shipped, catalogued banks
  // really contain (the same figure the bank index publishes), so the
  // check stays true after the owner adds the remaining bank files.
  assert.strictEqual(setsBank.questions.length, 556);
  let total = 0;
  walkAllQuestions(() => { total += 1; });
  assert.strictEqual(total, realIndexResult.report.verifiedQuestions, "questions on disk must equal the verified total of catalogued banks");
});

// ---------------------------------------------------------------------
section("19. Catalog view model (assets/js/catalog-model.js — the adapter the landing page uses)");
// ---------------------------------------------------------------------
const CatalogModel = require(path.join(projectRoot, "assets", "js", "catalog-model.js"));

// A fixture that exercises every shape the manifest schema allows:
//   - "flat": files directly on the subject (no topics)
//   - "nested": subject -> topic -> subtopic -> files, plus a topic with
//     files AND a subtopic (a mixed node)
//   - "mixed": files directly on the subject AND topics underneath
//   - "brand-new": a collection no UI code has ever heard of
//   - "empty": a collection with nothing in it
function pf(id, name, count) {
  return { id, name, file: id + ".json", path: "questions/fx/" + id + ".json", questionCount: count };
}
const shapeManifest = {
  schemaVersion: "1.0",
  manifestType: "dynanca-master",
  subjects: [
    { id: "flat", name: "Flat", practice_files: [pf("flat-1", "Flat One", 5), pf("flat-2", "Flat Two", 6)] },
    {
      id: "nested", name: "Nested",
      topics: [
        {
          id: "t1", name: "Topic One",
          practice_files: [pf("n-t1-a", "Topic One A", 3)],
          subtopics: [
            { id: "s1", name: "Sub One", practice_files: [pf("n-t1-s1-a", "Deep A", 2), pf("n-t1-s1-b", "Deep B", 2)] },
            { id: "s2", name: "Sub Two", topics: [{ id: "x", name: "Deeper", practice_files: [pf("n-deeper", "Deepest", 1)] }] },
          ],
        },
        { id: "t2", name: "Topic Two", practice_files: [pf("n-t2-a", "Álgebra Básica", 4)] },
      ],
    },
    {
      id: "mixed", name: "Mixed",
      practice_files: [pf("m-direct", "Mixed Direct", 9)],
      topics: [{ id: "t1", name: "Mixed Topic", practice_files: [pf("m-t1-a", "Mixed In Topic", 7)] }],
    },
    { id: "brand new/collection", name: "Brand New", practice_files: [pf("id with spaces & symbols/?#", "Odd Id", 8)] },
    { id: "empty", name: "Empty" },
  ],
};
const shapeIndex = {
  schemaVersion: "1.0",
  summary: { listedBanks: 10 },
  available: { "flat-1": 5, "n-t1-a": 3, "n-t1-s1-a": 20, "n-deeper": 1, "m-direct": 9, "id with spaces & symbols/?#": 8 },
};
const shapeCatalog = CatalogModel.buildCatalog(shapeManifest, shapeIndex, manifestUtil);

function traversalIds(manifest) {
  const ids = [];
  manifestUtil.eachPracticeFile(manifest.subjects, (p) => ids.push(p.id));
  return ids;
}

test("adapter yields exactly the entries of DynancaManifest.eachPracticeFile, same ids, same order (fixture with direct, nested, mixed and new nodes)", () => {
  assert.deepStrictEqual(shapeCatalog.entries.map((e) => e.id), traversalIds(shapeManifest));
  assert.strictEqual(shapeCatalog.entries.length, 10);
});
test("adapter yields exactly the entries of the traversal for the REAL manifest (count, ids, order)", () => {
  const realCatalog = CatalogModel.buildCatalog(realManifest, { available: {} }, manifestUtil);
  const ids = traversalIds(realManifest);
  assert.strictEqual(realCatalog.entries.length, ids.length);
  assert.deepStrictEqual(realCatalog.entries.map((e) => e.id), ids);
  assert.strictEqual(realCatalog.collections.length, realManifest.subjects.length);
  assert.deepStrictEqual(realCatalog.collections.map((c) => c.name), realManifest.subjects.map((s) => s.name));
});
test("adapter is read-only: the manifest and index objects are not mutated", () => {
  const manifestBefore = JSON.stringify(shapeManifest);
  const indexBefore = JSON.stringify(shapeIndex);
  CatalogModel.buildCatalog(shapeManifest, shapeIndex, manifestUtil);
  assert.strictEqual(JSON.stringify(shapeManifest), manifestBefore);
  assert.strictEqual(JSON.stringify(shapeIndex), indexBefore);
});
test("collections come from the manifest, in manifest order, including a brand-new and an empty one", () => {
  assert.deepStrictEqual(shapeCatalog.collections.map((c) => c.name), ["Flat", "Nested", "Mixed", "Brand New", "Empty"]);
  const flat = shapeCatalog.collectionByKey["flat"];
  assert.strictEqual(flat.topics.length, 0, "a flat collection must not get an invented topic");
  assert.strictEqual(flat.total, 2);
  assert.strictEqual(flat.available, 1);
  assert.strictEqual(shapeCatalog.collectionByKey["empty"].total, 0);
});
test("nested topics/subtopics keep their ancestor trail and roll counts up to every ancestor", () => {
  const nested = shapeCatalog.collectionByKey["nested"];
  assert.deepStrictEqual(nested.topics.map((t) => t.path), ["t1", "t1/s1", "t1/s2", "t1/s2/x", "t2"]);
  assert.strictEqual(nested.topicByPath["t1"].total, 4, "t1 = its own file + 2 in s1 + 1 in s2/x");
  assert.strictEqual(nested.topicByPath["t1/s1"].total, 2);
  assert.strictEqual(nested.topicByPath["t1/s2"].total, 1);
  assert.strictEqual(nested.topicByPath["t1/s2/x"].label, "Topic One › Sub Two › Deeper");
  const deep = shapeCatalog.byId["n-deeper"];
  assert.deepStrictEqual(deep.topicNames, ["Topic One", "Sub Two", "Deeper"]);
  assert.strictEqual(deep.collectionName, "Nested");
});
test("a mixed node (files AND topics) reports both its direct files and its topic files", () => {
  const mixed = shapeCatalog.collectionByKey["mixed"];
  assert.strictEqual(mixed.total, 2);
  assert.strictEqual(mixed.directTotal, 1);
  assert.strictEqual(mixed.topics.length, 1);
  const direct = CatalogModel.filterEntries(shapeCatalog, CatalogModel.normalizeState({ collection: "mixed", topic: ".", show: "all" }, shapeCatalog));
  assert.deepStrictEqual(direct.items.map((e) => e.id), ["m-direct"]);
});
test("availability and counts: verified count comes from the index, listed count from the manifest, and they are never mixed", () => {
  const a = shapeCatalog.byId["n-t1-s1-a"];
  assert.strictEqual(a.available, true);
  assert.strictEqual(a.verifiedCount, 20, "verified count is the index value");
  assert.strictEqual(a.listedCount, 2, "listed count stays the manifest value");
  const b = shapeCatalog.byId["flat-2"];
  assert.strictEqual(b.available, false);
  assert.strictEqual(b.verifiedCount, null);
  assert.strictEqual(shapeCatalog.totals.available, 6);
  assert.strictEqual(shapeCatalog.totals.listed, 10);
  assert.strictEqual(shapeCatalog.totals.verifiedQuestions, 5 + 3 + 20 + 1 + 9 + 8);
});
test("search covers name, canonical id, collection and topic names; is case-insensitive, trimmed, accent-insensitive, AND-combined", () => {
  const run = (q, extra) => CatalogModel.filterEntries(shapeCatalog, CatalogModel.normalizeState(Object.assign({ q, show: "all" }, extra || {}), shapeCatalog)).items.map((e) => e.id);
  assert.deepStrictEqual(run("  DEEP a "), ["n-t1-s1-a"], "name, case and surrounding spaces");
  assert.deepStrictEqual(run("n-t2-a"), ["n-t2-a"], "canonical id");
  assert.deepStrictEqual(run("brand new"), ["id with spaces & symbols/?#"], "collection name");
  assert.deepStrictEqual(run("sub two"), ["n-deeper"], "topic name in the trail");
  assert.deepStrictEqual(run("algebra basica"), ["n-t2-a"], "accents are ignored");
  assert.deepStrictEqual(run("mixed topic direct"), [], "all words must match the same bank");
  assert.strictEqual(run("").length, 10, "empty query matches everything");
});
test("filters combine: collection + topic (with descendants) + availability + query", () => {
  const st = (o) => CatalogModel.normalizeState(o, shapeCatalog);
  const ids = (o) => CatalogModel.filterEntries(shapeCatalog, st(o)).items.map((e) => e.id);
  assert.deepStrictEqual(ids({ collection: "nested", show: "all" }), ["n-t1-a", "n-t1-s1-a", "n-t1-s1-b", "n-deeper", "n-t2-a"]);
  assert.deepStrictEqual(ids({ collection: "nested", topic: "t1", show: "all" }), ["n-t1-a", "n-t1-s1-a", "n-t1-s1-b", "n-deeper"]);
  assert.deepStrictEqual(ids({ collection: "nested", topic: "t1/s1", show: "all" }), ["n-t1-s1-a", "n-t1-s1-b"]);
  assert.deepStrictEqual(ids({ collection: "nested", topic: "t1/s1" }), ["n-t1-s1-a"], "default shows available only");
  assert.deepStrictEqual(ids({ collection: "nested", topic: "t1", q: "deep", show: "all" }), ["n-t1-s1-a", "n-t1-s1-b", "n-deeper"]);
  const r = CatalogModel.filterEntries(shapeCatalog, st({ collection: "nested", topic: "t1/s1" }));
  assert.strictEqual(r.matchedAll, 2);
  assert.strictEqual(r.matchedAvailable, 1);
  assert.strictEqual(r.matchedUnavailable, 1);
});
test("an unknown collection/topic in the URL falls back to 'all' instead of an empty or broken view", () => {
  const s1 = CatalogModel.normalizeState({ collection: "nope", topic: "t1", page: "7" }, shapeCatalog);
  assert.strictEqual(s1.collection, "");
  assert.strictEqual(s1.topic, "");
  const s2 = CatalogModel.normalizeState({ collection: "nested", topic: "nope", show: "weird", page: "-3" }, shapeCatalog);
  assert.strictEqual(s2.collection, "nested");
  assert.strictEqual(s2.topic, "");
  assert.strictEqual(s2.show, "available");
  assert.strictEqual(s2.page, 1);
  assert.strictEqual(CatalogModel.normalizeState({ collection: "flat", topic: "." }, shapeCatalog).topic, "", "'not in a topic' only exists for mixed collections");
});
test("URL state round-trips (encode -> parse -> normalize), including ids with spaces and symbols", () => {
  const state = CatalogModel.normalizeState({ q: "a b&c=d", collection: "brand new/collection", show: "all", page: 3 }, shapeCatalog);
  const query = CatalogModel.toQuery(state);
  assert.strictEqual(query, "?q=a%20b%26c%3Dd&collection=brand%20new%2Fcollection&show=all&page=3");
  assert.deepStrictEqual(CatalogModel.normalizeState(CatalogModel.parseQuery(query), shapeCatalog), state);
  assert.strictEqual(CatalogModel.toQuery(CatalogModel.defaultState()), "", "default view has a clean URL");
  assert.strictEqual(CatalogModel.parseQuery("?q=a+b").q, "a b", "+ is a space, as browsers submit it");
  assert.doesNotThrow(() => CatalogModel.parseQuery("?q=%E0%A4%A&page=2"), "a malformed escape must not throw");
});
test("pagination: 24 per page, clamps out-of-range pages, exact ranges", () => {
  const items = Array.from({ length: 50 }, (_, i) => i);
  assert.strictEqual(CatalogModel.PAGE_SIZE, 24);
  const p1 = CatalogModel.paginate(items, 1);
  assert.deepStrictEqual([p1.from, p1.to, p1.pageCount, p1.items.length], [1, 24, 3, 24]);
  const p3 = CatalogModel.paginate(items, 3);
  assert.deepStrictEqual([p3.from, p3.to, p3.items.length], [49, 50, 2]);
  assert.strictEqual(CatalogModel.paginate(items, 99).page, 3, "too-high page clamps to the last page");
  assert.strictEqual(CatalogModel.paginate(items, 0).page, 1);
  const none = CatalogModel.paginate([], 5);
  assert.deepStrictEqual([none.page, none.pageCount, none.from, none.to, none.total], [1, 1, 0, 0, 0]);
});
test("page window always contains first, last and current, with gaps only where pages are skipped", () => {
  assert.deepStrictEqual(CatalogModel.pageWindow(1, 1), [1]);
  assert.deepStrictEqual(CatalogModel.pageWindow(2, 3), [1, 2, 3]);
  assert.deepStrictEqual(CatalogModel.pageWindow(40, 80), [1, "gap", 39, 40, 41, "gap", 80]);
  assert.deepStrictEqual(CatalogModel.pageWindow(1, 80), [1, 2, 3, 4, "gap", 80]);
  for (let pages = 1; pages <= 120; pages++) {
    for (let page = 1; page <= pages; page++) {
      const w = CatalogModel.pageWindow(page, pages);
      assert.ok(w.includes(1) && w.includes(pages) && w.includes(page));
      assert.ok(w.length <= 7, `window too long for ${page}/${pages}: ${w}`);
    }
  }
});
test("practice link is the canonical pattern with the exact manifest id (encodeURIComponent, never a slug)", () => {
  assert.strictEqual(CatalogModel.practiceHref("quiz-quiz-01"), "practice/index.html?quiz=quiz-quiz-01");
  const odd = "id with spaces & symbols/?#";
  const href = CatalogModel.practiceHref(odd);
  assert.strictEqual(href, "practice/index.html?quiz=" + encodeURIComponent(odd));
  assert.strictEqual(new URLSearchParams(href.split("?")[1]).get("quiz"), odd, "the practice page must read back the identical id");
  manifestUtil.eachPracticeFile(realManifest.subjects, (p) => {
    assert.strictEqual(new URLSearchParams(CatalogModel.practiceHref(p.id).split("?")[1]).get("quiz"), p.id);
  });
});
test("a manifest entry whose id is repeated can only open its first occurrence, so only the first is offered as available", () => {
  const dup = {
    subjects: [{ id: "c", name: "C", practice_files: [pf("same", "First", 1), pf("same", "Second", 1)] }],
  };
  const cat = CatalogModel.buildCatalog(dup, { available: { same: 1 } }, manifestUtil);
  assert.deepStrictEqual(cat.entries.map((e) => e.available), [true, false]);
});
test("malformed inputs raise a typed error the UI can turn into a retryable state (never a crash on undefined)", () => {
  [[null, shapeIndex], [{}, shapeIndex], [{ subjects: "x" }, shapeIndex]].forEach(([m, i]) => {
    assert.throws(() => CatalogModel.buildCatalog(m, i, manifestUtil), (e) => e.code === "malformed-manifest");
  });
  [[shapeManifest, null], [shapeManifest, []], [shapeManifest, { available: [] }]].forEach(([m, i]) => {
    assert.throws(() => CatalogModel.buildCatalog(m, i, manifestUtil), (e) => e.code === "malformed-index");
  });
  const empty = CatalogModel.buildCatalog({ subjects: [] }, { available: {} }, manifestUtil);
  assert.strictEqual(empty.entries.length, 0, "an empty manifest is valid and simply has no entries");
});
test("an index that lists ids the manifest does not have is reported for maintainers, and those ids are ignored", () => {
  const cat = CatalogModel.buildCatalog(shapeManifest, { summary: { listedBanks: 3 }, available: { ghost: 4, "flat-1": 5 } }, manifestUtil);
  assert.deepStrictEqual(cat.indexMismatch, { unknownIds: 1, indexListedBanks: 3, manifestEntries: 10 });
  assert.strictEqual(cat.totals.available, 1);
});

// --- saved progress: strictly read-only -------------------------------
function makeStorage(initial, options) {
  const data = Object.assign({}, initial);
  const calls = { setItem: 0, removeItem: 0, clear: 0 };
  return {
    calls,
    data,
    get length() {
      if (options && options.throwOnLength) throw new Error("SecurityError");
      return Object.keys(data).length;
    },
    key(i) { return Object.keys(data)[i]; },
    getItem(k) {
      if (options && options.throwOnGet) throw new Error("SecurityError");
      return Object.prototype.hasOwnProperty.call(data, k) ? data[k] : null;
    },
    setItem(k, v) { calls.setItem += 1; data[k] = String(v); },
    removeItem(k) { calls.removeItem += 1; delete data[k]; },
    clear() { calls.clear += 1; Object.keys(data).forEach((k) => delete data[k]); },
  };
}
test("saved progress is summarised from real attempt records without a single write, migration or removal", () => {
  const initial = {
    "dynanca-mcq-flat-1-v2": JSON.stringify({
      q1: { status: "answered_correct", selectedLabel: "A", answeredAt: 1000 },
      q2: { status: "answered_wrong", selectedLabel: "B", answeredAt: 5000 },
      q3: { status: "unanswered" },
      q4: { status: "answered_correct" }, // no selectedLabel: not a valid record
    }),
    "dynanca-mcq-session-flat-1-v2": JSON.stringify({ currentId: "q2", stepsSinceReview: 1, historyStack: ["q1"] }),
    "dynanca-mcq-n-t1-a-v2": JSON.stringify({ q1: { status: "answered_wrong", selectedLabel: "C", answeredAt: 9000 } }),
    "dynanca-mcq-flat-2-v2": JSON.stringify({ q1: { status: "answered_correct", selectedLabel: "A", answeredAt: 99999 } }),
    "dynanca-mcq-not-in-catalog-v2": JSON.stringify({ q1: { status: "answered_correct", selectedLabel: "A", answeredAt: 1 } }),
    "gp-practice-v1": JSON.stringify({ legacy: { status: "answered_correct", selectedLabel: "A" } }),
    "dynanca-mfc-theme-mode": "dark",
    "dynanca-mcq-m-direct-v2": "{not json",
  };
  const storage = makeStorage(initial);
  const snapshot = JSON.stringify(storage.data);
  const progress = CatalogModel.readSavedProgress(storage, shapeCatalog);
  assert.deepStrictEqual(progress, [
    { id: "flat-2", answers: 1, lastAnsweredAt: 99999 },
    { id: "n-t1-a", answers: 1, lastAnsweredAt: 9000 },
    { id: "flat-1", answers: 2, lastAnsweredAt: 5000 },
  ]);
  assert.deepStrictEqual(storage.calls, { setItem: 0, removeItem: 0, clear: 0 }, "the landing page must never write practice storage");
  assert.strictEqual(JSON.stringify(storage.data), snapshot, "every key, including the legacy and the corrupt one, is left exactly as found");
});
test("blocked or throwing storage yields 'no progress' instead of an exception", () => {
  assert.deepStrictEqual(CatalogModel.readSavedProgress(null, shapeCatalog), []);
  assert.deepStrictEqual(CatalogModel.readSavedProgress(makeStorage({}, { throwOnLength: true }), shapeCatalog), []);
  assert.deepStrictEqual(
    CatalogModel.readSavedProgress(makeStorage({ "dynanca-mcq-flat-1-v2": "{}" }, { throwOnGet: true }), shapeCatalog), []
  );
});

// ---------------------------------------------------------------------
section("20. Bank availability index (tools/bank-index/build-bank-index.js)");
// ---------------------------------------------------------------------
const bankIndexCli = path.join(projectRoot, "tools", "bank-index", "build-bank-index.js");
const realIndexPath = path.join(projectRoot, "assets", "data", "bank-index.json");

function hashTree(dir) {
  const out = {};
  (function walk(d) {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      const full = path.join(d, e.name);
      if (e.isDirectory()) walk(full);
      else out[path.relative(dir, full)] = sha256Hex(fs.readFileSync(full));
    }
  })(dir);
  return out;
}

test("the committed index is exactly what this snapshot of manifest + questions/ produces (--check)", () => {
  const out = execFileSync(process.execPath, [bankIndexCli, "--check"], { cwd: projectRoot, encoding: "utf8", stdio: "pipe" });
  assert.ok(/Bank index check PASS/.test(out), out);
});
test("building twice gives identical bytes (deterministic: manifest order, no timestamp)", () => {
  const a = serializeBankIndex(computeBankIndex(projectRoot).index);
  const b = serializeBankIndex(computeBankIndex(projectRoot).index);
  assert.strictEqual(a, b);
  assert.strictEqual(a, fs.readFileSync(realIndexPath, "utf8"));
  assert.ok(!/\d{4}-\d{2}-\d{2}T/.test(a), "no timestamp may be embedded");
  assert.deepStrictEqual(JSON.parse(a), computeBankIndex(projectRoot).index, "the hand-formatted file must be valid JSON for the same data");
});
test("index keys are canonical manifest ids, in manifest order, and counts are the verified questions.length", () => {
  const index = JSON.parse(fs.readFileSync(realIndexPath, "utf8"));
  const manifestIds = traversalIds(realManifest);
  const indexIds = Object.keys(index.available);
  assert.deepStrictEqual(indexIds, manifestIds.filter((id) => Object.prototype.hasOwnProperty.call(index.available, id)));
  indexIds.forEach((id) => assert.ok(manifestIds.includes(id), `index id ${id} is not a manifest id`));
  // Spot-check real files (one per collection + the known exception).
  ["mathematics-discrete-mathematics-sets-1", "quiz-quiz-01", "math-gaokao-1", "math-gaokao-71", "dynanca-1"].forEach((id) => {
    assert.strictEqual(index.available[id], bankByManifestId(id).questions.length, id);
  });
  assert.strictEqual(index.summary.listedBanks, manifestIds.length);
  assert.strictEqual(index.summary.availableBanks + index.summary.unavailableBanks, index.summary.listedBanks);
  assert.strictEqual(index.manifestSha256, sha256Hex(realManifestBytes));
});
test("math-gaokao-71: index, manifest and catalog all agree on the verified 150", () => {
  const index = JSON.parse(fs.readFileSync(realIndexPath, "utf8"));
  const verified = bankByManifestId("math-gaokao-71").questions.length;
  assert.strictEqual(index.available["math-gaokao-71"], verified);
  assert.strictEqual(manifestEntry("math-gaokao-71").questionCount, verified);
  assert.strictEqual(manifestEntry("math-gaokao-71").path, "questions/math gaokao/math gaokao - 71.json");
  const realCatalog = CatalogModel.buildCatalog(realManifest, index, manifestUtil);
  assert.strictEqual(realCatalog.byId["math-gaokao-71"].verifiedCount, verified);
  assert.strictEqual(realCatalog.byId["math-gaokao-71"].listedCount, verified);
});
test("computer science / algorithms: listed in the manifest, present in the index, AVAILABLE in the catalog with its verified count", () => {
  const index = JSON.parse(fs.readFileSync(realIndexPath, "utf8"));
  const entry = manifestEntry("algorithms");
  assert.strictEqual(entry.path, "questions/computer science/algorithms.json");
  const verified = bankByManifestId("algorithms").questions.length;
  assert.strictEqual(entry.questionCount, verified);
  assert.strictEqual(index.available["algorithms"], verified, "a stale bank-index.json hides this bank from the default AVAILABLE filter");
  const realCatalog = CatalogModel.buildCatalog(realManifest, index, manifestUtil);
  const item = realCatalog.byId["algorithms"];
  assert.ok(item && item.available === true, "algorithms must be available");
  assert.strictEqual(item.verifiedCount, verified);
  assert.strictEqual(item.listedCount, verified);
});
test("the listed total and the available total are different numbers and are kept apart", () => {
  const index = JSON.parse(fs.readFileSync(realIndexPath, "utf8"));
  const realCatalog = CatalogModel.buildCatalog(realManifest, index, manifestUtil);
  assert.strictEqual(realCatalog.totals.listed, index.summary.listedBanks);
  assert.strictEqual(realCatalog.totals.available, index.summary.availableBanks);
  assert.strictEqual(realCatalog.totals.verifiedQuestions, index.summary.verifiedQuestions);
  assert.strictEqual(realCatalog.totals.listedQuestions, index.summary.listedQuestions);
  assert.strictEqual(realCatalog.indexMismatch, null);
});
test("INTEGRATION REHEARSAL: adding a bank file at its canonical path + one rebuild makes it available — in a temporary copy, never in production questions/", () => {
  const index = JSON.parse(fs.readFileSync(realIndexPath, "utf8"));
  const ids = traversalIds(realManifest);
  const pendingId = ids.find((id) => !Object.prototype.hasOwnProperty.call(index.available, id));
  const donorId = ids.find((id) => Object.prototype.hasOwnProperty.call(index.available, id));
  const productionBefore = fs.readdirSync(path.join(projectRoot, "questions"), { recursive: true }).length;

  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "dynanca-index-fixture-"));
  try {
    // A temp project: the REAL manifest (byte copy) + one real donor bank.
    fs.copyFileSync(realManifestPath, path.join(tmp, "master-manifest.json"));
    const donor = manifestEntry(donorId);
    fs.mkdirSync(path.dirname(path.join(tmp, donor.path)), { recursive: true });
    fs.copyFileSync(path.join(projectRoot, donor.path), path.join(tmp, donor.path));

    const run = (extra) => execFileSync(process.execPath, [bankIndexCli, "--root", tmp, "--quiet"].concat(extra || []), { encoding: "utf8", stdio: "pipe" });
    run();
    const before = JSON.parse(fs.readFileSync(path.join(tmp, "assets", "data", "bank-index.json"), "utf8"));
    assert.deepStrictEqual(Object.keys(before.available), [donorId], "only the one shipped bank is available");

    // Use a pending entry if the package still has one; otherwise (after
    // the owner has added everything) any other listed entry.
    const targetId = pendingId || ids.find((id) => id !== donorId);
    const target = manifestEntry(targetId);
    assert.ok(!Object.prototype.hasOwnProperty.call(before.available, targetId));

    // The "owner adds a file" step — written ONLY inside the temp dir.
    const fixtureBank = { schemaVersion: "1.0", type: "mcq", id: "fixture", category: "Fixture", title: "Fixture", description: "Temporary test fixture", questionCount: 3,
      questions: [1, 2, 3].map((n) => ({ id: "fx-q" + n, question: "Fixture " + n + "?", options: [{ label: "A", text: "a" }, { label: "B", text: "b" }], answer: "A" })) };
    fs.mkdirSync(path.dirname(path.join(tmp, target.path)), { recursive: true });
    fs.writeFileSync(path.join(tmp, target.path), JSON.stringify(fixtureBank));

    // Stale index is detected…
    let staleDetected = false;
    try { run(["--check"]); } catch (e) { staleDetected = e.status === 1; }
    assert.ok(staleDetected, "--check must fail while the index is older than the content");

    // …and ONE command brings the new bank in.
    run();
    const after = JSON.parse(fs.readFileSync(path.join(tmp, "assets", "data", "bank-index.json"), "utf8"));
    assert.strictEqual(after.available[targetId], 3, "the new bank is available with its verified count");
    assert.strictEqual(after.summary.availableBanks, 2);
    run(["--check"]);

    // The generic UI model now offers it with a working canonical link.
    const cat = CatalogModel.buildCatalog(realManifest, after, manifestUtil);
    assert.strictEqual(cat.byId[targetId].available, true);
    assert.strictEqual(CatalogModel.practiceHref(targetId), "practice/index.html?quiz=" + encodeURIComponent(targetId));

    // The builder wrote exactly one file and left the manifest alone.
    assert.strictEqual(sha256Hex(fs.readFileSync(path.join(tmp, "master-manifest.json"))), sha256Hex(realManifestBytes));
    const written = Object.keys(hashTree(tmp)).map((p) => p.replace(/\\/g, "/")).sort();
    assert.deepStrictEqual(written, ["assets/data/bank-index.json", "master-manifest.json", donor.path, target.path].sort());
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
  assert.strictEqual(fs.readdirSync(path.join(projectRoot, "questions"), { recursive: true }).length, productionBefore, "production questions/ must be untouched");
});
test("a present-but-unusable bank file (invalid JSON / empty questions) is NOT offered as available", () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "dynanca-index-bad-"));
  try {
    const m = { schemaVersion: "1.0", manifestType: "dynanca-master", subjects: [{ id: "c", name: "C", practice_files: [
      { id: "broken", name: "Broken", file: "a.json", path: "questions/c/a.json", questionCount: 2 },
      { id: "empty", name: "Empty", file: "b.json", path: "questions/c/b.json", questionCount: 2 },
      { id: "unsafe", name: "Unsafe", file: "c.json", path: "../outside.json", questionCount: 2 },
      { id: "good", name: "Good", file: "d.json", path: "questions/c/d.json", questionCount: 9 },
    ] }] };
    fs.mkdirSync(path.join(tmp, "questions", "c"), { recursive: true });
    fs.writeFileSync(path.join(tmp, "master-manifest.json"), JSON.stringify(m));
    fs.writeFileSync(path.join(tmp, "questions", "c", "a.json"), "{ not json");
    fs.writeFileSync(path.join(tmp, "questions", "c", "b.json"), JSON.stringify({ questions: [] }));
    fs.writeFileSync(path.join(tmp, "questions", "c", "d.json"), JSON.stringify({ questions: [{ id: "1", question: "?" }] }));
    const { index, report } = computeBankIndex(tmp);
    assert.deepStrictEqual(index.available, { good: 1 });
    assert.strictEqual(report.unusableFiles.length, 3);
    assert.deepStrictEqual(report.countDifferences.map((d) => d.id), ["good"]);
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});
test("the builder refuses to write over the manifest, CSV, XLSX, schemas, bank files or vendor code", () => {
  ["master-manifest.json", "master-manifest.csv", "math-mcq-manifest.xlsx", "questions/quiz/quiz - 01.json", "schemas/x.json", "assets/vendor/mathjax/x.json", "../outside.json", "assets/data/index.txt"].forEach((rel) => {
    assert.throws(() => assertIndexTarget(projectRoot, path.resolve(projectRoot, rel)), /Refusing|must end in \.json/, rel);
  });
  assert.doesNotThrow(() => assertIndexTarget(projectRoot, path.resolve(projectRoot, "assets/data/bank-index.json")));
  let code = 0;
  try {
    execFileSync(process.execPath, [bankIndexCli, "--out", "master-manifest.json"], { cwd: projectRoot, encoding: "utf8", stdio: "pipe" });
  } catch (e) { code = e.status; }
  assert.strictEqual(code, 1);
  assert.strictEqual(sha256Hex(fs.readFileSync(realManifestPath)), protectedBaseline.files["master-manifest.json"]);
});

// ---------------------------------------------------------------------
section("21. Standalone theme module (assets/js/theme.js)");
// ---------------------------------------------------------------------
function loadTheme(options) {
  options = options || {};
  const attrs = {};
  const classes = new Set();
  const listeners = { doc: {}, win: {}, media: [] };
  const buttons = ["light", "dark", "system"].map((mode) => {
    const a = { "data-theme-option": mode, "aria-pressed": "false" };
    return { getAttribute: (k) => a[k], setAttribute: (k, v) => { a[k] = v; }, attrs: a };
  });
  const store = Object.assign({}, options.stored);
  const media = {
    matches: !!options.systemDark,
    addEventListener: (type, fn) => listeners.media.push(fn),
  };
  const win = {
    document: {
      readyState: "complete",
      documentElement: {
        setAttribute: (k, v) => { attrs[k] = v; },
        getAttribute: (k) => attrs[k],
        classList: { add: (c) => classes.add(c) },
      },
      querySelectorAll: () => buttons,
      addEventListener: (type, fn) => { listeners.doc[type] = fn; },
    },
    matchMedia: options.noMatchMedia ? undefined : () => media,
    addEventListener: (type, fn) => { listeners.win[type] = fn; },
  };
  Object.defineProperty(win, "localStorage", {
    get() {
      if (options.storageThrows) throw new Error("SecurityError: storage is blocked");
      return {
        getItem: (k) => (Object.prototype.hasOwnProperty.call(store, k) ? store[k] : null),
        setItem: (k, v) => {
          if (options.setThrows) throw new Error("QuotaExceededError");
          store[k] = String(v);
        },
      };
    },
  });
  const src = fs.readFileSync(path.join(projectRoot, "assets", "js", "theme.js"), "utf8");
  new Function("window", src)(win);
  const click = (mode) => listeners.doc.click({ target: { closest: () => buttons.find((b) => b.attrs["data-theme-option"] === mode) } });
  const pressed = () => buttons.filter((b) => b.attrs["aria-pressed"] === "true").map((b) => b.attrs["data-theme-option"]);
  return { win, attrs, classes, store, media, listeners, click, pressed };
}
test("theme runs with no PracticeEngine / PracticeState / MathJax present and defaults to the system setting", () => {
  const light = loadTheme({ systemDark: false });
  assert.strictEqual(light.attrs["data-theme"], "light");
  assert.deepStrictEqual(light.pressed(), ["system"]);
  const dark = loadTheme({ systemDark: true });
  assert.strictEqual(dark.attrs["data-theme"], "dark");
  assert.ok(dark.classes.has("js"));
});
test("theme uses the existing key dynanca-mfc-theme-mode, so the choice carries between landing and practice", () => {
  const t = loadTheme({ stored: { "dynanca-mfc-theme-mode": "dark" }, systemDark: false });
  assert.strictEqual(t.win.DynancaTheme.KEY, "dynanca-mfc-theme-mode");
  assert.strictEqual(t.attrs["data-theme"], "dark");
  assert.deepStrictEqual(t.pressed(), ["dark"]);
  t.click("light");
  assert.strictEqual(t.store["dynanca-mfc-theme-mode"], "light");
  assert.strictEqual(t.attrs["data-theme"], "light");
  assert.deepStrictEqual(t.pressed(), ["light"]);
  assert.deepStrictEqual(Object.keys(t.store), ["dynanca-mfc-theme-mode"], "the theme module writes only its own key");
});
test("in system mode a live OS theme change is followed; an explicit choice is not overridden by it", () => {
  const t = loadTheme({ systemDark: false });
  t.media.matches = true;
  t.listeners.media.forEach((fn) => fn());
  assert.strictEqual(t.attrs["data-theme"], "dark");
  t.click("light");
  t.media.matches = false;
  t.media.matches = true;
  t.listeners.media.forEach((fn) => fn());
  assert.strictEqual(t.attrs["data-theme"], "light");
});
test("storage that throws on access or on write never crashes the page; the click still applies for this page", () => {
  const blocked = loadTheme({ storageThrows: true, systemDark: true });
  assert.strictEqual(blocked.attrs["data-theme"], "dark");
  assert.doesNotThrow(() => blocked.click("light"));
  assert.strictEqual(blocked.attrs["data-theme"], "light");
  assert.deepStrictEqual(blocked.pressed(), ["light"]);
  const full = loadTheme({ setThrows: true });
  assert.doesNotThrow(() => full.click("dark"));
  assert.strictEqual(full.attrs["data-theme"], "dark");
});
test("a corrupt stored value and a browser without matchMedia both fall back safely", () => {
  assert.strictEqual(loadTheme({ stored: { "dynanca-mfc-theme-mode": "<script>" }, systemDark: true }).attrs["data-theme"], "dark");
  assert.strictEqual(loadTheme({ noMatchMedia: true }).attrs["data-theme"], "light");
});

// ---------------------------------------------------------------------
section("22. Page wiring, link integrity and storage safety");
// ---------------------------------------------------------------------
const practiceHtml = fs.readFileSync(path.join(projectRoot, "practice", "index.html"), "utf8");
const shellJs = fs.readFileSync(path.join(projectRoot, "assets", "js", "shell.js"), "utf8");
const dataLoaderJs = fs.readFileSync(path.join(projectRoot, "practice", "data-loader.js"), "utf8");

function localRefs(html) {
  const refs = [];
  const re = /\s(?:src|href)="([^"]+)"/g;
  let m;
  while ((m = re.exec(html)) !== null) {
    const ref = m[1];
    if (/^(?:[a-z][a-z0-9+.-]*:|\/\/|#)/i.test(ref)) continue; // absolute URL or in-page anchor
    refs.push(ref);
  }
  return refs;
}
test("every local file referenced by index.html, 404.html and practice/index.html exists (exact case and spaces)", () => {
  [["index.html", "."], ["404.html", "."], ["practice/index.html", "practice"]].forEach(([rel, base]) => {
    const html = fs.readFileSync(path.join(projectRoot, rel), "utf8");
    localRefs(html).forEach((ref) => {
      const clean = ref.split("#")[0].split("?")[0];
      if (clean === "" || clean === "./" || clean === "../" || clean === "/") return; // directory index
      const target = clean.startsWith("/") ? path.join(projectRoot, clean) : path.join(projectRoot, base, clean);
      assert.ok(fs.existsSync(target), `${rel} references missing file: ${ref}`);
      // Case-exact check (static hosts are case-sensitive even if this disk is not).
      const dir = path.dirname(target);
      assert.ok(fs.readdirSync(dir).includes(path.basename(target)), `${rel}: wrong letter case in ${ref}`);
    });
  });
});
test("the landing page uses the official logo image with intrinsic dimensions and no lazy-loading", () => {
  const m = /<img[^>]*class="brand__logo"[^>]*>/.exec(landingHtml);
  assert.ok(m, "landing header should contain the logo image");
  assert.ok(/src="assets\/img\/logo-dynanca\.png"/.test(m[0]));
  assert.ok(/width="846"/.test(m[0]) && /height="168"/.test(m[0]), "intrinsic size must be declared (ratio 846:168)");
  assert.ok(!/loading="lazy"/.test(m[0]), "the first-viewport logo must not be lazy-loaded");
  assert.ok(/alt="[^"]*Dynanca[^"]*"/.test(m[0]));
});
test("the landing page loads the theme without loading the engine, state, question banks or MathJax", () => {
  assert.ok(/<script src="assets\/js\/theme\.js"><\/script>/.test(landingHtml));
  assert.ok(!/practice-engine|practice-state|venn-renderer|math-visuals|mathjax|shell\.js|data-loader/i.test(landingHtml));
  assert.ok(!/questions\//.test(catalogJs), "catalog.js must not fetch bank files");
  const fetched = catalogJs.match(/_URL = "([^"]+)"/g) || [];
  assert.deepStrictEqual(fetched.sort(), ['_URL = "assets/data/bank-index.json"', '_URL = "master-manifest.json"']);
});
test("the landing page keeps one h1, a skip link, landmarks, labelled controls and a no-JavaScript notice", () => {
  assert.strictEqual((landingHtml.match(/<h1[\s>]/g) || []).length, 1);
  assert.ok(/<a class="skip-link" href="#main">/.test(landingHtml) && /<main id="main"/.test(landingHtml));
  assert.ok(/<header[\s>]/.test(landingHtml) && /<nav[^>]*aria-label=/.test(landingHtml) && /<footer[\s>]/.test(landingHtml));
  assert.ok(/<label[^>]*for="q"/.test(landingHtml) && /<label[^>]*for="collection"/.test(landingHtml) && /<label[^>]*for="topic"/.test(landingHtml));
  assert.ok(/role="status"[^>]*aria-live="polite"/.test(landingHtml), "the result summary is the (only) live region");
  assert.ok(!/<ul[^>]*id="bankGrid"[^>]*aria-live/.test(landingHtml), "the card list itself must not be a live region");
  assert.ok(/<noscript>[\s\S]*JavaScript[\s\S]*<\/noscript>/.test(landingHtml));
  assert.ok(/lang="en"/.test(landingHtml));
});
test("landing copy makes no claim the product cannot keep (no timer, price, sign-in, ratings, AI, streaks, sync promise)", () => {
  const text = landingHtml.replace(/<[^>]+>/g, " ").toLowerCase();
  ["timed", "timer", "$", "usd", "per year", "subscribe", "log in", "sign in", "testimonial", "rated", "certif", "ai-powered", "streak", "recommended for you"].forEach((word) => {
    assert.ok(text.indexOf(word) === -1, `landing copy contains "${word}"`);
  });
  assert.ok(/nothing is synced to other devices/.test(text), "the page must state that progress is local");
});
test("practice page: theme module is loaded in <head> and shell boot no longer gates the theme on the engine", () => {
  assert.ok(/<script src="\.\.\/assets\/js\/theme\.js"><\/script>[\s\S]*<\/head>/.test(practiceHtml));
  assert.ok(!/localStorage\s*\.\s*(getItem|setItem|removeItem)/.test(shellJs), "shell.js no longer owns theme storage");
  const bootShell = /function bootShell\(\) \{[\s\S]*?\n  \}/.exec(shellJs);
  assert.ok(bootShell && /initTheme\(\)/.test(bootShell[0]) && !/PracticeEngine|PracticeState/.test(bootShell[0]));
  const whenReady = /function bootWhenReady\(\) \{[\s\S]*?\n  \}/.exec(shellJs);
  assert.ok(whenReady && whenReady[0].indexOf("bootShell()") < whenReady[0].indexOf("DynancaPracticeReady"), "the shell must start before waiting for data");
});
test("practice page: MathJax configuration and the bundled local script tag are untouched", () => {
  assert.ok(practiceHtml.indexOf("inlineMath: [['\\\\(', '\\\\)']]") !== -1);
  assert.ok(practiceHtml.indexOf("displayMath: [['\\\\[', '\\\\]'], ['$$', '$$']]") !== -1);
  assert.ok(practiceHtml.indexOf("window.__dynancaMathQueue") !== -1, "typeset queue/flush must remain");
  assert.ok(/<script id="MathJax-script" async src="\.\.\/assets\/vendor\/mathjax\/tex-chtml-full\.js"><\/script>/.test(practiceHtml));
  assert.ok(!/https?:\/\//.test(practiceHtml.replace(/<!--[\s\S]*?-->/g, "")), "no CDN or external URL");
});
test("practice loader still resolves the exact manifest id with the shared traversal and the safe-path rule", () => {
  assert.ok(/params\.get\("quiz"\)/.test(dataLoaderJs));
  assert.ok(/DynancaManifest\.findPracticeFile\(manifest\.subjects, quizId\)/.test(dataLoaderJs));
  assert.ok(/DynancaManifest\.isSafeRelativePath\(entry\.path\)/.test(dataLoaderJs));
  assert.ok(/window\.PRACTICES = data\.questions;/.test(dataLoaderJs));
  assert.ok(!/slug|toLowerCase\(\)|replace\(\/\[\^a-z/.test(dataLoaderJs), "the id must never be normalised");
  assert.ok(!/innerHTML/.test(dataLoaderJs), "status text is written as text, not HTML");
});
test("no hand-written script calls localStorage.clear(), and landing scripts never write practice storage", () => {
  jsFiles
    .filter((f) => !f.includes(path.join("tools", "tests")) && !f.includes(path.join("tests", "browser")))
    .forEach((f) => {
      const src = fs.readFileSync(f, "utf8").replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");
      assert.ok(!/localStorage\s*\.\s*clear\s*\(/.test(src), path.relative(projectRoot, f) + " calls localStorage.clear()");
    });
  [catalogJs, catalogModelJs].forEach((src) => {
    assert.ok(!/localStorage\s*\.\s*(setItem|removeItem|clear)/.test(src));
    assert.ok(!/storage\.(setItem|removeItem|clear)\(/.test(src));
  });
  assert.ok(/sessionStorage\.setItem/.test(catalogJs), "catalog state uses sessionStorage only");
  assert.ok(/"dynanca-catalog-return-v1"/.test(catalogJs) && /"dynanca-catalog-scroll-v1"/.test(catalogJs), "catalog keys live in their own namespace");
});
test("practice storage keys and reset semantics are exactly as before", () => {
  const stateSrc = fs.readFileSync(path.join(projectRoot, "practice", "practice-state.js"), "utf8");
  assert.ok(stateSrc.indexOf('"dynanca-mcq-" + PRACTICE_SCOPE + "-v2"') !== -1);
  assert.ok(stateSrc.indexOf('"dynanca-mcq-session-" + PRACTICE_SCOPE + "-v2"') !== -1);
  assert.ok(stateSrc.indexOf('"gp-practice-v1"') !== -1);
  const resetBytes = fs.readFileSync(path.join(projectRoot, "assets", "js", "reset-progress.js"));
  assert.strictEqual(sha256Hex(resetBytes), protectedBaseline.files["assets/js/reset-progress.js"], "reset-progress.js must be unchanged");
  const resetSrc = resetBytes.toString("utf8");
  assert.ok(resetSrc.indexOf('"dynanca-mcq-" + PRACTICE_SCOPE + "-v2"') !== -1 && resetSrc.indexOf('["gp-practice-v1"]') !== -1);
});
test("CI and npm scripts contain no step that regenerates or rewrites the manifest", () => {
  const ci = fs.readFileSync(path.join(projectRoot, ".github", "workflows", "ci.yml"), "utf8");
  assert.ok(!/generate-manifest/.test(ci), "CI must not run the legacy generator");
  assert.ok(!/git diff --exit-code -- master-manifest\.json/.test(ci));
  const pkg = JSON.parse(fs.readFileSync(path.join(projectRoot, "package.json"), "utf8"));
  Object.keys(pkg.scripts).forEach((name) => {
    assert.ok(!/generate-manifest/.test(pkg.scripts[name]), `npm script "${name}" must not run the legacy generator`);
  });
  ["build:index", "verify:index", "verify:protected", "verify:mathjax", "verify:csp", "validate", "test", "test:browser"].forEach((name) => {
    assert.ok(pkg.scripts[name], `npm script "${name}" should exist`);
  });
});

// ---------------------------------------------------------------------
section("23. Protected content matches the reviewed SHA-256 baseline");
// ---------------------------------------------------------------------
test("node tools/integrity/verify-protected.js passes (manifest, banks, schemas, traversal, engine, state, renderers, practices.css, MathJax)", () => {
  const out = execFileSync(process.execPath, [path.join(projectRoot, "tools", "integrity", "verify-protected.js")], { cwd: projectRoot, encoding: "utf8", stdio: "pipe" });
  assert.ok(/Protected content check PASS/.test(out), out);
});
test("the baseline covers every protected class named in the contract", () => {
  const files = Object.keys(protectedBaseline.files);
  ["master-manifest.json", "assets/js/manifest.js", "practice/practice-engine.js", "practice/practice-state.js", "practice/venn-renderer.js", "practice/math-visuals.js", "practice/practices.css"].forEach((rel) => {
    assert.ok(files.includes(rel), rel + " must be in the baseline");
  });
  assert.strictEqual(files.filter((f) => f.startsWith("assets/vendor/mathjax/")).length, 106);
  assert.ok(files.filter((f) => f.startsWith("schemas/")).length >= 2);
  assert.ok(files.filter((f) => f.startsWith("questions/")).length > 0);
  // Every shipped bank file must be protected — none may sit outside the baseline.
  const shipped = fs.readdirSync(path.join(projectRoot, "questions"), { recursive: true })
    .map((rel) => "questions/" + String(rel).replace(/\\/g, "/"))
    .filter((rel) => rel.toLowerCase().endsWith(".json"));
  const unprotected = shipped.filter((rel) => !files.includes(rel));
  assert.deepStrictEqual(unprotected, [], "run `node tools/integrity/verify-protected.js --add-new` for new bank files");
});

// ---------------------------------------------------------------------
section("24. ML release integration and reviewed hint regressions");
// ---------------------------------------------------------------------
test("ML resolves through its unchanged manifest id/path, with valid titles and its current question count", () => {
  const entry = manifestEntry("ml");
  const bank = bankByManifestId("ml");
  assert.strictEqual(entry.path, "questions/computer science/ml.json");
  assert.ok(typeof entry.name === "string" && entry.name.trim());
  assert.ok(typeof bank.title === "string" && bank.title.trim());
  assert.strictEqual(bank.id, "ml");
  assert.strictEqual(entry.questionCount, bank.questions.length);
  assert.ok(bank.questions.length > 0);
});
test("ML is available, searchable by id/title, and produces the exact deep link", () => {
  const index = JSON.parse(fs.readFileSync(realIndexPath, "utf8"));
  const catalog = CatalogModel.buildCatalog(realManifest, index, manifestUtil);
  const entry = catalog.entries.find((e) => e.id === "ml");
  assert.ok(entry && entry.available);
  assert.strictEqual(entry.verifiedCount, bankByManifestId("ml").questions.length);
  assert.strictEqual(CatalogModel.practiceHref(entry.id), "practice/index.html?quiz=ml");
  for (const q of ["ml", manifestEntry("ml").name]) {
    const state = CatalogModel.normalizeState({ q, collection: "computer science" }, catalog);
    assert.ok(CatalogModel.filterEntries(catalog, state).items.some((e) => e.id === "ml"), q);
  }
});
test("every existing bank remains indexed with its actual count; only the declared pending range is absent", () => {
  const index = JSON.parse(fs.readFileSync(realIndexPath, "utf8"));
  const pending = [];
  let total = 0;
  manifestUtil.eachPracticeFile(realManifest.subjects, (e) => {
    if (!fs.existsSync(path.join(projectRoot, e.path))) { pending.push(e.id); return; }
    const count = bankByManifestId(e.id).questions.length;
    assert.strictEqual(index.available[e.id], count, e.id);
    total += count;
  });
  assert.strictEqual(total, index.summary.verifiedQuestions);
  // Owner may add the pending banks later; the test must then keep passing.
  assert.deepStrictEqual(pending, [], "Production curriculum must be complete");
});
test("ML is protected and baseline history preserves the independently verified old manifest hash", () => {
  const rel = "questions/computer science/ml.json";
  assert.strictEqual(protectedBaseline.files[rel], sha256Hex(fs.readFileSync(path.join(projectRoot, rel))));
  const evidence = JSON.parse(fs.readFileSync(path.join(projectRoot, "audit", "MANIFEST_REVIEW.json")));
  assert.strictEqual(evidence.exact_match, true);
  assert.strictEqual(evidence.reconstructed_sha256, evidence.recorded_sha256);
  assert.ok(protectedBaseline.history.some((h) => h.manifestReview));
});
test("reviewed hints are preserved, and the four reported hints no longer supply the answer", () => {
  const edits = JSON.parse(fs.readFileSync(path.join(projectRoot, "audit", "CONTENT_CHANGES.json")));
  const required = ["questions-mathematics-statistics-statistics-q300", "questions-mathematics-statistics-statistics-q333", "math-gaokao-37-q007", "math-gaokao-134-q006"];
  for (const id of required) assert.ok(edits.some((e) => e.id === id), id);
  const normalize = (s) => s.toLowerCase().replace(/[^a-z0-9]/g, "");
  for (const e of edits) {
    const bank = JSON.parse(fs.readFileSync(path.join(projectRoot, e.path)));
    const q = bank.questions.find((q) => q.id === e.id);
    assert.strictEqual(q.hint, e.after, e.id);
    assert.notStrictEqual(q.hint, e.before, e.id);
    if (required.includes(e.id)) {
      const correct = q.options.find((o) => o.label === q.answer).text;
      assert.ok(!normalize(q.hint).includes(normalize(correct)), e.id + " leaks answer");
    }
  }
});

test("Venn set names cannot break out of the accessible-label attribute", () => {
  const vm = require("vm");
  const context = { window: {} };
  vm.runInNewContext(fs.readFileSync(path.join(projectRoot, "practice", "venn-renderer.js"), "utf8"), context);
  const name = '\"><img src=x onerror=alert(1)>';
  for (const sets of [["A", "B"], ["A", "B", "C"]]) {
    const html = context.window.DynancaVenn.render({ type: "venn", sets, setNames: [name, "B", "C"], regions: {} }, "security-probe");
    assert.ok(!html.includes("<img"));
    assert.ok(html.includes("&quot;&gt;&lt;img"));
  }
});

test("bar-chart zero axes and bars stay inside the plot for positive, mixed, negative and zero values", () => {
  const vm = require("vm");
  const context = { window: {} };
  vm.runInNewContext(fs.readFileSync(path.join(projectRoot, "practice", "math-visuals.js"), "utf8"), context);
  for (const values of [[10, 20], [10, -10], [-10, -20], [0, 0]]) {
    const html = context.window.DynancaMathVisuals.render({ type: "bar-chart", data: values.map((v, i) => [String(i), v]) }, "bar-probe");
    const axis = Number(/<line[^>]+y1="([^"]+)"/.exec(html)[1]);
    const bars = [...html.matchAll(/<rect[^>]+y="([^"]+)"[^>]+height="([^"]+)"/g)].map((m) => ({ y: +m[1], h: +m[2] }));
    assert.strictEqual(bars.length, values.length);
    bars.forEach((bar, i) => {
      assert.ok(bar.y >= 67 && bar.y + bar.h <= 242);
      assert.ok(Math.abs((values[i] >= 0 ? bar.y + bar.h : bar.y) - axis) < 1e-9);
    });
    if (values[0] === 10 && values[1] === 20) assert.strictEqual(axis, 242, "positive-only charts retain their original baseline");
  }
});

console.log(`\n${pass} passed, ${fail} failed.`);
process.exit(fail ? 1 : 0);
