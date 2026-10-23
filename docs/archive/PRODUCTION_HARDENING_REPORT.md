> **ARCHIVED — historical report.** It describes an earlier package (130 banks, CSV-driven manifest) and its numbers and
> pass claims do not apply to the current site. Current status: `QA_REPORT_CURRENT.md` and `CONTENT_INTEGRATION_HANDOVER.md`
> at the project root. The text below is unchanged.

# PRODUCTION HARDENING REPORT

Scope this session: Live Chromium E2E, CSP hardening, HSTS hardening,
against the already-stable Dynanca MCQ project. No refactor, no rewrite,
no MathJax changes, no question-content changes.

---

## 1. Baseline

```
npm test
84 passed, 0 failed
```
(82 passed at the start of this session; +2 are `node --check` syntax
entries the existing test suite auto-discovers for the 2 new files under
`tools/csp/` — no existing test was touched, weakened, or removed.)

```
npm run validate
PASS — 130 practice files, 8,356 questions, 2 subjects, 7 topics
```

```
npm run verify:mathjax
PASS — 106 files, byte-for-byte unchanged
```

---

## 2. Live Chromium E2E

Browser:
Chromium 141.0.7390.37 (pre-installed binary at `/opt/pw-browsers`,
matched to `@playwright/test@1.56.0` — see §8 and §9 for why this
matters and what it means for a fresh clone)

Result:
**PASS** — run for real, three consecutive times, not simulated.

Tests:
11 passed, 0 failed (x3 consecutive runs, ~16-17s each)

Flows:

* Application boot: **PASS**
* Catalog: **PASS**
* Question loading: **PASS**
* MathJax rendering: **PASS**
* Answer selection: **PASS**
* Navigation (Next): **PASS**
* Completion: **PASS**
* Review: **PASS**
* Reset/return (localStorage persistence + corrupted-state resilience): **PASS**
* CSP enforcement (real header, live flow): **PASS**

Two real, honest failures were found and fixed during this work — not
hidden, not weakened away:

1. **Test-design flaw, not an app bug.** The "answer → next → completion"
   test originally targeted "whatever the first catalog card is," which
   turned out to be a 600-question bank, and hit Playwright's element-
   stability check during rapid interaction with the app's own (real,
   intentional) 0.2s question-entry animation — the animation the app
   already gates behind `@media (prefers-reduced-motion: no-preference)`
   in `practice/practices.css`. Fix: set Playwright's standard
   `reducedMotion: 'reduce'` context option (exercises the app's own
   accessibility code path, not a workaround) and pointed the completion
   test at the smallest bank in the manifest for a fast, deterministic
   run. Confirmed stable across 3 runs after the fix.
2. **Real CSP violation caught by live enforcement.** See §3 — hashing
   `style-src` broke MathJax. This is exactly what live-browser CSP
   validation is for, and it worked as intended.

No test was skipped, weakened, mocked, or had its assertions loosened to
reach green. `expect(errors).toEqual([])` and `expect(cspViolations).toEqual([])`
remain hard equality checks against real captured console output in every
test file.

---

## 3. CSP

**Before** (start of this session):
```
default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline';
img-src 'self' data:; font-src 'self' data:; connect-src 'self'; object-src 'none';
base-uri 'self'; frame-ancestors 'none'
```

**After:**
```
default-src 'self';
script-src 'self' 'sha256-RCwcseATztF/Ow0Ye5SNjp0u8z7K3K4wNurOs4EQMKM=' 'sha256-0deQiRNXMHoit0vLPzMc3Nq6LedkIvK6JUL6YNc07r8=' 'sha256-j48zkK41IxUYKaL3cLF9VkAH0pEn3gs0fJih3zenVLM=' 'unsafe-inline';
style-src 'self' 'unsafe-inline';
img-src 'self' data:;
font-src 'self' data:;
connect-src 'self';
object-src 'none';
base-uri 'self';
frame-ancestors 'self';
form-action 'self'
```

**What changed and why:**
- `script-src` now allowlists the app's 3 specific inline `<script>` blocks
  (catalog renderer, MathJax config bootstrap, practice-id bootstrap) by
  SHA-256 hash. Per the CSP spec, once a hash-source is present, modern
  browsers ignore `'unsafe-inline'` and only run script matching a listed
  hash — real hardening against inline-script injection (XSS), with
  `'unsafe-inline'` kept only as a spec-compliant legacy-browser fallback.
  This was verified safe against real Chromium across every flow
  (homepage, practice, math, Venn, persistence) with zero
  "Refused to execute" violations.
