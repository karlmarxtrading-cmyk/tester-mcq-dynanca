> Historical supporting document. Current recovery status and evidence are in IMPLEMENTATION_REPORT.md, TEST_REPORT.md and CURRICULUM_UPDATE_GUIDE.md. This document alone does not certify the current release.

# Handover integrasi konten — snapshot audit 2026-10-08

Katalog memakai `master-manifest.json` sebagai sumber utama. CSV/XLSX tetap merupakan ekspor historis; keduanya tidak dipakai untuk membangun katalog.

## Keadaan yang benar-benar tersedia

| Koleksi | Terdaftar | Tersedia | Pending | Soal tersedia |
|---|---:|---:|---:|---:|
| Mathematics | 40 | 40 | 0 | 8.575 |
| Quiz | 115 | 115 | 0 | 4.900 |
| Math gaokao | 459 | 459 | 0 | 4.730 |
| Comprehensive math | 1.911 | 150 | 1.761 | 1.500 |
| Computer science | 2 | 2 | 0 | 700 |
| Total | 2.527 | 766 | 1.761 | 20.405 |

Manifest mendaftarkan 38.015 soal. Computer science memuat `algorithms` (600) dan `ml` (100). Judul ML yang disetujui: **Machine Learning Fundamentals**. Semua 1.761 bank yang belum dikirim tetap berstatus pending; tidak dibuat soal dummy atau placeholder.

## Menambahkan bank yang sudah terdaftar

1. Letakkan bank asli pada path persis dari manifest. Rentang pending: `dynanca-151` sampai `dynanca-1911`, dengan path `questions/comprehensive math/dynanca - 151.json` hingga `questions/comprehensive math/dynanca - 1911.json`.
2. Periksa schema, ID soal, opsi, kunci, pembahasan, hint, dan hitungan aktual sebelum mendaftarkan hash. ID internal bank boleh berbeda dari ID manifest; tautan UI harus memakai ID manifest. Pertahankan ID yang sudah dipakai pengguna.
3. Jalankan `node tools/integrity/verify-protected.js --add-new` untuk mendaftarkan **file baru** yang telah ditinjau. Ini tidak menyetujui atau memperbarui hash file lama yang berubah. Perubahan file lama memerlukan diff, alasan, histori hash, dan validasi terpisah.
4. Jalankan perintah berikut dari root proyek:

   ```sh
   npm ci
   npx playwright install chromium
   npm run build:index
   npm run check
   npm run build
   npm run test:browser
   npm run validate
   ```

`build:index` hanya menulis `assets/data/bank-index.json`, deterministik dari manifest dan file yang tersedia. Jangan mengisi hitungan atau ketersediaan secara manual. File dengan JSON rusak atau daftar soal kosong tidak dapat dianggap tersedia.

Rilis bertahap memakai `validate:shipped`. `validate` penuh dan `integrate` tetap gagal selama masih ada file pending; kegagalan itu harus dilaporkan, bukan disembunyikan. Hasil tes saat ini ada di `TEST_RESULTS.md`; jumlah tes dan hasil integrasi masa depan tidak dijanjikan sebelum dijalankan.

## Kompatibilitas dan verifikasi integrasi

Paket audit mempertahankan seluruh 20.405 ID soal, semua label/teks opsi, seluruh kunci jawaban, dan namespace progres. Perbaikan konten terbatas pada hint, instruksi, dan pembahasan yang terverifikasi; jejak lengkap ada di `CHANGELOG_FIXES.md` dan `audit/`.

Setelah menambahkan file, buka bank dari rentang awal, tengah, dan akhir yang benar-benar telah dikirim; pastikan tautan ID manifest, skor, reload, MathJax, serta kembali ke katalog. Bank yang belum dikirim harus tetap tanpa tautan aktif di katalog dan menampilkan status unavailable saat deep link dibuka.

Jika seluruh bank manifest akhirnya tersedia dengan jumlah soal sesuai kontrak, indeks seharusnya menunjukkan 2.527 tersedia dan 0 pending. Itu adalah ekspektasi integrasi, **bukan hasil pengujian paket ini**. Tes yang bergantung pada contoh pending dapat skip jika tidak lagi ada bank pending; laporkan jumlah aktual dari run baru.

## Deployment

Cloudflare menggunakan `npm run build` dan root proyek sebagai output static. Sebelum unggah, keluarkan `node_modules/`, `test-results/`, `qa-evidence/`, dan `audit/` dari paket produksi sesuai workflow deployment Anda. Arsip audit lengkap tetap menyertakan sumber dan bukti untuk review.

Deployment Cloudflare, cache CDN/ETag, dan eksekusi GitHub Actions belum dijalankan dalam audit ini. Verifikasi header `_headers`, redirect `/practice/index.html?quiz=ml`, HTTP 404 untuk file yang hilang, dan cache setelah deployment. Server lokal menegakkan CSP asli tetapi tidak meniru cache atau semua redirect CDN.

Versi handover sebelum perbaikan dipertahankan tanpa perubahan di `docs/archive/CONTENT_INTEGRATION_HANDOVER_BEFORE_REAL_MCQ_FIX.md`.
