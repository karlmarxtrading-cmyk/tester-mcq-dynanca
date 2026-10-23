> Historical supporting document. Current recovery status and evidence are in IMPLEMENTATION_REPORT.md, TEST_REPORT.md and CURRICULUM_UPDATE_GUIDE.md. This document alone does not certify the current release.

# FINAL_AUDIT_REPORT — DYNANCA REAL MCQ

Audit dan perbaikan terhadap **REAL MCQ(1).zip** serta laporan masukan **REAL_MCQ_AUDIT_REPORT.md**, tanggal **8 Oktober 2026**. Paket sumber dipertahankan terpisah; paket hasil bernama **DYNANCA_REAL_MCQ_FIXED.zip**.

## 1. Hasil rilis

Integrasi ML, baseline proteksi, hint terkonfirmasi, redaksi/notasi numerik, renderer, preview URL, kontras terukur dan dokumentasi telah diperbaiki. **157 tes Node dan 120 tes browser Chromium lulus**. Build dan validasi shipped lulus. **Validasi penuh gagal hanya karena 1.761 bank pending**, sesuai kondisi sumber; tidak ada soal pending yang dibuat, dihapus atau diganti placeholder.

Sumber katalog tetap **`master-manifest.json`**. Hasil akhir: **2.527 bank / 38.015 soal terdaftar**, **766 bank / 20.405 soal tersedia**. ML ditemukan lewat pencarian, tampil sebagai **Machine Learning Fundamentals**, dan dibuka melalui ID manifest **`ml`**. ID/path dan isi 100 soal ML tetap.

| Koleksi | Bank terdaftar | Bank tersedia | Soal tersedia | Pending |
|---|---:|---:|---:|---:|
| Mathematics | 40 | 40 | 8.575 | 0 |
| Quiz | 115 | 115 | 4.900 | 0 |
| Math gaokao | 459 | 459 | 4.730 | 0 |
| Comprehensive math | 1.911 | 150 | 1.500 | 1.761 |
| Computer science | 2 | 2 | 700 | 0 |
| **Total** | **2.527** | **766** | **20.405** | **1.761** |

## 2. Inventarisasi dan perlindungan sumber

Arsip asli berukuran **9.952.820 byte**, memuat **997 entri ZIP**, **937 file reguler**, total file tidak terkompresi **46.946.565 byte**. SHA-256 asli:

```text
946552f1d8121bb108c1826ed26a878d7f76b52b2a853326014d1f0419cdc97e
```

SHA-256 semua 937 file dicatat **sebelum modifikasi** di [`audit/SOURCE_SHA256.json`](audit/SOURCE_SHA256.json). Salinan asli dan checkpoint fase disimpan terpisah di workspace; seluruh hash sumber diperiksa ulang sesudah perbaikan dan harus tetap sama. Semua path file sumber tetap disertakan dalam proyek final; artefak build/test hanya ditambahkan.

Inventaris awal: **789 JSON**, **98 JavaScript**, **4 CSS**, **3 HTML**, **8 Markdown**, **6 PNG**, **23 WOFF**, satu YAML CI, satu CSV, satu XLSX dan tiga file konfigurasi tanpa ekstensi. Root/subfolder dipelajari: manifest/metadata, `schemas/`, 766 file `questions/`, practice engine/state/loader/renderers, catalog/theme/reset/storage, 106 file vendor MathJax, tool generator/integritas/CSP/validator/server, browser/Node tests, `_headers`, CI dan dokumentasi.

CSV memiliki **130 baris legacy**; XLSX ZIP/CRC valid (10 bagian). Keduanya dan keenam aset PNG dipertahankan byte-identik, tidak dipakai mengganti manifest. Dua schema, traversal manifest, engine/state/reset, stylesheet practice dan 106 file MathJax juga tetap identik dengan sumber. Tidak ada perubahan branding besar, backend, framework, struktur penyimpanan atau key progres.

## 3. Temuan, akar penyebab, solusi dan verifikasi