- `object-src`, `base-uri`, `form-action` added per standard hardening
  guidance (no `<object>`/`<embed>` or `<form>` elements exist anywhere in
  the app, so these are pure risk-reduction with zero functional surface
  to break).
- `frame-ancestors` changed from `'none'` to `'self'` (this session's
  explicit instruction) — the app may embed itself but nothing external.

**What was intentionally left unchanged:**
- `style-src` still has **no hash-source** — plain `'self' 'unsafe-inline'`,
  same as before. This was tested with a hash (matching the one static
  inline `<style>` block in `index.html`) and it **broke MathJax**: MathJax's
  CHTML renderer injects/updates its own `<style>` element at runtime with
  computed font-metric CSS that cannot be pre-hashed, and once any hash is
  present in `style-src`, browsers ignore `'unsafe-inline'` for that
  directive per spec — so the hashed version silently blocked MathJax's own
  styling. Caught by real "Refused to apply inline style" console errors
  during `npm run test:browser`, not by inspection. Reverted before
  shipping. This is documented at length directly in `_headers` and
  enforced by `tools/csp/verify-csp-hashes.js`, which fails the build if a
  style-src hash is ever reintroduced.

**Does `'unsafe-inline'` remain? Where, and why:**
- `style-src`: yes, actively relied upon (MathJax's runtime style
  injection needs it — see above).
- `script-src`: present only as an inert legacy-browser fallback; every
  evergreen browser (which supports hash-sources) ignores it and enforces
  the hash allowlist instead.

**Drift protection:** `tools/csp/verify-csp-hashes.js` (`npm run
verify:csp`, also in CI) recomputes the 3 script hashes from the actual
HTML on every run and fails if `_headers` doesn't contain all of them, and
separately fails if a style-src hash is ever added back. If someone edits
one of the 3 inline scripts without updating the CSP, this catches it
before it reaches a browser that would otherwise silently block the
edited script.

---

## 4. HSTS

Header:
```
Strict-Transport-Security: max-age=31536000
```

Scope and deployment assumptions:
- HSTS only has any effect over HTTPS — browsers ignore it entirely on a
  plain HTTP response, so it is inert (not harmful) on the local dev
  server and only takes effect once actually deployed behind HTTPS.
  Confirmed harmless: it's present in every response from this session's
  local `http://` test server and all 11 browser tests still pass.
- `includeSubDomains` was **deliberately not added** — it requires every
  subdomain of the real deploying domain to also be HTTPS-only, which is a
  fact about the production domain this repository cannot know. Add it at
  the hosting layer once that's confirmed.
- `preload` was **deliberately not added** — HSTS preload-list submission
  is a hard-to-reverse decision about one specific production domain; not
  something a repository should opt a domain into on someone's behalf.

---

## 5. MathJax Integrity

Files checked: **106**
Changed: **0**
Hash/integrity: **PASS** (`npm run verify:mathjax`, SHA-256 per file,
re-run and re-confirmed at the end of this session)

---

## 6. Question Data Integrity

Question banks: **130**
Questions: **8,356**
Changed: **0**

Manifest regeneration from `master-manifest.csv` remains byte-identical
to the committed `master-manifest.json`.

---

## 7. Regression

```
npm test        → PASS (84 passed, 0 failed)
Manifest        → PASS (byte-identical regeneration)
Security (CSP)  → PASS (verify:csp + live Chromium enforcement, 0 violations)
MathJax         → PASS (106/106 unchanged)
Browser         → PASS (11/11, 3 consecutive real-Chromium runs)
```

---

## 8. Files Changed

