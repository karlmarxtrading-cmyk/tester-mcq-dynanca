#!/usr/bin/env node
/* ==========================================================================
   Dynanca — bank availability index builder (READ-ONLY towards content)
   -------------------------------------------------------------------------
   master-manifest.json lists every practice bank the catalog knows about.
   Not every listed bank file has to be shipped in a given release. The
   landing page must know which banks can really be opened WITHOUT probing
   thousands of URLs and WITHOUT downloading question payloads, so this
   script produces one small static index at build time:

       assets/data/bank-index.json

   For every manifest entry (walked with the same shared traversal the
   website uses, assets/js/manifest.js) it checks the local bank file:

       available  <=>  path is a safe questions/-relative path
                       AND the file exists
                       AND it parses as JSON
                       AND it has a non-empty "questions" array

   which is exactly the condition practice/data-loader.js needs to open a
   bank. For an available bank the index stores the VERIFIED number of
   elements in its "questions" array, keyed by the canonical manifest
   entry id. Banks that are not available are simply absent.

   WHAT THIS SCRIPT WRITES:   only the index file (default
                              assets/data/bank-index.json).
   WHAT IT NEVER WRITES:      master-manifest.json, master-manifest.csv,
                              the XLSX, schemas/, or anything in questions/.
                              It refuses any --out path that points at one
                              of those.

   The output is deterministic: entries are in manifest order and there is
   no timestamp, so building twice from the same snapshot gives identical
   bytes (which is what `--check` relies on).

   Usage:
     node tools/bank-index/build-bank-index.js            # rebuild the index
     node tools/bank-index/build-bank-index.js --check    # verify, write nothing
     npm run build:index
     npm run verify:index

   Options:
     --root <dir>   project root to read (default: this repository). Used by
                    the automated tests to run against temporary fixtures.
     --out <file>   index path relative to the root
                    (default: assets/data/bank-index.json)
     --check        compare the freshly computed index with the file on disk
                    and exit 1 if they differ; never writes.
     --quiet        print only errors.
   ========================================================================== */
"use strict";

const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const DEFAULT_OUT = "assets/data/bank-index.json";
const INDEX_SCHEMA_VERSION = "1.0";
const INDEX_TYPE = "dynanca-bank-availability";

function loadTraversal(repoRoot) {
  // Always the shared traversal shipped with the website, so the index can
  // never disagree with the catalog or the practice loader about which
  // entries exist or how nested topics/subtopics are walked.
  return require(path.join(repoRoot, "assets", "js", "manifest.js"));
}

/**
 * Compute the index for a project root. Pure with respect to the file
 * system: reads only.
 * @param {string} root absolute project root
 * @returns {{index: object, report: object}}
 */