Severity **HIGH** berarti penghalang integrasi/proteksi atau risiko injeksi/validitas jawaban; **MEDIUM** berarti kualitas pendidikan/rendering/aksesibilitas yang terkonfirmasi; **LOW** berarti drift dokumentasi/tooling. Prioritas tidak menyiratkan exploit sudah terjadi pada data shipped.

| ID / severity | Lokasi dan gejala | Akar penyebab | Perbaikan | Verifikasi nyata |
|---|---|---|---|---|
| F01 **HIGH** | `assets/data/bank-index.json`: 2.526 listed / 765 tersedia / 20.305 soal; ML 100 soal tidak tampil | ML telah ada di manifest/files tetapi indeks turunan belum dibangun ulang | Jalankan **`npm run build:index`**, tanpa edit indeks manual; hasil 2.527 / 766 / 20.405 | `verify:index`, regresi semua bank dan pencarian/link ML; E2E empat lebar dua tema |
| F02 **HIGH** | `tools/integrity/protected-baseline.json`: manifest hash lama dan ML belum dilindungi | Baseline mendahului penambahan ML yang sah; `--add-new` tidak menyelaraskan hash lama | Buktikan manifest historis dengan rekonstruksi exact hash; majukan hanya perubahan yang ditinjau, simpan histori; daftar ML melalui `--add-new` | 884 file protected PASS; rekonstruksi hash identik; tabel before/after dan history |
| F03 **HIGH** | `npm test`: awal **138 PASS / 10 FAIL** | Drift manifest/index/proteksi, bukan sepuluh bank rusak | Perbaiki akar F01/F02; reproduksi terisolasi tanpa mengganti tes menjadi **148/0**, lalu tambah regresi ML/hint/renderer | Minimal 148/0; final **157/0** dengan dua pemeriksaan sintaks tool baru dan tujuh kasus regresi tambahan |
| F04 **MEDIUM** | Hint empat ID yang dilaporkan dan kandidat lain | Hint memberi hasil/ekspresi pilihan benar atau langsung menyimpulkan true/false | **57 hint** diperbaiki menjadi arah berpikir; scan 176 kandidat dibaca dalam konteks, 126 dipertahankan | `CONTENT_CHANGES.json`; keputusan kandidat; regresi empat ID; scan seluruh hint |
| F05 **LOW** | `master-manifest.json` dan `questions/computer science/ml.json` | Kedua file masukan memakai judul panjang, belum sesuai judul yang disetujui | Ubah kedua judul menjadi **Machine Learning Fundamentals**, ID/path/100 objek soal sama | Exact ID/path/title regression dan browser card/practice |
| F06 **LOW** | README, QA, handover, changelog, komentar tool/CI | Laporan historis masih ditampilkan sebagai kondisi saat ini | Arsipkan dokumen awal, tulis snapshot terkini dan hasil aktual; bedakan pending/NOT RUN | Dokumen final menunjuk log, counts dan hash saat ini; sumber laporan historis tetap |
| F07 **HIGH**, potensial | `practice/venn-renderer.js`, figure `aria-label` | `setNames` dikonkatenasi dalam atribut HTML tanpa escaping penuh; fixture dapat menutup quote dan menyisipkan markup | Escape seluruh accessible label; tetap mempertahankan escaping konten lain | Reproduksi markup sebelum fix; Node dan Chromium payload negatif; 0 elemen/eksekusi injeksi akhir. CSP aktif memblokir inline handler, bukan alasan membiarkan markup |
| F08 **MEDIUM** | Renderer Venn tiga himpunan | Lingkaran C sampai y=227 melewati universe y=200/viewBox 225; label AB-only/ABC dan nama set overlap | Universe/viewBox tiga-set diperbesar; label AB/nama set diposisikan ulang; highlight outside direkonstruksi analitis; label aksesibel akurat | Visual sebelum/sesudah; seluruh **75** visual × empat lebar, **0** bounds/collision finding |
| F09 **MEDIUM** | `practice/math-visuals.js` bar-chart opsional | Skala bar memakai baseline positif; +10/-10 membuat bar y=329,5 melewati viewBox 300; label negatif bertabrakan | Satu skala endpoint/zero axis dengan area plot 67..242; kategori dipisahkan dari nilai negatif | Node empat kelas data dan browser SVG mixed-sign 320 px; data shipped tidak diubah |
| F10 **MEDIUM** | 26 prompt dan 44 explanation di 13 bank matematika/quiz | Bentuk hasil tidak dispesifikasi saat opsi ekuivalen; pembulatan disebut sebagai `=`; konversi persen/chain remainder dan slash-fraction ambigu | **70 perubahan field**: 4 permintaan bentuk canonical, 17 pembulatan, 5 fraction prompt; 28 `approx`, 10 persen, 6 chain/remainder | Hitung ulang terarah; diff field; solver 518 eligible; semua opsi/key tetap |
| F11 **MEDIUM** | Empat token `assets/css/shell.css` | Practice eyebrow/hint/success/muted dan wrong-feedback terlalu dekat batas kontras | Koreksi nilai light accent/success/danger dan dark muted; desain/engine/CSS practice tetap | Browser teks HTML aktif ML light/dark pada empat lebar; kontrol negatif opacity; wrong-feedback lama 4,43:1 ditinjau |
| F12 **MEDIUM** | `tools/dev-server/serve.js`: `/practice?quiz=ml` | Redirect directory menambahkan slash dari pathname yang kehilangan query | Pertahankan pathname + `/` + search pada 308 | Reproduksi sebelum; E2E `/practice?quiz=ml` membuka ML akhir |
| F13 **MEDIUM**, QA | `tests/browser/support.js` | Helper kontras mengabaikan alpha/opacity; pembulatan bisa meloloskan nilai di bawah ambang; awalnya label disabled ikut diuji sebagai aktif | Composite warna/opasitas termasuk placeholder; bandingkan rasio mentah; inactive dihitung terpisah sesuai standar; kontrol negatif | Chromium 120/0/0, low-opacity active sample gagal sebagaimana seharusnya; inactive exemption diperiksa |
| F14 **LOW** | `.github/workflows/ci.yml` dan tes Computer science lama | Node 20 di workflow lama; ekspektasi hard-coded hanya 1 bank CS | Node 24 kedua job; derive jumlah tersedia dari manifest/index, bukan menghapus tes Algorithms | Lokal Node 24 install/build/tests PASS; live GitHub Actions **NOT RUN** |
| F15 **INFO / PENDING** | `dynanca-151`–`dynanca-1911` | Bank belum ada pada lampiran | Pertahankan 1.761 entri unavailable/pending, tanpa placeholder | Shipped PASS; full validate exit 1 **No other error** |
| F16 **INFO / UNCONFIRMED** | 29 kelompok soal identik lintas bank | Arsip tidak menjelaskan niat pengulangan | Review kunci dan pola overlap; simpan semua 58 kemunculan/ID; keputusan penulis belum dapat dikonfirmasi | `DUPLICATE_REVIEW.md` dan keputusan 29 kelompok; warning tetap jujur |

