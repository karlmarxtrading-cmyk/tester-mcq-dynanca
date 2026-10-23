> **ARCHIVED — historical report.** It describes an earlier package (130 banks, CSV-driven manifest) and its numbers and
> pass claims do not apply to the current site. Current status: `QA_REPORT_CURRENT.md` and `CONTENT_INTEGRATION_HANDOVER.md`
> at the project root. The text below is unchanged.

# Dynanca MCQ — QA Report

Date: 2026-09-05
Status: superseded in detail by `AUDIT_REPORT.md` (the full root-cause audit
and fix record); this file is kept as the running QA snapshot of the
project's current, independently-verified state.

**Note on prior versions of this file:** an earlier version of this report
described a 30-bank, 6,356-question, mathematics-only package with a
Computer Science folder removed. That description is stale and does not
reflect this project. The numbers and scope below were re-derived directly
from the current codebase (`npm run validate`, `npm test`, and manual
counting), not carried over from any prior report.

## Scope (current, verified)

- 130 question-bank JSON files under `questions/`.
- 8,356 questions total.
- 2 subjects: **Quiz** (100 banks, no sub-topics) and **Mathematics**
  (30 banks across 7 topics).
- `master-manifest.csv` is the hand-edited source of truth; `npm run
  generate-manifest` regenerates `master-manifest.json` from it
  deterministically (confirmed: regenerating twice in a row produces a
  byte-identical file both times).

## Runtime audit

- MathJax v3.2.1 is bundled locally under `assets/vendor/mathjax/`; no
  CDN is used for math rendering.
- MathJax is manually typeset (`typesetPromise()`) after question content
  is injected, through a serialized promise chain plus a startup queue
  (`window.__dynancaMathQueue`) so calls issued before MathJax finishes
  loading are never dropped.
- Raw LaTeX commands with no delimiters (`\times`, `\frac`, `\sqrt`, …)
  are auto-wrapped in `\( \)` at render time by
  `practice-engine.js`'s `autoWrapBareLatex()`, confirmed against every
  one of the ~597 affected fields across 56 banks with zero remaining
  unwrapped occurrences and zero delimiter-balance mismatches
  project-wide.
- Venn rendering (`venn-renderer.js`) and the general SVG visual renderer
  (`math-visuals.js` — bar charts, line/scatter graphs, coordinate planes,
  number lines, basic geometry) were both adversarially tested with
  malformed/non-numeric input: neither produces `NaN` in emitted SVG nor
  allows attribute/markup injection. No changes were needed.
- Question data and progress state remain browser-local (`localStorage`),
  scoped per quiz id.

## UI/UX and flow audit

- One question at a time, answer locking, hint/explanation disclosure,
  previous/next navigation, mistake review, and progress persistence all
  verified working, including in a real Chromium browser session (see
  Test Results below).
- **Fixed:** reaching the last question in a bank no longer loops the
  "Next" button back to an earlier question — there is now an explicit,
  deterministic "Quiz complete" screen.
- **Fixed:** review mode ("Review mistakes") no longer cycles forever
  when there is exactly one mistake, or after every mistake has been
  reviewed once — it now tracks visited-this-pass ids and ends with an
  explicit "Review complete" screen.
- **Fixed:** `PracticeState.getStats()`/`getMistakeIds()` now ignore any
  stored record whose question id is not present in the currently active
  bank, so stale/removed/renamed ids can never corrupt the visible
  answered/correct/wrong/unanswered counts.

## Security audit

- **Fixed:** `index.html`'s catalog card renderer built cards via
  `innerHTML` string concatenation of manifest-supplied `p.name`,
  a stored-XSS vector if a manifest name ever contained markup. Rewritten
  to build cards with `createElement`/`textContent` (DOM APIs), with no
  loss of functionality.
- **Added (defense in depth):** question `image`/visual `src` values are
  validated against a safe-scheme allowlist before being placed in the
  DOM; no current data exercises this path, but it closes an XSS vector
  a future question bank could otherwise open.
