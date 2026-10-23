# REAL MCQ — Audit Teknis dan Konten (8 Oktober 2026)

## Lingkup dan batasan

Sumber: arsip `REAL MCQ(1).zip`, 997 entri ZIP, proyek statis Dynanca MCQ. Audit dilakukan pada **salinan hasil ekstraksi**, bukan mengubah berkas di dalam ZIP sumber. Memeriksa seluruh 789 file JSON secara sintaks, seluruh 766 bank yang disertakan dengan skrip independen, jalur integrasi manifest–indeks–UI, sebagian kode inti, laporan QA, checksum, suite Node.js, dan diagnosis build. Pemeriksaan matematika/semantik semua 20.405 soal satu per satu **belum** dapat dianggap tuntas; uji browser penuh **tidak** dapat dilakukan karena Chromium yang diluncurkan di lingkungan audit gagal navigasi localhost (`ERR_BLOCKED_BY_ADMINISTRATOR`), walaupun binernya terpasang. Tidak ada klaim bahwa semua bug telah ditemukan.

## Hasil pemeriksaan baseline asli ZIP (sebelum perubahan apa pun)

| Pemeriksaan | Hasil |
|---|---|
| `npm run verify:protected` | **FAIL**: `master-manifest.json` berbeda dari baseline (883 file dilindungi; 1 berubah) |
| `npm run verify:mathjax` | PASS: 106 file vendor |
| `npm run verify:csp` | PASS: 2 hash inline script |
| `npm run verify:index` | **FAIL**: indeks ketersediaan usang |
| `npm run validate:shipped` | PASS WITH PENDING CONTENT: 766 bank ada, 1.761 belum ada, 20.405 soal |
| `npm test` | **FAIL**: 138 lulus, 10 gagal |
| `npm run test:browser` | NOT VERIFIED pada lingkungan audit |
| Semua berkas `.json` termasuk yang non-bank | 789/789 sintaks JSON berhasil diparse |

## Temuan

### F-01 — P1/blocker: indeks rilis tidak cocok dengan manifest dan file bank
- `master-manifest.json` mencantumkan **2.527** bank (38.015 soal), terdapat **766** bank nyata (20.405 soal), dan **1.761** bank memang belum disertakan.
- `assets/data/bank-index.json` masih snapshot **2.526** bank, **765** tersedia, **20.305** soal terverifikasi.
- `questions/computer science/ml.json` valid, berisi 100 soal, terdaftar sebagai manifest ID `ml`, tetapi `available.ml` tidak ada di indeks. Pengguna katalog akan melihat status tidak tersedia meskipun endpoint data ML merespons HTTP 200.
- Berkas manifest saat ini SHA-256 `0d709f51fcd5f7041ef25d4071cc496ceafa4b30d55997897fd4a953d56fdb49`, tetapi `bank-index.json` mengacu pada `c288e1ba510c920c5bc3998e685732616edd24d637a5f511cee5b0292f141524`.
- Tindakan: regenerasi indeks dengan `npm run build:index`, lalu `npm run verify:index`; commit indeks yang diperbarui. Jangan isi angka secara manual.

### F-02 — P1/blocker: catatan integritas tertinggal dari perubahan pemilik
- `tools/integrity/protected-baseline.json` mengharapkan hash manifest versi sebelumnya; `questions/computer science/ml.json` belum tercatat sebagai bank terlindungi. `npm run verify:protected` gagal.
- Jangan pulihkan manifest lama hanya agar tes lulus karena manifest saat ini sudah mencantumkan bank ML yang nyata; jangan membuang bank ML.
- Tindakan: review diff manifest dan legitimasi penambahan ML; catat perubahan terotorisasi dalam sejarah/revisi baseline beserta hash lama–baru dan alasan. Untuk file bank baru, CLI `node tools/integrity/verify-protected.js --add-new` **baru boleh** dipakai setelah baseline perubahan manifest sudah diselaraskan, karena CLI menolak perubahan hash file yang telah ada.

### F-03 — P1/blocker: sepuluh tes regresi gagal (gejala berantai)
- Baseline: `npm test` = 138 PASS / 10 FAIL. Kegagalan bersumber dari baseline manifest, indeks lama, dan daftar bank terlindungi yang belum mencantumkan `ml.json`.
- Uji isolasi pada **salinan sementara**: `npm run build:index` memperbaiki `verify:index` dan menyisakan 6 tes gagal (142 PASS/6 FAIL). Setelah sinkronisasi hash manifest secara sementara, `verify-protected --add-new`, dan regenerasi indeks: `npm test` **148 PASS / 0 FAIL**; `npm run build` PASS. Semua file salinan yang dimodifikasi dikembalikan ke keadaan awal setelah diagnosis; ZIP sumber tidak diubah.
- Tindakan: lakukan sinkronisasi yang sah dan tambahkan tes regression permanen khusus keterlihatan bank ML dan integritas indeks.

