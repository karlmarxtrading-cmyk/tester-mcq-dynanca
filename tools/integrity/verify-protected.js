#!/usr/bin/env node
/* ==========================================================================
   Dynanca — protected-content integrity check (READ-ONLY by default)
   -------------------------------------------------------------------------
   The manifest, every shipped question bank, schemas, traversal, practice
   engine / state / renderers / stylesheet and MathJax are protected. Builds
   must preserve their reviewed bytes. Authorized, verified fixes require
   old/new hashes, reasons and a traceable diff in baseline history.

   tools/integrity/protected-baseline.json records the SHA-256 of each of
   those files, rooted in the original archive and reviewed history. This script
   recomputes the hashes and fails on ANY difference or missing file.

   Usage:
     node tools/integrity/verify-protected.js   # read-only verification
     npm run curriculum:review
     npm run curriculum:approve -- --proposal HASH --reason OWNER_DECISION

   The legacy --add-new route is disabled. New files, manifest edits and
   revisions must follow the explicit hash-bound review/approval workflow.
   ========================================================================== */
"use strict";

const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const projectRoot = path.resolve(__dirname, "..", "..");
const baselinePath = path.join(__dirname, "protected-baseline.json");

function sha256(file) {
  return crypto.createHash("sha256").update(fs.readFileSync(file)).digest("hex");
}

function walk(dir) {
  let out = [];
  if (!fs.existsSync(dir)) return out;
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) out = out.concat(walk(full));
    else out.push(path.relative(projectRoot, full).replace(/\\/g, "/"));
  }
  return out;
}

function main() {
  const addNew = process.argv.includes("--add-new");
  if (addNew) { console.error("Use npm run curriculum:review, then curriculum:approve with the reviewed proposal hash and reason. --add-new no longer bypasses review."); process.exitCode=1; return; }
  if (!fs.existsSync(baselinePath)) {
    console.error("Protected baseline not found: " + path.relative(projectRoot, baselinePath));
    process.exit(1);
  }
  const baseline = JSON.parse(fs.readFileSync(baselinePath, "utf8"));
  const files = baseline.files || {};
  const changed = [];
  const missing = [];
  const groups = {};

  Object.keys(files).forEach((rel) => {
    const group = rel.startsWith("questions/") ? "questions/**"
      : rel.startsWith("assets/vendor/mathjax/") ? "assets/vendor/mathjax/**"
      : rel.startsWith("schemas/") ? "schemas/**"
      : rel;
    groups[group] = groups[group] || { total: 0, identical: 0 };
    groups[group].total += 1;
    const full = path.join(projectRoot, rel);
    if (!fs.existsSync(full)) { missing.push(rel); return; }
    if (sha256(full) !== files[rel]) { changed.push(rel); return; }
    groups[group].identical += 1;
  });

  const newBankFiles = walk(path.join(projectRoot, "questions"))
    .filter((rel) => rel.toLowerCase().endsWith(".json") && !(rel in files))
    .sort();

  Object.keys(groups).forEach((g) => {
    console.log(`  ${groups[g].identical}/${groups[g].total} identical  ${g}`);
  });

  if (changed.length || missing.length) {
    changed.forEach((rel) => console.error("  CHANGED: " + rel));
    missing.forEach((rel) => console.error("  MISSING: " + rel));
    console.error(
      `\nProtected content check FAILED — ${changed.length} changed, ${missing.length} missing ` +
        `(of ${Object.keys(files).length} baseline files). Review the diff against the approved baseline and its history.`
    );
    process.exitCode = 1; // not process.exit(): let a long list flush completely
    return;
  }

  if (newBankFiles.length && addNew) {
    newBankFiles.forEach((rel) => { files[rel] = sha256(path.join(projectRoot, rel)); });
    const ordered = {};
    Object.keys(files).sort().forEach((rel) => { ordered[rel] = files[rel]; });
    baseline.files = ordered;
    fs.writeFileSync(baselinePath, JSON.stringify(baseline, null, 2) + "\n", "utf8");
    console.log(`Recorded ${newBankFiles.length} new bank file(s) in the baseline. Existing entries were not changed.`);
  } else if (newBankFiles.length) {
    console.log(
      `  ${newBankFiles.length} bank file(s) under questions/ are newer than the baseline (first: ${newBankFiles[0]}). ` +
        "They are not compared; run npm run curriculum:review, then approve the reviewed proposal to put them under protection."
    );
    console.error("Protected content check FAILED — review and approve the incoming bank files with curriculum:review / curriculum:approve before release.");
    process.exitCode = 1;
    return;
  }

  console.log(`\nProtected content check PASS — ${Object.keys(files).length} baseline file(s) byte-for-byte identical.`);
}

main();
