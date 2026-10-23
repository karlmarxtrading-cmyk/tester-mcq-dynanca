#!/usr/bin/env node
/* ==========================================================================
   Dynanca — whole-ecosystem validator (READ-ONLY)
   -------------------------------------------------------------------------
   Source of truth: master-manifest.json, as committed. It is the owner's
   FINAL contract — this validator never regenerates it, never compares it
   with master-manifest.csv, and never writes any file.

   (History: this tool used to rebuild the manifest in memory from
   master-manifest.csv and fail when the two differed. The CSV is a legacy
   130-row export that no longer describes the 2,527-entry catalog, so that
   comparison could only ever push someone to overwrite the final JSON.
   It was removed; manifest integrity is now guarded by the byte-level
   check in tools/integrity/verify-protected.js instead.)

   What is validated:

     master-manifest.json
        -> schema shape, hierarchy, unique subject/topic/practice ids,
           unique paths, safe paths
     every referenced question-bank JSON THAT IS PRESENT
        -> parses, satisfies schemas/question-bank.schema.json,
           questionCount matches questions.length and the manifest's
           questionCount, question ids present + unique, question text
           present, answer (if any) references a real option, Venn
           invariants, no double-escaped newline/tab text
     referenced bank files that are NOT present ("pending content")
        -> counted and listed, never invented and never hidden
     questions/ directory
        -> orphan-file report (files that exist but aren't catalogued) —
           WARNING only; orphans are never auto-added.

   Known, owner-accepted metadata differences live in
   tools/ecosystem-validator/accepted-exceptions.json. An accepted
   difference is reported as ACCEPTED (not as an error) only while the
   data still matches the recorded values exactly; if either side drifts,
   it becomes an error again.

   Usage:
     node tools/ecosystem-validator/validate-ecosystem.js
         Full content validation. Exit 0 only when every listed bank is
         present and valid. Pending bank files make it exit 1.
     node tools/ecosystem-validator/validate-ecosystem.js --allow-pending
         UI-release scope. Pending bank files are reported but do not fail
         the run; anything else wrong still does. The final line then
         reads "PASS WITH PENDING CONTENT", never plain "PASS".

   Exit code 0 = no errors for the selected scope. Warnings never fail.
   ========================================================================== */
"use strict";
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const { isSafeRelativePath } = require(path.resolve(__dirname, "..", "..", "assets", "js", "manifest.js"));
const { validateVennQuestion } = require("../lib/venn-validate.js");

// Project root is normally derived from this script's own location. The
// automated test suite overrides it via DYNANCA_TEST_PROJECT_ROOT to run
// this exact validator against isolated fixture directories (e.g. to prove
// it actually fails a bank missing a required schema field) without ever
// touching the real project's files — production usage never sets this.
const projectRoot = process.env.DYNANCA_TEST_PROJECT_ROOT
  ? path.resolve(process.env.DYNANCA_TEST_PROJECT_ROOT)
  : path.resolve(__dirname, "..", "..");
const allowPending = process.argv.includes("--allow-pending");
const jsonPath = path.join(projectRoot, "master-manifest.json");
const questionsDir = path.join(projectRoot, "questions");
const bankSchemaPath = path.join(projectRoot, "schemas", "question-bank.schema.json");

const acceptedExceptionsPath = path.join(projectRoot, "tools", "ecosystem-validator", "accepted-exceptions.json");

const errors = [];
const warnings = [];
const pending = [];   // listed bank files that are not present in this build
const accepted = [];  // owner-accepted differences that still match exactly
function err(msg) { errors.push(msg); }
function warn(msg) { warnings.push(msg); }

// ---- owner-accepted metadata differences ----------------------------------
// Loaded from the project being validated (so isolated test fixtures have
// none). Every entry must still match reality exactly to be honoured.
let acceptedCountMismatches = [];
if (fs.existsSync(acceptedExceptionsPath)) {
  try {
    const parsed = JSON.parse(fs.readFileSync(acceptedExceptionsPath, "utf8"));
    acceptedCountMismatches = Array.isArray(parsed.questionCountMismatch) ? parsed.questionCountMismatch : [];
  } catch (e) {
    err(`tools/ecosystem-validator/accepted-exceptions.json is not valid JSON: ${e.message}`);
  }
}
const acceptedSeen = new Set();

