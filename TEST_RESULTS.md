> Historical supporting document. Current recovery status and evidence are in IMPLEMENTATION_REPORT.md, TEST_REPORT.md and CURRICULUM_UPDATE_GUIDE.md. This document alone does not certify the current release.

# TEST_RESULTS — DYNANCA REAL MCQ

Tanggal pelaksanaan: **8 Oktober 2026 (UTC)**. Laporan ini berasal dari output perintah dan Chromium yang benar-benar dijalankan, bukan estimasi. Bukti perintah, waktu, durasi dan exit code: [`audit/logs/final/results.json`](audit/logs/final/results.json).

## 1. Ringkasan hasil

**157 tes Node dan 120 tes browser lulus, 0 kegagalan akhir.** Validasi katalog penuh exit **1**, hanya karena **1.761 bank yang belum disertakan**. Validasi shipped dan build exit **0**. Soal pending tidak dibuatkan placeholder dan tidak dihapus dari manifest.

| Koleksi | Bank terdaftar | Bank tersedia | Soal tersedia | Pending |
|---|---:|---:|---:|---:|
| Mathematics | 40 | 40 | 8.575 | 0 |
| Quiz | 115 | 115 | 4.900 | 0 |
| Math gaokao | 459 | 459 | 4.730 | 0 |
| Comprehensive math | 1.911 | 150 | 1.500 | 1.761 |
| Computer science | 2 | 2 | 700 | 0 |
| **Total** | **2.527** | **766** | **20.405** | **1.761** |

Manifest memuat **38.015 soal terdaftar**; angka tersebut berbeda dari **20.405 soal yang benar-benar tersedia**. ML memiliki 100 soal, ID manifest `ml`, path `questions/computer science/ml.json`, judul `Machine Learning Fundamentals`.

## 2. Lingkungan aktual

- Linux; Node.js **24.19.0**, npm **11.9.0**.
- Dependency dari lockfile: Playwright **1.56.0**. `npm ci --ignore-scripts` berhasil; percobaan instalasi offline sebelumnya gagal `ENOTCACHED` dan tidak dipakai sebagai bukti PASS. `package.json` dan lockfile tetap identik dengan sumber.
- Chromium **141.0.7390.37**, Playwright build **1194**, browser sungguhan dalam mode headless.
- Preview memakai `tools/dev-server/serve.js` dan header proyek `_headers`; **CSP aktif**, tidak memakai `bypassCSP`, retries **0**. Empat worker. Hasil terstruktur: [`browser.json`](audit/logs/final/browser.json).
- Resolusi minimum yang diminta: **320, 390, 768 dan 1280 CSS px**. ML diuji dalam tema terang dan gelap di setiap ukuran.

## 3. Reproduksi sebelum perbaikan

| Tahap | Perintah | Exit | PASS / FAIL | Bukti |
|---|---|---:|---|---|
| Paket awal | `npm run verify:protected` | 1 | Manifest berbeda dari hash historis | [log awal](audit/logs/initial/verify-protected.log) |
| Paket awal | `npm run verify:index` | 1 | Indeks basi; ML tidak terindeks | [log awal](audit/logs/initial/verify-index.log) |
| Paket awal | `npm run validate:shipped` | 0 | Shipped valid, pending tetap ada | [log awal](audit/logs/initial/validate-shipped.log) |
| Paket awal | `npm test` | 1 | **138 / 10** | [log awal](audit/logs/initial/test.log) |
| Reproduksi perbaikan minimal | `npm test` | 0 | **148 / 0** | [log minimal](audit/logs/minimal-reproduction/test.log) |
| Reproduksi perbaikan minimal | `npm run build` | 0 | Build berhasil | [log minimal](audit/logs/minimal-reproduction/build.log) |
| Paket akhir dengan regresi tambahan | `npm test` | 0 | **157 / 0** | [log final](audit/logs/final/test.log) |

Reproduksi **148/0** dilakukan pada salinan paket awal: hanya memajukan hash manifest setelah review, mendaftarkan ML dengan `--add-new`, dan menjalankan **generator resmi** `npm run build:index`. Tidak ada perubahan soal atau ekspektasi tes pada salinan minimal. Catatan: [`minimal-reproduction/results.json`](audit/logs/minimal-reproduction/results.json).

## 4. Semua perintah final dan exit code

