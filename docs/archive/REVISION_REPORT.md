> **ARCHIVED — historical report.** It describes an earlier package (130 banks, CSV-driven manifest) and its numbers and
> pass claims do not apply to the current site. Current status: `QA_REPORT_CURRENT.md` and `CONTENT_INTEGRATION_HANDOVER.md`
> at the project root. The text below is unchanged.

# Dynanca MCQ — Revision Report

## Scope

This revision was applied to the uploaded `MCQ LP(6).zip` using the supplied audit findings as the revision specification.

The revision deliberately preserves percentage notation such as `15%` exactly as authored. No percentage token was rewritten or converted into LaTeX.

## Changes applied

1. **Duplicate LOGIC bank**
   - Rebuilt `questions/mathematics/logic/logic-04.json` with 300 newly authored, programmatically verified truth-value questions.
   - Kept the bank count at 300 and preserved the existing bank/catalog structure.

2. **Cross-bank duplicate questions**
   - Replaced the remaining duplicate question instances in Math Snack and Statistics with distinct questions/values covering the same learning concepts.
   - Removed all exact duplicate `question + options + answer` collisions across the 130 banks.

3. **Arithmetic answer-key bias**
   - Rebalanced `arithmetic-01.json` answer positions to A=17, B=17, C=16.
   - Option text was moved with its semantic identity; answer keys and explicit explanation references were updated consistently.

4. **Bare LaTeX data cleanup**
   - Fixed all 13 audited bare-LaTeX fields by adding proper MathJax delimiters.
   - Existing correctly delimited mathematics was left intact.
   - Percentage notation was not modified.

5. **Venn diagram UI**
   - `practice/venn-renderer.js` now displays semantic `setNames` when provided, with A/B/C fallback when names are absent.
   - Accessibility descriptions now include the semantic set names.
   - Updated the Venn caption to refer to named set labels.

6. **Venn theme consistency**
   - Replaced the Venn-specific `--border` / `--surface` fallbacks with the project's `--dmc-border` / `--dmc-surface` design tokens.
   - Added responsive label sizing and a theme-aware text halo for readability.

7. **Stale regression test**
   - Updated the quiz-75 pseudocode regression test to locate the current `q004` identifier instead of the obsolete `question-4` identifier.

8. **Internal bank IDs**
   - Made every question-bank JSON `id` unique and deterministic from its catalog path.
   - This does not change manifest routing or runtime practice IDs.

## Verification

- 130 practice banks retained.
- 8,356 questions retained.
- Manifest remains synchronized with CSV.
- Ecosystem validator: **PASS**.
- Automated regression suite: **60 passed, 0 failed**.
- Exact cross-bank question duplicates: **0**.
- Exact duplicate-bank content: **0**.
- Audited bare-LaTeX fields remaining: **0**.
- Percentage token multiset before vs. after revision: **identical**.
- `arithmetic-01.json`: A=17, B=17, C=16.
- All explicit `correct answer is X` explanation references checked against the final answer key: **0 mismatches**.

## Important boundary

This revision resolves the concrete defects identified by the supplied audit and adds regression protection for them. It does **not** claim that every one of the 8,356 original mathematical explanations has been independently human-proofread from first principles. The existing content outside the audited/revised cases was preserved rather than silently rewritten.

---

# Pass 2 — Final hardening (`\%` / `___` / radicals / MathJax / content QA)

## Scope

This pass was applied against the ZIP produced by Pass 1 above (`MCQ_LP6_REVISED.zip`), using a new audit brief covering: converter root-cause analysis, the `\%` literal-backslash bug, a `\_\_\_` placeholder bug, MathJax delimiter safety, four "simplifying radicals" content bugs, a multimodal-statistics bug, a rounding double-check, question-ID single-source-of-truth, and full-ecosystem validation + regression tests.

## Converter root-cause finding

The brief assumed a `CSV → converter → JSON` content pipeline that escapes/unescapes LaTeX. **That pipeline does not exist in this project.** The two actual converters are:

- `tools/manifest-generator/generate-manifest.js` — turns `master-manifest.csv` (catalog rows: folder/file/id/name/path/questionCount) into `master-manifest.json`. It never touches question content or LaTeX.
- `tools/practice-converter/convert-practices.js` — evaluates a `PRACTICES` JS array literal and writes it out as JSON. It performs no string escaping, unescaping, or LaTeX normalization of any kind, and is not part of the live `questions/**/*.json` build path (nothing in `package.json` invokes it).

