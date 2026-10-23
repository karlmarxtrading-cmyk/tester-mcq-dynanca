#!/usr/bin/env node
/* ==========================================================================
   Dynanca — generic Venn-diagram data validator
   -------------------------------------------------------------------------
   Checks the invariants that must hold for ANY visual.type === "venn"
   question, regardless of which bank it lives in. This is the durable
   guard against the class of bug found in
   questions/mathematics/discrete-mathematics/sets.json (Phase 7-10 of the
   2026-09 Venn repair): hardcoded/zeroed regions, corrupted setNames
   (question text leaking into the label array), and missing setNames.

   validateVennQuestion(q) -> string[] of problem descriptions (empty = ok)

   Invariants checked:
     - visual.sets is present and is either 2 or 3 entries (["A","B"] or
       ["A","B","C"]); anything else is flagged as unsupported/invalid.
     - visual.regions has every key required for that arity, and every
       value is a non-negative integer.
     - visual.setNames, if present, has exactly one label per set, each a
       short human-readable string (not a fragment of the question text —
       detected heuristically via length and the presence of a "?" or
       digit-heavy Venn keywords that should never appear in a label).
     - If the question text states an explicit grand total (e.g. "survey
       of N people", "Out of N people"), the sum of every mutually
       exclusive region plus "outside" (if present) must equal that total.
   ========================================================================== */
"use strict";

const REGION_KEYS_2 = ["A_only", "B_only", "intersection"]; // "outside" optional
const REGION_KEYS_3 = ["A_only", "B_only", "C_only", "AB_only", "AC_only", "BC_only", "ABC"]; // "outside" optional

const MAX_LABEL_LEN = 40;
const LABEL_LEAK_RE = /\?|shows regions|How many|\bonly\b.*\bonly\b/i;

function isNonNegInt(v) {
  return typeof v === "number" && Number.isInteger(v) && v >= 0;
}

function extractStatedTotal(questionText) {
  if (typeof questionText !== "string") return null;
  const m =
    /A survey of (\d+) people/i.exec(questionText) ||
    /Out of (\d+) people/i.exec(questionText) ||
    /total of (\d+)/i.exec(questionText);
  return m ? Number(m[1]) : null;
}

function validateVennQuestion(q) {
  const problems = [];
  const v = q && q.visual;
  if (!v || v.type !== "venn") return problems; // not a venn question, nothing to check

  const sets = Array.isArray(v.sets) ? v.sets : [];
  const regions = v.regions || {};
  const setNames = Array.isArray(v.setNames) ? v.setNames : [];

  let requiredKeys;
  if (sets.length === 2) {
    requiredKeys = REGION_KEYS_2;
  } else if (sets.length === 3) {
    requiredKeys = REGION_KEYS_3;
  } else {
    problems.push(`unsupported sets arity: ${JSON.stringify(sets)}`);
    return problems;
  }

  for (const key of requiredKeys) {
    if (!(key in regions)) {
      problems.push(`missing region "${key}"`);
    } else if (!isNonNegInt(regions[key])) {
      problems.push(`region "${key}" is not a non-negative integer: ${JSON.stringify(regions[key])}`);
    }
  }
  if ("outside" in regions && !isNonNegInt(regions.outside)) {
    problems.push(`region "outside" is not a non-negative integer: ${JSON.stringify(regions.outside)}`);
  }

  if (setNames.length) {
    if (setNames.length !== sets.length) {
      problems.push(`setNames.length (${setNames.length}) !== sets.length (${sets.length})`);
    }
    setNames.forEach((name, i) => {
      if (typeof name !== "string" || !name.trim()) {
        problems.push(`setNames[${i}] is empty/not a string`);
      } else if (name.length > MAX_LABEL_LEN || LABEL_LEAK_RE.test(name)) {
        problems.push(`setNames[${i}] looks corrupted (question text leaked into label): ${JSON.stringify(name)}`);
      }
    });
  }

  // Total conservation, only when the question states an explicit total
  // and every required region + outside were valid integers above.
  const allValid = requiredKeys.every((k) => isNonNegInt(regions[k])) && (!("outside" in regions) || isNonNegInt(regions.outside));
  if (allValid) {
    const stated = extractStatedTotal(q.question);
    if (stated !== null) {
      const sum = requiredKeys.reduce((acc, k) => acc + regions[k], 0) + (regions.outside || 0);
      if (sum !== stated) {
        problems.push(`regions do not sum to the stated total: sum=${sum}, stated total=${stated}`);
      }

      // Heuristic for the specific "everything dumped into outside"
      // collapse bug found in Phase 7 of the 2026-09 Venn repair: the
      // stated total lands entirely in "outside" while every other
      // required region is zero, even though the question text names
      // per-region counts (e.g. "13 drink only water, 7 drink only
      // coffee, and 7 drink both"). Generic sum-conservation alone can't
      // catch this because 0+0+0+total still equals the stated total.
      const nonOutsideAllZero = requiredKeys.every((k) => regions[k] === 0);
      if (nonOutsideAllZero && regions.outside === stated) {
        const otherNumbers = (q.question.match(/\d+/g) || [])
          .map(Number)
          .filter((n) => n !== stated);
        if (otherNumbers.length >= 2) {
          problems.push(
            `regions look uninitialized: "outside" absorbed the entire stated total (${stated}) while every other region is 0, ` +
              `but the question names per-region counts (${otherNumbers.join(", ")}) that were never distributed into regions.`
          );
        }
      }
    }
  }

  return problems;
}

module.exports = { validateVennQuestion, isNonNegInt, extractStatedTotal };
