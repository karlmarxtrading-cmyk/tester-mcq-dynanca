# QA_REPORT_CURRENT — Dynanca MCQ, penyempurnaan landing & alur menuju latihan

Tanggal pengujian: 2026-10-08 · Semua hasil di bawah berasal dari perintah yang
benar-benar dijalankan pada paket ini. Tidak ada angka yang dikutip dari laporan
lama (laporan lama dipindahkan ke `docs/archive/`).

## 0. Pembaruan 2026-10-08 — revisi manifest (5 koleksi, `computer science`)

Bagian 1 dan seterusnya di bawah ini mencatat putaran QA **sebelumnya**, pada snapshot
lama (2.525 bank terdaftar / 764 tersedia / 4 koleksi, manifest SHA-256 `2cd8b607…`,
bank Dynanca di `questions/dynanca/`). Angka-angka itu tidak lagi berlaku. Keadaan
sekarang, dari perintah yang benar-benar dijalankan:

| Perintah | Exit | Hasil |
|---|---:|---|
| `npm run build:index` | 0 | listed 2526, available 765, not available 1761; Computer science 1/1, 600 soal |
| `npm run verify:index` | 0 | PASS — indeks cocok byte-per-byte |
| `npm run verify:protected` | 0 | PASS — 883 file baseline identik |
| `npm run verify:mathjax` | 0 | PASS — 106 file |
| `npm run verify:csp` | 0 | PASS — 2 hash inline script |
| `npm run validate:shipped` | 0 | PASS WITH PENDING CONTENT — 0 error; Subjects 5, 765 ada, 1761 pending (`dynanca-151` … `dynanca-1911`); 20.305 soal |
| `npm run validate` | 1 | diharapkan: gagal **hanya** karena 1761 file pending, "No other error" |
| `npm test` | 0 | 148 lulus, 0 gagal |
| `npm run test:browser` | 0 | 106 lulus (termasuk tes end-to-end baru Computer science / Algorithms) |
| `npm run build` | 0 | build produksi (build:index + verify:protected/mathjax/csp + validate:shipped) |

Simulasi Cloudflare Pages lokal (`wrangler pages dev`): semua aset penting 200
`application/json` (manifest, indeks, `algorithms.json`, satu bank per koleksi), bank pending
dan path dengan huruf besar/kecil salah → 404, `practice/index.html?quiz=…` → 308 ke
`practice/?quiz=…`, `Cache-Control: public, max-age=0, must-revalidate` + ETag pada
`bank-index.json`. Smoke test Chromium di atasnya: 5 koleksi, Algorithms tampil di filter
default dengan 600 soal, menjawab/penjelasan/next/reload berjalan, 0 error konsol.

Penyebab dan perbaikan: lihat bagian paling atas `CHANGE_SUMMARY.md`.

## 1. Status ringkas

| Kategori | Status | Bukti |
|---|---|---|
| Integritas file dilindungi (manifest, 764 bank, schema, traversal, engine, state, renderer, `practices.css`, 106 file MathJax) | **PASS** — 882/882 identik byte-per-byte | `npm run verify:protected`; §3 |
| Integritas MathJax | **PASS** — 106 file | `npm run verify:mathjax` |
| Hash CSP (tidak ada hash hilang, tidak ada hash usang, `style-src` tanpa hash) | **PASS** — 2 hash inline script | `npm run verify:csp` |
| Indeks ketersediaan sesuai snapshot | **PASS** | `npm run verify:index` |
| Validasi konten yang DISERTAKAN (764 bank, 19.705 soal) | **PASS WITH PENDING CONTENT** — 0 error; 1.761 file bank belum ada | `npm run validate:shipped` |
| Validasi konten LENGKAP (2.525 bank) | **FAIL (sesuai harapan)** — hanya karena 1.761 file bank yang akan Anda tambahkan; tidak ada error lain | `npm run validate` |
| Unit/regresi Node | **PASS** — 147 lulus, 0 gagal | `npm test` |
| Browser E2E (Chromium, CSP nyata) | **PASS** — 104 lulus, 0 gagal | `npm run test:browser` |
| Responsif 320/360/390/768/1024/1280/1440 + zoom 200% | **PASS** — 37 audit geometri, 0 temuan | §6 |
| Kontras WCAG 2.2 AA (warna terkomputasi, terang+gelap, semua state) | **PASS** pada landing | §7 |
| Keyboard (desktop + viewport kecil) | **PASS** | §8 |
| Pelanggaran CSP di browser | **PASS** — 0 pelanggaran | §9 |
| Lighthouse (lab, lokal) | **DIJALANKAN** — landing mobile 99/100/100/100 | §10 |
| Firefox / Safari (WebKit) | **NOT RUN** — build browser tidak bisa diunduh di lingkungan uji | §12 |
| Pembaca layar manual (NVDA/VoiceOver/TalkBack), perangkat fisik | **NOT RUN** | §12 |
| Cloudflare preview / deployment live, data lapangan Core Web Vitals | **NOT RUN** — tidak ada akses; tidak ada deployment yang dilakukan | §12 |

