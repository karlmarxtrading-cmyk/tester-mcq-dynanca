> Historical supporting document. Current recovery status and evidence are in IMPLEMENTATION_REPORT.md, TEST_REPORT.md and CURRICULUM_UPDATE_GUIDE.md. This document alone does not certify the current release.

# TEST RESULTS FINAL — Dynanca REAL MCQ 1.2.0

Quality gate **PASS** pada `2026-10-08T20:31:55.354Z` UTC. Run final terhadap dist berlangsung berurutan, tanpa rebuild paralel. Log dan bukti asli tersedia dalam source ZIP.

## Jumlah final

| Suite | Passed | Failed | Skipped | Bukti |
|---|---:|---:|---:|---|
| Node suite asli, termasuk pemeriksaan syntax tools tambahan | 192 | 0 | 0 | `reports/node-regression.log` |
| Release regression Node | 30 | 0 | 0 | `reports/release-regression.log` |
| Chromium browser, retries 0 | 154 | 0 | 0 | `reports/browser.log`, `reports/browser-results.json` |
| **Total test cases** | **376** | **0** | **0** | **222 Node + 154 browser**, flaky 0 |

| Pemeriksaan terpisah, tidak ditambahkan ke jumlah test cases | Hasil |
|---|---|
| Protected integrity | PASS: 1.034 berkas, termasuk 916 bank. Perubahan yang disetujui memiliki audit trail. |
| MathJax vendor integrity | PASS: 106 berkas byte-identical. |
| Inline CSP hashes | PASS: 2 hash tepat, 0 stale. |
| Index exact snapshot | PASS: 916 tersedia, 1.611 pending, 21.905 soal. |
| Shipped dataset | PASS WITH PENDING CONTENT; 42 warning duplicate content lintas bank. |
| Corpus MathJax | PASS: 52.521 ekspresi unik / 147.157 occurrences; 0 delimiter/parser/CSP/request errors. |
| Build deterministik | PASS: dua build sama seluruh bytes dan release manifest. |
| Deployment preflight | PASS: 1.049 file, 47.933.842 byte, 37 static references dan seluruh aset allowlist. |
| Visual matrix | PASS: 20 tampilan / 22 screenshot, 2.390 sampel text contrast, 0 kegagalan layout/contrast/runtime. |
| Official Wrangler/workerd local smoke | PASS: status 200/404, redirect, CSP, scoring, reload dan JSON dengan encoded path. |
| npm vulnerability snapshot | 0 known vulnerability pada dependency npm yang diaudit. |

## Lingkungan dan cara mengulang

Linux; Node 24.19.0, npm 11.9.0, Wrangler resmi 4.149.0, Playwright 1.56.0 dan Chromium 141.0.7390.37. Browser dist server menjalankan CSP dan 404 nyata; official workerd diuji terpisah. Durasi full browser suite: 128.5 detik. Mobile 320/390 mencakup touch emulation, bukan perangkat fisik.

```bash
npm ci
npx playwright install chromium
npm run prepare:release
npm run preflight
npm run preview
```

Di WSL, gunakan `npx playwright install --with-deps chromium`. Hentikan preview sebelum rebuild. `prepare:release` mengatur browser suite agar membaca dist, sehingga isolation test tidak skipped. Menjalankan browser suite langsung terhadap source dapat melewati satu test yang khusus memeriksa isolasi dist; total final di atas berasal dari mandatory prepare dengan skipped 0.

## Before / after

| Pemeriksaan | Upload asli | Setelah perbaikan |
|---|---|---|
| Node suite asli | 153 PASS / 4 FAIL, total 157 | 192 PASS / 0 FAIL, ditambah 30 release cases |
| Browser suite asli setelah Chromium dipasang | 119 PASS / 1 FAIL, total 120 | Seluruh suite asli dan tambahan: 154 PASS |
| Index | Stale: 766 bank / 20.405 soal | Actual: 916 bank / 21.905 soal |
| Collision label/text | Opsi B dengan text `A`, key `A`, dinilai Correct | Incorrect; 0 correct |
| MathJax registry | 31 registered / 1 active setelah 30 replacement | ≤4 registered setelah 60 navigasi, semuanya connected |
| Malformed selectedLabel | Soal terlewati, quiz complete | Record ditolak; 0 dari 2 answered |
| Encoded traversal | Diterima | Ditolak; raw spaces dan case tetap berfungsi |
| Bank dengan row null | Silent empty state | `bank-damaged` dengan retry |
| 150 bank belum terdaftar di protected baseline | Warning lalu PASS | Gagal kecuali penambahan yang ditinjau; 916 bank kini terlindungi |
| File internal pada output | Root source disarankan sebagai output | Allowlist dist; internal paths mengembalikan 404 |