/** "dynanca-151 … dynanca-160" style ranges so 1,761 ids stay readable. */
function compactIds(ids) {
  const out = [];
  let run = null;
  const flush = () => {
    if (!run) return;
    out.push(run.count > 2 ? `${run.first} … ${run.last} (${run.count})` : run.count === 2 ? `${run.first}, ${run.last}` : run.first);
    run = null;
  };
  ids.forEach((id) => {
    const m = /^(.*?)(\d+)$/.exec(id);
    if (m && run && run.prefix === m[1] && Number(m[2]) === run.n + 1) {
      run.n += 1; run.last = id; run.count += 1;
      return;
    }
    flush();
    run = m ? { prefix: m[1], n: Number(m[2]), first: id, last: id, count: 1 } : null;
    if (!m) out.push(id);
  });
  flush();
  return out;
}

// ---- question-bank.schema.json enforcement --------------------------------
// Read directly from the schema file (rather than hardcoding its values a
// second time here) so the validator can never silently drift out of sync
// with the documented contract in schemas/question-bank.schema.json.
let bankSchema = null;
try {
  bankSchema = JSON.parse(fs.readFileSync(bankSchemaPath, "utf8"));
} catch (e) {
  err(`schemas/question-bank.schema.json not found or invalid: ${e.message}`);
}

function checkBankSchema(bank, p) {
  if (!bankSchema) return;
  (bankSchema.required || []).forEach((field) => {
    if (!(field in bank)) err(`"${p.path}": missing required top-level field "${field}" (schemas/question-bank.schema.json).`);
  });
  const props = bankSchema.properties || {};
  Object.keys(props).forEach((field) => {
    if (!(field in bank)) return;
    const spec = props[field];
    const value = bank[field];
    if (spec.const !== undefined && value !== spec.const) {
      err(`"${p.path}": "${field}" must be ${JSON.stringify(spec.const)} (got ${JSON.stringify(value)}).`);
    }
    if (spec.type === "string" && typeof value !== "string") {
      err(`"${p.path}": "${field}" must be a string (got ${typeof value}).`);
    }
    if (spec.type === "string" && typeof value === "string" && !value.trim() && field !== "id") {
      // `id` may legitimately be empty per README (bank id is independent
      // of the manifest id and not load-bearing at runtime) — every other
      // required string field (category/title/description) must be filled.
      err(`"${p.path}": "${field}" is present but empty.`);
    }
    if (spec.type === "integer" && (typeof value !== "number" || !Number.isInteger(value))) {
      err(`"${p.path}": "${field}" must be an integer (got ${JSON.stringify(value)}).`);
    }
    if (typeof spec.minimum === "number" && typeof value === "number" && value < spec.minimum) {
      err(`"${p.path}": "${field}" must be >= ${spec.minimum} (got ${value}).`);
    }
  });
}