**Kesimpulan yang tepat:** kesiapan UI untuk katalog 2.525 bank sudah
dibuktikan pada Chromium lewat server HTTP yang mengirim header proyek.
**Paket konten belum lengkap** (764 dari 2.525 bank) dan itu memang tugas Anda;
validasi penuh harus dijalankan ulang setelah file ditambahkan
(`CONTENT_INTEGRATION_HANDOVER.md`).

## 2. Baseline attachment (sebelum ada perubahan)

- Arsip: `MCQ MATH COMPUTER.zip`, SHA-256 `04523a98b51baabe59d6629f2e6403bf03b54cef8d62ce84108de27303666dd9`, 914 file.
- `master-manifest.json` SHA-256 `2cd8b60768591c49c0327a8301c5abfa36c1f72d240ec6ab064be3c229782217` — **sama** dengan angka pada audit; tidak ada perbedaan versi.
- Baseline hash seluruh 914 file dibuat sebelum mengedit. Hash file dilindungi disimpan di `tools/integrity/protected-baseline.json` (diambil dari arsip asli, tidak pernah ditulis ulang).

Perintah baseline yang dijalankan pada salinan utuh attachment:

| Perintah | Hasil baseline | Catatan |
|---|---|---|
| `npm run verify:mathjax` | PASS, 106 file | sesuai audit |
| `npm run verify:csp` | PASS, 3 hash inline script | sesuai audit |
| `npm run validate` | FAIL, 1.763 error | 1.761 file belum ada + `math-gaokao-71` (10 vs 150) + CSV/JSON tidak sinkron — sesuai audit |
| `npm test` | FAIL lalu **crash** `ENOENT …/sets.json` | sebelum crash: 10 tes gagal (CSV≠JSON, validator, dan 8 fixture ke path/ID lama) — suite tidak selesai |
| `npm run test:browser` (suite lama, 11 tes) | PASS 11/11 | dijalankan sekarang; audit sebelumnya belum menjalankannya |
| Landing lama di browser | 2.525 card dalam DOM; tinggi halaman 127.575 px (1280) / 347.066 px (390) | screenshot `before/` |
| Lighthouse landing lama (mobile, lab) | perf 96, a11y **89** (kontras eyebrow 3,99:1) | §10 |

## 3. Perbandingan hash sesudah pekerjaan

Seluruh 914 file asli dibandingkan dengan paket akhir (934 file):

- **895 identik byte-per-byte**, 14 berubah, 5 dipindah/diganti, 25 baru (termasuk tiga dokumen serah-terima).
- File dilindungi — **semuanya identik**:

| Kelompok | Identik |
|---|---|
| `master-manifest.json` | 1/1 |
| `questions/**/*.json` | 764/764 |
| `schemas/**` | 2/2 |
| `assets/js/manifest.js` | 1/1 |
| `practice/practice-engine.js` | 1/1 |
| `practice/practice-state.js` | 1/1 |
| `practice/venn-renderer.js` | 1/1 |
| `practice/math-visuals.js` | 1/1 |
| `practice/practices.css` | 1/1 |
| `assets/vendor/mathjax/**` | 106/106 |

- Juga tidak disentuh: `master-manifest.csv`, `math-mcq-manifest.xlsx`,
  `assets/css/shell.css` (token `--dmc-*`), `assets/js/reset-progress.js`,
  semua gambar termasuk `assets/img/logo-dynanca.png`.
