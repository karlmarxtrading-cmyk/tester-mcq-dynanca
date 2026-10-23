# Ringkasan perubahan — landing & alur menuju latihan

Arsitektur tetap: file statis, HTML/CSS/JavaScript vanilla, tanpa login, backend,
framework, CDN, telemetry, service worker, atau halaman harga. Bukti pengujian ada di
`QA_REPORT_CURRENT.md`; penambahan konten di `CONTENT_INTEGRATION_HANDOVER.md`.

## 0. Pembaruan 2026-10-08 — sinkronisasi setelah revisi manifest

Revisi manifest pemilik (5 koleksi; bank Dynanca pindah ke `questions/comprehensive math/`;
koleksi baru `computer science` dengan `algorithms`, 600 soal; `math-gaokao-71` kini 150)
belum diikuti oleh artefak turunannya. Yang diperbaiki — tanpa mengubah satu pun soal,
jawaban, penjelasan, path, atau ID:

| Masalah | Akar masalah | Perbaikan |
|---|---|---|
| Algorithms tidak tampil di katalog | `assets/data/bank-index.json` masih snapshot lama (2525/764) | dibangun ulang dengan `npm run build:index` (2526/765) |
| `verify:protected` gagal (150 hilang, manifest berubah) | baseline masih memakai `questions/dynanca/…` dan hash manifest lama | 150 kunci dipindah ke `questions/comprehensive math/…` setelah dibuktikan hash-nya identik; hash manifest dicatat ulang; `algorithms.json` ditambahkan dengan `--add-new`; dicatat di array `history` baseline |
| `validate:shipped` gagal | pengecualian `math-gaokao-71` (10 vs 150) sudah tidak benar | entri itu dihapus dari `accepted-exceptions.json` |
| 13 tes Node + 5 tes browser gagal | ekspektasi snapshot lama (hash, 4 koleksi, kunci `dynanca`, 10 vs 150, label jamak "1 banks") | diperbarui ke keadaan sekarang; ditambah tes Computer science (Node + browser end-to-end) dan tes "setiap file bank terlindungi" |
| Indeks basi bisa ter-deploy lagi | deploy tidak menjalankan `build:index` | skrip baru `npm run build` (perintah build Cloudflare Pages) + langkah CI `npm run build` sebelum `git diff --exit-code` |
| Line ending file terlindungi bisa diubah git | `master-manifest.csv` CRLF; tanpa `.gitattributes` | `.gitattributes` baru (`-text` untuk file terlindungi) |

`master-manifest.csv` dan `math-mcq-manifest.xlsx` sengaja **tidak** disinkronkan: keduanya
ekspor lama (130 baris) yang terlindungi byte-per-byte, sumber kebenaran adalah
`master-manifest.json`, dan generator lama menolak menulis manifest JSON.

Bagian 1 dan seterusnya di bawah menjelaskan pekerjaan landing sebelumnya pada snapshot lama.

## 1. Yang TIDAK berubah (identik byte-per-byte, 895 dari 914 file asli)

`master-manifest.json`, 764 bank di `questions/**`, `schemas/**`,
`assets/js/manifest.js`, `practice/practice-engine.js`, `practice-state.js`,
`venn-renderer.js`, `math-visuals.js`, `practices.css`, 106 file
`assets/vendor/mathjax/**`, `assets/css/shell.css` (token `--dmc-*`),
`assets/js/reset-progress.js`, `master-manifest.csv`, `math-mcq-manifest.xlsx`,
semua gambar termasuk logo. Konfigurasi MathJax di `practice/index.html` tidak disentuh.

## 2. File baru