| Perintah aktual | Mulai (UTC, 2026-10-08) | Durasi (detik) | Exit | Hasil | Log |
|---|---|---:|---:|---|---|
| `npm run verify:protected` | 11:30:00 | 0.28 | 0 | PASS: 884 file cocok dengan baseline yang telah ditinjau. | [`verify-protected.log`](audit/logs/final/verify-protected.log) |
| `npm run verify:mathjax` | 11:30:00 | 0.26 | 0 | PASS: 106 file vendor identik dengan sumber. | [`verify-mathjax.log`](audit/logs/final/verify-mathjax.log) |
| `npm run verify:csp` | 11:30:00 | 0.2 | 0 | PASS: 2 hash inline script tepat, tanpa hash usang. | [`verify-csp.log`](audit/logs/final/verify-csp.log) |
| `npm run verify:index` | 11:30:01 | 0.32 | 0 | PASS: 2.527 terdaftar, 766 tersedia, 20.405 soal tersedia; ml=100. | [`verify-index.log`](audit/logs/final/verify-index.log) |
| `npm run validate:shipped` | 11:30:01 | 0.61 | 0 | PASS WITH PENDING: 766 bank / 20.405 soal valid; 1.761 pending; 29 duplikasi sebagai warning. | [`validate-shipped.log`](audit/logs/final/validate-shipped.log) |
| `npm test` | 11:37:45 | 6.33 | 0 | PASS: 157 PASS / 0 FAIL; suite Node tidak memakai mekanisme SKIP. | [`test.log`](audit/logs/final/test.log) |
| `npm run build` | 11:30:08 | 1.71 | 0 | PASS: generator resmi dan seluruh pemeriksaan integritas/shipped selesai. | [`build.log`](audit/logs/final/build.log) |
| `npm run test:browser -- --reporter=list,json` | 11:37:51 | 28.88 | 0 | PASS: 120 PASS / 0 FAIL / 0 SKIP / 0 flaky; 0 error global. | [`browser.log`](audit/logs/final/browser.log) |
| `npm run validate` | 11:30:40 | 0.53 | 1 | FAIL EXPECTED: hanya 1.761 bank pending; tidak ada error lain. | [`validate.log`](audit/logs/final/validate.log) |
| `python3 tools/qa/audit-content.py` | 11:30:40 | 3.36 | 0 | PASS struktural: seluruh 20.405 soal; sinyal semantik telah ditinjau secara terarah. | [`audit-content.log`](audit/logs/final/audit-content.log) |
| `node tools/qa/audit-mathjax.js` | 11:30:43 | 30.27 | 0 | PASS: 47.853 ekspresi unik, 0 kesalahan parse/delimiter/CSP/network. | [`audit-mathjax-content.log`](audit/logs/final/audit-mathjax-content.log) |
| `npm audit --json` | 11:31:14 | 11.74 | 0 | PASS: 0 kerentanan dilaporkan pada dependency graph terkunci. | [`npm-audit.log`](audit/logs/final/npm-audit.log) |
| `npm run qa:evidence -- --out audit/browser-evidence` | 11:31:25 | 45.76 | 0 | PASS: 45 screenshot, 37 audit layout, 8 keadaan kontras, 0 error console/CSP. | [`browser-evidence.log`](audit/logs/final/browser-evidence.log) |

Perintah browser diberi `--reporter=list,json` hanya untuk menyimpan output terstruktur; **tidak ada filter, skip, atau retry**. Sembilan perintah wajib semuanya dijalankan. Empat baris tambahan menyediakan audit seluruh konten, MathJax, dependency dan bukti visual.

Rerun akhir pada 11:37–11:38 UTC hanya mengulang Node dan seluruh suite browser setelah helper QA memakai rasio kontras **tanpa pembulatan sebelum perbandingan**. Tidak ada perubahan aplikasi, data atau baseline sesudah rangkaian build/integritas 11:30 UTC. Perubahan dokumen sesudahnya tidak mengubah executable aplikasi atau bank soal.

Log kegagalan selama pengerjaan tetap disertakan. Percobaan final pertama menghasilkan **118 PASS / 2 FAIL** pada sampling label kontrol loading yang benar-benar disabled. Helper diperbaiki agar mengikuti pengecualian kontrol inactive, tetap menguji teks aktif, opacity/alpha dan placeholder, serta ditambah kontrol negatif. Ini bukan penghapusan tes: suite akhir berisi **120 tes, 0 SKIP**. Lihat [`final-attempt1/`](audit/logs/final-attempt1/) dan [`final-before-precise-contrast/`](audit/logs/final-before-precise-contrast/). Log geometri Venn dan solver di tahap antara juga dipertahankan.

## 5. Cakupan konten otomatis dan semantik

