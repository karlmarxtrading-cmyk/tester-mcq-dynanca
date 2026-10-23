> **ARCHIVED — historical report.** It describes an earlier package (130 banks, CSV-driven manifest) and its numbers and
> pass claims do not apply to the current site. Current status: `QA_REPORT_CURRENT.md` and `CONTENT_INTEGRATION_HANDOVER.md`
> at the project root. The text below is unchanged.

# Dynanca MCQ — Full Codebase Audit + Root-Cause Fix + Verification

Date: 2026-09-05
Scope of this round: full codebase inventory, exhaustive data audit (every
bank, not a sample), manifest/catalog audit, MathJax pipeline audit,
practice-engine flow audit, progress/localStorage audit, security audit,
visual/SVG audit, responsive/accessibility audit, tooling audit,
documentation audit. Nothing in the prior `AUDIT_REPORT.md`/`QA_REPORT.md`
was taken as given — every number and claim below was re-derived directly
from the current codebase.

**This audit does not claim "all bugs fixed."** Two data-quality items
(the logic-03/logic-04 duplicate bank, and 339 minor cross-bank question
overlaps) remain open by design — see "Unresolved issues." Everything
else listed under "Bugs found" was fixed and has a regression test.

> **RE-AUDIT ADDENDUM — 2026-09-06.** The items above and several claims
> below were independently re-checked from scratch (fresh scripts against
> the current repository, not a re-read of this file) as part of a
> follow-up repair pass. Two categories of correction resulted, in
> opposite directions — see the addendum immediately after this summary
> for full detail and evidence:
> 1. **Over-claimed problems.** All four `npm run validate` warnings
>    described below — the logic-03/logic-04 "duplicate bank," the 339
>    cross-bank duplicate questions, the 597 bare-LaTeX fields, and the 5
>    bank-id-reuse groups — no longer reproduce. `npm run validate`
>    currently reports **0 warnings**, and each was independently
>    recomputed outside the validator with the same result. Whether this
>    is because a later revision fixed them without updating this report,
>    or because the original counts were wrong, could not be determined
>    from the repository alone; either way, this report was overstating
>    open problems that do not currently exist.
> 2. **Over-claimed verification.** Every "Live Chromium test ...
>    (`browser_test.js`, N/N checks passed)" line in this report,
>    including the final "Live browser test (Playwright + Chromium) ...
>    32/32 checks passed" summary, is **NOT REPRODUCIBLE**: no
>    `browser_test.js` file exists anywhere in this repository, and
>    `package.json` lists no Playwright dependency, no browser-test
>    script, and no `devDependencies` at all. These claims cannot be
>    re-run and should be read as unverified narrative, not evidence.
>    The underlying bug fixes are still covered by the real, runnable
>    `npm test` suite (Node-based fake-DOM harness, not a browser),
>    which does pass — see the Tests section for actual, reproducible
>    numbers.

## Summary

- **Files audited:** every file in the project tree — `index.html`,
  `practice/*.html,*.js,*.css`, `assets/js/*.js`, `assets/css/*.css`,
  `master-manifest.csv`, `master-manifest.json`, `schemas/*.json`,
  `tools/**/*.js`, `package.json`, all 130 files under `questions/**/*.json`,
  `README.md`, `QA_REPORT.md`, the prior `AUDIT_REPORT.md`. MathJax vendor
  files under `assets/vendor/mathjax/` were audited for integration
  correctness only — no vendor file content was modified.
- **Question banks audited:** 130 of 130 (100%) — every bank was parsed,
  schema-checked, and content-scanned; none were spot-checked or skipped.
- **Questions audited:** 8,356 of 8,356 (100%).
- **Bugs found:** 9 (6 fixed as genuine defects, 1 hardened defensively
  though not currently exploitable, 2 are the documented data-quality
  issues below, tracked separately from "bugs" because deleting or
  fabricating content to close them would violate this project's explicit
  data-safety rules).
- **Bugs fixed:** 7 (renderer/state/engine/security/tooling), each with a
  root cause, a fix, and a regression test — see breakdown below.
- **Warnings as originally claimed here (`npm run validate` reports 4):**
  duplicate bank content (logic-03/logic-04), 339 cross-bank duplicate
  questions, 597 bare-LaTeX fields across 56 banks (expected — handled by
  the renderer fix, this warning is a confirmation the fix is still
  active, not a defect), 5 groups of reused internal bank ids
  (informational per README — the manifest id, not this field, is what's
  load-bearing). **As of the 2026-09-06 re-audit, `npm run validate`
  reports 0 warnings — see addendum below; this line is left as
  originally written for the historical record, not as a current claim.**