| File | Why changed | What changed | Risk |
|---|---|---|---|
| `_headers` | CSP/HSTS hardening | Rewrote CSP to hash-allowlist inline scripts, kept style-src unhashed (documented why), added `object-src`, `base-uri`, `form-action`, changed `frame-ancestors` to `'self'`, added `Strict-Transport-Security`. Extensive inline comments recording the audit and the MathJax-breaking dead end that was found and reverted. | Low — verified against real Chromium across every app flow, 0 CSP violations, MathJax rendering confirmed intact. Only takes effect on hosts that read `_headers` (Netlify/Cloudflare Pages) or wherever the equivalent is applied manually. |
| `tests/browser/browser-test.js` | Fix real test-design flaws found this session; add CSP-enforcement coverage | Fixed the completion-flow test to target the manifest's smallest bank instead of an arbitrary catalog card; added a `Content-Security-Policy` describe block asserting the real header is present and zero CSP violations occur across homepage, practice, math, and Venn flows; server now sends the project's actual `_headers` on every response instead of no headers at all. | Low — test-only file, does not ship to production, does not touch any application file. |
| `tests/browser/playwright.config.js` | Fix real flakiness found this session | Added `reducedMotion: 'reduce'` to the test browser context, which exercises the app's own existing `prefers-reduced-motion` code path rather than fighting a live CSS animation. | None — test config only. |
| `package.json` | Add CSP verification script; pin Playwright to a version whose browser binary is actually available in this environment | Added `verify:csp` script; `@playwright/test` version pinned `^1.56.0` (was `^1.47.0`, which npm had actually resolved to 1.63.0 — a version mismatched against the only Chromium binary reachable in this sandbox). | Low — devDependency only, never ships to the site. See §9 for what this means for your own environment. |
| `.github/workflows/ci.yml` | Add CSP check to CI | Added a `CSP hash drift check` step (`npm run verify:csp`) before the browser E2E step. | None — CI-only. |

## Files Added (this session)

| File | Purpose |
|---|---|
| `tools/csp/compute-csp-hashes.js` | Extracts the app's inline `<script>`/`<style>` bodies and computes their CSP hash-source values. |
| `tools/csp/verify-csp-hashes.js` | Drift guard: fails if `_headers`' script hashes don't match current inline content, or if a style-src hash is ever reintroduced (which would re-break MathJax). Wired into `npm run verify:csp` and CI. |

(`tools/mathjax-integrity/`, `.github/workflows/ci.yml`, `_headers`, and
`tests/browser/` were added in the *previous* session; this session
modified their contents as described above rather than creating them
fresh.)

## Files Explicitly NOT Changed

```
MathJax: NOT TOUCHED — 106/106 files byte-for-byte identical, re-verified at session end
Question banks: NOT MASS-REGENERATED — 130 banks, 8,356 questions, 0 content changes
Core renderer, practice engine, Venn renderer, manifest format,
question schema, localStorage format, scoring logic: untouched
index.html / practice/index.html: untouched (the CSP hashes were computed
  FROM their existing inline content, not the other way around)
```

---

## 9. Remaining Risks — stated plainly

- **Playwright/Chromium version pin is environment-specific.** This
  sandbox has no network access to `cdn.playwright.dev`, so I could not
  run `npx playwright install chromium` normally. I found a pre-installed
  Chromium 141 binary at a fixed path and pinned `@playwright/test` to
  `1.56.0` to match it, so the tests could actually run for real here.
  **In your own environment or CI (which has normal internet access),
  `npx playwright install --with-deps chromium` will download whatever
  Chromium build matches whatever `@playwright/test` version is in
  `package.json` at the time — this should just work via the normal
  `npm ci && npx playwright install --with-deps chromium && npm run test:browser`
  path, but it has not been verified end-to-end in a "normal" environment
  with full internet access. If you upgrade `@playwright/test` later,
  there's nothing special to redo — just re-run `npm run test:browser`.**
- **`style-src` still relies on `'unsafe-inline'`.** This is a real,
  deliberate, documented trade-off (see §3), not an oversight — but it
  does mean an injected inline `<style>` tag (e.g. via a successful XSS
  elsewhere) would still execute. Closing this fully would require either
  moving MathJax off CHTML output (not permitted — MathJax is off-limits)
  or a nonce-based approach requiring a server that generates a fresh
  nonce per response (incompatible with this project's fully static
  architecture without adding a build/serving layer, which was out of
  scope this session).
- **The CSP audit covers the current codebase only.** If future code adds
  any external resource (a CDN font, an analytics script, an iframe), the
  CSP as written will silently block it. `_headers` documents this and
  `verify-csp-hashes.js` will catch inline-script hash drift, but it does
  **not** detect a newly-added external resource — that still needs a
  human to widen the relevant `-src` directive.
- **CI has not actually executed in GitHub Actions** — I wrote and
  locally validated every piece it runs (`npm test`, `npm run validate`,
  manifest determinism, `npm run verify:mathjax`, `npm run verify:csp`,
  and `npm run test:browser` against real Chromium), but the workflow
  file itself has not had a real Actions run against it yet.

I'm not claiming "100% production ready." The two items above (browser-
version portability, and the documented `style-src` `'unsafe-inline'`
trade-off) are real, open items — not hedging language.