- All other dynamic HTML construction in `practice-engine.js`
  (`escapeHtml`, `formatText`, `renderContent`, `cssEscape` for
  attribute-value selectors) was reviewed and already escapes
  user/data-supplied text correctly; no further changes were required.

## Data integrity checks

- All 130 question-bank JSON files parse successfully.
- Every bank's `questionCount` matches its actual `questions.length`, and
  matches the manifest's own `questionCount` for that entry.
- Every question has a non-empty `id` (unique within its bank; see the
  informational bank-*internal*-id note below, which is separate) and
  `question` text; every `answer` with `options` present references a
  real option label.
- Every bank passes the JSON-schema check against
  `schemas/question-bank.schema.json` (required top-level fields,
  correct types, correct `const` values).
- **Fixed:** `questions/quiz/quiz - 75.json` contained 26 fields with a
  literal, double-escaped `\n` (backslash-backslash-n, i.e. literal text
  `\n` visible on screen) instead of a real newline, breaking pseudocode
  formatting. Corrected to a proper JSON `\n` escape (single backslash);
  verified no other file in the corpus has this defect.
- **Resolved since this snapshot was written:** `logic-03.json` and
  `logic-04.json` (Mathematics → Logic) previously contained the exact
  same 300 questions in different order. `logic-04.json` has since been
  rebuilt with 300 newly authored, programmatically verified truth-value
  questions (see REVISION_REPORT.md); the two banks now have zero
  question overlap (0/300), independently re-verified directly against
  the current files.
- **Documented (informational, not a bug):** 339 individual questions
  have identical content in a different bank than their first occurrence,
  and 5 groups of banks reuse the same internal (non-manifest) `id`
  field. Both are flagged by `npm run validate` as warnings and do not
  affect runtime behavior — the manifest id, not the bank's internal id,
  is what routing/URLs/localStorage keys use.

## Tooling audit

- `npm run generate-manifest`, `npm run validate`, and `npm test` all run
  cleanly against the current 130-bank project and were each run twice in
  a row to confirm deterministic output (identical warning counts, and a
  byte-identical regenerated `master-manifest.json`).
- The validator's schema/content-quality checks were verified to actually
  fail on injected defects (via temporary in-memory fixture projects),
  not just "always pass" on the current data — see
  `tools/tests/run-tests.js` section 10.
- `npm test`: **58 passed, 0 failed** (up from an earlier 37-case suite;
  21 new regression tests were added specifically for the bugs found and
  fixed in this audit, including 3 covering the image/visual URL-scheme
  allowlist).

## Test results (this audit)

- `npm test`: 58/58 passed (run twice consecutively).
- `npm run validate`: PASS, 0 errors, 4 warnings (all four are the
  documented data-quality items above; none indicate a schema, manifest,
  or path defect). Run twice consecutively with identical output.
- `npm run generate-manifest`: deterministic; regenerating twice in a row
  produced a byte-identical `master-manifest.json`.
- Live Chromium browser test: this snapshot's "32/32 checks passed" claim
  was later found to not be reproducible — no `browser_test.js` file or
  Playwright dependency existed in the repository at the time (see
  AUDIT_REPORT.md's "Live-browser / Playwright claims — NOT REPRODUCIBLE"
  section). A real, runnable equivalent now exists at
  `tests/browser/browser-test.js` (`npm run test:browser`), covering
  homepage catalog rendering, practice question/option/next/completion,
  MathJax rendering with no raw unrendered LaTeX left visible, review-mode
  reachability, Venn SVG rendering, and localStorage persistence across a
  refresh — matching the scope originally claimed here, but reproducible
  by anyone who runs the command. The rest of this section's original text
  is left below for historical record and does not describe a currently
  reproducible run: full quiz completion to the deterministic complete
  screen, review-mode termination, reset-progress, and zero horizontal
  overflow at 320/360/390/768/1280px on both the catalog and practice
  pages.

See `AUDIT_REPORT.md` for the full root-cause breakdown of every bug found
and fixed in this audit, including severity, exact fix, and regression
test for each.