### F-04 — P2: status laporan & dokumentasi tidak lagi cocok dengan paket
- `QA_REPORT_CURRENT.md` dan `CONTENT_INTEGRATION_HANDOVER.md` masih menyebut 2.526/765/20.305, sementara paket kini 2.527/766/20.405. Komentar CI masih menyebut 2.526.
- Laporan sebelumnya sah untuk snapshot sebelumnya, tetapi klaim sebagai *CURRENT* saat ini menyesatkan jika tidak dipisahkan dengan versi.
- Tindakan: sesuaikan ringkasan status terkini dengan hasil tes terbaru; pertahankan arsip historis sebagai arsip.

### F-05 — P2: empat hint terverifikasi mengungkap jawaban
- `questions/mathematics/statistics/LEARN STATISTICS 1.json`, `questions-mathematics-statistics-statistics-q300`: hint menyebut langsung `E[θ-hat]=θ`, yaitu opsi jawaban yang benar.
- File sama, `...-q333`: hint menyebut *standard normal distribution*, yaitu jawaban persis.
- `questions/math gaokao/math gaokao - 37.json`, `math-gaokao-37-q007`: hint mengandung ekspresi akhir `sqrt(5)-sqrt(2)` yang juga opsi benar.
- `questions/math gaokao/math gaokao - 134.json`, `math-gaokao-134-q006`: hint menyebut term yang harus dipilih secara eksplisit.
- Pemindaian leksikal lebih luas menemukan 86 kemiripan jawaban–hint setelah normalisasi dan 17 overlap token tinggi; mayoritas kandidat dapat berupa petunjuk wajar, BUKAN 103 bug terbukti. Perlu telaah konteks sebelum koreksi. Jangan edit jawaban dan penjelasan yang benar saat memperbaiki hint.

### F-06 — P3: ketidakselarasan teks judul untuk bank ML
- `master-manifest.json` → name: `Machine Learning Fundamentals: Concepts and Applications`.
- `questions/computer science/ml.json` → title: `Machine Learning Fundamentals`.
- Katalog menampilkan nama manifest, sedangkan halaman latihan memakai judul internal. Kedua judul bukan kesalahan fakta; ini beda tampilan yang dapat membingungkan. Sebelumnya pemilik sudah memilih `Machine Learning Fundamentals` sebagai judul yang tepat; usulkan diseragamkan dengan mengubah nama display manifest (jangan ubah ID/path/soal).

### F-07 — P3/peringatan konten: pengulangan lintas bank
- Validator proyek dan pemindaian independen sama-sama menemukan **29** soal identik (soal+opsi+kunci) di bank berbeda. Ini tidak otomatis bug: beberapa bank adalah kumpulan lintas topik. Audit duplikasi secara pedagogis, jangan menghapus konten atau mengubah ID tanpa alasan dan migrasi progres.

### F-08 — Bukan bug: 1.761 bank belum dikirim
- ID `dynanca-151` hingga `dynanca-1911` tercantum namun file belum disertakan. Proyek sengaja mengakomodasi rilis parsial; `npm run validate` (tanpa `--allow-pending`) diharapkan gagal karena konten tertunda. Jangan membuat dummy, mengarang soal, menghapus entri manifest, mengubah `validate:shipped` menjadi validasi penuh, atau menyembunyikan status pending.

## Pengujian yang perlu dilanjutkan ChatGPT Work

1. **Browser E2E real CSP**, karena tidak dapat dilakukan di lingkungan audit ini: desktop/mobil, mode terang/gelap, pencarian/filter, ML open link, menjawab-hint-penjelasan-next, reload/progres, Back, reset, MathJax, Venn, responsif, aksesibilitas keyboard, request 404 dan offline, console errors serta CSP.
2. **Semantik konten** semua bank: hitung kunci, validitas opsi, akurasi numerik, kemungkinan ambigu, hint langsung/parafrase, formula MathJax, duplikasi sepadan, Venn, cocoknya judul dan tujuan belajar. Semua keputusan perubahan harus disertai bukti; tinjau kandidat leksikal yang mungkin false positive.
3. **Produksi** CI workflow/node version, cache, `_headers`, deployment Cloudflare, browser Firefox/WebKit bila tersedia; bedakan `NOT RUN` dengan `PASS`.

## Kriteria selesai

- Index baru: 2.527 bank terdaftar, 766 tersedia, 1.761 pending, 38.015 soal terdaftar, 20.405 soal terverifikasi.
- `npm run verify:protected`, `verify:mathjax`, `verify:csp`, `verify:index`, `validate:shipped`, `npm test`, `npm run build` semuanya PASS setelah perubahan terotorisasi.
- `npm run validate` boleh fail **hanya** karena 1.761 bank belum disertakan, dengan bukti alasan.
- Uji browser terverifikasi atau dilaporkan NOT RUN beserta alasan (tidak boleh diklaim PASS tanpa pelaksanaan).
- Seluruh penambahan/perubahan bank dan manifest tercatat hash+diff; tidak ada ID/path berubah, data progres tidak hilang, vendor MathJax tidak diubah tanpa kebutuhan yang dibuktikan.
- Serahkan ZIP hasil, report final beserta log tes, changelog, dan daftar isu tak terselesaikan.
