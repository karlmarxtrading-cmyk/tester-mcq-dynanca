#!/usr/bin/env node
/* ==========================================================================
   MathJax immutability verification
   -------------------------------------------------------------------------
   MathJax (assets/vendor/mathjax/**) is treated as READ-ONLY by every other
   tool and process in this project. This script does not change MathJax in
   any way — it only computes a SHA-256 checksum of every file under
   assets/vendor/mathjax and compares it against the committed baseline in
   tools/mathjax-integrity/mathjax-baseline.json.

   Usage:
     node tools/mathjax-integrity/verify-mathjax.js            # verify
     node tools/mathjax-integrity/verify-mathjax.js --write    # (re)write baseline

   `--write` is for the human maintainer to run deliberately if MathJax is
   ever intentionally upgraded out-of-band; it is never invoked by npm test,
   npm run validate, or CI, which only ever verify.
   ========================================================================== */
"use strict";

const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const projectRoot = path.resolve(__dirname, "..", "..");
const mathjaxDir = path.join(projectRoot, "assets", "vendor", "mathjax");
const baselinePath = path.join(__dirname, "mathjax-baseline.json");

function listFilesRecursive(dir) {
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...listFilesRecursive(full));
    else out.push(full);
  }
  return out;
}

function computeChecksums() {
  if (!fs.existsSync(mathjaxDir)) {
    throw new Error("assets/vendor/mathjax does not exist — MathJax appears to be missing.");
  }
  const files = listFilesRecursive(mathjaxDir)
    .map((f) => path.relative(projectRoot, f).split(path.sep).join("/"))
    .sort();
  const checksums = {};
  for (const rel of files) {
    const buf = fs.readFileSync(path.join(projectRoot, rel));
    checksums[rel] = crypto.createHash("sha256").update(buf).digest("hex");
  }
  return checksums;
}

function main() {
  const write = process.argv.includes("--write");
  const current = computeChecksums();

  if (write) {
    fs.writeFileSync(baselinePath, JSON.stringify(current, null, 2) + "\n");
    console.log(
      `MathJax baseline written: ${Object.keys(current).length} files -> ${path.relative(
        projectRoot,
        baselinePath
      )}`
    );
    return;
  }

  if (!fs.existsSync(baselinePath)) {
    console.error(
      "No MathJax baseline found. Run `node tools/mathjax-integrity/verify-mathjax.js --write` once to create it."
    );
    process.exit(1);
  }

  const baseline = JSON.parse(fs.readFileSync(baselinePath, "utf8"));
  const baselineFiles = Object.keys(baseline).sort();
  const currentFiles = Object.keys(current).sort();

  const missing = baselineFiles.filter((f) => !current[f]);
  const added = currentFiles.filter((f) => !baseline[f]);
  const changed = baselineFiles.filter((f) => current[f] && current[f] !== baseline[f]);

  if (missing.length || added.length || changed.length) {
    console.error("MathJax integrity check FAILED — MathJax must never change.");
    if (missing.length) console.error("  Missing files:\n    " + missing.join("\n    "));
    if (added.length) console.error("  Unexpected new files:\n    " + added.join("\n    "));
    if (changed.length) console.error("  Changed files:\n    " + changed.join("\n    "));
    process.exit(1);
  }

  console.log(
    `MathJax integrity check PASS — ${baselineFiles.length} files, byte-for-byte unchanged.`
  );
}

main();