Question-bank JSON files are hand/AI-authored directly; there is no intermediate CSV/JS source for question content to regenerate from. Consequently the `\%` and `\_\_\_` bugs are **data-authoring bugs, not converter bugs** — there is no root-cause converter fix available. This matches how Pass 1 handled the same class of problem (bare-LaTeX cleanup): fix the affected data, then add a regression test that scans every live bank so the same mistake can't silently reappear when new banks are added. That is the approach used below.

## Changes applied

1. **`\%` literal-backslash bug** — audited every `\%` occurrence across all 130 banks by parsing math context (`\(...\)` / `\[...\]` spans) per string field, distinguishing legitimate math-mode `\%` (e.g. `\(20\%\)`, `\(CV=(s/\bar{x})\times100\%\)`) from stray plain-text `\%` that renders as a literal backslash. Found and fixed **50 genuine plain-text occurrences**:
   - `questions/mathematics/algebra/basic-algebra-600.json` — 37
   - `questions/mathematics/math-snack/math-snack-07.json` — 4
   - `questions/mathematics/statistics/statistics-learning-04.json` — 9
   - `questions/mathematics/statistics/statistics.json` had **zero** plain-text occurrences (all its `\%` are correctly inside math mode) — no changes made there for this bug.
   - Fix was applied per-occurrence with the math-span check (never a blind `replaceAll`), verified afterward that all 339 remaining `\%` occurrences project-wide are inside math delimiters, and that ordinary `15%`-style percentages were never touched.

2. **`\_\_\_` placeholder bug** — found exactly one occurrence, in `questions/quiz/quiz - 01.json` (`quiz-01-q005`), sitting as a plain-text fill-in-the-blank placeholder between two math spans. Fixed to `___`.

3. **Simplifying-radicals content bugs (`basic-algebra-600.json`)** — confirmed and fixed all 4 broken questions:
   - `mfc-80` (√36): was `3√4` → now `6` (36 is a perfect square).
   - `mfc-232` (√72): was `3√8` → now `6√2`.
   - `mfc-371` (√32): was `2√8`, and `4√2` was not even offered as an option → now `4√2`, added as the correct option.
   - `mfc-469` (√100): was `5√4` → now `10` (100 is a perfect square).
   - For each, options/answer/explanation were rebuilt as one consistent chain and verified programmatically (`Math.sqrt` cross-check + a full prime-factorization "largest perfect-square factor" checker over all 12 questions in this concept — all 12 now agree with the deterministic simplification).

4. **Multimodal statistics bug (`statistics.json`)** — the brief flagged `mfc-28` (`[5,14,17,15,15,14]`, tied modes 14 and 15, single-letter answer key). Confirmed genuine. Fixed via the **minimal-dataset-edit** route (changed one `14`→`16`) rather than restructuring the question into a multi-select format, since every other question in this single-select architecture uses a single-letter `answer`. A new *generic* regression test (see below) then swept every "Mode"-concept question in every bank for the same tie pattern and found **two more previously-undetected instances of the identical bug**, also fixed the same way:
   - `mfc-212`: `[10,20,3,11,10,20]` (tied 10/20) → `[10,20,3,11,10,21]`.
   - `mfc-388`: `[13,20,12,13,20,14]` (tied 13/20) → `[13,20,12,13,21,14]`.

5. **Rounding double-check (`first-math-600.json`)** — recomputed both flagged values programmatically:
   - `64/387 × 100 = 16.5375…%` → rounds to **17%**, matches the existing answer key. **VERIFIED CORRECT, no change.**
   - `31/295 × 100 = 10.5085…%` → rounds to **11%**, matches the existing answer key. **VERIFIED CORRECT, no change.**

6. **Question ID single source of truth** — re-confirmed (Pass 1 already fixed this): the `quiz-75.json` regression test locates the *current* `q004`-suffixed id at runtime rather than hardcoding `question-4`. No further change was needed; a broader ID-integrity test already exists in the ecosystem validator (uniqueness, presence, answer-reference validity) and now also in the test suite.

## Broader content QA (deterministic, programmatic re-verification)

