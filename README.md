# Current recovery candidate — 10 October 2026

This source uses the uploaded 1,236-bank / 26,644-question curriculum. Owner baseline approval and Cloudflare preview verification are pending. Start with CURRICULUM_UPDATE_GUIDE.md, IMPLEMENTATION_REPORT.md and TEST_REPORT.md. The material below documents the prior release and its historical claims; it is not evidence that this candidate is deployed or production verified.

# Dynanca REAL MCQ — standalone release 1.2.0

Website statis HTML/CSS/JavaScript; tanpa login, backend, framework baru, atau repository sebagai syarat deployment. Paket ini memakai **Cloudflare Pages Direct Upload dan Wrangler resmi 4.149.0**.

Mulai dari `DEPLOYMENT_GUIDE_WINDOWS.md`. Laporan rilis yang berlaku: `PRODUCTION_AUDIT_REPORT.md`, `TEST_RESULTS_FINAL.md`, `CHANGELOG_PRODUCTION.md`, dan `RELEASE_MANIFEST.json`. Laporan lama di paket menjelaskan snapshot sebelumnya, bukan keadaan rilis ini.

## Isi katalog saat rilis

- 2.527 bank tercantum dalam `master-manifest.json`.
- **916 bank tersedia, 21.905 soal**, termasuk `dynanca-151` sampai `dynanca-300` yang sebelumnya belum masuk indeks.
- **1.611 bank pending**: `dynanca-301` sampai `dynanca-1911`. Status pending tetap terlihat; tidak dibuat soal pengganti.
- Manifest, 916 JSON bank soal, schema, dan 106 file vendor MathJax dipertahankan dari ZIP sumber. ID dan kunci soal tidak diubah.
- Duplikasi konten tetap dilaporkan; tidak dihapus otomatis. Pengujian renderer tidak membuktikan kebenaran akademik seluruh corpus.

## Persiapan cepat

Gunakan Node.js 24 LTS (minimum 22). Wrangler terbaru resmi mendukung Windows 11; Windows 10 menggunakan WSL sesuai panduan.

```bash
npm ci
npx playwright install chromium
npm run prepare:release
npm run preview
```

`prepare:release` memvalidasi data/integritas/CSP, menjalankan tes Node, membuat `dist/`, menguji browser terhadap **dist**, memeriksa MathJax, lalu menjalankan preflight. Gagal satu langkah berarti tidak ada quality gate PASS. Hentikan preview sebelum membangun ulang direktori yang sedang disajikan.

## Perintah

| Perintah | Fungsi |
|---|---|
| `npm run build` | Bangun ulang indeks, verifikasi integritas, validasi bank tersedia, buat output allowlist `dist/`. |
| `npm run check` | Pemeriksaan source dan tes Node, tanpa deployment. |
| `npm run prepare:release` | Seluruh quality gate lokal, termasuk browser dan MathJax. |
| `npm run predeploy` | Alias untuk persiapan rilis lengkap. |
| `npm run preflight` | Periksa path, hash, ukuran, file count, header dan eksposur file internal dalam dist. |
| `npm run preview` | Wrangler Pages dev pada `http://127.0.0.1:8788`, inspector lokal 9235. |
| `npm run preview:static` | Server Node yang menyajikan dist beserta CSP; alternatif preview lokal. |
| `npm run preview:source` | Server pengembangan untuk source; jangan gunakan output ini untuk upload. |
| `npm run configure:deployment -- --project NAMA --preview-branch CABANG` | Verifikasi akun/project Direct Upload dan branch produksi melalui API Cloudflare. Menyimpan identitas nonrahasia lokal. |
| `npm run deploy:preview` | Jalankan ulang quality gate dan unggah dist ke branch preview yang telah diverifikasi. |
| `npm run deploy:production` | Jalankan ulang quality gate, baca branch produksi aktual, lalu unggah dist. |
| `npm run verify:deployment -- --url https://URL-AKTUAL` | Bandingkan setiap aset publik dengan hash lokal, uji 404/header dan browser. |
| `npm run wrangler -- login` | OAuth resmi Cloudflare. |

`wrangler.jsonc` hanya konfigurasi preview lokal. Wrapper deploy berjalan dari direktori sementara kosong sehingga tidak membawa config lokal, Git metadata, atau Functions yang tidak diminta. Project aktif dan branch produksi tidak ditebak atau diubah.

## Kontrak data dan build

`master-manifest.json` adalah sumber katalog. CSV/XLSX hanya arsip legacy. `assets/data/bank-index.json` adalah turunan dari berkas yang benar-benar tersedia. Homepage tidak mengunduh seluruh bank; latihan mengunduh satu bank sesuai ID manifest.

Build menyalin hanya HTML, CSS, JS runtime, ikon/logo, indeks/manifest, bank tersedia dan MathJax/fonts ke dist. Tests, audit, log, dokumentasi, npm tooling, spreadsheet dan credentials tidak masuk dist. Jangan upload root source atau ZIP mentah.

Saat menambahkan bank yang sudah tercantum:

```bash
node tools/integrity/verify-protected.js --add-new
npm run prepare:release
```

Daftarkan hash hanya setelah meninjau bank baru. Verifier gagal jika ada bank belum terdaftar; `--add-new` tidak mengganti hash berkas lama. `npm run validate` tetap gagal sampai seluruh bank pending ditambahkan; `validate:shipped` menguji semua bank yang tersedia.

## Keamanan dan progres

Script CSP memakai same-origin dan dua hash inline yang tepat, tanpa blanket `unsafe-inline`. Style inline tetap diperlukan MathJax CHTML. Semua perubahan inline script harus diikuti `node tools/csp/compute-csp-hashes.js` dan `npm run verify:csp`.

Progres tersimpan per bank pada browser dengan namespace yang sama seperti sebelumnya. Rekaman rusak tidak boleh melewati soal; status dinilai terhadap pilihan/kunci bank yang sedang dimuat. Tidak ada sinkronisasi perangkat atau proteksi kerahasiaan bank pada situs statis publik.