- Berubah (14): `index.html`, `practice/index.html`, `practice/data-loader.js`,
  `assets/js/shell.js`, `_headers`, `README.md`, `package.json`,
  `.github/workflows/ci.yml`, `tests/browser/playwright.config.js`,
  `tools/csp/compute-csp-hashes.js`, `tools/csp/verify-csp-hashes.js`,
  `tools/ecosystem-validator/validate-ecosystem.js`,
  `tools/manifest-generator/generate-manifest.js`, `tools/tests/run-tests.js`.
- Dipindah: 4 laporan lama → `docs/archive/` (diberi banner "ARCHIVED").
  Diganti: `tests/browser/browser-test.js` → 3 berkas spec baru.
- Konfigurasi MathJax pada `practice/index.html` tidak berubah: dua blok inline
  script identik, dibuktikan oleh hash CSP yang sama
  (`sha256-0deQiR…` dan `sha256-j48zkK…`). Satu-satunya perubahan CSP adalah
  **menghapus** hash ketiga (script inline landing yang kini eksternal) —
  kebijakan menjadi lebih ketat, bukan lebih longgar. `style-src 'self'
  'unsafe-inline'` tanpa hash dipertahankan untuk MathJax CHTML.

## 4. Hasil perintah akhir (log ringkas)

```
verify:protected  exit=0   Protected content check PASS — 882 baseline file(s) byte-for-byte identical.
verify:mathjax    exit=0   MathJax integrity check PASS — 106 files, byte-for-byte unchanged.
verify:csp        exit=0   CSP hash check PASS — all 2 inline script hash(es) are present … no stale hash,
                           and style-src correctly has no hash-source
verify:index      exit=0   Bank index check PASS — assets/data/bank-index.json matches this snapshot byte for byte.
validate:shipped  exit=0   Subjects: 4, topics/subtopics: 7, practice files listed: 2525, present: 764, pending: 1761.
                           Questions in the bank files that are present: 19705.
                           ACCEPTED: "math-gaokao-71": manifest questionCount 10, bank file … has 150 questions
                           WARN: 29 question(s) have identical content … in a DIFFERENT bank   (baseline, tidak diubah)
                           PENDING: dynanca-151 … dynanca-1911 (1761)
                           PASS WITH PENDING CONTENT
validate          exit=1   FAIL — content incomplete: 1761 listed bank file(s) are not present. No other error.
test              exit=0   147 passed, 0 failed.
test:browser      exit=0   104 passed (58.8s)
qa:evidence       exit=0   45 screenshots; 37 layout audits (0 findings); 8 contrast audits (0 failing)
```

### Perubahan semantik pengujian (sebelum → sesudah)

| Sebelum | Sesudah | Alasan |
|---|---|---|
| Validator & tes §3 meregenerasi manifest dari `master-manifest.csv` dan menuntut hasilnya sama dengan JSON | JSON adalah kontrak; dicek identik dengan hash arsip asli; generator lama **menolak** menulis `master-manifest.json` (diuji) | CSV adalah ekspor lama 130 baris; pemeriksaan lama hanya bisa "lulus" dengan menimpa JSON final |
| CI: langkah "Manifest determinism" menjalankan generator lalu `git diff` | Dihapus; diganti `verify:protected`, `verify:index`, dan `git diff --exit-code` setelah semua langkah | Menghilangkan satu-satunya alur yang memutasi JSON final |
| Validator: file bank hilang = error per file (1.761 error) | Dilaporkan sebagai **PENDING** (jumlah + rentang ID). Mode penuh tetap exit 1; `--allow-pending` exit 0 dengan label "PASS WITH PENDING CONTENT" | Memisahkan cacat nyata dari konten yang memang belum ditambahkan, tanpa memalsukan PASS |
| `math-gaokao-71` (10 vs 150) = error | **ACCEPTED** lewat `accepted-exceptions.json`, hanya selama nilainya persis 10 dan 150; bila salah satu sisi berubah, kembali menjadi error | Mismatch yang Anda konfirmasi; kedua file tetap utuh |
| Tes membuka path lama (`sets.json`, `basic-algebra-600.json`, `statistics.json`) dan ID `mfc-N` | Bank dicari **melalui manifest** (`mathematics-discrete-mathematics-sets-1`, dst.); soal lewat sufiks ID final (`-q080`), dan tiap tes memastikan itu memang soal yang dimaksud | Path/ID produksi tidak diubah untuk mengikuti fixture |
| 20 fixture Venn dengan ID hardcoded | Nilai region & `setNames` **diturunkan ulang dari teks soal** (14 soal "neither", 6 soal "exactly two", 53 Venn dua-himpunan, validator generik untuk 75 Venn) | Tetap bermakna berapa pun penomoran ID |
| "quiz-01-q005 berisi ___" | Dihapus (soal itu kini soal lain); perilakunya dijaga tes generik semua bank | Fixture sudah tidak ada pada data final |
| Total proyek hardcoded 8.356 soal | Total di disk = total terverifikasi indeks (sekarang 19.705) | Tetap benar setelah Anda menambah file |
| Suite browser lama: 11 tes | 104 tes; ke-11 skenario lama tercakup di `practice.spec.js` | — |

