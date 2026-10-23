#!/usr/bin/env node
/* ==========================================================================
   Dynanca — dependency-free CSV parser (RFC 4180 style)
   -------------------------------------------------------------------------
   Used by both the manifest generator and the ecosystem validator so the
   two tools can never disagree about how a row is read. A naive
   `line.split(",")` breaks the moment any cell contains a comma, a quoted
   field, an escaped quote, or an embedded newline — this parser handles
   all of those correctly while staying dependency-free.

   parseCsv(text) -> { header: string[], rows: Array<Record<string,string>> }
   Each row is an object keyed by the trimmed header name, with every cell
   trimmed. Leading zeros, spaces, and hyphens inside a cell's own content
   are preserved exactly — only surrounding whitespace is trimmed, and only
   because the source manifest rows are hand-typed and expected to have it.
   ========================================================================== */
"use strict";

/**
 * Parse raw CSV text into an array of rows, where each row is an array of
 * raw string cells (not yet mapped to header names). Supports:
 *  - quoted fields ("...")
 *  - commas inside quoted fields
 *  - escaped quotes ("" inside a quoted field)
 *  - embedded newlines inside a quoted field
 *  - CRLF and LF line endings
 *  - a leading UTF-8 BOM
 * @param {string} text
 * @returns {string[][]}
 */
function parseCsvRows(text) {
  var s = String(text == null ? "" : text).replace(/^﻿/, "");
  var rows = [];
  var row = [];
  var field = "";
  var inQuotes = false;
  var i = 0;
  var len = s.length;

  function endField() {
    row.push(field);
    field = "";
  }
  function endRow() {
    endField();
    rows.push(row);
    row = [];
  }

  while (i < len) {
    var c = s[i];
    if (inQuotes) {
      if (c === '"') {
        if (s[i + 1] === '"') {
          field += '"';
          i += 2;
          continue;
        }
        inQuotes = false;
        i += 1;
        continue;
      }
      field += c;
      i += 1;
      continue;
    }
    if (c === '"') {
      inQuotes = true;
      i += 1;
      continue;
    }
    if (c === ",") {
      endField();
      i += 1;
      continue;
    }
    if (c === "\r") {
      // Lone CR or CRLF — treat as a row break, consume an immediately
      // following \n so CRLF doesn't produce a phantom blank row.
      if (s[i + 1] === "\n") i += 1;
      endRow();
      i += 1;
      continue;
    }
    if (c === "\n") {
      endRow();
      i += 1;
      continue;
    }
    field += c;
    i += 1;
  }
  // Flush the final field/row unless the file ended cleanly on a row break
  // and there is nothing pending.
  if (field.length > 0 || row.length > 0 || inQuotes) {
    endRow();
  }
  // Drop fully blank trailing rows (e.g. a trailing newline at EOF).
  while (rows.length && rows[rows.length - 1].length === 1 && rows[rows.length - 1][0] === "") {
    rows.pop();
  }
  return rows;
}

/**
 * Parse CSV text into header + array of row objects keyed by header name.
 * Blank lines (no non-empty cells at all) are skipped. Every cell value is
 * trimmed; use parseCsvRows() directly if raw untrimmed cells are needed.
 * @param {string} text
 * @returns {{header: string[], rows: Object<string,string>[]}}
 */
function parseCsv(text) {
  var allRows = parseCsvRows(text);
  if (!allRows.length) return { header: [], rows: [] };
  var header = allRows[0].map(function (h) { return String(h).trim(); });
  var rows = [];
  for (var r = 1; r < allRows.length; r++) {
    var raw = allRows[r];
    var isBlank = raw.every(function (cell) { return String(cell).trim() === ""; });
    if (isBlank) continue;
    var obj = {};
    for (var c = 0; c < header.length; c++) {
      obj[header[c]] = String(raw[c] == null ? "" : raw[c]).trim();
    }
    rows.push(obj);
  }
  return { header: header, rows: rows };
}

module.exports = { parseCsv: parseCsv, parseCsvRows: parseCsvRows };