Per the brief's instruction not to stop at formatting, a sample of the largest deterministically-checkable question templates was re-derived from first principles and compared against the stored answer key (Python + SymPy where algebraic simplification was needed):

| Bank | Concept(s) checked | Questions checked | Mismatches found |
|---|---|---|---|
| `basic-algebra-600.json` | Percent word problems | 18 | 0 |
| `basic-algebra-600.json` | Simplifying radicals | 12 | 0 (after fix) |
| `basic-algebra-600.json` | Combining like terms, Distributive property | 41 | 0 |
| `basic-algebra-600.json` | Laws of exponents | 16 | 0 |
| `basic-algebra-600.json` | Arithmetic/Geometric sequences, Discriminant reasoning, Quadratic formula, Solving by factoring | 67 | 0 |
| `first-math-600.json` | All 9 "Percentage …" concept families (rate, calculation, increase, discount, change, complement, of-a-number, applied-to-a-count, of-a-total) | 50 | 0 |
| `first-math-600.json` | Linear equations (`ax ± b = c`) | 20 | 0 |
| `statistics.json` | Mode (all instances, exhaustive) | all | 3 (all fixed, see above) |

**224 additional questions** were re-derived and verified correct beyond the specific bugs the brief flagged, with zero further mismatches. This is a representative sample of the largest templated categories in the two biggest banks, not an exhaustive re-derivation of all 8,356 questions — see "Remaining issues" below.

## Regression tests added (`tools/tests/run-tests.js`, sections 15–17)

1. No field in any question bank contains a literal `\%` outside a math delimiter (scans all 130 banks).
2. Plain percentages (`14%`) remain ordinary text after the `\%` cleanup (positive control).
3. Math-mode percentages (`\(20\%\)`) are left untouched by the `\%` cleanup (negative control, guards against over-correction).
4. No field in any question bank contains a plain-text escaped-underscore placeholder (`\_\_\_`) outside a math delimiter.
5. The specific `quiz - 01.json` placeholder renders as plain `___`.
6. Each of the 4 fixed radical questions: answer references a real option, the option text is the fully-simplified form, and (where applicable) is numerically cross-checked against `Math.sqrt`.
7. **Generic** multimodal-safety check: every single-answer "Mode"-concept question's bracketed data set (across every bank, present and future) has one unambiguous mode — this is what caught `mfc-212` and `mfc-388` beyond the originally-flagged `mfc-28`.
8. `statistics.json` `mfc-28` specifically resolves to a single mode of 15.

## Verification (this pass)

- 130 practice banks retained, 8,356 questions retained (byte-identical file/question counts to Pass 1's output).
- Every touched file re-parses as valid JSON; diffed against the pre-pass ZIP to confirm each change was a targeted single-line/single-field edit with no incidental reformatting or content loss.
- `npm run validate`: **PASS** (manifest still in sync with CSV, 130 files / 8,356 questions).
- `npm test`: **71 passed, 0 failed** (60 pre-existing + 11 new regression tests in sections 15–17).
- Legitimate math-mode `\%` occurrences project-wide: 339, all confirmed still inside `\(...\)`/`\[...\]` delimiters, none altered.
- Plain-text `\%` / `\_\_\_` occurrences remaining project-wide: **0**.

## Remaining issues (reported honestly, per the brief's instruction)

- **Not every one of the 8,356 questions has been independently re-derived from first principles.** The 224-question deterministic re-check above covers the largest templated categories in the two biggest banks (`basic-algebra-600.json`, `first-math-600.json`) plus every "Mode" question project-wide; it does not cover every concept in every bank (e.g. word-problem categories with more free-form phrasing, the Quiz subject's 100 banks, or the smaller Mathematics topics like calculus/logic/discrete-math). No further math-correctness bugs were found within the categories that were checked.
- **No converter-level fix exists for the `\%`/`\_\_\_` bug class** because no such converter is part of this project's real pipeline (see "Converter root-cause finding" above). The regression tests in sections 15 and 17 are the durable guard against recurrence for future hand-authored banks, mirroring how Pass 1 protected against the bare-LaTeX and double-escaped-`\n` bugs.
- The renderer's existing `autoWrapBareLatex()` safety net (Pass 1) and the validator's bare-LaTeX/duplicate/answer-reference checks were re-run and continue to pass; they were not modified in this pass.