| File | Tujuan |
|---|---|
| `assets/css/catalog.css` | Gaya landing; scope `.catalog-page`, token `--catalog-*`, tema terang/gelap, semua state |
| `assets/js/theme.js` | Modul tema mandiri (light/dark/system) untuk landing **dan** practice; key lama `dynanca-mfc-theme-mode`; tidak bergantung engine |
| `assets/js/catalog-model.js` | View model read-only: traversal lewat `DynancaManifest`, search, filter, URL state, paginasi, ringkasan progres (baca saja). Dipakai browser dan tes Node |
| `assets/js/catalog.js` | Pengendali DOM landing: 2 fetch, loading/timeout/retry/empty, render 24 card, riwayat browser |
| `assets/data/bank-index.json` | Indeks ketersediaan turunan (ID manifest → jumlah soal terverifikasi) |
| `tools/bank-index/build-bank-index.js` | Skrip build read-only untuk indeks (`npm run build:index`, `--check`) |
| `assets/css/practice-status.css` | Gaya tautan balik + panel status halaman practice; hanya membaca token `--dmc-*` |
| `404.html` | Halaman 404 bermerek; juga membuat Cloudflare Pages mengembalikan 404 nyata untuk file yang tidak ada |
| `tools/integrity/verify-protected.js`, `protected-baseline.json` | Pemeriksaan SHA-256 file dilindungi terhadap arsip asli |
| `tools/ecosystem-validator/accepted-exceptions.json` | Pengecualian `math-gaokao-71` (10 vs 150) yang Anda terima |
| `tools/dev-server/serve.js` | Server preview yang mengirim header `_headers` (CSP nyata), gzip, 404 |
| `tools/qa/capture-evidence.js` | Screenshot + audit layout/kontras/performa lab |
| `tests/browser/support.js`, `landing.spec.js`, `practice.spec.js`, `layout-a11y.spec.js` | 104 tes browser |
| `QA_REPORT_CURRENT.md`, `CONTENT_INTEGRATION_HANDOVER.md`, `CHANGE_SUMMARY.md`, `.gitignore` | Dokumentasi |

## 3. File yang diubah

| File | Perubahan | Batas yang dijaga |
|---|---|---|
| `index.html` | Ditulis ulang: header berlogo, hero, "How it works", koleksi, katalog (search/filter/paginasi), footer, `<noscript>`; tanpa script/style inline | — |
| `practice/index.html` | + `theme.js` dan `practice-status.css` di `<head>`; + tautan "← Practice catalog"; + `<noscript>` | Dua blok inline script (MathJax config, practice id) identik → hash CSP sama |
| `practice/data-loader.js` | Lapisan status: 8 keadaan gagal dengan judul, tautan kembali, "Try again" bila layak; tenggat fetch 30 dtk; tautan balik ke tampilan katalog terakhir | Resolver ID (`findPracticeFile` dengan ID persis), aturan path aman, syarat `questions` tidak kosong, dan blok sukses tidak berubah |
| `assets/js/shell.js` | Tema dipindah ke `theme.js`; boot dipisah: shell (tema + ukuran header) selalu jalan, engine hanya setelah data siap | Progres, review, event engine tidak berubah |
| `_headers` | Hash script inline landing dihapus (kini 2 hash); komentar diperbarui | `style-src 'self' 'unsafe-inline'` tanpa hash (MathJax); tidak ada pelonggaran |
| `tools/ecosystem-validator/validate-ecosystem.js` | JSON = kontrak (tanpa regenerasi dari CSV); file hilang = PENDING; pengecualian diterima; `--allow-pending`; exit tanpa memotong output | Semua pemeriksaan isi bank tetap |
| `tools/manifest-generator/generate-manifest.js` | CLI **menolak** menulis `master-manifest.json` | `generate()` tetap untuk tes fixture |
| `tools/csp/*.js` | Ikut memeriksa `404.html`; gagal bila ada hash usang | — |
| `tools/tests/run-tests.js` | Fixture lama dicari lewat manifest; 5 bagian baru (§19–23) | Lihat tabel semantik di QA report |
| `.github/workflows/ci.yml` | Langkah mutasi manifest dihapus; diganti pemeriksaan read-only + job "content-completeness" informatif | — |
| `package.json` | Skrip baru; `generate-manifest` dihapus | — |
| `tests/browser/playwright.config.js` | Pola `*.spec.js`; `reducedMotion` lewat `contextOptions` (sebagai key `use` biasa ia diabaikan) | — |
| `README.md` | Ditulis ulang sesuai kontrak final | — |

Dipindah: `AUDIT_REPORT.md`, `PRODUCTION_HARDENING_REPORT.md`, `QA_REPORT.md`,
`REVISION_REPORT.md` → `docs/archive/` dengan banner "ARCHIVED" (isi tidak diubah).
Diganti: `tests/browser/browser-test.js` → tiga berkas spec.

## 4. Keputusan desain

- **Logo**: PNG yang ada (`assets/img/logo-dynanca.png`, 846×168, transparan) cocok dengan
  referensi dan dipakai apa adanya — tidak diketik ulang, diregangkan, difilter, atau
  dipotong. Tinggi 52 px di desktop, 44 px di mobile (tagline masih terbaca). Pada tema
  gelap logo diletakkan di pelat terang karena wordmark berwarna gelap. Re-kompresi
  lossless hanya menghemat 2%, jadi file tidak diubah.
