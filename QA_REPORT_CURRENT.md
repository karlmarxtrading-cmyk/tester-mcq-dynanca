> Historical supporting document. Current recovery status and evidence are in IMPLEMENTATION_REPORT.md, TEST_REPORT.md and CURRICULUM_UPDATE_GUIDE.md. This document alone does not certify the current release.

# QA terkini — DYNANCA REAL MCQ, 2026-10-08

Snapshot final: **2.527 bank / 38.015 soal terdaftar**, **766 bank / 20.405 soal tersedia**, termasuk **Machine Learning Fundamentals** (`ml`, 100 soal). **1.761 bank pending** `dynanca-151`–`dynanca-1911` tetap di manifest.

Hasil yang benar-benar dijalankan: **157 PASS / 0 FAIL Node**, **120 PASS / 0 FAIL / 0 SKIP browser Chromium** dengan CSP aktif pada 320/390/768/1280 px. `verify:protected` (884 file), `verify:mathjax` (106 file), `verify:csp`, `verify:index`, `validate:shipped`, dan `build` exit 0. `npm run validate` exit 1 **hanya karena 1.761 bank pending**.

Seluruh 20.405 soal diperiksa struktural dan seluruh ekspresi MathJax yang terdeteksi diparse di browser nyata. Review semantik terarah, bukan sertifikasi semua soal: 518 solver-eligible, 100 ML (19 derivasi), kandidat hint/numerik, dan 29 kelompok duplikasi. ID, opsi lengkap, kunci dan struktur progres tetap.

Laporan resmi saat ini:

- [FINAL_AUDIT_REPORT.md](FINAL_AUDIT_REPORT.md): temuan, severity, perbaikan dan batas cakupan.
- [TEST_RESULTS.md](TEST_RESULTS.md): perintah aktual, exit code, log, FAIL awal dan NOT RUN.
- [CHANGELOG_FIXES.md](CHANGELOG_FIXES.md): semua perubahan dan hash protected before/after.
- [CONTENT_INTEGRATION_HANDOVER.md](CONTENT_INTEGRATION_HANDOVER.md): cara menambahkan konten pending.

Log dan screenshot berada di `audit/`. Deployment Cloudflare/live CI, Firefox/WebKit/perangkat fisik, dan screen reader manual **NOT RUN**; tidak disebut PASS. Dokumen QA sebelumnya disimpan byte-identik di [docs/archive/QA_REPORT_CURRENT_BEFORE_REAL_MCQ_FIX.md](docs/archive/QA_REPORT_CURRENT_BEFORE_REAL_MCQ_FIX.md) sebagai histori, bukan kondisi terkini.