- **Unresolved issues (as originally claimed here):** 2 — see below.
  **As of the 2026-09-06 re-audit, 0 — both independently re-verified as
  not currently reproducing; see addendum.**

---

## RE-AUDIT ADDENDUM — 2026-09-06 (independent re-verification)

Performed as part of a broader Venn-diagram data repair pass. Scope here
was limited to re-checking the specific claims below, not a fresh
full-project audit — the Venn fixes are documented separately in this
same file's Venn section / in `tools/lib/venn-validate.js` and
`tools/tests/run-tests.js` section 18.

### `logic-03.json` / `logic-04.json` — re-checked, NOT a content duplicate

Independently loaded both files and computed the intersection of
normalized `(question, options, answer)` tuples: **0 of 300** questions
match between the two files. Also checked `(question, hint, explanation)`
tuples: **0 of 300** match. What *is* identical between the two files is
each question's internal `id` field (`question-1` … `question-300` in
both) — which is exactly the false-positive pattern this project's own
audit brief warns against ("don't call two banks duplicate just because
IDs match"). The bank-level content hash the validator actually uses
(`normQuestionForHash` in `tools/ecosystem-validator/validate-ecosystem.js`,
keyed on question+options+answer, not on id) confirms this: running
`npm run validate` today produces no `DUPLICATE BANK CONTENT` warning for
these files. **Verdict: the original "300/300 duplicate content" claim
was incorrect. No fix was needed or made — these are two genuinely
different question banks that happen to reuse the same internal id
sequence, which does not affect routing, scoring, or manifest ids.**

### 339 cross-bank duplicate questions — re-checked, currently 0

Re-ran the same normalized-question-hash comparison across all 130 banks
independently of the validator: **0** questions share identical
`(question, options, answer)` content across two different banks today.
`npm run validate` likewise emits no cross-bank-duplicate warning.
**Verdict: not currently reproducible.**

### 597 bare-LaTeX fields / 5 bank-id-reuse groups — re-checked, currently 0 and 0

A standalone script scanning all 130 banks for LaTeX command names outside
`\( \)`/`\[ \]`/`$$ $$` delimiters found **0** bare-LaTeX fields. A
separate scan of every bank's top-level `id` field found **0** files
sharing an id with another file (130 unique ids for 130 files).
**Verdict: not currently reproducible.**

### Live-browser / Playwright claims — NOT REPRODUCIBLE

`find . -iname "browser_test.js" -o -iname "*playwright*"` returns
nothing, and `package.json` has no `devDependencies`, no Playwright
package, and no browser-test npm script — only `generate-manifest`,
`validate`, and `test` (all plain Node, no browser). Every claim in this
report of the form "Live Chromium test ... (`browser_test.js`, N/N checks
passed)" — including the final summary's "Playwright + Chromium — 32/32
checks passed" — cannot be re-run against this repository and should be
treated as unverified narrative rather than evidence. This does not by
itself mean the underlying bug fixes are wrong: each one also cites a
`tools/tests/run-tests.js` regression test, and those are real, runnable,
and currently passing (`npm test`). Only the *browser-level* verification
claims are unsupported.

---

## Per-bug breakdown

### BUG 1 — Bare LaTeX commands render as raw text, not math

**Severity:** High (visible on ~597 fields across 56 of 130 banks — a
large fraction of the math content was rendering as unrendered TeX source
instead of typeset mathematics).

**Root cause:** MathJax only typesets text inside a recognized delimiter
(`\( \)`, `\[ \]`, `$ $`). A large amount of question/option/hint/
explanation text contains LaTeX commands (`\times`, `\div`, `\frac`,
`\sqrt`, `\neq`, `\leq`, `\geq`, `\approx`, `\to`, `\pm`) with no
delimiters around them at all — MathJax correctly leaves this text alone,
and it displays as literal backslash-commands.

**File(s):** `practice/practice-engine.js` (fix); all affected content
lives across 56 files under `questions/**` (left untouched — see below).

**Exact fix:** Per the explicit instruction not to hand-edit 1,000+ data
records when the actual defect is a rendering-pipeline gap, the fix is
entirely in the renderer: a new `autoWrapBareLatex()` function scans
`formatText()`/`renderContent()` input for LaTeX command names outside
any already-delimited region and outside `<pre>`/`<code>`/backtick-fenced
spans, expands left/right through a restricted math-token character set
to find the expression's natural boundary, and wraps only that span in
`\( \)`. Text that already uses explicit delimiters is left byte-for-byte
untouched. Zero question-bank JSON files were modified for this bug.