// ---- cross-bank content audit (duplicates + bare LaTeX) — WARN only -------
// These are content-quality signals, not structural/schema errors: the
// project's data rules explicitly forbid silently deleting valid questions
// or fabricating replacement content to make a duplicate "go away" (see
// AUDIT_REPORT.md / the audit brief), so a genuine content duplicate must
// stay a visible warning that a human resolves — never a hard failure that
// would pressure an automated "fix" into deleting data.
const LATEX_COMMAND_NAMES = [
  "times", "div", "frac", "dfrac", "tfrac", "sqrt", "neq", "leq", "geq", "approx", "to", "pm", "mp",
  "cdot", "sum", "prod", "int", "infty", "alpha", "beta", "gamma", "delta", "theta", "lambda", "mu",
  "pi", "sigma", "phi", "omega", "leftarrow", "rightarrow", "Rightarrow", "Leftarrow", "leftrightarrow",
  "Leftrightarrow", "in", "notin", "subset", "subseteq", "cup", "cap", "emptyset", "forall", "exists",
  "binom", "log", "ln", "lim", "partial", "vec", "hat", "bar", "overline", "underline", "left", "right",
  "text", "mathbf", "mathrm", "mathit", "ldots", "cdots", "vdots", "ddots", "circ", "propto", "equiv",
  "ne", "le", "ge", "angle", "perp", "parallel", "sin", "cos", "tan", "cot", "sec", "csc"
];
const HAS_LATEX_COMMAND_RE = new RegExp("\\\\(?:" + LATEX_COMMAND_NAMES.join("|") + ")\\b");
const DELIM_RE = /\\\((?:[^\\]|\\(?!\)))*\\\)|\\\[(?:[^\\]|\\(?!\]))*\\\]|\$\$[\s\S]*?\$\$/g;
const LITERAL_ESCAPE_RE = /\\([nt])(?![A-Za-z])/;
function stripDelimitedMath(s) {
  return s.replace(/```[\s\S]*?```/g, "").replace(/`[^`]*`/g, "").replace(DELIM_RE, "");
}
function hasBareLatex(s) {
  return typeof s === "string" && HAS_LATEX_COMMAND_RE.test(stripDelimitedMath(s));
}
function hasLiteralEscape(s) {
  return typeof s === "string" && LITERAL_ESCAPE_RE.test(stripDelimitedMath(s));
}

const questionHashIndex = new Map(); // sha1(normalized question) -> [{path, id}]
const bankHashIndex = new Map(); // sha1(all normalized questions) -> [path]
const bankIdIndex = new Map(); // bank.id -> [path, ...]
let bareLatexFieldCount = 0;
let literalEscapeFieldCount = 0;
const bareLatexBanks = new Set();
const literalEscapeBanks = new Set();

function normQuestionForHash(q) {
  const norm = (v) => (typeof v === "string" ? v.trim().toLowerCase().replace(/\s+/g, " ") : v);
  const opts = Array.isArray(q.options) ? q.options : [];
  const normOpts = opts.map((o) => (o && typeof o === "object" ? [norm(o.label), norm(o.text)] : [null, norm(o)]));
  return JSON.stringify({ q: norm(q.question), opts: normOpts, a: norm(q.answer) });
}

function deepEqual(a, b) {
  if (a === b) return true;
  if (typeof a !== typeof b) return false;
  if (Array.isArray(a) || Array.isArray(b)) {
    if (!Array.isArray(a) || !Array.isArray(b) || a.length !== b.length) return false;
    return a.every((v, i) => deepEqual(v, b[i]));
  }
  if (a && b && typeof a === "object") {
    const ak = Object.keys(a).sort();
    const bk = Object.keys(b).sort();
    if (ak.length !== bk.length || ak.some((k, i) => k !== bk[i])) return false;
    return ak.every((k) => deepEqual(a[k], b[k]));
  }
  return false;
}

function main() {
  // ---- A: the committed manifest is the contract (read, never regenerated) ----
  let committed = null;
  if (!fs.existsSync(jsonPath)) {
    err(`master-manifest.json not found at ${path.relative(projectRoot, jsonPath)}.`);
  } else {
    try {
      committed = JSON.parse(fs.readFileSync(jsonPath, "utf8"));
    } catch (e) {
      err(`master-manifest.json does not parse: ${e.message}`);
    }
  }
  console.log("Source of truth: master-manifest.json (final contract; read-only, not compared with any CSV).");

  if (committed) {
    if (committed.schemaVersion !== "1.0") err(`master-manifest.json schemaVersion must be "1.0" (got ${JSON.stringify(committed.schemaVersion)}).`);
    if (committed.manifestType !== "dynanca-master") err(`master-manifest.json manifestType must be "dynanca-master" (got ${JSON.stringify(committed.manifestType)}).`);
    if (!Array.isArray(committed.subjects)) err(`master-manifest.json "subjects" must be an array.`);
  }

  // ---- C/D/E/F/G/H/I/J/K: walk the committed manifest ----
  const subjectIds = new Map();
  const practiceIds = new Map();
  const practicePaths = new Map();
  const referencedPaths = new Set();
  let subjectCount = 0, topicCount = 0, fileCount = 0, questionTotal = 0, presentCount = 0;

  function checkSiblingIds(nodes, label, seenMap) {
    (nodes || []).forEach((n) => {
      if (!n.id) { err(`${label} node is missing an "id".`); return; }
      if (!seenMap.has(n.id)) seenMap.set(n.id, 0);
      seenMap.set(n.id, seenMap.get(n.id) + 1);
    });
  }

  function checkSiblingIdsLocal(nodes, subjectName, depthLabel) {
    const local = new Map();
    checkSiblingIds(nodes, `${subjectName} ${depthLabel}`, local);
    for (const [id, n] of local) {
      if (n > 1) err(`Duplicate ${depthLabel} id "${id}" among siblings under "${subjectName}" (${n} occurrences).`);
    }
  }

  function walk(nodes, subjectName, depthLabel) {
    checkSiblingIdsLocal(nodes, subjectName, depthLabel);
    (nodes || []).forEach((node) => {
      if (depthLabel === "topic" || depthLabel === "subtopic") topicCount += 1;
      const hasChildren = (node.topics && node.topics.length) || (node.subtopics && node.subtopics.length);
      const hasFiles = node.practice_files && node.practice_files.length;
      if (!hasChildren && !hasFiles) warn(`${subjectName} -> "${node.name || node.id}" has neither practice_files nor topics/subtopics (empty node).`);

      (node.practice_files || []).forEach((p) => {
        fileCount += 1;
        if (!p.id) { err(`Practice file under "${node.name || node.id}" is missing an "id".`); return; }
        practiceIds.set(p.id, (practiceIds.get(p.id) || 0) + 1);
        if (p.path) {
          practicePaths.set(p.path, (practicePaths.get(p.path) || 0) + 1);
          referencedPaths.add(p.path);
        } else {
          err(`Practice file "${p.id}" is missing a "path".`);
        }
        if (!isSafeRelativePath(p.path)) {
          err(`Practice file "${p.id}" has an unsafe path "${p.path}" (must be a questions/-relative path with no traversal).`);
          return;
        }
        const resolved = path.resolve(projectRoot, p.path);
        if (!fs.existsSync(resolved)) {
          // Not an invented error and not hidden: listed, counted, and it
          // decides the exit code unless --allow-pending is given.
          pending.push({ id: p.id, path: p.path, listedQuestionCount: p.questionCount });
          return;
        }
        presentCount += 1;
        let bank;
        try {
          bank = JSON.parse(fs.readFileSync(resolved, "utf8"));
        } catch (e) {
          err(`"${p.path}" is not valid JSON: ${e.message}`);
          return;
        }
        checkBankSchema(bank, p);
        if (bank && typeof bank.id === "string" && bank.id.trim()) {
          if (!bankIdIndex.has(bank.id)) bankIdIndex.set(bank.id, []);
          bankIdIndex.get(bank.id).push(p.path);
        }
        if (!Array.isArray(bank.questions)) {
          err(`"${p.path}" has no "questions" array.`);
          return;
        }
        if (bank.questionCount !== bank.questions.length) {
          err(`"${p.path}": questionCount (${bank.questionCount}) does not match questions.length (${bank.questions.length}).`);
        }
        if (typeof p.questionCount === "number" && p.questionCount !== bank.questions.length) {
          const known = acceptedCountMismatches.find((x) => x && x.id === p.id);
          if (
            known &&
            known.path === p.path &&
            known.manifestQuestionCount === p.questionCount &&
            known.verifiedQuestionCount === bank.questions.length
          ) {
            acceptedSeen.add(p.id);
            accepted.push(
              `"${p.id}": manifest questionCount ${p.questionCount}, bank file "${p.path}" has ${bank.questions.length} questions ` +
                `— known/accepted metadata mismatch (${known.reason || "see accepted-exceptions.json"}). Neither file is changed.`
            );
          } else {
            err(`Manifest questionCount for "${p.id}" (${p.questionCount}) does not match actual question count in "${p.path}" (${bank.questions.length}).`);
          }
        }
        questionTotal += bank.questions.length;

        // Per-question checks, matching the project's actual documented
        // contract (README: "id and question are the only required
        // question fields") — not inventing stricter requirements.
        const qIds = new Set();
        const normalizedQuestions = [];
        bank.questions.forEach((q, qi) => {
          const where = `${p.path} question[${qi}]`;
          if (q == null || q.id == null || String(q.id).trim() === "") { err(`${where} is missing "id".`); return; }
          const qid = String(q.id);
          if (qIds.has(qid)) err(`${p.path}: duplicate question id "${qid}".`);
          qIds.add(qid);
          if (!q.question || !String(q.question).trim()) err(`${where} (id ${qid}) is missing "question" text.`);
          if (Array.isArray(q.options) && q.options.length) {
            if (typeof q.answer !== "string" || !q.answer.trim()) err(`${p.path} question ${qid}: MCQ answer is required.`);
            const labels = new Set();
            q.options.forEach((o, oi) => {
              if (!o || o.label == null || String(o.label).trim() === "") err(`${p.path} question ${qid} option[${oi}] is missing "label".`);
              else labels.add(o.label);
              if (o && (o.text == null || String(o.text).trim() === "")) err(`${p.path} question ${qid} option "${o.label}" is missing "text".`);
            });
            if (q.answer != null && String(q.answer).trim() !== "" && !labels.has(q.answer)) {
              err(`${p.path} question ${qid}: answer "${q.answer}" does not match any option label.`);
            }
          }

          // Content-quality signals (see comment block above): duplicate
          // detection, bare LaTeX, and double-escaped newline/tab text.
          const norm = normQuestionForHash(q);
          normalizedQuestions.push(norm);
          const h = crypto.createHash("sha1").update(norm).digest("hex");
          if (!questionHashIndex.has(h)) questionHashIndex.set(h, []);
          questionHashIndex.get(h).push({ path: p.path, id: qid });

          const textFields = [q.question, q.hint, q.explanation, q.code].filter((v) => typeof v === "string");
          if (Array.isArray(q.options)) {
            q.options.forEach((o) => { if (o && typeof o.text === "string") textFields.push(o.text); });
          }
          let bareHit = false, escHit = false;
          textFields.forEach((t) => {
            if (hasBareLatex(t)) bareHit = true;
            if (hasLiteralEscape(t)) { escHit = true; literalEscapeFieldCount++; }
          });
          if (bareHit) bareLatexFieldCount++;
          if (bareHit) bareLatexBanks.add(p.path);
          if (escHit) {
            literalEscapeBanks.add(p.path);
            err(`${p.path} question ${qid}: field contains a double-escaped "\\n"/"\\t" (literal backslash-n/backslash-t text instead of a real newline/tab) — this is a data encoding bug, not intentional content.`);
          }

          // Generic Venn-diagram invariants (region non-negativity, region
          // presence, setNames shape/corruption, total conservation where
          // derivable). See tools/lib/venn-validate.js.
          if (q && q.visual && q.visual.type === "venn") {
            validateVennQuestion(q).forEach((problem) => {
              err(`${p.path} question ${qid}: VENN INVALID — ${problem}`);
            });
          }
        });

        const bankHash = crypto.createHash("sha1").update(normalizedQuestions.slice().sort().join("\n")).digest("hex");
        if (!bankHashIndex.has(bankHash)) bankHashIndex.set(bankHash, []);
        bankHashIndex.get(bankHash).push(p.path);
      });

      walk(node.topics, subjectName, "topic");
      walk(node.subtopics, subjectName, "subtopic");
    });
  }

  if (committed && Array.isArray(committed.subjects)) {
    subjectCount = committed.subjects.length;
    checkSiblingIds(committed.subjects, "subject", subjectIds);
    committed.subjects.forEach((s) => walk([s], s.name || s.id, "subject"));
  }

  for (const [id, n] of subjectIds) if (n > 1) err(`Duplicate subject id "${id}" (${n} occurrences).`);
  for (const [id, n] of practiceIds) if (n > 1) err(`Duplicate practice_files id "${id}" (${n} occurrences).`);
  for (const [p, n] of practicePaths) if (n > 1) err(`Duplicate practice_files path "${p}" (${n} occurrences).`);

  // ---- L: orphan-file audit (warning only, never auto-fixed) ----
  function walkDir(dir) {
    let out = [];
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, e.name);
      if (e.isDirectory()) out = out.concat(walkDir(full));
      else if (e.name.toLowerCase().endsWith(".json")) out.push(path.relative(projectRoot, full).replace(/\\/g, "/"));
    }
    return out;
  }
  if (fs.existsSync(questionsDir)) {
    const allJsonFiles = walkDir(questionsDir);
    allJsonFiles.forEach((f) => {
      if (!referencedPaths.has(f)) warn(`ORPHAN FILE: ${f} exists but is not catalogued in master-manifest.json.`);
    });
  }

  // ---- M: duplicate BANK content (identical question sets in two files) ----
  // Content-quality signal, deliberately a WARNING (see comment above
  // questionHashIndex): the project's data rules forbid silently deleting
  // one side of a duplicate bank or fabricating replacement content, so
  // this must stay a visible, actionable warning rather than a build
  // failure that would pressure someone into destructive "fixes".
  for (const [, files] of bankHashIndex) {
    if (files.length > 1) {
      warn(
        `DUPLICATE BANK CONTENT: ${files.join(" and ")} contain the exact same set of questions ` +
          `(same normalized question+options+answer for every question, in some order). This is almost ` +
          `certainly an accidental copy/paste rather than intentional — verify with the content owner ` +
          `and replace one side with authored content; do not delete or fabricate content automatically.`
      );
    }
  }

  // ---- N: duplicate QUESTION content across (or within) banks ----
  let crossBankDuplicateQuestions = 0;
  for (const [, hits] of questionHashIndex) {
    if (hits.length <= 1) continue;
    const distinctFiles = new Set(hits.map((h) => h.path));
    if (distinctFiles.size > 1) crossBankDuplicateQuestions += hits.length - 1;
  }
  if (crossBankDuplicateQuestions > 0) {
    warn(
      `${crossBankDuplicateQuestions} question(s) have identical content (same question+options+answer) ` +
        `in a DIFFERENT bank than their first occurrence. Some overlap is expected from pooled/generated ` +
        `content; large clusters (see the duplicate-bank warning above, if any) usually indicate copy/paste.`
    );
  }

  // ---- O: bare LaTeX / double-escaped whitespace summary ----
  // The renderer (practice/practice-engine.js formatText -> autoWrapBareLatex)
  // now auto-delimits bare LaTeX macros at render time, so this is
  // informational, not a failure — it exists so a REGRESSION in that
  // renderer fix (or a future rendering pipeline that doesn't have it)
  // would show up here instead of silently rendering broken math again.
  if (bareLatexBanks.size) {
    warn(
      `${bareLatexFieldCount} field(s) across ${bareLatexBanks.size} bank(s) contain LaTeX commands ` +
        `(\\times, \\frac, ...) with no \\( \\)/\\[ \\]/$$ $$ delimiters. This is handled at render time by ` +
        `practice/practice-engine.js's autoWrapBareLatex() — confirm that fix is still in place rather than ` +
        `hand-editing this content.`
    );
  }
  if (literalEscapeBanks.size) {
    // This one IS a hard error (added above, per-question) — the summary
    // line just makes the aggregate visible in the warning log too.
    warn(`${literalEscapeFieldCount} field(s) across ${literalEscapeBanks.size} bank(s) contained a double-escaped "\\n"/"\\t" (see ERRORs above).`);
  }

  // ---- P: bank-level internal `id` field — informational only ----
  // README documents that a question-bank JSON's own `id` field is
  // intentionally independent of the manifest id and not used at runtime
  // for routing/localStorage — so a duplicate or empty bank `id` is never
  // an error here, only a note in case that independence assumption ever
  // changes.
  const dupBankIds = [];
  for (const [id, paths] of bankIdIndex) {
    if (id && paths.length > 1) dupBankIds.push(`"${id}" (${paths.join(", ")})`);
  }
  if (dupBankIds.length) {
    warn(
      `${dupBankIds.length} internal bank "id" value(s) are reused across multiple question-bank files: ` +
        `${dupBankIds.join("; ")}. Per README this field is independent of the manifest id and not used at ` +
        `runtime, so this is informational only — not treated as an error.`
    );
  }

  // ---- Q: accepted exceptions must still describe reality ----
  // Both sides of an accepted difference are protected data. If the
  // recorded pair no longer matches (and the bank is present), something
  // protected was edited — that must surface, not be waved through.
  acceptedCountMismatches.forEach((x) => {
    if (!x || acceptedSeen.has(x.id)) return;
    if (pending.some((p) => p.id === x.id)) return; // file not shipped: nothing to compare yet
    if (!practiceIds.has(x.id)) {
      err(`accepted-exceptions.json lists "${x.id}", but master-manifest.json has no such practice_files id.`);
      return;
    }
    err(
      `accepted-exceptions.json expects "${x.id}" to differ (manifest ${x.manifestQuestionCount}, bank ${x.verifiedQuestionCount}), ` +
        `but the current files no longer show exactly that difference. Protected data changed — restore it or have the owner update the exception.`
    );
  });

  // ---- report ----
  // NOTE: the exit status is set with process.exitCode (not process.exit())
  // so that Node flushes stdout first. With a large report written to a
  // pipe, process.exit() can cut the output off before the final
  // PASS/FAIL line — which is exactly the line CI and the tests read.
  console.log(`Subjects: ${subjectCount}, topics/subtopics: ${topicCount}, practice files listed: ${fileCount}, present: ${presentCount}, pending: ${pending.length}.`);
  console.log(`Questions in the bank files that are present: ${questionTotal}.`);
  if (accepted.length) {
    console.log(`\n${accepted.length} accepted difference(s):`);
    accepted.forEach((a) => console.log("  ACCEPTED:", a));
  }
  if (warnings.length) {
    console.log(`\n${warnings.length} warning(s):`);
    warnings.forEach((w) => console.log("  WARN:", w));
  }
  if (pending.length) {
    console.log(`\n${pending.length} listed bank file(s) are not present in this build (pending content):`);
    compactIds(pending.map((p) => p.id)).forEach((line) => console.log("  PENDING:", line));
  }
  if (errors.length) {
    console.log(`\n${errors.length} error(s):`);
    errors.forEach((e) => console.log("  ERROR:", e));
  }

  if (errors.length) {
    console.log("\nFAIL" + (pending.length ? ` (${errors.length} error(s); ${pending.length} bank file(s) also pending)` : ""));
    process.exitCode = 1;
    return;
  }
  if (pending.length) {
    if (allowPending) {
      console.log(
        `\nPASS WITH PENDING CONTENT — everything that is present is valid; ${pending.length} listed bank file(s) are not in this build. ` +
          "Full content validation is NOT complete: run without --allow-pending after the files are added."
      );
      process.exitCode = 0;
    return;
    }
    console.log(
      `\nFAIL — content incomplete: ${pending.length} listed bank file(s) are not present. No other error. ` +
        "(Use --allow-pending to validate only what is shipped.)"
    );
    process.exitCode = 1;
    return;
  }
  console.log("\nPASS");
  process.exitCode = 0;
}

main();
