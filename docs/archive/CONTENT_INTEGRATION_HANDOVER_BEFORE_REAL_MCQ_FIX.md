# CONTENT_INTEGRATION_HANDOVER — menambahkan 1.761 bank Dynanca

**Pemilik tugas: Anda (pemilik konten).** Pekerjaan UI tidak menulis satu pun soal,
tidak membuat placeholder, dan tidak mengubah `master-manifest.json`. Dokumen ini
menjelaskan apa yang perlu ditaruh di mana, satu perintah yang harus dijalankan, dan
bagaimana memvalidasi paket lengkap.

## 1. Keadaan paket sekarang

| Koleksi | Terdaftar di manifest | File bank ada | Belum ada |
|---|---:|---:|---:|
| Mathematics | 40 | 40 | 0 |
| Quiz | 115 | 115 | 0 |
| Math gaokao | 459 | 459 | 0 |
| Comprehensive math | 1.911 | 150 | **1.761** |
| Computer science | 1 | 1 | 0 |
| **Total** | **2.526** | **765** | **1.761** |

- Soal terverifikasi di 765 file yang ada: **20.305** (termasuk `algorithms`, 600 soal).
- `questionCount` manifest untuk semua 2.526 entri: 37.915 (angka *terdaftar*, bukan yang bisa dibuka).
- **Paket konten BELUM lengkap.** UI sudah siap untuk 2.526 bank; validasi penuh baru bisa lulus setelah langkah di bawah.

## 2. Yang perlu Anda tambahkan

- Rentang ID manifest: **`dynanca-151` sampai `dynanca-1911`** (1.761 entri, berurutan).
- Path kanonis (persis seperti di manifest — huruf kecil, spasi-tanda hubung-spasi, tanpa nol di depan):

  ```
  questions/comprehensive math/dynanca - 151.json
  questions/comprehensive math/dynanca - 152.json
  …
  questions/comprehensive math/dynanca - 1911.json
  ```

- Jangan mengganti nama file, folder, atau ID; jangan mengedit manifest. `id` di dalam file
  bank tidak wajib sama dengan ID manifest.
- Bentuk file: `schemas/question-bank.schema.json` (`schemaVersion`, `type`, `id`, `category`,
  `title`, `description`, `questionCount`, `questions[]`). Agar validasi penuh lulus:
  - `questionCount` di file = jumlah elemen `questions`;
  - jumlah itu = `questionCount` entri manifestnya (untuk rentang ini manifest mencantumkan
    10 per bank; periksa entri masing-masing);
  - tiap soal punya `id` unik dalam bank dan teks `question`; bila ada `options`, `answer`
    menunjuk label opsi yang ada.
- File yang ada tetapi tidak valid (bukan JSON, atau `questions` kosong) **tidak** akan
  ditawarkan sebagai tersedia; skrip indeks menuliskannya sebagai `UNUSABLE`.

## 3. Satu perintah untuk mengaktifkan bank baru

```
npm run build:index
```

(setara `node tools/bank-index/build-bank-index.js`; tidak perlu `npm ci`.)

- Membaca `master-manifest.json` dan memeriksa file bank lokal (ada, JSON valid, `questions`
  tidak kosong), lalu menulis **hanya** `assets/data/bank-index.json`.
- Tidak pernah menulis manifest, CSV, XLSX, schema, atau apa pun di `questions/`; skrip
  menolak `--out` yang menunjuk ke sana.
- Deterministik (urutan manifest, tanpa timestamp): snapshot yang sama → byte yang sama.
- Setelah itu semua bank baru **otomatis** muncul sebagai tersedia lewat UI generik yang sama:
  card dengan tautan `practice/index.html?quiz=<ID manifest>`, hitungan koleksi, angka di hero.
  Tidak ada HTML/CSS/JS yang perlu diedit per bank.

Bisa dilakukan bertahap: tambah sebagian file → `npm run build:index` → deploy. Bank yang
belum ada tetap tampil (di "All banks") sebagai "Not available in this release" tanpa tautan.

**Penting — indeks dan konten harus dari snapshot yang sama.** Jalankan `build:index`
*setelah* file terakhir ditambahkan dan *sebelum* membuat ZIP/deploy. Bila lupa:
- file ditambah tetapi indeks lama → bank baru masih tampil "Not available" (aman, tetapi
  belum aktif); `npm run verify:index` akan **gagal** dan memberi tahu;