Laporan input menyebut judul internal ML sudah singkat. Pemeriksaan **file lampiran aktual** menunjukkan title internal dan name manifest sama-sama panjang; hanya dua field judul tersebut yang diselaraskan. Ini koreksi terhadap observasi masukan, bukan perubahan isi soal ML.

Empat hint yang wajib diperbaiki: `questions-mathematics-statistics-statistics-q300`, `questions-mathematics-statistics-statistics-q333`, `math-gaokao-37-q007`, `math-gaokao-134-q006`. Teks lengkap before/after ada di `CHANGELOG_FIXES.md` dan `audit/CONTENT_CHANGES.json`.

## 4. Manifest dan baseline: alasan perubahan dapat diaudit

| Tahap | SHA-256 `master-manifest.json` | Makna |
|---|---|---|
| Baseline historis sebelum ML | `c288e1ba510c920c5bc3998e685732616edd24d637a5f511cee5b0292f141524` | Hash yang tercatat dalam paket awal |
| Manifest yang benar-benar diterima | `0d709f51fcd5f7041ef25d4071cc496ceafa4b30d55997897fd4a953d56fdb49` | Penambahan ML sudah ada, judul panjang |
| Manifest final | `3c4d706a6ad1c792281c9c305ec8cb95c1309b0e153ef3b264d5f06337d38c64` | ML sah dipertahankan; judul disetujui |