- **Warna & tipografi**: permukaan netral sejuk + satu aksen biru yang diturunkan dari biru
  wordmark (`#6DA5D2` hanya dekoratif; teks/aksi memakai `#1A5A9E` / `#164A82` agar lulus AA).
  Font sistem (`system-ui` …) dipilih sengaja; tidak ada nama font yang tidak dimuat.
- **Hero ringkas, katalog dekat**: satu judul, satu paragraf, dua aksi, tiga angka dari data,
  dan empat langkah. Tidak ada ilustrasi besar atau animasi. Pada 1280×800 judul katalog
  terlihat di viewport pertama.
- **Copy jujur**: "timed quizzes" dihapus. Tidak ada testimoni, rating, harga, login, AI,
  timer, difficulty, streak, atau janji tanggal rilis. Angka utama adalah yang *bisa dibuka*
  (764 bank / 19.705 soal), bukan total terdaftar.
- **Terdaftar vs tersedia**: default "Available"; "All banks" menampilkan seluruh 2.525
  entri. Bank belum tersedia: garis putus-putus, lencana "Not available in this release",
  **tanpa** elemen `<a>`/tombol. Jumlah soalnya berlabel "listed" (dari manifest), sedangkan
  bank tersedia menampilkan jumlah terverifikasi dari indeks.
- **Topik mengikuti manifest**: kontrol Topic hanya muncul untuk koleksi yang punya topik
  (saat ini Mathematics). Koleksi datar tidak diberi hierarki karangan.
- **Satu anchor per card**: judul adalah tautan; area kliknya direntangkan ke seluruh card
  lewat pseudo-element. Tidak ada tombol di dalam tautan.
- **State di URL** (`?q=&collection=&topic=&show=all&page=`): pengetikan memakai
  `replaceState`, filter/halaman memakai `pushState`. Posisi scroll disimpan di
  `sessionStorage` untuk Back.
- **Paginasi 24 card** (habis dibagi 1/2/3/4 kolom), urutan manifest dipertahankan, tanpa
  opsi urut lain.
- **Continue practice** hanya dari record nyata `dynanca-mcq-<id>-v2` (jumlah jawaban dan
  waktu jawaban terakhir yang memang tersimpan). Tanpa persentase, karena tanpa mengunduh
  bank tidak bisa dipastikan semua record masih milik soal yang ada.
- **Indeks wajib**: bila indeks gagal dimuat, landing menampilkan error + retry, bukan
  menebak ketersediaan.
- **Keadaan gagal** menyembunyikan kontrol yang tidak bisa bekerja dan memakai `role="alert"`
  sebagai satu-satunya pengumuman.
- **Tanpa JavaScript**: pemberitahuan jujur; tautan ke katalog dan kontrol tema disembunyikan.

## 5. Preview, build, deploy

```
npm run preview        # http://127.0.0.1:8788/ — mengirim header dari _headers
npm run build:index    # satu-satunya langkah build; hanya menulis assets/data/bank-index.json
npm run check          # semua pemeriksaan read-only (perlu `npm ci` untuk npm test)
```

Deploy seperti sebelumnya: unggah isi folder ini sebagai file statis ke hosting Cloudflare
yang sama (root ZIP = root situs). Jangan sertakan `node_modules/`, `test-results/`,
`qa-evidence/`. Tidak ada deployment yang saya lakukan.

Periksa pada preview deployment Cloudflare (belum bisa saya uji):
1. header `_headers` terkirim pada `/`, `/practice/`, dan aset;
2. `/practice/index.html?quiz=dynanca-1` (akan di-redirect Cloudflare ke `/practice/?quiz=…`) tetap membuka bank;
3. `/questions/dynanca/dynanca%20-%20151.json` mengembalikan **404** (bergantung pada `404.html` di root; tanpanya Cloudflare Pages menjawab 200 dengan halaman utama). `404.html` memakai path absolut-root, jadi mengasumsikan situs berada di root domain;
4. rumus MathJax tampil dan console bebas pelanggaran CSP.

## 6. Hal yang perlu keputusan Anda (tidak saya ubah)

- Halaman practice: kontras eyebrow (3,99:1) dan tombol "Show hint" (4,21:1), serta CLS
  ≈ 0,48 saat bank dimuat — semuanya sudah ada pada arsip asli dan berada di file
  dilindungi atau token `--dmc-*`.
- `master-manifest.csv` / `.xlsx` adalah ekspor lama; masih disertakan tanpa perubahan.
- `tools/`, `tests/`, `docs/`, dan berkas `.md` ikut ter-deploy bila root proyek dijadikan
  root situs (seperti struktur sebelumnya). Tidak berbahaya, tetapi bisa dikecualikan bila
  Anda mau.