- indeks menyebut bank yang filenya tidak ikut ter-deploy → halaman practice menampilkan
  "Not available in this release" dengan tautan kembali ke katalog (tidak macet di "Loading…").

## 4. Validasi setelah integrasi

```
npm ci                      # sekali, untuk perintah tes
npm run integrate           # build:index + verify:protected + verify:mathjax + verify:csp + validate (PENUH) + npm test
npx playwright install chromium   # sekali
npm run test:browser
```

Hasil yang diharapkan setelah seluruh 1.761 file ada dan valid:

| Perintah | Harapan |
|---|---|
| `npm run build:index` | `Available in this build: 2526`, `Not available in this build: 0` |
| `npm run verify:index` | PASS |
| `npm run verify:protected` | PASS untuk 883 file baseline; file baru dilaporkan sebagai "newer than the baseline" (informasi) |
| `npm run validate` | **PASS** (bukan lagi "PASS WITH PENDING CONTENT"); tidak ada lagi pengecualian `ACCEPTED` |
| `npm test` | lulus; tes latihan integrasi otomatis memakai entri lain bila tidak ada lagi yang pending |
| `npm run test:browser` | lulus; lima tes khusus "bank belum tersedia" akan **skip** dengan sendirinya ketika tidak ada lagi bank yang belum tersedia (pada latihan katalog penuh: 99 lulus, 5 skip) |

Opsional, setelah Anda yakin isi file sudah final: `node tools/integrity/verify-protected.js --add-new`
memasukkan file bank **baru** ke baseline perlindungan (hanya menambah entri; tidak pernah
mengubah hash yang sudah ada).

Sesudah itu periksa secara manual di preview: buka beberapa bank baru dari awal, tengah, dan
akhir rentang (mis. `dynanca-151`, `dynanca-1000`, `dynanca-1911`), pastikan rumus tampil.

## 5. Catatan: `math-gaokao-71` — selisih lama sudah selesai

Dulu manifest mencantumkan `questionCount` **10** untuk bank ini, sedangkan filenya berisi
**150** soal; selisih itu dicatat sebagai pengecualian `ACCEPTED` di
`tools/ecosystem-validator/accepted-exceptions.json`. Revisi manifest pemilik (2026-10-08)
mengubah nilainya menjadi **150**, sama dengan file bank. Pengecualian itu sudah dihapus
(validator melaporkan pengecualian yang tidak lagi sesuai kenyataan sebagai error), dan
manifest, indeks, serta katalog kini sama-sama menunjukkan 150.

## 6. Yang sudah dibuktikan tentang alur integrasi

- **Tes otomatis** (`npm test`, §20): di direktori sementara, manifest asli + satu file bank;
  indeks dibangun; sebuah file fixture ditaruh di path kanonis entri yang pending;
  `--check` mendeteksi indeks usang; satu kali `build` membuat bank itu tersedia dengan
  hitungan terverifikasi; manifest identik; hanya satu file yang ditulis; `questions/`
  produksi tidak berubah.
- **Latihan katalog penuh di salinan sementara**: 1.761 file fixture di semua path kanonis →
  2.525 tersedia → `validate` penuh PASS, `npm test` 147 lulus, browser 99 lulus + 5 skip.
- **Latihan ujung-ke-ujung di salinan sementara** (log `integration-rehearsal.log` di paket
  bukti): dua file ditaruh di `dynanca - 151.json` dan `dynanca - 1911.json` → `verify:index`
  gagal → `build:index` → 766 tersedia → di browser, card `dynanca-151` punya tautan
  `practice/index.html?quiz=dynanca-151`, halaman practice memuat soal, `dynanca-1911`
  terbuka, `dynanca-152` (masih belum ada) tetap "Not available in this release". Salinan
  itu dihapus; paket yang diserahkan tetap berisi 150 file Dynanca.

## 7. Yang belum divalidasi

- Isi 1.761 file yang belum ada (jelas belum bisa).
- Perilaku pada deployment Cloudflare (belum ada akses/deployment).
- Dengan 2.525 bank tersedia, ukuran indeks naik dari ≈ 21 KB ke ≈ 60 KB mentah
  (≈ 10 KB terkompresi, perkiraan); katalog tetap merender 24 card per halaman.