Menghapus **hanya blok entri ML** dari manifest diterima, tanpa serialisasi ulang, menghasilkan hash historis **persis sama**. Bukti byte rekonstruksi: `audit/manifest/master-manifest.pre-ML.reconstructed.json`; alasan dan hash: `audit/MANIFEST_REVIEW.json`. Rekonstruksi adalah **artefak bukti**, tidak digunakan sebagai manifest aplikasi.

Baseline historis menyebut arsip `MCQ MATH COMPUTER.zip` (hash `04523a98b51baabe59d6629f2e6403bf03b54cef8d62ce84108de27303666dd9`), bukan hash lampiran terbaru. Histori lama tidak diklaim sebagai audit baru dan tidak ditimpa. Perbaikan ini mencatat source-before, hash baseline lama, hash sesudah dan alasan setiap tahap yang diotorisasi. `--add-new` hanya menambahkan bank baru; tidak dipakai menyembunyikan drift file yang sudah dilindungi.

**33 file protected berubah terhadap paket masuk**: 30 bank (termasuk title ML), manifest dan dua renderer. **884 file** cocok dengan baseline final; tidak ada hash MathJax/schema/engine/state/CSV/XLSX yang diganti. Tabel lengkap 33 before/after: [`CHANGELOG_FIXES.md`](CHANGELOG_FIXES.md), JSON mesin: [`audit/PROTECTED_CHANGES.json`](audit/PROTECTED_CHANGES.json).

## 5. Audit konten dan batas pembuktian

Semua **20.405 soal** melewati validasi struktural. Audit independen menghitung **518 soal eligible** (512 PASS, 6 bentuk hasil ditinjau), memeriksa **5.731 klaim numerik** (5.726 PASS, 5 pernyataan salah disengaja ditinjau), serta meninjau semua **129** pasangan opsi ekuivalen. Guard hash seluruh 134 sinyal cocok, tidak ada kandidat numerik yang tidak diputuskan. Yang tidak sesuai grammar tetap `NOT_PROVEN`.

Seluruh hint discan, 176 kandidat dibaca bersama prompt/opsi/pembahasan, 57 kebocoran terkonfirmasi diperbaiki. General rule/intermediate step/dua alternatif dan kemiripan normalisasi tidak otomatis dianggap bug. Seluruh 100 soal ML ditinjau terarah dengan 19 derivasi eksplisit. Semua 29 kelompok duplikasi ditinjau; niat pedagogis tetap belum dapat dibuktikan. Tidak ada soal dihapus hanya karena duplikasi.

MathJax lokal sebenarnya memproses **47.853 ekspresi unik** yang diambil dari **129.284 kemunculan** pada **215.846 field** di semua soal; **0** error parse/delimiter/CSP/network. Ini membuktikan parser/renderability, tidak seluruh kebenaran formula. Tidak ada review semantik formal satu per satu seluruh 20.405 soal simbolik; kemungkinan cacat semantik di luar grammar/cakupan targeted tetap menjadi keterbatasan yang dinyatakan.

## 6. Aplikasi, keamanan dan kompatibilitas

E2E sungguhan dengan CSP aktif mencakup katalog/search/filter/pagination/URL/history, unavailable/empty/error/retry, deep link, ML 100 soal, scoring, Next/Previous, review, progres reload/legacy migration/reset terisolasi, serta light/dark/keyboard/ARIA/reflow di empat ukuran minimum. Kunci penyimpanan dan sumber engine/state/reset tetap; **ID, teks opsi dan key 20.405 soal tetap persis sama**. 110 objek soal berubah hanya field yang direview.

Audit injeksi membaca sink HTML dan menguji payload markup pada manifest, teks soal/hint/pembahasan/opsi, Venn, chart, dan return query. Kerentanan atribut Venn diperbaiki walaupun handler inline diblokir CSP. Scan shipped content tidak menemukan perintah link/style HTML MathJax atau skema URL berbahaya yang dicari. Tidak ada third-party request pada alur browser; 106 vendor MathJax dan dua CSP inline hashes tidak diubah. `style-src` runtime MathJax tetap sebagaimana sumber.