Tidak ada suite yang dihapus tanpa pengganti dan tidak ada exit code yang diabaikan.

## 5. Cakupan tes

### Node (`npm test`) — 147 tes

| § | Isi | Lulus |
|---|---|---|
| 1–2, 4–5, 11 | Parser CSV & generator lama (fixture saja), keamanan path | 22 |
| 3 | Kontrak manifest: hash, header, ID unik, generator menolak menimpa | 5 |
| 6, 10 | Validator: cakupan disertakan/penuh, ACCEPTED, tidak menulis; fixture schema & duplikat | 6 |
| 7 | `node --check` 29 file JS | 29 |
| 8–9, 13–18 | Renderer LaTeX, engine/state, regresi konten, integritas Venn | 37 |
| 12, 22 | Bentuk keamanan landing, wiring halaman, integritas tautan (termasuk huruf besar/spasi), keamanan storage, copy jujur, CI tanpa mutasi | 14 |
| 19 | Adapter katalog: direct files, nested topics/subtopics, node campuran, koleksi baru; jumlah & ID = traversal manifest (fixture **dan** manifest asli 2.525) ; search, filter, URL state, paginasi, progres read-only | 19 |
| 20 | Indeks: deterministik, `--check`, `math-gaokao-71` = 150, **latihan integrasi di direktori sementara**, file rusak tidak ditawarkan, menolak menulis ke path dilindungi | 8 |
| 21 | Modul tema mandiri: tanpa engine, key lama, perubahan sistem, storage ditolak/korup | 5 |
| 23 | Konten dilindungi identik | 2 |

### Browser (`npm run test:browser`) — 104 tes, Chromium 141 (Playwright 1.56), CSP dari `_headers` ditegakkan

