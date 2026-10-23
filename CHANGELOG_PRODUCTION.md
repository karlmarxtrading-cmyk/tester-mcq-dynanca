> Historical supporting document. Current recovery status and evidence are in IMPLEMENTATION_REPORT.md, TEST_REPORT.md and CURRICULUM_UPDATE_GUIDE.md. This document alone does not certify the current release.

# CHANGELOG PRODUCTION — Dynanca REAL MCQ 1.2.0

Upload SHA-256: `df9a8711c693b85ba07866a436855066ea692cae6e8e8c747656915d4c064270`. Raw diff tersedia pada `reports/SOURCE_DIFF_CURRENT.patch`; seluruh before/after hashes pada `reports/forensic-current.json`.

Seluruh 916 bank, manifest, schema dan vendor asli dipertahankan. ID, key dan konten soal tidak berubah dalam pekerjaan ini. History perubahan yang sudah berada dalam ZIP merupakan pekerjaan terdahulu, bukan perubahan baru dari rilis ini.

## Berkas asli yang berubah

| File | Alasan teknis |
|---|---|
| `_headers` | Hapus legacy inline-script fallback; tambahkan revalidation. Style inline MathJax tetap. |
| `assets/css/shell.css` | Theme/reset/review controls kini memiliki minimum height 44px. |
| `assets/data/bank-index.json` | Regenerasi hitungan 916 bank / 21.905 soal / 1.611 pending, termasuk 150 bank baru. |
| `assets/js/manifest.js` | Tolak encoded/control/query/dot/empty paths; raw spaces dan uppercase tetap valid. |
| `audit/CONTENT_AUDIT.json` | Regenerasi QA report/screenshot untuk snapshot 916 bank; bukan perubahan konten runtime. |
| `audit/DUPLICATE_REVIEW_DATA.json` | Regenerasi QA report/screenshot untuk snapshot 916 bank; bukan perubahan konten runtime. |
| `audit/MATHJAX_CONTENT_AUDIT.json` | Regenerasi QA report/screenshot untuk snapshot 916 bank; bukan perubahan konten runtime. |
| `audit/NUMERIC_CLAIM_RESULTS.json` | Regenerasi QA report/screenshot untuk snapshot 916 bank; bukan perubahan konten runtime. |
| `audit/QUESTION_COVERAGE.json` | Regenerasi QA report/screenshot untuk snapshot 916 bank; bukan perubahan konten runtime. |
| `audit/screenshots/bar-chart-320.png` | Regenerasi QA report/screenshot untuk snapshot 916 bank; bukan perubahan konten runtime. |
| `audit/screenshots/ml-1280-dark.png` | Regenerasi QA report/screenshot untuk snapshot 916 bank; bukan perubahan konten runtime. |
| `audit/screenshots/ml-1280-light.png` | Regenerasi QA report/screenshot untuk snapshot 916 bank; bukan perubahan konten runtime. |
| `audit/screenshots/ml-320-dark.png` | Regenerasi QA report/screenshot untuk snapshot 916 bank; bukan perubahan konten runtime. |
| `audit/screenshots/ml-320-light.png` | Regenerasi QA report/screenshot untuk snapshot 916 bank; bukan perubahan konten runtime. |
| `audit/screenshots/ml-390-dark.png` | Regenerasi QA report/screenshot untuk snapshot 916 bank; bukan perubahan konten runtime. |
| `audit/screenshots/ml-390-light.png` | Regenerasi QA report/screenshot untuk snapshot 916 bank; bukan perubahan konten runtime. |
| `audit/screenshots/ml-768-dark.png` | Regenerasi QA report/screenshot untuk snapshot 916 bank; bukan perubahan konten runtime. |
| `audit/screenshots/ml-768-light.png` | Regenerasi QA report/screenshot untuk snapshot 916 bank; bukan perubahan konten runtime. |
| `package.json` | Versi 1.2.0, minimum Node 22, workflow lokal dan pinned official tooling. |
| `package-lock.json` | Lockfile sinkron dengan package dan dependency resmi. |
| `practice/data-loader.js` | Validasi seluruh bank, encoding path, same-origin/no-cache fetch dan damaged-bank error. |
| `practice/practice-engine.js` | Single-winner scoring, validasi bank, cache ID, guard attempt, MathJax clear dan URL controls. |
| `practice/practices.css` | Target hint minimum 44px. |
| `practice/practice-state.js` | Validasi record, rekonsiliasi key, metadata session dan null-prototype maps; namespace tetap. |
| `README.md` | Panduan standalone terkini, count actual dan pemisahan source/output. |
| `tests/browser/playwright.config.js` | Lokasi laporan/output root dan retention screenshot/trace saat gagal. |
| `tests/browser/support.js` | Browser membaca dist melalui DYNANCA_TEST_ROOT, helper asli dipertahankan. |
| `tools/integrity/protected-baseline.json` | Daftarkan 150 bank unchanged dan empat protected runtime changes; history lama tetap. |
| `tools/integrity/verify-protected.js` | Bank baru tanpa hash terdaftar menjadi failure, kecuali --add-new eksplisit. |

## Berkas baru