HTTP 404 dan kegagalan network diperiksa lokal; directory query diperbaiki. Preview mempunyai gzip cache berbasis mtime; **bukan emulator cache CDN Cloudflare**. Tidak ada service worker/offline queue baru. `npm audit --json` actual melaporkan **0 kerentanan** pada dependency graph dev terkunci. Temuan ini bukan jaminan keamanan absolut atau audit platform Cloudflare.

Bukti visual memuat 45 screenshot katalog/QA dan screenshot tambahan ML/chart. 37 audit layout dan 8 keadaan kontras katalog tidak memiliki temuan gagal. Kontras praktik diuji pada teks HTML aktif dengan alpha/opasitas efektif; ini tidak mengesahkan seluruh SVG, semua kombinasi visual atau screen reader. Diagram Venn seluruhnya diuji bounds/overlap; tiga-set diperbaiki setelah inspeksi gambar, tanpa mengubah nilai visual atau region data.

CI lokal konsisten dengan generator dan protection gate; Node workflow diselaraskan ke 24. Tidak ada deployment Cloudflare atau live GitHub Actions dilakukan. Cache CDN, redirects host, HTTPS/HSTS, Firefox/WebKit/perangkat fisik, screen reader manusia dan sertifikasi WCAG menyeluruh adalah **NOT RUN**, dengan alasan rinci di `TEST_RESULTS.md`. Full validation masih **FAIL karena pending saja**; tidak disebut sebagai PASS penuh.

## 7. Bukti dan hasil yang diserahkan

| Artefak | Isi |
|---|---|
| `DYNANCA_REAL_MCQ_FIXED.zip` | Seluruh sumber proyek dalam root `DYNANCA_REAL_MCQ/`, laporan, diff, log dan screenshot; tanpa dependency terpasang/cache sementara |
| `FINAL_AUDIT_REPORT.md` | Temuan, severity, akar penyebab, solusi, bukti dan batas cakupan |
| `CHANGELOG_FIXES.md` | Semua perubahan, 33 hash protected before/after, daftar perubahan konten dan rujukan diff |
| `TEST_RESULTS.md` | Exit code/time/log aktual; initial 138/10, minimal 148/0, final 157/0 + browser 120/0/0; pending/NOT RUN |
| `SHA256SUMS.txt` | Hash ZIP final dan tiga laporan terpisah |
| `audit/SOURCE_CHANGES.patch` | Unified diff seluruh file sumber yang berubah serta tambahan kode/docs utama |
| `audit/FILE_DIFF.json` | Status/hash seluruh 937 file sumber dan semua file tambahan paket; tidak ada penghapusan sumber |
| `audit/PACKAGING_VERIFICATION.json` | Pemeriksaan isi paket, CRC draft, seluruh source path dan protected hash |
| `audit/logs/` | Log awal, minimal, tahap antara dan final tanpa mengganti kegagalan dengan klaim PASS |
| `audit/*REVIEW*.json`, `audit/SEMANTIC_REVIEW.md` | Keputusan konten dengan before/after, guard dan batas pembuktian |
| `audit/browser-evidence/`, `audit/screenshots/`, `audit/geometry/` | Bukti Chromium, visual dan perbaikan geometri |

Arsip asli terpisah dan tidak dimasukkan kembali ke ZIP final. Node modules, instalasi browser, `test-results/`, cache Python dan output QA sementara di luar bukti audit tidak dipaketkan; `package.json` dan lockfile tersedia untuk instalasi ulang. Dokumen historis disimpan dalam `docs/archive/`, bukan dijadikan laporan kondisi final.

Checkpoint file, hash dan log dibuat pada setiap fase. Pemeriksaan akhir paket dan hash tidak mengubah bank atau runtime yang telah dites. Semua cacat terkonfirmasi dalam cakupan telah diperbaiki; isi 1.761 bank pending dan pembuktian semantik di luar cakupan tidak diklaim selesai.