function computeIndex(root) {
  const repoRoot = path.resolve(__dirname, "..", "..");
  const traversal = loadTraversal(repoRoot);
  const manifestPath = path.join(root, "master-manifest.json");
  const manifestBytes = fs.readFileSync(manifestPath);
  const manifest = JSON.parse(manifestBytes.toString("utf8"));
  if (!manifest || !Array.isArray(manifest.subjects)) {
    throw new Error("master-manifest.json has no subjects array.");
  }

  const available = {};
  const seenIds = new Set();
  const report = {
    listedBanks: 0,
    availableBanks: 0,
    unavailableBanks: 0,
    listedQuestions: 0,
    verifiedQuestions: 0,
    missingFiles: [],
    unusableFiles: [],
    duplicateIds: [],
    countDifferences: [],
    perCollection: [],
  };
  const collectionStats = new Map();

  traversal.eachPracticeFile(manifest.subjects, function (entry, trail) {
    report.listedBanks += 1;
    const subject = trail[0] || {};
    const collectionKey = String(subject.id);
    if (!collectionStats.has(collectionKey)) {
      collectionStats.set(collectionKey, { id: subject.id, name: subject.name, listed: 0, available: 0, verifiedQuestions: 0 });
    }
    const stats = collectionStats.get(collectionKey);
    stats.listed += 1;

    const listedCount = typeof entry.questionCount === "number" ? entry.questionCount : 0;
    report.listedQuestions += listedCount;

    const id = entry.id;
    if (typeof id !== "string" || !id) {
      report.unusableFiles.push({ id: String(id), path: entry.path, reason: "manifest entry has no string id" });
      return;
    }
    if (seenIds.has(id)) {
      // A duplicated id can only ever resolve to its first entry at runtime
      // (findPracticeFile returns the first match), so only that first
      // entry may be indexed.
      report.duplicateIds.push(id);
      return;
    }
    seenIds.add(id);

    if (!traversal.isSafeRelativePath(entry.path)) {
      report.unusableFiles.push({ id: id, path: entry.path, reason: "path is not a safe questions/-relative path" });
      return;
    }
    const filePath = path.join(root, entry.path);
    if (!fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) {
      report.missingFiles.push({ id: id, path: entry.path });
      return;
    }
    let bank;
    try {
      bank = JSON.parse(fs.readFileSync(filePath, "utf8"));
    } catch (err) {
      report.unusableFiles.push({ id: id, path: entry.path, reason: "file is not valid JSON (" + err.message + ")" });
      return;
    }
    if (!bank || !Array.isArray(bank.questions) || bank.questions.length === 0) {
      report.unusableFiles.push({ id: id, path: entry.path, reason: "file has no non-empty \"questions\" array" });
      return;
    }

    const verified = bank.questions.length;
    available[id] = verified;
    report.verifiedQuestions += verified;
    stats.available += 1;
    stats.verifiedQuestions += verified;
    if (typeof entry.questionCount === "number" && entry.questionCount !== verified) {
      report.countDifferences.push({ id: id, path: entry.path, manifestQuestionCount: entry.questionCount, verifiedQuestionCount: verified });
    }
  });

  report.availableBanks = Object.keys(available).length;
  report.unavailableBanks = report.listedBanks - report.availableBanks;
  report.perCollection = Array.from(collectionStats.values());

  const index = {
    schemaVersion: INDEX_SCHEMA_VERSION,
    indexType: INDEX_TYPE,
    generatedBy: "tools/bank-index/build-bank-index.js",
    note:
      "Derived, regenerable file. Do not edit by hand: run `npm run build:index`. " +
      "\"available\" maps a canonical master-manifest practice_files id to the verified " +
      "number of questions in that bank file. Listed banks that are absent here are " +
      "not shipped in this build.",
    manifestSha256: crypto.createHash("sha256").update(manifestBytes).digest("hex"),
    summary: {
      listedBanks: report.listedBanks,
      availableBanks: report.availableBanks,
      unavailableBanks: report.unavailableBanks,
      listedQuestions: report.listedQuestions,
      verifiedQuestions: report.verifiedQuestions,
    },
    available: available,
  };
  return { index: index, report: report };
}

function serializeIndex(index) {
  // One available bank per line: small enough to ship, still reviewable
  // in a diff after new bank files are added.
  const head = {};
  Object.keys(index).forEach(function (key) {
    if (key !== "available") head[key] = index[key];
  });
  const headJson = JSON.stringify(head, null, 2);
  const lines = Object.keys(index.available).map(function (id) {
    return "    " + JSON.stringify(id) + ": " + index.available[id];
  });
  return (
    headJson.slice(0, headJson.lastIndexOf("}")).replace(/\s+$/, "") +
    ",\n  \"available\": {" + (lines.length ? "\n" + lines.join(",\n") + "\n  " : "") + "}\n}\n"
  );
}