- `landing.spec.js` (51): logo dimuat & tidak terdistorsi pada 1280/390/320; pelat terang di dark mode; satu H1, landmark, skip link; CTA tidak tertutup header; koleksi dari manifest; **hanya 2 file data yang di-fetch, 0 request ke `questions/`, 24 card**; search (nama, ID, koleksi, topik; trim; case-insensitive); tombol clear & Escape; filter koleksi/topik; kombinasi filter; `math-gaokao-71` tampil 150; paginasi (tautan nyata, `aria-current`, clamp, reset saat filter berubah); Available vs All banks; bank belum tersedia tanpa tautan/aksi; empty state; gagal jaringan + retry; **timeout 15 dtk + respons terlambat tidak menimpa hasil retry**; manifest rusak (3 varian); indeks hilang/rusak; manifest kosong; bentuk manifest lain & teks berbahaya (XSS) lewat fixture yang hanya disajikan ke browser uji; deep link; Back/Forward; kembali dari practice (Back **dan** tautan balik) dengan scroll dipulihkan; buka di tab baru; tema (sistem, perubahan sistem saat terbuka, persist, lintas halaman, tanpa flash); storage ditolak/korup; "Continue practice" dari jawaban nyata; **landing tidak menulis satu byte pun ke storage latihan**; 404; tanpa JavaScript.
- `practice.spec.js` (27): satu bank dari **setiap** koleksi lewat path manifest persis (termasuk `FIRST MATH.json`, `quiz - 01.json`, folder `math gaokao`); deep link lama (`/practice/index.html?quiz=` dan `/practice/?quiz=`); brand link ke home; tidak ada request keluar origin, MathJax 3.2.1 lokal; **alur penuh** pada bank terkecil: hint → jawab salah → verdict/penjelasan → next → previous → selesaikan → layar selesai → review mistakes → akhir review → reload; resume setelah refresh; Reset progress (batal & setuju; hanya key bank itu, tema & bank lain utuh); migrasi `gp-practice-v1` tetap bekerja; progres tidak hilang/ditulis ulang oleh landing; record korup; **MathJax**: inline di soal & semua opsi, display di soal, hint, penjelasan (inline + display) — pada soal nyata yang dicari berdasarkan isi; **Venn** tiga himpunan dengan label & angka dari data; 0 pelanggaran CSP di kedua tema; keadaan gagal (tanpa `quiz`, ID tak terdaftar, bank belum dirilis, host menjawab HTML 200, jaringan putus + retry berhasil, HTTP 500, file rusak, bank kosong, manifest gagal/rusak, unduhan menggantung 30 dtk); tanpa JavaScript.
- `layout-a11y.spec.js` (26): matriks responsif, halaman practice 320/390/1280, zoom 200%, teks 200%, CLS saat loading, urutan Tab & fokus, tugas penuh hanya keyboard, paginasi keyboard, live region, state terpilih, reduced motion, kontras (terang/gelap; semua state; hover; ring fokus; lapisan status practice).

**Uji mutasi** (memastikan tes memeriksa perilaku, bukan keberadaan string): 7 cacat
sengaja dimasukkan lalu dipulihkan — tautan pada bank belum tersedia, paginasi
dimatikan, key tema diganti, "Loading…" dibiarkan saat gagal, indeks dipalsukan,
warna teks muted dilemahkan, judul card dipaksa satu baris + ellipsis. **7/7 tertangkap.**

## 6. Responsivitas (bounding box nyata)

Audit memeriksa setiap elemen terlihat (bukan hanya scrollbar), teks terpotong,
target interaktif yang bertumpuk, target < 24 px, dan kontrol utama < 44 px.
`overflow-x` pada `html`/`body` landing adalah `visible` (tidak ada yang
disembunyikan).

| Lebar CSS | default | search+filter | judul terpanjang (123 karakter) | kosong | gagal |
|---|---|---|---|---|---|
| 320 | OK | OK | OK | OK | OK |
| 360 | OK | OK | OK | OK | OK |
| 390 | OK | OK | OK | OK | OK |
| 768 | OK | OK | OK | OK | OK |
| 1024 | OK | OK | OK | OK | OK |
| 1280 | OK | OK | OK | OK | OK |
| 1440 | OK | OK | OK | OK | OK |

- Zoom 200%: jendela 1280→640, 768→384, 640→320 CSS px (skala 2x): OK.
- Ukuran teks 200% (root 32 px) pada 1280: tidak ada overflow/terpotong/bertumpuk.
  (Dua cacat ditemukan dan diperbaiki pada putaran ini: H1 dan angka fakta meluap.)
- Halaman practice 320/390/1280: dimuat, belum tersedia, gagal — tidak keluar viewport.
- Judul panjang: `white-space: normal`, tanpa ellipsis/line-clamp; judul penuh terbaca.
- Logo: 846×168 intrinsik; tinggi 44 px (< 768) / 52 px (≥ 768); rasio tepat; tanpa filter; tidak lazy.
- Target: input, select, tombol utama, tautan navigasi, tautan paginasi ≥ 44 px
  (sasaran kenyamanan produk). Tombol tema 40×40 px (34×40 px pada < 359 px) —
  di atas minimum WCAG 2.2 AA 2.5.8 (24 px). 44 px **bukan** minimum AA universal.
- CLS selama loading (data & logo ditunda): < 0,1 pada 390 dan 1280.

## 7. Kontras (warna terkomputasi browser)

Target: teks normal ≥ 4,5:1, teks besar ≥ 3:1, batas komponen/fokus ≥ 3:1.

