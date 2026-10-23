#!/usr/bin/env node
/* ==========================================================================
   CSP hash drift guard
   -------------------------------------------------------------------------
   The Content-Security-Policy in `_headers` allowlists this project's
   inline <script>/<style> blocks by SHA-256 hash (see
   tools/csp/compute-csp-hashes.js for why). That is only safe as long as
   the hashes in `_headers` match the CURRENT inline content — if someone
   edits an inline script and forgets to update the CSP, the edited script
   would silently fail to run under a browser that enforces CSP, which is
   exactly the kind of "looks hardened, quietly breaks the site" outcome
   this project's hardening rules are meant to avoid.

   This script recomputes the hashes from the actual HTML and fails if
   `_headers` doesn't contain every one of them.
   ========================================================================== */
"use strict";

const fs = require("fs");
const path = require("path");
const { computeHashes } = require("./compute-csp-hashes");

const projectRoot = path.resolve(__dirname, "..", "..");
const headersPath = path.join(projectRoot, "_headers");

function main() {
  if (!fs.existsSync(headersPath)) {
    console.error(`No _headers file found at ${path.relative(projectRoot, headersPath)}.`);
    process.exit(1);
  }
  const headers = fs.readFileSync(headersPath, "utf8");
  const cspLine = headers.split("\n").find((l) => /Content-Security-Policy:/i.test(l));
  if (!cspLine) {
    console.error("No Content-Security-Policy line found in _headers.");
    process.exit(1);
  }

  const current = computeHashes();
  const missing = [];

  for (const hash of current.script) {
    if (!cspLine.includes(hash)) missing.push(`script-src ${hash}`);
  }
  // style-src is deliberately NOT hash-checked here: MathJax's CHTML
  // renderer injects/updates its own <style> element at runtime with
  // computed content that cannot be pre-hashed, so style-src intentionally
  // keeps plain 'unsafe-inline' with no hash-source (see _headers). Adding
  // a style hash would make browsers ignore 'unsafe-inline' for style-src
  // per spec and silently break MathJax — verified against real Chromium.

  if (/style-src[^;]*'sha256-/.test(cspLine)) {
    console.error(
      "CSP check FAILED — style-src contains a sha256 hash-source. This has already been " +
        "proven (against real Chromium) to make browsers ignore 'unsafe-inline' for style-src " +
        "and silently break MathJax's runtime style injection. Do not add a style-src hash " +
        "unless MathJax's CHTML output mode has changed how it injects styles — re-verify with " +
        "`npm run test:browser` against a math-containing bank before changing this."
    );
    process.exit(1);
  }

  // A hash that no longer matches any inline script is dead weight in the
  // allowlist (it would still authorise that old script text). Keep the
  // policy exactly as wide as the pages need.
  const scriptSrc = (cspLine.match(/script-src([^;]*)/) || ["", ""])[1];
  const listed = scriptSrc.match(/'sha256-[A-Za-z0-9+/=]+'/g) || [];
  const stale = listed.filter((hash) => current.script.indexOf(hash) === -1);
  if (stale.length) {
    console.error("CSP check FAILED — _headers allowlists inline script hash(es) that no page contains any more:");
    for (const h of stale) console.error("  stale: script-src " + h);
    console.error("\nRemove them from the Content-Security-Policy line in _headers.");
    process.exit(1);
  }

  if (missing.length) {
    console.error("CSP hash drift detected — _headers is out of sync with actual inline content:");
    for (const m of missing) console.error("  missing: " + m);
    console.error(
      "\nRun `node tools/csp/compute-csp-hashes.js` and update the Content-Security-Policy line in _headers."
    );
    process.exit(1);
  }

  console.log(
    `CSP hash check PASS — all ${current.script.length} inline script hash(es) are present in _headers with no stale hash, and style-src correctly has no hash-source (${current.style.length} inline style block(s) exist; runtime styles stay on 'unsafe-inline' for MathJax — see _headers).`
  );
}

main();