| Pemeriksaan | Cakupan aktual | Hasil / batas |
|---|---|---|
| JSON aplikasi dan metadata | 789 JSON sumber/aplikasi; parsing seluruhnya | 0 syntax error; JSON bukti audit dipisahkan dari hitungan aplikasi |
| Struktur bank/soal | 766 bank, **20.405 soal** | Count, ID global, opsi/label, key valid, teks wajib, path/manifest dan visual diperiksa; 0 error struktural |
| Kompatibilitas sumber | Seluruh **20.405** objek soal dibandingkan | ID, opsi lengkap dan key sama; 110 objek berubah hanya hint/prompt/explanation |
| Solver independen | **518** soal yang sesuai grammar aritmetika/Boolean | **512 PASS**, **6 REVIEW_FORM**; bentuk hasil diperiksa secara kontekstual. Sisanya `NOT_PROVEN`, bukan PASS semantik |
| Rantai kesamaan numerik | **5.731** klaim yang dapat diparse | **5.726 PASS**, **5 REVIEW**; kelimanya memang pernyataan salah/kontradiksi dalam konteks soal |
| Opsi ekuivalen | **129 pasangan** pada 82 soal | Semua ditinjau; 47 pasangan distraktor, 30 tugas representasi, 25 bentuk canonical, 21 interval, 6 ukuran matriks |
| Hint | Scan semua 20.405 hint; **176 kandidat / 64 teks berbeda** | 50 kandidat direvisi, 126 dipertahankan berdasarkan konteks; 7 perbaikan tambahan; **57 hint diperbaiki** |
| ML semantik | **100** soal ditinjau terarah | **19** contoh mempunyai derivasi numerik/aljabar eksplisit; tidak ditemukan cacat terkonfirmasi; isi soal ML tidak diubah |
| Duplikasi lintas bank | **29 kelompok / 58 kemunculan** | Kunci diperiksa terarah; 29 kemunculan ekstra dan semua ID dipertahankan; niat penulis **UNCONFIRMED** |
| MathJax nyata | **215.846 field**, **129.284 kemunculan**, **47.853 ekspresi unik** | Bundled MathJax di Chromium dengan CSP; **0** delimiter/parse/CSP/network error. Renderability bukan kebenaran matematika |
| Visual Venn | Seluruh **75 visual** pada empat lebar | 0 lingkaran keluar universe, label bertabrakan, atau teks keluar viewBox dalam pengukuran akhir |

134 sinyal numerik (129 pasangan + 5 klaim) memiliki keputusan dan guard hash soal yang cocok; **0 unreviewed / 0 stale guards**. Bukti: `CONTENT_AUDIT.json`, `QUESTION_COVERAGE.json`, `NUMERIC_SOLVER_RESULTS.json`, `NUMERIC_CLAIM_RESULTS.json`, `NUMERIC_REVIEW_DECISIONS.json`, `REVIEW_RESOLUTION.json`, `ML_CONTENT_REVIEW.json` dan `SEMANTIC_REVIEW.md` di `audit/`.

Solver memakai AST whitelist yang terbatas, bukan `eval`; bentuk simbolik, asumsi geometris, pembuktian, distribusi, dan bahasa alami yang tidak didukung tetap **NOT_PROVEN**. Review targeted tidak merupakan sertifikasi seluruh 20.405 kunci. Scan hint tidak membuktikan ketiadaan semua kebocoran parafrase.

## 6. Browser, keamanan, layout dan progres

Suite lama tetap dijalankan; tambahan ML/security/visual sebanyak 14 tes menghasilkan total **120 PASS / 0 FAIL / 0 SKIP / 0 flaky**. Cakupan aktual meliputi:

- Pencarian ML melalui ID/judul, filter Computer science, card berjudul benar, tautan ID `quiz=ml`, soal dan MathJax terload.
- Scoring benar/salah, hint, Next/Previous, review kesalahan, reload dan resume, kembali ke katalog, reset ML yang menjaga record bank lain/tema. Semua **100 soal ML** diselesaikan sekali tanpa loop; tes ini memakai key bank untuk menguji UI, bukan membuktikan semantik.
- Katalog search/filter/topic/pagination, Back/Forward, query URL, empty/loading/error, pending tanpa link, fixture manifest/index rusak, timeout/retry dan respons terlambat.
- Path/URL tidak aman, hostile return query, markup manifest/question/option/hint/explanation, label Venn yang mencoba menutup atribut, dan title/caption chart. Fixture berbahaya tetap ditampilkan sebagai teks; tidak ada eksekusi/elemen injeksi di hasil final.
- Deep link lama, `/practice?quiz=ml` yang dinormalisasi tanpa kehilangan query, HTTP 404 untuk URL/bank hilang, origin MathJax lokal dan CSP nyata.
- Storage denied/corrupt, migrasi record lama, reset terisolasi, keyboard-only search/filter/open/back, Tab/focus, state ARIA, reduced motion, pembesaran 200%, tema light/dark/system.
- Bar chart mixed-sign sintetis serta tes Node untuk data positif, campuran, seluruh negatif dan nol. Bank shipped saat ini hanya memakai visual Venn; fixture chart bukan soal baru.