| File/kelompok | Fungsi |
|---|---|
| `tools/release/runtime-files.js` | Runtime allowlist, inventory bank/vendor dan symlink guards. |
| `tools/release/preflight.js` | Hash, file limit, size, path/case, MIME, JSON, CSP dan internal exposure checks. |
| `tools/release/build.js` | Staged dist copy dan release manifest deterministik. |
| `tools/release/run.js` | Node argv spawn untuk Wrangler resmi, tanpa shell interpolation. |
| `tools/release/prepare.js` | Sequential checks/tests, browser dist, MathJax corpus dan exact-hash gate. |
| `tools/release/preview.js` | Pages dev resmi dengan port/inspector eksplisit serta preflight. |
| `tools/release/deploy.js` | Account/project lookup, Direct Upload guards, actual production branch dan empty upload cwd. |
| `tools/release/verify-public.js` | Semua public asset SHA/MIME, internal 404, CSP dan smoke browser pada lima lebar. |
| `tools/tests/release-tests.js` | 30 regression Node, termasuk deterministic build dan negative preflight. |
| `tests/browser/production.spec.js` | 34 regression browser, seluruh 916 bank, touch dan optional visuals. |
| `tools/qa/production-evidence.js` | 20 visual measurements dan 22 screenshot dari dist. |
| `wrangler.jsonc` | Config preview lokal; wrapper upload mengisolasinya dari deployment. |
| `DEPLOYMENT_GUIDE_WINDOWS.md` dan current reports | Workflow Windows/WSL, evidence dan status aktual. |
| `RELEASE_MANIFEST.json`, `reports/quality-gate.json` | Hash aset yang diuji, size, limits dan provenance release. |
| `reports/evidence-current/`, `reports/visual/`, forensic diff | Bug reproduction, log, performance, QA dan packaging evidence. |

## Protected audit trail

150 bank `dynanca-151`–`dynanca-300` didaftarkan setelah SHA cocok dengan upload; data tidak ditulis ulang. Empat protected runtime files berubah di bawah otorisasi master prompt dan memiliki before/after hashes dalam baseline history. Verifier final PASS untuk 1.034 file. Perbandingan langsung dengan ZIP asli membuktikan bank, manifest dan vendor tidak berubah.

| Protected file | SHA sebelum | SHA sesudah | Alasan |
|---|---|---|---|
| `assets/js/manifest.js` | `53a7fba60481150a6f97b0c2346f886ebf4a2418c6a12f6b9f660d4f36be0514` | `692bd2d2fcf84c30e267610d4c4406425be62b46c6ecc36e9adbfa6249ac3585` | Reject encoded traversal, control characters, query/fragment paths; encode URL path segments at fetch time. |
| `practice/practice-engine.js` | `31b7d0b7975af1949da89d3868f68f338fe01392f1d82420bb1c580aa634a7c0` | `382a169c7bc97e8cab9b7b618a3917ae0aea529223dac957a5ff804e03cd03fe` | Resolve a single correct option with label/index precedence; validate whole banks; guard offscreen answers; clear MathJax registry; cache ID lookup. |
| `practice/practice-state.js` | `f91a08b06c80d4d0cc276b1e7c20982a039cce5a9493468c51d1b9281eef5d65` | `e3ca195a3b1e76b015eae0392773cd47ec9d3e7ff4d8a19fe70360923c344f5a` | Recover malformed saved records, reconcile loaded keys, reject invalid review counters and use null-prototype storage maps. |
| `practice/practices.css` | `ebb4b2f8884e328fa4af9c41fe7e12ff84287944fcef7711265c1ca684b51bea` | `f1dd5289e8079c3e00a0a7b292cd67c89bf71eb5041538a332581b1f6b746f7c` | 44px minimum hint target after actual mobile measurements found 16px height. |

## Compatibility dan risiko

Desain utama, ID/deep link, raw path dengan spaces/case, namespace progres, MathJax configuration dan hash inline tetap. Record storage malformed ditolak; verdict lama direkonsiliasi dengan key yang sedang dimuat. Bank malformed menampilkan error dan retry. Resolver memberi prioritas label untuk key string, index 0-based untuk key numeric sesuai kontrak engine, lalu text fallback jika key bukan label.

Validasi bank sengaja gagal jika satu row rusak. Bank tambahan harus ditinjau, didaftarkan dengan --add-new, lalu diindeks ulang. Allowlist berarti aset runtime baru perlu didaftarkan secara eksplisit. Style inline MathJax masih diizinkan; legacy script fallback dihapus. Tidak ada framework, backend, timer, login atau generator konten baru.

Build assets dan manifest deterministik dengan fixed timestamp atau `SOURCE_DATE_EPOCH`. Execution timestamp pada laporan/gate tidak masuk runtime. Jangan rebuild bersamaan dengan preview, test atau deploy yang sedang membaca dist; pergantian folder dapat menimbulkan request 404 sementara.

QA memakai Node 24 (minimum 22), Wrangler 4.149.0 dan Playwright 1.56.0. Windows 11 adalah native OS dalam prerequisite resmi; Windows 10 memakai WSL Ubuntu 22.04+. Mesin Windows/WSL fisik belum diuji. Authenticated upload, public verification dan rollback belum dilakukan karena Cloudflare belum login. Review akademik seluruh corpus belum lengkap dan 42 duplicate groups dipertahankan. Semua 376 final test cases PASS; lihat `TEST_RESULTS_FINAL.md`.