| Tema | Teks normal terendah | Teks besar terendah | Batas kontrol terendah | Sampel teks |
|---|---|---|---|---|
| Terang | 5,82:1 (`#525C6B` di `#E6EFF8`) | 16,76:1 | 3,90:1 | 633 |
| Gelap | 6,79:1 (`#A3ADBA` di `#1F252E`) | 16,57:1 | 4,68:1 | 633 |

- State yang diukur: default, All banks (campuran tersedia/tidak, koleksi & halaman
  terpilih), search+topik, kosong, kosong dengan hasil tersembunyi, Continue
  practice, gagal, loading; lalu hover pada 12 jenis kontrol dan ring fokus pada
  12 jenis kontrol (outline 3 px, ≥ 3:1). 0 pasangan gagal.
- Eyebrow lama `#C85A3E` di `#FAF9F6` (3,99:1) tidak lagi ada di landing; eyebrow
  baru `#1A5A9E` di `#F4F6F9` = 6,47:1.
- Logo: pengecualian normatif; pada tema gelap diletakkan di pelat terang `#F4F6F9`.

**Temuan baseline di luar scope (tidak diubah):** pada halaman *practice*,
Lighthouse melaporkan dua pasangan < 4,5:1 yang sudah ada sebelum pekerjaan ini
dan identik dengan arsip asli: `.hero__eyebrow` (`#C85A3E` di `#FAF9F6`, 3,99:1,
dari `shell.css`) dan `.practice-hint-toggle` (4,21:1, dari `practices.css` yang
dilindungi). Memperbaikinya berarti mengubah token `--dmc-*` atau file
dilindungi, jadi dicatat untuk keputusan Anda. Elemen baru di halaman practice
(tautan balik, panel status) lulus AA di kedua tema.

## 8. Keyboard

- Urutan Tab (1280 dan 360): skip link → logo → navigasi → tema → aksi hero →
  koleksi → search → clear → koleksi → topik → Available/All (satu tab stop, panah
  untuk berpindah) → reset → 24 card (satu tab stop per card) → paginasi → footer.
  Tidak ada elemen yang dikunjungi dua kali (tidak ada trap); setiap fokus terlihat,
  berada di viewport, dan tidak tertutup header sticky (`elementFromPoint`).
- Mengetik di search tidak memindahkan fokus; hasil diumumkan lewat satu live
  region ringkas (`#resultSummary`), daftar card bukan live region.
- Paginasi memindahkan fokus ke ringkasan hasil; card belum tersedia bukan tab stop.
- Tugas penuh tanpa mouse: cari → filter → buka bank → kembali ke tampilan yang sama.

## 9. CSP & MathJax di browser

- Server uji (`tools/dev-server/serve.js`) mengirim blok `/*` dari `_headers` pada
  setiap respons; header `Content-Security-Policy` diverifikasi pada respons.
- 0 pelanggaran CSP (pesan console **dan** event `securitypolicyviolation`) pada:
  landing, 404, practice (4 koleksi), alur matematika + Venn di tema terang & gelap.
- `#MJX-CHTML-styles` (stylesheet yang disuntikkan MathJax) hadir dan glyph berukuran
  nyata — bukti `style-src` tetap mengizinkannya.
- Baris terpanjang `_headers` 367 karakter (batas Cloudflare 2.000); 1 aturan (batas 100).

## 10. Performa (LAB — bukan data lapangan)

| Halaman | Alat / profil | Perf | A11y | Best pr. | SEO | FCP | LCP | TBT | CLS |
|---|---|---|---|---|---|---|---|---|---|
| Landing baru | Lighthouse 12.8.2 mobile (simulasi: 150 ms RTT, 1,6 Mbps, CPU 4x) | 99 | 100 | 100 | 100 | 1,0 s | 1,7 s | 90 ms | 0 |
| Landing baru, `?collection=dynanca&show=all&page=7` | idem | 98 | 100 | 100 | 100 | 1,0 s | 2,1 s | 110 ms | 0 |
| Landing baru | Lighthouse desktop | 100 | 100 | 100 | 100 | 0,3 s | 0,6 s | 0 ms | 0,012 |
| Landing **lama** (baseline) | Lighthouse mobile | 96 | 89 | 100 | 100 | 1,0 s | 1,4 s | 240 ms | 0,023 |
| Practice `dynanca-1` baru | Lighthouse mobile | 76 | 95 | 100 | — | 1,1 s | 1,4 s | 220 ms | 0,478 |
| Practice `dynanca-1` **lama** (baseline) | Lighthouse mobile | 60 | 95 | 100 | — | 0,9 s | 4,2 s | 220 ms | 0,554 |