Node baseline dihitung ulang pada salinan ZIP asli; log lengkap `reports/evidence-current/unit-baseline-verified.log` berakhir dengan 153 passed, 4 failed. Log awal `unit-baseline.log` tidak memiliki summary lengkap dan tidak menjadi sumber total authoritative. Browser first attempt gagal karena executable Chromium belum tersedia. Setelah instalasi, 119/1 merupakan baseline aplikasi yang relevan; kegagalan setup tidak dihitung sebagai 120 bug website.

Satu run perantara menghasilkan 153 browser PASS / 1 FAIL karena server menerima 404 untuk manifest ketika dist dibangun ulang dari proses lain. Trace disimpan di `reports/evidence-current/intermediate-browser-failure/`. Run final dipisahkan secara berurutan dan menghasilkan 154/0. Bukti kegagalan perantara tetap tersedia dan diberi label jelas.

## Cakupan regression

Browser menguji katalog, search/filter/pagination, URL dan back/forward, available/pending/invalid ID, loading/network/JSON/retry, keyboard/focus/landmarks, tema, resume/reload/reset/review/finish, storage unavailable/corrupt/legacy, correct/wrong verdict, pergantian bank, malformed data, CSP/security headers, HTML/SVG/media injection, Venn dan renderer opsional, completion seluruh 100 soal ML serta touch navigation.

Semua 916 bank dibuka dengan first question yang sesuai dalam 8 partitions. Winner uniqueness diperiksa berdasarkan key yang dimuat. Runtime validator Node mencakup seluruh 21.905 soal. Jawaban tes yang memakai key bank **bukan pembuktian akademik independen**. Semua 75 diagram Venn diperiksa geometry pada empat lebar; optional line/scatter/coordinate/number-line/geometry memakai fixture sintetis di lima lebar dan dua tema. Fixtures tidak dimasukkan ke bank atau deployment.

Preflight negative fixtures menambahkan internal file, menghilangkan font, mengubah CSS serta mematahkan URL/case; semuanya terdeteksi. Routing guard tests menolak Git integration, account ambigu/tidak dikenal, argumen tidak dikenal, preview sama dengan production, dan gate dengan hash berubah. Seluruh fixture berada pada temporary copies atau route interception.

`reports/visual/visual-audit.json` memuat pengukuran 20 tampilan dan daftar 22 screenshot. Lima lebar: 320, 390, 768, 1.280 dan 1.920; dua tema. Representative Venn dan MathJax explanation juga diperiksa secara visual.

## Performa dan keterbatasan

Isolated local gzip, satu warm-up dibuang, lima fresh contexts dan versi bergantian: median landing 87.9 → 91.1 ms; practice 145.0 → 152.3 ms. Request count tetap 9/17 dan bank download 0/1. Tidak diklaim speedup loading; pembersihan registry MathJax terbukti dengan regression tersendiri. Run `performance-final.json` sebelumnya memakai resource bersama QA dan tidak digunakan untuk menyimpulkan perubahan kecepatan.

**Partially Verified:** kebenaran akademik seluruh corpus. Solver terbatas mengevaluasi 518 soal: 512 PASS dan 6 form review. Ada 5.979 numeric claims, 10 intentional false-claim contexts dan 129 kandidat opsi numerik yang ditinjau dalam konteks. 42 duplicate groups tetap dipertahankan untuk keputusan pedagogis penulis.

**Blocked:** preview/production publik karena `loggedIn:false`. Akun, project, branch produksi aktual dan URL publik belum diverifikasi. `verify:deployment` siap membandingkan 1.048 aset publik; `_headers` adalah hosting configuration dan dikecualikan dari unduhan publik.

**Not Tested:** mesin Windows/WSL/phone fisik, Safari/Firefox, pengguna screen reader, sertifikasi WCAG penuh, public cache/HTTPS, izin akun Cloudflare dan rollback history. Tidak ada mandatory automated test yang gagal atau skipped pada gate akhir. Hasil source ZIP round-trip dan deployment archive checks dicatat pada `reports/PACKAGING_CURRENT.json` setelah packaging.
