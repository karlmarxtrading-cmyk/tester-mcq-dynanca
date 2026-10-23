#!/usr/bin/env node
/* ==========================================================================
   Dynanca — LEGACY master-manifest.csv -> manifest JSON converter
   -------------------------------------------------------------------------
   STATUS: legacy / reference tool. master-manifest.json is the owner's
   FINAL contract and is no longer derived from master-manifest.csv (the
   CSV is an old 130-row export; the final JSON lists 2,527 banks).

   Because running this tool with its old defaults would overwrite that
   final file with the stale CSV contents, the command line now REFUSES to
   write to the project's master-manifest.json. It can still convert a CSV
   to some OTHER output path (useful for experiments and for the automated
   tests, which call generate() in memory and never write the project's
   manifest).

   Usage:
     node tools/manifest-generator/generate-manifest.js <input.csv> <output.json>
   Both paths are resolved relative to the project root. <output.json> is
   required and must not be master-manifest.json.

   CSV columns:
     folder, sub-folder, sub-sub-folder, sub-sub-sub-folder, file,
     id, name, path, questionCount

   Hierarchy depth is derived from however many of the four folder columns
   are populated for a row — a row does NOT need every column filled in.
   For example a "quiz" row with only `folder` populated becomes a subject
   with `practice_files` directly on it (no `topics` array), while a
   "mathematics" row with `folder` + `sub-folder` populated becomes a
   subject with one topic underneath it. Both shapes are legitimate and
   both are preserved — this is intentional, not a bug (see the master
   manifest schema / README).
   ========================================================================== */
"use strict";
const fs = require("fs");
const path = require("path");
const { parseCsv } = require("../lib/csv-parse.js");

const projectRoot = path.resolve(__dirname, "..", "..");
const inputArg = process.argv[2] || "master-manifest.csv";
const outputArg = process.argv[3] || "";
const inputPath = path.resolve(projectRoot, inputArg);
const outputPath = outputArg ? path.resolve(projectRoot, outputArg) : "";
const protectedManifestPath = path.resolve(projectRoot, "master-manifest.json");

const LEVEL_COLUMNS = ["folder", "sub-folder", "sub-sub-folder", "sub-sub-sub-folder"];

