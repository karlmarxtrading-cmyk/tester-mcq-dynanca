#!/usr/bin/env node
/* ==========================================================================
   CSP inline-hash computation
   -------------------------------------------------------------------------
   Extracts every inline <script> (no src=) and <style> block from the
   pages that ship inline code (index.html, practice/index.html) and
   computes their CSP hash-source value (sha256-<base64>).

   This exists so the CSP in `_headers` can allowlist the app's specific,
   known inline scripts/styles by hash instead of blanket 'unsafe-inline'
   — the standard way to harden CSP on a static site without moving
   inline code into external files (which would be an HTML/JS structure
   change this project avoids unless proven necessary).

   Usage:
     node tools/csp/compute-csp-hashes.js            # print current hashes
   Used by:
     node tools/csp/verify-csp-hashes.js              # drift check (npm run verify:csp)
   ========================================================================== */
"use strict";

const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const projectRoot = path.resolve(__dirname, "..", "..");
// Every HTML page the site serves. Pages with no inline code simply
// contribute no hash (index.html and 404.html ship none).
const PAGES = ["index.html", "practice/index.html", "404.html"].filter((rel) =>
  fs.existsSync(path.join(projectRoot, rel))
);

function extractInlineBlocks(html, tagRe) {
  const blocks = [];
  let m;
  while ((m = tagRe.exec(html)) !== null) {
    const body = m[1];
    if (body.trim() === "") continue;
    blocks.push(body);
  }
  return blocks;
}

function computeHashes() {
  const scriptHashes = new Set();
  const styleHashes = new Set();

  for (const rel of PAGES) {
    const html = fs.readFileSync(path.join(projectRoot, rel), "utf8");

    // Inline <script> blocks only — scripts with a src= attribute are
    // external files and are governed by script-src 'self', not hashes.
    const scriptRe = /<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/g;
    for (const body of extractInlineBlocks(html, scriptRe)) {
      const hash = crypto.createHash("sha256").update(body, "utf8").digest("base64");
      scriptHashes.add(`'sha256-${hash}'`);
    }

    const styleRe = /<style[^>]*>([\s\S]*?)<\/style>/g;
    for (const body of extractInlineBlocks(html, styleRe)) {
      const hash = crypto.createHash("sha256").update(body, "utf8").digest("base64");
      styleHashes.add(`'sha256-${hash}'`);
    }
  }

  return {
    script: Array.from(scriptHashes).sort(),
    style: Array.from(styleHashes).sort(),
  };
}

function main() {
  const hashes = computeHashes();
  console.log(JSON.stringify(hashes, null, 2));
}

if (require.main === module) main();
module.exports = { computeHashes };