/** Refuse to ever write over protected content. */
function assertWritableTarget(root, outPath) {
  const rel = path.relative(root, outPath).replace(/\\/g, "/");
  if (rel.startsWith("..") || path.isAbsolute(rel)) {
    throw new Error("Refusing to write the index outside the project root: " + outPath);
  }
  const lower = rel.toLowerCase();
  const forbidden =
    lower === "master-manifest.json" ||
    lower === "master-manifest.csv" ||
    lower.endsWith(".xlsx") ||
    lower.startsWith("questions/") ||
    lower.startsWith("schemas/") ||
    lower.startsWith("assets/vendor/");
  if (forbidden) {
    throw new Error("Refusing to write the index to a protected path: " + rel);
  }
  if (!lower.endsWith(".json")) {
    throw new Error("The index path must end in .json: " + rel);
  }
}

function printReport(report, log) {
  log("Manifest entries (listed banks):   " + report.listedBanks);
  log("Available in this build:           " + report.availableBanks);
  log("Not available in this build:       " + report.unavailableBanks);
  log("Questions listed by the manifest:  " + report.listedQuestions + " (all listed banks)");
  log("Questions verified in bank files:  " + report.verifiedQuestions + " (available banks only)");
  report.perCollection.forEach(function (c) {
    log("  - " + c.name + ": " + c.available + " of " + c.listed + " banks available, " + c.verifiedQuestions + " verified questions");
  });
  if (report.missingFiles.length) {
    const first = report.missingFiles[0];
    const last = report.missingFiles[report.missingFiles.length - 1];
    log("Missing bank files: " + report.missingFiles.length + " (first: " + first.id + ", last: " + last.id + ")");
  }
  report.unusableFiles.forEach(function (u) {
    log("UNUSABLE: " + u.id + " -> " + u.path + ": " + u.reason);
  });
  report.duplicateIds.forEach(function (id) {
    log("DUPLICATE MANIFEST ID (only the first entry is indexed): " + id);
  });
  report.countDifferences.forEach(function (d) {
    log(
      "COUNT DIFFERENCE: " + d.id + " — manifest questionCount " + d.manifestQuestionCount +
        ", bank file has " + d.verifiedQuestionCount + " (the index uses the verified " + d.verifiedQuestionCount +
        "; the manifest is not modified)"
    );
  });
}

function main() {
  const args = process.argv.slice(2);
  let root = path.resolve(__dirname, "..", "..");
  let out = DEFAULT_OUT;
  let check = false;
  let quiet = false;
  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--root") root = path.resolve(args[++i]);
    else if (args[i] === "--out") out = args[++i];
    else if (args[i] === "--check") check = true;
    else if (args[i] === "--quiet") quiet = true;
    else {
      console.error("Unknown argument: " + args[i]);
      process.exit(2);
    }
  }
  const log = quiet ? function () {} : function (line) { console.log(line); };
  const outPath = path.resolve(root, out);

  let result;
  try {
    assertWritableTarget(root, outPath);
    result = computeIndex(root);
  } catch (err) {
    console.error("Bank index build failed: " + err.message);
    process.exit(1);
  }
  const text = serializeIndex(result.index);
  printReport(result.report, log);

  if (check) {
    let current = null;
    try { current = fs.readFileSync(outPath, "utf8"); } catch (err) { current = null; }
    if (current === null) {
      console.error("Bank index check FAILED — " + path.relative(root, outPath) + " does not exist. Run `npm run build:index`.");
      process.exit(1);
    }
    if (current !== text) {
      console.error(
        "Bank index check FAILED — " + path.relative(root, outPath) +
          " is out of date for this snapshot of master-manifest.json + questions/. Run `npm run build:index`."
      );
      process.exit(1);
    }
    log("Bank index check PASS — " + path.relative(root, outPath) + " matches this snapshot byte for byte.");
    return;
  }

  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, text, "utf8");
  log("Wrote " + path.relative(root, outPath) + " (" + Buffer.byteLength(text, "utf8") + " bytes). No other file was written.");
}

if (require.main === module) main();
module.exports = { computeIndex, serializeIndex, assertWritableTarget, DEFAULT_OUT };