function slug(s) {
  return String(s)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function titleCase(s) {
  return String(s)
    .replace(/[-_]+/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function isSafeRelativePath(p) {
  if (typeof p !== "string" || !p) return false;
  if (p.indexOf("\\") !== -1) return false;
  if (/^[a-zA-Z][a-zA-Z0-9+.-]*:\/\//.test(p)) return false; // no protocol/absolute URL
  if (p.charAt(0) === "/") return false; // no absolute paths
  const parts = p.split("/");
  if (parts.indexOf("..") !== -1) return false; // no path traversal
  if (parts[0] !== "questions") return false; // must live under questions/
  return true;
}

function generate(csvText) {
  const { header, rows } = parseCsv(csvText);
  const required = ["folder", "file"];
  for (const col of required) {
    if (header.indexOf(col) === -1) {
      throw new Error(`master-manifest.csv is missing required column "${col}".`);
    }
  }

  const manifest = { schemaVersion: "1.0", manifestType: "dynanca-master", subjects: [] };
  const seenIds = new Map(); // practice-file id -> [csv row numbers]
  const seenPaths = new Map(); // practice-file path -> [csv row numbers]
  const warnings = [];
  let totalRows = 0;
  let validRows = 0;

  rows.forEach((r, idx) => {
    const rowNum = idx + 2; // +1 for header, +1 for 1-based numbering
    totalRows += 1;

    const levels = LEVEL_COLUMNS.map((k) => r[k] || "").filter(Boolean);
    if (!levels.length) {
      warnings.push(`Row ${rowNum}: no folder/sub-folder value — row skipped (nothing to catalog).`);
      return;
    }
    const file = (r.file || "").trim();
    if (!file) {
      warnings.push(`Row ${rowNum}: missing "file" — row skipped.`);
      return;
    }

    // Walk/create the hierarchy for this row. Depth is whatever the row
    // actually populates — a shorter hierarchy is a legitimate leaf node,
    // not an error.
    let list = manifest.subjects;
    let node = null;
    levels.forEach((level, i) => {
      const id = slug(level);
      let existing = list.find((n) => n.id === id);
      if (!existing) {
        existing = { id, name: titleCase(level) };
        if (i < levels.length - 1) existing[i === 0 ? "topics" : "subtopics"] = [];
        list.push(existing);
      } else if (i < levels.length - 1 && !existing[i === 0 ? "topics" : "subtopics"]) {
        // A node first seen as a leaf (direct practice_files) later turns
        // out to also need children in a different row — support it
        // rather than silently dropping the deeper row.
        existing[i === 0 ? "topics" : "subtopics"] = [];
      }
      // Slugification collision guard: two DIFFERENT raw folder names that
      // happen to slugify to the same id (e.g. "Algebra" and "Algebra!")
      // would otherwise be silently merged into one node here — whichever
      // row created the node wins the display name and the later row's
      // rows get folded in underneath it with no indication anything
      // happened. That's a silent data-loss/merge risk, so surface it as a
      // loud warning instead of fixing it invisibly (the merge itself is
      // still applied — this generator never drops a row — but the
      // collision must be visible so a human resolves the underlying
      // folder-name inconsistency in the CSV).
      if (existing.name !== titleCase(level)) {
        warnings.push(
          `Row ${rowNum}: folder name "${level}" slugifies to id "${id}", which already belongs to ` +
            `node named "${existing.name}" (from a different raw folder name). These rows have been ` +
            `merged under one node — verify this is intentional, or make the folder names consistent.`
        );
      }
      node = existing;
      if (i < levels.length - 1) list = existing[i === 0 ? "topics" : "subtopics"];
    });

    node.practice_files = node.practice_files || [];
    const relPath = (r.path || "").trim() || path.posix.join("questions", ...levels, file);
    const id = (r.id || "").trim() || slug(levels.join("-") + "-" + file.replace(/\.json$/i, ""));
    const display = (r.name || "").trim() || titleCase(file.replace(/\.json$/i, ""));
    const countRaw = (r.questionCount || "").trim();
    const count = countRaw === "" ? 0 : Number(countRaw);
    if (countRaw !== "" && !Number.isFinite(count)) {
      warnings.push(`Row ${rowNum}: questionCount "${countRaw}" is not a number — using 0.`);
    }
    if (!isSafeRelativePath(relPath)) {
      warnings.push(`Row ${rowNum}: path "${relPath}" is not a safe questions/-relative path — row skipped.`);
      return;
    }

    if (!seenIds.has(id)) seenIds.set(id, []);
    seenIds.get(id).push(rowNum);
    if (!seenPaths.has(relPath)) seenPaths.set(relPath, []);
    seenPaths.get(relPath).push(rowNum);

    node.practice_files.push({
      id,
      name: display,
      file,
      path: relPath,
      questionCount: Number.isFinite(count) ? count : 0,
    });
    validRows += 1;
  });

  for (const [id, rowsForId] of seenIds) {
    if (rowsForId.length > 1) warnings.push(`Duplicate practice_files id "${id}" in CSV rows ${rowsForId.join(", ")}.`);
  }
  for (const [p, rowsForPath] of seenPaths) {
    if (rowsForPath.length > 1) warnings.push(`Duplicate practice_files path "${p}" in CSV rows ${rowsForPath.join(", ")}.`);
  }

  return { manifest, warnings, totalRows, validRows };
}

function main() {
  if (!outputPath || outputPath === protectedManifestPath) {
    console.error(
      "[generate-manifest] Refusing to run: master-manifest.json is the final, protected catalog contract and is not " +
        "generated from master-manifest.csv any more. Nothing was written.\n" +
        "To convert a CSV for inspection, give an explicit output path that is not master-manifest.json, e.g.\n" +
        "  node tools/manifest-generator/generate-manifest.js master-manifest.csv /tmp/from-csv.json"
    );
    process.exit(1);
  }
  const csvText = fs.readFileSync(inputPath, "utf8");
  const { manifest, warnings, totalRows, validRows } = generate(csvText);

  warnings.forEach((w) => console.warn("[generate-manifest] WARNING:", w));

  fs.writeFileSync(outputPath, JSON.stringify(manifest, null, 2) + "\n", "utf8");

  let topicCount = 0;
  let fileCount = 0;
  let questionCount = 0;
  (function walk(nodes) {
    (nodes || []).forEach((n) => {
      if (n.topics) topicCount += n.topics.length;
      if (n.subtopics) topicCount += n.subtopics.length;
      (n.practice_files || []).forEach((p) => {
        fileCount += 1;
        questionCount += p.questionCount || 0;
      });
      walk(n.topics);
      walk(n.subtopics);
    });
  })(manifest.subjects);

  console.log(
    `Generated ${path.relative(projectRoot, outputPath)} ` +
      `(${manifest.subjects.length} subjects, ${topicCount} topics, ${fileCount} practice files, ` +
      `${questionCount} questions, ${validRows}/${totalRows} CSV rows converted, ${warnings.length} warning(s)).`
  );
}

if (require.main === module) {
  main();
}

module.exports = { generate, isSafeRelativePath, slug, titleCase };