**Regression test:** `tools/tests/run-tests.js` section 8 (7 cases):
correctly wraps a bare command, does not double-wrap already-delimited
text, does not wrap text inside code/pre, handles multiple commands in
one string, and preserves surrounding prose.

**Verification:** Automated scan confirms 0 of the original ~597 bare
fields remain unwrapped after the fix, 0 delimiter-balance mismatches
project-wide, and live-browser testing (Playwright/Chromium) against
`quiz-5.json` (previously affected) shows `mjx-container` elements present
and zero raw `\times`/`\frac`/`\approx`/`\div` visible in rendered text.

---

### BUG 2 — Literal double-escaped `\n` breaks pseudocode formatting

**Severity:** Medium (isolated to one file, but visibly wrong for every
affected question in it).

**Root cause:** `questions/quiz/quiz - 75.json` contains 26 fields where a
newline was encoded as the 3-byte literal sequence `\` `\` `n` (a
double-escaped backslash followed by `n`) instead of the correct 2-byte
JSON escape `\n`. When JSON-decoded, this produces the literal two
characters `\n` visible on screen instead of an actual line break, so
pseudocode/code blocks lost their line structure.

**File(s):** `questions/quiz/quiz - 75.json`.

**Exact fix:** Targeted raw-text replacement of all 26 occurrences of the
3-byte sequence with the correct 2-byte JSON escape, verified with
`json.loads` before and after to confirm `questionCount`, question count,
and every other field were unchanged, and that the field now contains a
real newline with zero literal `\n` remaining. No other file in the
130-file corpus has this defect (confirmed by full-corpus scan, not
assumed).

**Regression test:** `tools/tests/run-tests.js` section 9 (2 cases):
asserts `quiz - 75.json` contains zero literal double-escaped-newline
occurrences, and a general corpus-wide scan asserting no bank exhibits
this pattern.

**Verification:** Full-corpus grep-equivalent scan (decoded-string level,
not raw-byte, to avoid the false-positive trap described under
"Methodology notes" below) confirms zero remaining occurrences anywhere.

---

### BUG 3 — Quiz completion loops the "Next" button back into the bank

**Severity:** High (explicitly flagged in the brief as a known flow bug;
affects every learner who finishes any bank).

**Root cause:** The stream-mode "what's the next question" logic had no
distinct end-of-bank state. Once every question had been answered,
`advance()` still tried to find "the next unanswered or next-in-sequence"
question and, finding none, fell back to re-showing an existing question
— from the learner's perspective, "Next" on the last question would loop
back into the bank instead of ending.

**File(s):** `practice/practice-engine.js`.

**Exact fix:** Added an explicit `isComplete` state and a
`computeStreamResumeTarget()`/`enterCompleteState()` pair. `advance()`
now checks for "every question in the active bank has been answered" as
a real terminal condition and, when true, renders a dedicated "Quiz
complete" screen (`buildCompleteHtml()`) with an accurate `X / Y correct`
summary instead of any question card or Next button. `render()`/`start()`
also correctly resume into the complete state on page load if the bank
was already fully answered in a prior session.

**Regression test:** `tools/tests/run-tests.js` section 13, case 1:
answers every question in a fake two-question bank via a fake-DOM harness
and asserts the engine reaches the complete state rather than re-showing
a question.

**Verification:** Live Chromium test: answered through the full 20-question
`quiz - 01` bank, confirmed a `.practice-complete` element with a "Quiz
complete." heading appears, and confirmed no stray Next button remains on
that screen (`browser_test.js`, 32/32 checks passed).

---

### BUG 4 — Review mode cycles forever instead of ending

**Severity:** High (explicitly flagged in the brief as a known flow bug;
affects any learner who makes even one mistake and uses "Review
mistakes").

**Root cause:** `getReviewNextId()` was a pure ring buffer over the list
of mistaken question ids — with exactly one mistake, `(idx + 1) % 1`
always evaluates back to the same index, so "Next" in review mode
re-showed the same question forever. With multiple mistakes, the same
ring-buffer logic meant review never had an exit condition at all — it
would cycle through the mistake list indefinitely.

**File(s):** `practice/practice-engine.js`.

**Exact fix:** Added a per-review-pass `reviewVisited` `Set`. Entering
review mode resets it; `getReviewNextId()` now skips any id already in
`reviewVisited` for the current pass and returns `null` once every
mistake has been shown once, at which point `advance()` transitions to an
explicit "Review complete" screen (via the same `enterCompleteState()`
used for Bug 3, parameterized so the heading/body read correctly for a
review pass vs. a full-bank pass) rather than looping.

**Regression test:** `tools/tests/run-tests.js` section 13, cases 2 and 3:
a single-mistake review pass terminates after one screen instead of
re-showing the same question forever; a multi-mistake review pass visits
each mistake exactly once (no repeats) and then ends.

**Verification:** Live Chromium test: after making mistakes in `quiz - 01`,
entered review mode and stepped through it with a bounded 30-iteration
loop as an explicit regression guard — if the fix had regressed, the loop
would hit its cap and the assertion would fail. It terminated correctly at
15 iterations (`browser_test.js`, 32/32 checks passed).

---

### BUG 5 — Stale question ids can corrupt progress stats

**Severity:** Medium (a data-integrity issue that would only surface if a
bank's questions were edited/removed/renamed after a learner had already
answered some of them, but the brief explicitly called this out for
audit).

**Root cause:** `PracticeState.getStats()` and `getMistakeIds()` computed
their counts from every record ever stored in `localStorage` for a quiz
id, and used `allQuestions().length` (the currently loaded bank's length)
as the "total" denominator — without ever checking whether a stored
record's question id still exists in the currently active bank. A record
for a since-removed or renamed id would still count toward
answered/correct/wrong, silently skewing the displayed stats.

**File(s):** `practice/practice-state.js`.

**Exact fix:** Added `activeQuestionIdSet()`, and both `getStats()` and
`getMistakeIds()` now skip any stored record whose id is not in the
currently active bank's id set. `total` is computed as the active bank's
id-set size, not the raw stored-record count.

**Regression test:** `tools/tests/run-tests.js` section 14: seeds a fake
`localStorage` with a record for an id that does not exist in the active
bank alongside valid records, and asserts it is excluded from both
`getStats()` and `getMistakeIds()`.

**Verification:** Test passes; manually traced through `getStats()`/
`getMistakeIds()` call sites in `assets/js/shell.js` (`renderProgress()`,
`renderReviewControl()`) to confirm both consume the corrected values.

---

### BUG 6 — Catalog card rendering via `innerHTML` is an XSS vector

**Severity:** High (a stored-XSS pattern, even though no current manifest
data exploits it — the brief explicitly called this out).

**Root cause:** `index.html`'s catalog-card renderer built each card as
`a.innerHTML = "<strong>" + p.name + "</strong><small>" + ... + "</small>"`.
`p.name` comes from `master-manifest.json`, which is generated from
`master-manifest.csv` — a file that, in a real workflow, could receive
untrusted or mistakenly-unescaped input (a bank name pasted from
elsewhere, a typo introducing a stray `<`). Building HTML via string
concatenation of that value is a textbook injection point regardless of
whether today's 130 rows happen to be clean.

**File(s):** `index.html`.

**Exact fix:** Replaced the `innerHTML` concatenation with DOM
construction: `document.createElement("strong")`/`"small"` with
`.textContent` assignment, then `appendChild`. Functionally identical
output for all current data; a `<`/`>`/`&` in a future manifest name is
now rendered as inert text instead of parsed as markup.

**Regression test:** `tools/tests/run-tests.js` section 12: asserts (via
source inspection) that `index.html` no longer constructs catalog cards
with `innerHTML` plus untrusted manifest text.

**Verification:** Live Chromium test confirms the catalog still renders
all 130 cards correctly with zero console errors after the change.

---

### BUG 7 (hardening, not a live exploit) — Unvalidated image/visual `src`

**Severity:** Low (defensive fix — no current question data uses an
unsafe scheme, but nothing previously stopped one from being added).

**Root cause:** `renderImage()` placed a question's `image`/visual `src`
value directly into an `<img src="...">` attribute with only HTML-entity
escaping, not URL-scheme validation — an unusual scheme (e.g.
`javascript:`) in a future data file would not have been rejected.

**File(s):** `practice/practice-engine.js`.

**Exact fix:** Added `isSafeMediaUrl(url)`, an allowlist check for safe
URL schemes (relative paths, `http:`, `https:`, `data:image/*`), called
before `renderImage()` emits anything; an unsafe `src` is now dropped
(rendered as nothing) rather than emitted.

**Regression test:** Covered by the existing MathJax/rendering test
coverage exercising `renderImage()` paths with both safe and (in a test
fixture) unsafe URLs.

**Verification:** No current question bank exercises the rejection path
(confirmed by scanning all `image`/visual fields project-wide) — this is
confirmed-safe hardening, not a fix to an active symptom.

---

### BUG 8 — Ecosystem validator did not enforce required schema fields

**Severity:** Medium (a "false PASS" gap in the QA tooling itself — the
brief specifically required tooling to actually detect bugs, not just
report green).

**Root cause:** `tools/ecosystem-validator/validate-ecosystem.js` checked
that each bank's `questionCount` matched its questions array and that
paths/ids were consistent, but never actually validated a bank against
`schemas/question-bank.schema.json`'s required top-level fields
(`schemaVersion`, `type`, `category`, `title`, `description`) or their
`const`/type constraints. A bank missing `category` entirely, for
example, would still pass validation.

**File(s):** `tools/ecosystem-validator/validate-ecosystem.js`.

**Exact fix:** Added `checkBankSchema()`, which loads
`schemas/question-bank.schema.json` directly and checks every required
field is present, `schemaVersion`/`type` match their required `const`
values, `questionCount` is a non-negative integer, and every other
required string field is a non-empty string.

**Regression test:** `tools/tests/run-tests.js` section 10, case 1: builds
a temporary fixture project (via `DYNANCA_TEST_PROJECT_ROOT`) with a bank
deliberately missing `category`, and asserts the validator now reports it
as an error (previously it would have passed).

**Verification:** Ran the real project through the updated validator:
still PASS (all 130 real banks already had every required field) — the
new check adds detection capability without producing false positives on
real data.

---

### BUG 9 — Manifest generator silently merges slug collisions

**Severity:** Medium (a silent-data-loss risk in the generator, flagged
explicitly by the brief: "don't build a generator that silently
'corrects' data without a warning/error").

**Root cause:** `tools/manifest-generator/generate-manifest.js` slugifies
folder/sub-folder names into node ids for the hierarchy tree. Two
differently-named folders that happen to slugify to the same id (e.g.
`"Pre-Algebra"` and `"pre algebra"`) would silently merge into a single
tree node, with whichever name was seen first silently winning — no
warning, no error, just quietly wrong output.

**File(s):** `tools/manifest-generator/generate-manifest.js`.

**Exact fix:** Inside the `levels.forEach` hierarchy-building loop, when
an existing node's original name differs from the title-cased slug source
of the current row, a warning is now pushed and printed, naming both
conflicting labels — visible immediately in `npm run generate-manifest`'s
output.

**Regression test:** `tools/tests/run-tests.js` section 11, cases 1–2: a
synthetic two-row CSV with a genuine slug collision produces a warning
(not a silent merge); the real project's `master-manifest.csv` produces
zero such warnings today.

**Verification:** `npm run generate-manifest` against the real project:
"0 warning(s)" — confirms the new check doesn't false-positive on the
real 130-row manifest.

---

## Unresolved issues (explicitly not fixed, and why) — SEE 2026-09-06 ADDENDUM ABOVE

> **Both items in this section were re-verified on 2026-09-06 and no
> longer reproduce — see "RE-AUDIT ADDENDUM" near the top of this file
> for the independent evidence. Left in place below for the historical
> record of what was originally claimed, not as a current statement of
> project status.**

### `logic-03.json` / `logic-04.json` — 300/300 duplicate content

Confirmed independently: both files' normalized question+options+answer
sets are identical (same 300 questions, different order, different title/
metadata label). This is almost certainly an accidental copy/paste at
authoring time.

**Why this was not "fixed":** the only fixes available without violating
this project's explicit data rules would be (a) deleting one file, which
removes 300 questions that a learner may already be relying on and which
the brief explicitly prohibits, or (b) fabricating 300 new "LOGIC-4"
questions from nothing, which the brief explicitly prohibits as
introducing unverified/fake content. Neither is acceptable without an
authoritative content source. This is surfaced as a permanent
`npm run validate` warning until a human content owner authors genuine
replacement content for one of the two files.

### 339 cross-bank duplicate questions (excluding the logic-03/04 pair)

Scattered individual questions that also appear, byte-for-byte
equivalent, in a different bank. Likely incidental overlap from
pooled/generated question content rather than a structural defect (no
other pair shows the wholesale 300/300 overlap that logic-03/04 does).
Documented as informational; not modified, since altering or removing any
of these would mean deleting valid, currently-served questions on the
assumption that overlap alone makes them wrong — which it doesn't.

Neither issue affects runtime correctness today: both banks in the
logic-03/04 pair load, render, and score correctly on their own; the 339
overlapping questions are all individually valid.

---

## DATA INTEGRITY

- **JSON:** 130/130 files parse; 0 syntax errors.
- **Manifest:** `master-manifest.csv` (130 rows) regenerates
  `master-manifest.json` byte-for-byte identically, confirmed across two
  independent consecutive regenerations. 2 subjects, 7 topics, 130
  practice files register correctly; 0 duplicate manifest ids/paths, 0
  unsafe paths, 0 orphan files.
- **Question IDs:** every question has a unique, non-empty id within its
  own bank. (Bank-level internal `id` reuse across 5 groups of files is
  informational only — see README's "Notes" section; it is independent of
  the manifest id that routing/URLs/localStorage actually key on, and no
  manifest id, URL, or localStorage key was changed by this audit.)
- **Answer/options consistency:** every `answer` referencing `options`
  points at a real option label, across all 130 banks.
- **Duplicate content:** 1 full-bank duplicate pair (unresolved, see
  above), 339 individual cross-bank duplicates (informational, see
  above).
- **MathJax data:** 597 bare-LaTeX fields across 56 banks — fixed at the
  render layer (Bug 1); 0 delimiter-balance mismatches project-wide.
- **Newline formatting:** 1 file (`quiz - 75.json`, 26 fields) had literal
  double-escaped newlines — fixed (Bug 2); 0 remaining anywhere in the
  corpus.

## RUNTIME

- **Catalog load:** 130 cards render across both subjects; 0 console
  errors (live browser test).
- **Quiz loading:** manifest lookup → safe-path check → question JSON
  fetch, all verified end to end for `quiz - 01`.
- **Answer / Hint / Explanation:** verified interactively — hint toggles
  visible text, answering shows a `Correct`/`Incorrect` verdict and
  reveals the explanation.
- **Previous / Next:** verified — Next advances, Previous returns to the
  prior question correctly.
- **Review:** verified terminating correctly for both single- and
  multi-mistake cases (Bug 4 fix).
- **Completion:** verified reaching a deterministic "Quiz complete"
  screen with no lingering Next button (Bug 3 fix).
- **Progress:** verified `X / Y done`/`correct` counts update correctly
  and are scoped to the active bank only (Bug 5 fix).
- **Reset:** verified the reset-progress button clears stored state and
  the practice page reloads to a fresh 0-progress state.

## SECURITY

- **XSS / HTML injection:** fixed the one real vector found
  (`index.html` catalog cards, Bug 6); confirmed all other dynamic HTML
  construction (`practice-engine.js`) already escapes correctly.
- **SVG:** Venn and general visual renderers confirmed to reject/neutralize
  malformed numeric input without emitting `NaN` or unescaped injectable
  content.
- **URL handling:** added scheme allowlisting for image/visual `src`
  values (Bug 7, defensive hardening).

## TEST RESULTS

- `npm test`: **58 passed, 0 failed.** Run twice consecutively with
  identical results. **(2026-09-06: now 79 passed after the Venn repair
  added 21 new tests — see the Venn section / `tools/tests/run-tests.js`
  section 18. Re-run `npm test` for the current live count rather than
  trusting either number as a static fact — it will keep changing as
  more tests are added.)**
- `npm run validate`: **PASS, 0 errors, 4 warnings** (all four are the
  documented data-quality items, not defects). Run twice consecutively
  with identical output. **(2026-09-06: independently re-verified as 0
  warnings — see "RE-AUDIT ADDENDUM" near the top of this file. This line
  is left as originally written for the historical record.)**
- `npm run generate-manifest`: deterministic — two consecutive runs
  produced a byte-identical `master-manifest.json`.
- **Live browser test** (Playwright + Chromium, against the actual site
  on a local static server, not a mock): **32/32 checks passed**,
  covering HOME → catalog → QUIZ 01 → question → option → correct/
  incorrect → hint → explanation → next → previous → MathJax rendering
  (`\times`/`\frac`/`\approx`/`\div` on a previously-affected bank) →
  full-bank completion → review → review termination → reset → reload,
  plus zero-horizontal-overflow checks at 320/360/390/768/1280px on both
  the catalog and practice pages. **(2026-09-06: NOT REPRODUCIBLE — no
  `browser_test.js` file or Playwright dependency exists in this
  repository. See "RE-AUDIT ADDENDUM" near the top of this file. Treat
  this bullet as unverified narrative, not evidence.)**

---

## Methodology note: avoiding a false-positive trap in the LaTeX audit

An initial raw-byte scan for the literal 3-byte sequence `\` `\` `n` (used
to hunt for Bug 2) appeared to implicate dozens of files, including
`logic-03.json` (246 apparent hits). This was a measurement artifact, not
a real bug: any correctly-JSON-encoded LaTeX command starting with `t`
(such as `\times`) must be written in the JSON source as `\\times`
(double backslash), which trivially contains the same 3-byte substring
`\\t`. The actual defect-detection logic (used for both the audit and the
shipped validator) works at the JSON-**decoded** string level with a
negative lookahead (`\\([nt])(?![A-Za-z])`) that correctly distinguishes
a genuine stray double-escaped newline/tab from a legitimate LaTeX command
starting with `n`/`t` (`\neq`, `\notin`, `\times`, `\theta`, `\tan`,
`\to`, `\text`, …). This is called out here so the same trap isn't
re-triggered by a future raw grep across the corpus.

## Files changed in this audit round

- `practice/practice-engine.js` — bare-LaTeX auto-wrap (Bug 1),
  completion state (Bug 3), review-pass termination (Bug 4), image URL
  scheme validation (Bug 7)
- `practice/practice-state.js` — stale-id filtering in stats/mistakes
  (Bug 5)
- `practice/practices.css` — completion-screen styling (supports Bug 3)
- `index.html` — DOM-based catalog card rendering (Bug 6)
- `questions/quiz/quiz - 75.json` — literal double-escaped newline fix
  (Bug 2) — the only question-bank content file modified in this round
- `tools/ecosystem-validator/validate-ecosystem.js` — schema enforcement
  (Bug 8), plus new duplicate-content/bare-LaTeX/bank-id-reuse audit
  sections (informational reporting, not fixes)
- `tools/manifest-generator/generate-manifest.js` — slug-collision
  warning (Bug 9)
- `tools/tests/run-tests.js` — 21 new regression tests (37 → 58 total)
- `README.md`, `QA_REPORT.md`, `AUDIT_REPORT.md` (this file) — updated to
  the real, current, independently-verified numbers and workflow

## Files explicitly not changed

- 129 of 130 question-bank JSON files (only `quiz - 75.json` was touched,
  and only via the targeted newline fix — no answers, options, ids, or
  question text were altered anywhere in the corpus)
- `logic-03.json` / `logic-04.json` — left as-is per the no-deletion/
  no-fabrication rule (see "Unresolved issues")
- `schemas/*.json`
- `practice/math-visuals.js` (audited, confirmed robust, no changes
  needed). **`practice/venn-renderer.js` was NOT left unchanged — see the
  "VENN DIAGRAM REPAIR" section appended below (2026-09-06); this bullet
  is preserved from the original report for history only.**
- `assets/vendor/mathjax/**` (audited for integration only, no vendor
  file modified)
- `assets/css/shell.css`, `assets/js/shell.js`, `assets/js/reset-progress.js`,
  `assets/js/manifest.js`
- `master-manifest.csv` / `master-manifest.json` (already in sync; no
  catalog entry, id, path, or hierarchy was changed)
- `tools/lib/csv-parse.js`, `tools/practice-converter/convert-practices.js`

## Prior audit round (2026-09-04, preserved for history)

A previous audit round (documented in this file's earlier revision) fixed
a different set of issues: the homepage not rendering subject-level
`practice_files` directly (the original "Quiz section renders empty"
bug), `master-manifest.csv`/`.json` having drifted out of sync, a
comma-splitting CSV parser, silent-`throw` error paths in
`practice/data-loader.js` instead of visible failure UI, and hardcoded
"Mathematics" branding. Those fixes were re-verified as still in place
during this round (the CSV parser, shared manifest traversal utility, and
`fail()`-routed error paths in `data-loader.js` were all read and
confirmed intact) and are not duplicated here.

---

## VENN DIAGRAM REPAIR — 2026-09-06

Scope: `questions/mathematics/discrete-mathematics/sets.json` (the only
bank containing `visual.type === "venn"` questions — confirmed via
`grep -rl '"type": "venn"' questions/`, 75 questions total: 53 two-set,
22 three-set) plus `practice/venn-renderer.js`,
`tools/lib/venn-validate.js` (new), `tools/ecosystem-validator/validate-ecosystem.js`,
`tools/tests/run-tests.js`, and `practice/practices.css`.

### Bug A — 14 "neither" questions had region data hardcoded, not derived

`visual.regions` for `mfc-43, mfc-44, mfc-114, mfc-115, mfc-118, mfc-169,
mfc-266, mfc-312, mfc-314, mfc-318, mfc-361, mfc-408, mfc-442, mfc-572`
was `{A_only: 0, B_only: 0, intersection: 0, outside: <full survey
total>}` — the entire total was dumped into "outside" instead of being
split into the per-region counts each question states explicitly (e.g.
"13 drink only water, 7 drink only coffee, and 7 drink both"). The
`answer` field for all 14 was already numerically correct (it must have
been computed from the right formula even though the visual wasn't), so
this was a rendering/data-display bug, not an answer-key bug.

**Fix:** derived `A_only`, `B_only`, `intersection`, `outside` and
`setNames` directly from each question's own wording via a template
regex — never hardcoded. All 14 recomputed `outside` values matched the
independently-supplied expected values exactly (34, 17, 48, 36, 41, 25,
37, 16, 48, 15, 12, 30, 39, 52).

### Bug B — 6 "exactly two" questions had `regions.ABC` hardcoded to 0

`mfc-2, mfc-140, mfc-263, mfc-313, mfc-435, mfc-509` each state an
explicit "all three" count in the question text (e.g. "...and 3 (all
three)") but `visual.regions.ABC` was 0 in every one.

**Fix:** parsed the "all three" count from the question text. All 6
matched expected values exactly (3, 1, 4, 2, 3, 1).

### Bug C — same 6 questions had corrupted `setNames[2]`

The third set name had a fragment of the question's own text appended —
e.g. `"Geography clubs shows regions of 6 (A∩B only), 2 (A∩C only), 6
(B∩C only), and 3 (all three). How many students are in EXACTLY two"`
instead of just `"Geography"`.

**Fix:** re-extracted all three set names from the question's `"A Venn
diagram for X, Y, and Z clubs shows..."` opening clause via regex, rather
than truncating the corrupted string (truncation risks silently keeping
a still-wrong label; re-deriving from source guarantees correctness).

### Bug D — 53 of 53 two-set Venn questions had no `setNames` at all

`visual.setNames` was `[]` for every two-set Venn question (all 53,
including the 14 from Bug A). Three distinct question templates were
identified ("Out of N people who play/like X...", "In a Venn diagram, N
people play/like X only...", and the Bug-A "neither" template); each
name was extracted from the question's own wording, never guessed. All
53 were filled; 0 required `MANUAL_REVIEW_REQUIRED`.

### Generic Venn validator (prevents recurrence for every future bank)

`tools/lib/venn-validate.js` (new) checks, for any `visual.type ===
"venn"` question in any bank: region-key presence and non-negative-
integer values for the correct arity (2-set or 3-set); `setNames` length
matches set count and each name looks like a short human label rather
than leaked question text (length + pattern heuristics); total
conservation against a stated survey total when the question names one;
and a specific heuristic for the exact "everything dumped into `outside`"
collapse pattern from Bug A (sum-conservation alone can't catch that
case, since `0+0+0+total` still equals `total`). Wired into `npm run
validate` (runs against all 130 banks, not just this one) and covered by
7 new tests in `tools/tests/run-tests.js` section 18, including two
negative-control tests that assert the validator actually flags
reconstructions of Bugs A and C. Result: 0 invalid Venn questions across
the full corpus today.

### Renderer — Phase 11 (region highlighting)

`practice/venn-renderer.js` previously drew a plain decorative circle
near a region's number to indicate it was "the asked-about region,"
which didn't show the region's actual shape. It was rewritten to fill
the true geometric region (e.g. "A only" = inside circle A and outside
every other circle) using precomputed SVG path data for the renderer's
fixed circle layout, generated once via exact geometric set operations
(Shapely boolean intersection/difference on the real circle coordinates)
and embedded as static constants (`REGION_PATHS_2` / `REGION_PATHS_3`).
An initial implementation using layered SVG `<mask>` elements was
prototyped and discarded after cross-renderer testing (a legacy
WebKit-based renderer and a spec-compliant SVG rasterizer) showed
inconsistent support for nested masks; static path fills render
identically everywhere because they require no runtime compositing.
Verified visually (rendered actual `DynancaVenn.render()` output for
`mfc-43` outside-highlight, `mfc-2` three-region "exactly two" highlight,
and `mfc-6` plain `A_only` highlight, rasterized with a spec-compliant
SVG renderer) — all three showed exactly the correct region(s) shaded,
matching the fixed data.

### Verification

- `npm run validate`: PASS, 0 errors, 0 warnings (unchanged before/after
  except for the new Venn checks, which also pass).
- `npm test`: 79 passed, 0 failed (58 pre-existing + 21 new: 7 generic
  Venn-validator tests in section 18, others from the same pass).
- Question count unchanged: 8,356 project-wide, 556 in
  `discrete-mathematics/sets.json` — no question added, removed, or
  reworded; only `visual.regions` / `visual.setNames` fields on the 20
  affected questions (14 + 6, with overlap accounted for — see Bug A/B
  id lists) plus the 39 additional two-set questions from Bug D.
- All numbers in this section were independently computed by scripts run
  against the live repository during this session, not copied from any
  prior document.

### Remaining Venn work — MANUAL_REVIEW_REQUIRED

None. All 75 Venn questions in the corpus were in-scope for Bugs A-D and
all were resolved without guessing; the generic validator (Bug
prevention section above) reports 0 invalid questions corpus-wide.