Pengukuran tambahan dengan throttling CDP nyata (390×844, CPU 4x, 1,6 Mbps/750 kbps/150 ms,
gzip aktif): FCP = LCP ≈ 0,58 s; katalog siap ≈ 1,65 s; CLS 0,019; ketikan search →
hasil ≈ 203 ms (termasuk debounce 140 ms).

- Request landing: **11** selesai menurut CDP (HTML, CSS, 4 JS, logo, manifest, indeks, favicon, ikon data-URI) —
  tidak ada request per bank. Transfer ≈ 209 KB (logo 103 KB; manifest 68 KB gzip).
- DOM landing: 380 node, 24 card (sebelumnya 2.525 card).
- Tambahan JS+CSS landing: **22.932 byte gzip** (anggaran 81.920): `catalog.css` 6.457,
  `theme.js` 1.608, `catalog-model.js` 5.449, `catalog.js` 9.418.
- LCP landing adalah paragraf hero (teks), tidak bergantung pada data.
- CLS halaman practice (0,478) adalah **baseline** (0,554 pada arsip asli): hero berganti
  dari "Loading…" ke judul/deskripsi dan card soal masuk. Di luar scope yang diizinkan;
  dicatat sebagai rekomendasi.
- Target Core Web Vitals (LCP ≤ 2,5 s, INP ≤ 200 ms, CLS ≤ 0,1 pada persentil ke-75)
  adalah metrik **lapangan**. Angka di atas hanya lab lokal; **tidak ada klaim** bahwa
  target lapangan terpenuhi.

## 11. Screenshot (browser nyata)

Dihasilkan `npm run qa:evidence` (Chromium headless). Berkas ada di paket bukti
terpisah `dynanca-qa-evidence.zip` (tidak ikut dideploy), folder `screenshots/`:

| Berkas | Keadaan |
|---|---|
| `before/before-landing-desktop-1280.png`, `…-mobile-390.png` | Landing lama (baseline) |
| `01-landing-first-view-{desktop-1280,mobile-390}-{light,dark}.png` | Landing awal, 4 varian |
| `02-landing-full-page-{desktop-1280,mobile-390}.png` | Halaman penuh |
| `03-width-{0320…1440}-top.png` | 7 lebar |
| `04-longest-title-{0320,1440}.png` | Judul terpanjang |
| `05-catalog-search-filter-{desktop,mobile}.png` | Search + filter aktif |
| `06-catalog-all-banks-mixed-{desktop,mobile}.png` | Tersedia & belum tersedia berdampingan |
| `07-catalog-empty-…`, `08-catalog-empty-hidden-matches-…` | Hasil kosong (2 jenis) |
| `09-catalog-loading-…`, `10-catalog-load-error-…` | Loading dan gagal |
| `11-pagination-focus-…` | Paginasi + ring fokus keyboard |
| `12-continue-practice-desktop-1280.png` | Continue practice dari 3 jawaban nyata |
| `13-zoom-200-percent-…` | Zoom 200% |
| `14-no-javascript-mobile-390.png`, `15-not-found-desktop-1280.png` | Tanpa JS, 404 |
| `16…18-practice-…` | Practice dimuat, penjelasan + MathJax display, Venn |
| `19…21-practice-…` | Belum tersedia, gagal jaringan, tanpa `quiz` |

Paket bukti juga berisi `layout-matrix.json`, `contrast-report.json`,
`performance-lab.json`, laporan Lighthouse (HTML/JSON), dan log lengkap setiap perintah.

## 11b. Latihan integrasi konten (di salinan sementara, tidak dikirim)

Untuk membuktikan bahwa pekerjaan Anda nanti tidak memerlukan perubahan UI:

1. **Dua file** ditaruh di `dynanca - 151.json` dan `dynanca - 1911.json` pada salinan
   sementara → `verify:index` gagal (indeks usang terdeteksi) → `npm run build:index` →
   766 bank tersedia → di browser: card `dynanca-151` bertautan
   `practice/index.html?quiz=dynanca-151`, soal tampil, `dynanca-1911` terbuka,
   `dynanca-152` tetap "Not available in this release". Manifest identik.
2. **Katalog penuh**: 1.761 file fixture (salinan bank Dynanca asli) ditaruh di semua
   path kanonis pada salinan sementara → `build:index`: 2.525 tersedia, 0 belum →
   `verify:index` PASS → `verify:protected` PASS (882) → `validate` (penuh) **PASS**
   dengan `ACCEPTED` untuk `math-gaokao-71` → `npm test` 147 lulus →
   `npm run test:browser` **99 lulus, 5 skip** (lima tes yang memang membutuhkan bank
   belum tersedia melewati dirinya sendiri), 0 gagal.

   Latihan ini menemukan satu cacat nyata pada alat: validator memanggil
   `process.exit()` tepat setelah mencetak laporan, sehingga pada laporan besar yang
   dialirkan lewat pipe baris akhir PASS/FAIL bisa terpotong. Sudah diperbaiki
   (`process.exitCode`), lalu semua pemeriksaan dijalankan ulang.

Kedua salinan dihapus. Paket yang diserahkan tetap berisi 150 file Dynanca; tidak ada
fixture di `questions/` produksi. Ini membuktikan **alur dan UI**, bukan isi 1.761 file
asli Anda.

## 12. Keterbatasan pengujian (jujur)

1. **Hanya Chromium.** Firefox dan WebKit/Safari tidak bisa diunduh di lingkungan
   uji. CSS/JS yang dipakai adalah fitur umum (grid, flex, custom properties,
   `fetch`, `AbortController`, History API); `text-wrap: balance` hanyalah
   penyempurnaan. Reproduksi: `npx playwright install firefox webkit`, tambahkan
   project di `tests/browser/playwright.config.js`, jalankan `npm run test:browser`.
2. **Tidak ada uji pembaca layar manual** dan tidak ada perangkat fisik. Yang
   dibuktikan adalah struktur (role, nama, state, live region) dan perilaku keyboard.
3. **Cloudflare tidak diuji** (preview maupun live) dan tidak ada deployment yang
   dilakukan. Server lokal mengirim header `_headers`, tetapi tidak meniru redirect
   `index.html`, Brotli, atau cache Cloudflare. Periksa pada preview deployment:
   header terkirim; `/practice/index.html?quiz=…` → `/practice/?quiz=…` tetap
   membuka bank; URL tak dikenal mengembalikan 404 (bergantung pada `404.html`).
4. **Kebenaran matematika tiap soal tidak dinilai ulang.** 29 soal berisi identik
   lintas bank tetap sebagai peringatan (baseline), tidak diubah.
5. Mode tanpa JavaScript diuji dengan emulasi Chromium; isi `<noscript>` diverifikasi
   lewat markup dan screenshot.
6. Jumlah "jawaban tersimpan" di landing dihitung dari record yang benar-benar ada
   di browser; record milik soal yang sudah tidak ada di bank tidak bisa dibedakan
   tanpa mengunduh bank, sehingga teksnya sengaja "N answers saved", bukan persentase.

## 13. Regresi vs baseline vs tugas konten

- **Regresi yang ditimbulkan pekerjaan ini:** tidak ditemukan (0 tes gagal; file dilindungi identik; 11 skenario browser lama tetap lulus).
- **Temuan baseline yang tetap ada (di luar scope):** kontras eyebrow & tombol hint halaman practice; CLS halaman practice; 29 soal duplikat lintas bank; CSV/XLSX lama tidak mewakili katalog; logo PNG 103 KB (re-kompresi lossless hanya menghemat 2%, jadi dibiarkan).
- **Tugas konten Anda:** 1.761 file `dynanca-151` … `dynanca-1911`.

## 14. Cara mengulang

```
npm ci
npx playwright install chromium     # sekali
npm run check                       # semua pemeriksaan read-only untuk konten yang disertakan
npm run test:browser
npm run qa:evidence                 # screenshot + laporan ke ./qa-evidence
npm run preview                     # http://127.0.0.1:8788/ dengan header proyek
```
