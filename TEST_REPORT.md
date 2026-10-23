# TEST REPORT — DYNANCA REAL MCQ

Status: **BASELINE APPROVED — SOURCE BUILD PASS — CLOUDFLARE PREVIEW PENDING**.

Pengujian rilis lengkap memakai salinan kandidat. Setelah persetujuan eksplisit pemilik atas scope dan 321 perubahan, baseline source disahkan melalui CLI approval. Build source aktual, protected integrity, MathJax integrity, CSP dan validator lengkap kemudian lulus. Semua aset dist aktual identik dengan kandidat yang telah diuji; pengujian browser lengkap tidak diulang karena byte runtime tidak berubah.

| Pemeriksaan final | Hasil |
|---|---|
| Source / index / dist | 1.236 bank, 26.644 soal, 0 pending |
| Protected kandidat | PASS; baseline mencakup semua bank |
| Vendor MathJax | PASS, 106 file |
| CSP hashes | PASS |
| Index freshness | PASS |
| Ecosystem validator lengkap | PASS; 44 warning kesamaan konten dipertahankan |
| Node source tests | 171 PASS, 0 FAIL |
| Release tests | 30 PASS, 0 FAIL |
| Curriculum workflow tests | 20 PASS, 0 FAIL |
| Chromium terhadap dist | 203 PASS, 0 FAIL, 0 SKIP, 0 FLAKY |
| Semua bank di browser | 1.236 first questions dibuka; masing-masing tepat satu opsi yang ditandai benar oleh engine |
| MathJax seluruh corpus | 26.644 soal; 61.165 ekspresi unik; 0 delimiter/compile/CSP/request error |
| Build kandidat | PASS, 1.369 aset, 0 pending |
| npm run prepare:release kandidat | PASS, exit 0 |
| Preflight | PASS; aset sumber/deployment cocok |
| Concurrent release guard | PASS: proses release kedua ditolak |
| Integritas konten | Seluruh 1.236 JSON dan manifest identik byte-for-byte dengan upload |
| Inventaris asli | 4.869 hash cocok dengan ZIP upload |

Pengujian browser mencakup bank awal/akhir setiap koleksi, tiga bank Computer Science baru, Comprehensive Math baru, scoring, hint, Next/Previous, deep links, reload/progres, tema, logo, CSP, keyboard, computed contrast, viewport 320–1920, serta fixture koleksi/bank baru berisi satu dan dua soal. Semua bank diuji lewat 42 partisi yang menyesuaikan ukuran corpus dan berjalan paralel. Ini bukan tes setiap soal secara interaktif; seluruh ekspresi matematika diuji oleh auditor MathJax terpisah.

20 tes workflow mencakup review/approval eksplisit, proposal tampered/usang, penambahan bank/koleksi/soal, metadata rename, pemindahan path dengan ID tetap, build sesudah approval, kehilangan bank pada dist, file internal publik, indeks usang, bank hilang, JSON malformed, ID duplikat, answer invalid/hilang, dan traversal path. Suite Node/release melengkapi pemeriksaan schema, opsi, hashes, renderer dan routing.

Batas: tidak ada kredensial API Cloudflare yang tersedia dan tidak ada preview/production deployment atau URL publik yang diverifikasi. Firefox/Safari, perangkat fisik, screen reader manusia, fresh npm ci lintas-OS dan dependency scan baru tidak dilakukan. Pengujian menggunakan modul Node/Playwright yang tersedia dari ZIP serta Chromium Linux yang dipasang untuk pengujian. Ketepatan akademik setiap jawaban dari 26.644 soal tidak disertifikasi; isi akademik tidak direvisi.

Baseline proposal: satu manifest berubah dari baseline lama + 320 file bank baru; 916 bank lama cocok. Selisih terhadap manifest historis dist: 1.294 referensi lama tidak tercantum, 3 entri baru, 1 metadata entri berubah. Ini perubahan pada upload pengguna; revisi ini tidak menghapus atau memulihkan bank historis. Pemilik telah mengesahkan scope 1.236 bank/26.644 soal dan seluruh 321 perubahan baseline.

Bukti current ada dalam reports/candidate-* dan CANDIDATE_QUALITY_GATE.json; VALIDATION_CONTEXT.json menjelaskan otorisasinya. Laporan lama ditandai historical. RELEASE_MANIFEST.json memuat hash aset runtime; CHECKSUMS.sha256 memuat checksum paket dan dokumen unduhan.

Persetujuan pemilik: 2026-10-11; proposal `566f65f89f4ffd2fe467b0242c8d1c627aef09d3a4a0e736a092b39e65597b10`. Persetujuan ini mencakup baseline/scope; deployment belum dilakukan.