`qa:evidence` menyimpan **45 screenshot**, **37** audit layout tanpa temuan, **8** keadaan kontras katalog tanpa pasangan gagal, dan **0** page error/CSP error. Minimum teks normal katalog yang tersampling: light **5,82:1**, dark **6,79:1**; batas kontrol minimum light **3,90:1**, dark **4,68:1**. Helper menghitung warna alpha/opacity efektif dan membandingkan rasio tidak dibulatkan. Kontrol inactive dilaporkan terpisah. Pengukuran teks HTML aktif/keadaan yang diuji ini **bukan sertifikasi WCAG menyeluruh**, tidak mencakup seluruh piksel SVG atau inspeksi pembaca layar manusia. Delapan screenshot ML dan fixture bar tambahan ada di `audit/screenshots/`.

Visual QA terarah membaca screenshot ML light 320/dark 1280, penjelasan MathJax 390, Venn sebelum/sesudah, dan bar chart 320. Formula panjang dapat bergulir horizontal **di dalam** wadah matematika; tidak seluruhnya dipaksa muat pada 320 px. Pengukuran semua 75 Venn mencakup posisi/batas/overlap, bukan jaminan semua ukuran huruf diagram memenuhi kebutuhan setiap pengguna.

Performa **lab lokal, landing saja**, bukan Core Web Vitals produksi: mobile 390 px, CPU 4x, 1,6 Mbps/RTT 150 ms: catalog-ready **1.454 ms**, FCP/LCP **480 ms**, CLS **0,017**; desktop 1280 px: catalog-ready **78 ms**, FCP/LCP **44 ms**, CLS **0,003**. Ini satu sesi pengukuran, bukan distribusi performa lapangan atau pengukuran ulang seluruh practice CLS.

## 7. NOT RUN dan pending yang transparan

| Area | Status | Alasan / cakupan yang tersedia |
|---|---|---|
| `dynanca-151`–`dynanca-1911` | **PENDING / NOT RUN isi** | 1.761 bank tidak ada di ZIP; dipertahankan di manifest dengan status unavailable |
| Deployment Cloudflare live, cache CDN/purge/Brotli, redirect host, HTTPS/HSTS | **NOT RUN** | Tidak ada deployment/domain target yang diberikan; konfigurasi dan preview lokal diperiksa, bukan perilaku CDN produksi |
| GitHub Actions pada repository remote | **NOT RUN** | Tidak ada repository workflow remote yang dieksekusi; perintah quality gate berjalan lokal pada Node 24 |
| Firefox, WebKit, Safari/iOS/Android fisik | **NOT RUN** | Paket/suite dikonfigurasi Chromium; responsive diuji dengan viewport Chromium, bukan perangkat fisik |
| NVDA/VoiceOver/JAWS dan audit manual menyeluruh WCAG | **NOT RUN** | Keyboard/ARIA/layout/HTML contrast otomatis tersedia; sesi pembaca layar manusia tidak tersedia |
| Pembuktian semantik seluruh 20.405 soal | **NOT PROVEN** | Grammar solver terbatas; review tambahan fokus pada kandidat, ML, dan 29 duplikasi |
| Persetujuan pedagogis 29 duplikasi | **UNCONFIRMED** | Arsip tidak mengandung keputusan penulis; tidak dihapus atau diasumsikan disengaja |

Tidak ada tes browser yang ditandai PASS karena terhalang lingkungan. Semua 120 tes Chromium dijalankan. `npm audit` melaporkan 0 kerentanan pada graph dependency dev yang terpasang pada tanggal audit; hal ini tidak membuktikan aplikasi bebas seluruh risiko keamanan.

## 8. Cara mengulang dan sumber standar

Jalankan dari folder proyek hasil ekstraksi:

```sh
npm ci
npx playwright install chromium
npm run verify:protected
npm run verify:mathjax
npm run verify:csp
npm run verify:index
npm run validate:shipped
npm test
npm run build
npm run test:browser
npm run validate
python3 tools/qa/audit-content.py
node tools/qa/audit-mathjax.js
npm audit --json
npm run qa:evidence
```

`npm run validate` diharapkan exit 1 sampai konten pending benar-benar tersedia. `--add-new` tidak memutakhirkan hash file yang telah dilindungi. Jangan menjalankan generator CSV legacy untuk mengganti manifest JSON.

Referensi primer yang digunakan untuk perubahan runtime dan metode QA: [Node.js Release schedule](https://github.com/nodejs/Release) dan [W3C Understanding SC 1.4.3](https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html), diperiksa 2026-10-08. Standar dipakai sebagai dasar keputusan; hasil PASS dalam laporan berasal dari log proyek aktual.
