> Historical supporting document. Current recovery status and evidence are in IMPLEMENTATION_REPORT.md, TEST_REPORT.md and CURRICULUM_UPDATE_GUIDE.md. This document alone does not certify the current release.

# PRODUCTION AUDIT REPORT — Dynanca REAL MCQ 1.2.0

Tanggal audit: 8 Oktober 2026 UTC / 9 Oktober 2026 WIB. Sumber: `REAL MCQ(2).zip`, SHA-256 `df9a8711c693b85ba07866a436855066ea692cae6e8e8c747656915d4c064270`. Laporan ini menggantikan kesimpulan snapshot lama untuk rilis yang diserahkan.

## Keputusan dan status aktual

Implementasi source, build deterministik, pengujian lokal dan paket Direct Upload selesai. Tidak ada Critical/High blocker teknis yang diketahui pada output yang diuji. **Deployment publik belum dijalankan.** Label PRODUCTION_READY pada nama ZIP berarti paket siap menjalankan workflow lokal dan upload setelah autentikasi; bukan bukti sebuah situs publik telah diverifikasi atau seluruh isi akademik benar.

| Area | Status | Bukti dan batas |
|---|---|---|
| Runtime dan quality gate lokal | Verified | 222 tes Node + 154 tes Chromium PASS, 0 gagal/skipped; hashes gate sama dengan build. |
| Integritas data tersedia | Verified | 916 bank / 21.905 soal; bank, manifest, schema dan vendor sama dengan ZIP yang diunggah. |
| Build dan isolasi output | Verified | 1.049 aset, 47.933.842 byte; preflight PASS; dua build menghasilkan bytes/manifest sama. |
| Wrangler Pages dev resmi | Verified | Versi 4.149.0, workerd, browser, header, redirect, scoring/progres dan 404 diuji nyata. |
| Seluruh kebenaran akademik | Partially Verified | Struktur seluruh corpus; solver terbatas 518 soal (512 PASS, 6 REVIEW_FORM); bukan pembuktian 21.905 soal. |
| Wrapper upload terautentikasi | Partially Verified | CLI/flags resmi dan guard routing/gate diuji; akun/project/production branch aktual belum tersedia. |
| Preview/production publik | Blocked | Wrangler `whoami --json` mengembalikan `loggedIn:false`; tidak ada URL deployment yang diklaim. |
| Windows 11, Windows 10 WSL fisik | Not Tested | Script tanpa ketergantungan shell/repository; eksekusi aktual dilakukan di Linux. Panduan menyediakan jalur OS resmi. |
| Rollback akun pengguna | Not Tested | Prosedur Pages resmi didokumentasikan; history/target akun belum diakses. |

## Inventaris dan arsitektur

Arsip asli berisi **1.260 file**, **62.768.232 byte** dan **70 direktori non-root**. Semua path/ukuran/hash tersimpan di `reports/evidence-current/original-inventory.json`; pohon direktori dan perbandingan semua berkas ada di `reports/forensic-current.json`. Ekstraksi menolak absolute path, `..`, backslash dan symlink berbahaya. Arsip asli tidak diubah. Tidak ada file asli yang hilang dari source hasil perbaikan.

| Ekstensi asli | Jumlah |
|---|---:|
| `(tanpa ekstensi)` | 3 |
| `.css` | 4 |
| `.csv` | 1 |
| `.html` | 4 |
| `.js` | 100 |
| `.json` | 987 |
| `.log` | 55 |
| `.md` | 17 |
| `.patch` | 1 |
| `.png` | 60 |
| `.py` | 2 |
| `.txt` | 1 |
| `.woff` | 23 |
| `.xlsx` | 1 |
| `.yml` | 1 |

| Komponen | Peran runtime / alur |
|---|---|
| `index.html`, `assets/js/catalog*.js` | Katalog, pencarian/filter, pagination dan deep link. Beranda mengambil manifest + indeks; tidak mengambil bank soal/MathJax. |
| `master-manifest.json`, `assets/js/manifest.js` | 2.527 ID/path bank; traversal bersama katalog/loader/build. Manifest adalah sumber utama, CSV/XLSX arsip legacy. |
| `assets/data/bank-index.json` | Turunan ketersediaan dan hitungan nyata dari bank yang ada; regenerated deterministik. |
| `practice/index.html`, `data-loader.js` | Resolusi ID, encoding per segmen path, ambil satu bank, validasi seluruh bank, shell loading/error. |
| `practice-engine.js`, `practice-state.js` | Opsi/scoring, Next/Previous, completion, review dan session per bank di localStorage. |
| `venn-renderer.js`, `math-visuals.js`, MathJax | SVG lokal dan LaTeX ke CHTML/fonts lokal. Tidak ada layanan diagram/CDN eksternal. |
| `tools/release/` | Allowlist → stage/build dist → checks/test → preflight → Wrangler lokal atau Direct Upload. |

Katalog saat rilis:

| Collection | Bank tersedia / tercantum | Soal tersedia |
|---|---:|---:|
| Mathematics | 40 / 40 | 8.575 |
| Quiz | 115 / 115 | 4.900 |
| Math gaokao | 459 / 459 | 4.730 |
| Comprehensive math | 300 / 1.911 | 3.000 |
| Computer science | 2 / 2 | 700 |
| **Total** | **916 / 2.527** | **21.905** |

1.611 bank `dynanca-301`–`dynanca-1911` masih pending. Manifest mencantumkan 38.015 soal jika seluruh bank kelak tersedia; angka itu tidak dipakai sebagai jumlah soal yang sudah dikirim. `validate:shipped` melaporkan PASS WITH PENDING CONTENT; full `validate` tetap tidak lulus sampai bank pending ada. Tidak ada placeholder atau bank yang dihapus untuk menutupi masalah.

## Findings dan tindakan

| ID / severity | Bukti, lokasi dan root cause | Risiko | Perbaikan dan regression |
|---|---|---|---|
| F01 **High** | Build lama tidak menghasilkan dist; README menyarankan root sebagai output. Root memiliki `audit/`, log, test, tools, CSV/XLSX. | Internal/development files ikut terpublikasi dan output tak terdefinisi. | `tools/release/runtime-files.js`, `build.js`, `preflight.js` memakai allowlist tepat; browser dan Wrangler mengembalikan 404 untuk internal. |
| F02 **High** | Fixture opsi A=`2`, B=`A`, key=`A`: B dinilai Correct. `practice-engine.js` membandingkan label serta teks secara bersamaan. | Skor salah dan lebih dari satu pemenang. | Satu resolver memberi prioritas label, numeric index untuk key numeric, lalu text fallback. Node/browser collision tests dan setiap bank memiliki satu pemenang. |
| F03 **High** | Indeks menyebut 766 bank/20.405 soal, padahal 916/21.905 tersedia. 150 bank 151–300 belum diindeks; baseline `verify:index` gagal. | Bank valid tidak terlihat, status pending/hitungan salah. | Regenerasi indeks dari data nyata; verifikasi byte exact, akhir bank300 terbuka lewat path encoded, semua916 bank diuji. |
| F04 **High** | Record `selectedLabel:{bad:1}, status:answered_correct` menyebabkan “All questions answered correctly”. `practice-state.js` mempercayai status tanpa label valid. | Session rusak melewati soal dan completion/skor salah. | Validasi record/label terhadap opsi saat ini, koreksi status terhadap key saat ini, validasi session metadata; tiga corrupt-record fixtures + stale-key + reload/review PASS. |
| F05 **Medium** | Setelah30 pergantian DOM: 31 MathItems tersimpan, hanya1 aktif (`runtime-baseline.json`). DOM diganti tanpa membersihkan registry MathJax. | Memori bertambah pada session panjang dan typeset node terlepas. | `typesetClear` sebelum replace; queued typeset memeriksa node connected. Setelah60 navigasi registry ≤4 dan semuanya connected. |
| F06 **Medium** | Bank `questions:[null]` diperlakukan kosong: “No questions available yet.” Loader membuang row rusak diam-diam. | Siswa melihat kondisi kosong yang menutupi data rusak. | Whole-bank validator menolak malformed option, duplicate ID/label, key hilang/tak dikenal; shell `bank-damaged` dengan retry. Semua21.905 row valid. |
| F07 **Medium** | `isSafeRelativePath` menerima `questions/%2e%2e/master-manifest.json`; browser menafsirkan path percent-encoded. | Batas folder bank dapat dilampaui oleh path manifest malformed. Tidak ada kredensial yang terbukti terbaca. | Tolak percent/query/hash/control/dot/empty segments; encode raw segment saat fetch. Tes exact-case/spaces, traversal dan scheme/control PASS. |
| F08 **Medium** | Protected baseline lama884 berkas tidak mencakup150 bank baru; verifier hanya warning lalu PASS. | Klaim integritas tidak melindungi data baru. | Daftarkan150 bank setelah cocok SHA asli; verifier gagal untuk unregistered bank kecuali penambahan eksplisit `--add-new`. Baseline kini1034. |
| F09 **Medium** | Kontrol tema/reset/review22–24px dan hint16px pada mobile. | Target sentuh sulit dipakai. | `shell.css`, `practices.css` memberi min-height44px; touchscreen320/390 dan20 tampilan layout/contrast PASS. |
| F10 **Low** | Tidak ada strategi revalidasi eksplisit untuk source/indeks yang bisa berubah. | Cache lama dapat mencampur snapshot saat rilis. | Header global revalidate, fetch manifest/bank `no-cache`; local browser/real workerd menunjukkan header yang benar. Public cache masih harus diuji sesudah deploy. |
| F11 **Low** | `script-src` lama menyertakan legacy `unsafe-inline` bersama hash. Pada browser modern hash sudah mengabaikan fallback itu. | Browser lama dapat mengizinkan inline lebih luas. Ini bukan bukti XSS pada browser modern. | Hapus fallback script saja; dua hash tetap sama. Style inline MathJax tetap; CSP/parser/browser PASS. |
| F12 **Medium** | Workflow upload berdiri sendiri, pemeriksaan limit, verifikasi branch dan hash gate belum tersedia. | Pengguna dapat upload workspace/branch salah atau bytes yang belum diuji. | Wrangler resmi dipin; npm workflow, pemilihan account eksplisit, API production_branch, penolakan Git project/preview=production, temp cwd dan gate exact-hash. Jalur authenticated upload belum dieksekusi. |

Critical ditemukan: **0**. F01–F12 selesai pada source/output lokal. Bukti asli, diff, test hasil dan batas autentikasi disimpan; tidak ada klaim otomatis bahwa deploy publik telah berhasil.

## Data dan review akademik

Seluruh916 bank lulus syntax JSON/schema, unique IDs, opsi/key references, category/difficulty dan sinkronisasi count/path. ID, operands, key, hint, explanation dan JSON bank **tidak diubah dalam pekerjaan ini**. Perbaikan scoring hanya mengubah pemilihan opsi runtime, bukan isi kunci.

Audit menemukan **42 kelompok duplikasi lintas bank / 42 occurrence tambahan** dengan question+options+answer yang sama. Tidak ada duplicate-ID atau byte-identical whole-bank group. Semuanya dicatat di `audit/DUPLICATE_REVIEW_DATA.json` dan dipertahankan karena pengulangan konten dapat disengaja. Niat pedagogis masih membutuhkan penulis. Laporan lama yang menyebut29 kelompok berlaku pada snapshot lama.

Solver grammar terbatas mengevaluasi518 soal: 512 PASS dan 6 REVIEW_FORM karena hasil numerik beropsi ekuivalen perlu mempertimbangkan bentuk yang diminta. Ada 5.979 numeric-claim checks; 10 false-equality kandidat dibaca dalam konteks dan merupakan proposisi salah/distractor/kontradiksi yang disengaja. 129 kandidat opsi ekuivalen memakai keputusan konteks terdahulu hanya ketika hash question cocok; dua current stems FIRST MATH q083/q084 dibaca ulang karena hash berbeda dari keputusan historis: prompt meminta pecahan paling sederhana. `reports/content-review-current.json` menyimpan current hash, keputusan dan batas. Status akademik **Partially Verified**, bukan sertifikasi semua pembahasan/kunci.

## SVG, MathJax dan aksesibilitas

Corpus memuat 75 SVG Venn; semua diuji geometry/viewBox/region/label bounds pada empat lebar dengan suite asli dan representative screenshots dibaca secara visual. Renderer line/scatter/coordinate/number-line/geometry diuji dengan **fixture sintetis**, masing-masing pada lima lebar dan dua tema; fixture tidak dimasukkan ke bank. Bar positive/negative/mixed/zero dan injection regression dari suite asli tetap lulus. Tidak ada visual jenis tersebut yang ditemukan sebagai soal shipped.

MathJax lokal 3.2.1, 106 berkas beserta 23 WOFF dipertahankan. Browser parser memeriksa 21.905 soal, 230.846 fields, 147.157 expression occurrences dan 52.521 unique expressions: 0 delimiter/parser errors, 0 CSP violations, 0 failed requests. Ini bukti kompatibilitas renderer, bukan makna akademik.

20 tampilan aktual (landing+practice ×5width ×2tema) di 320/390/768/1280/1920: 0 overflow,0 clipping/overlap/undersized controls,0 text-contrast failures pada 2.390 sampel teks,0 runtime errors. 22 screenshot tersimpan di `reports/visual/`. Landmark/heading/label/ARIA, keyboard focus/search/filter/pagination/reset dan progress live regions diuji suite. Tidak dilakukan audit pengguna screen reader fisik, Safari/Firefox, atau sertifikasi WCAG penuh.

## Keamanan

Semua 1.260 file asli diinventarisasi; scan pola credential dan filename sensitif tidak menemukan literal credentials yang cocok. Ini heuristic, bukan pembuktian absolut ketiadaan semua secrets. Source internal memang ada sebagai dokumen pengembangan; **tidak satu pun otomatis masuk dist**. 11 kelompok byte-duplicate files adalah historical logs, dicatat pada baseline.

Sink HTML pada engine memakai escaping/renderContent; markup/attribute/SVG injection fixtures tidak dapat membuat element/script tak diizinkan. Path validator dan URL media menolak skema executable/control obfuscation. Bank merupakan konten statis yang ditinjau, tidak ada endpoint input soal publik. CSP same-origin, dua hash inline tepat, object-src none, base/form/frame restrictions, nosniff/referrer/permissions/HSTS dipertahankan. HSTS efek HTTPS belum diverifikasi di situs publik. Style `unsafe-inline` masih diperlukan dynamic CHTML MathJax; script tidak memakai blanket inline.

`npm audit --json` terakhir:0 vulnerability untuk 95 dependency npm yang dihitung metadata. Ini tidak mencakup jaminan CVE seluruh vendor lokal/historical documents; verifikasi 106 hash hanya membuktikan bytes vendor tidak berubah. Credentials Wrangler hanya di-memory/header API, tidak ditulis ke dist/laporan. localStorage adalah progres lokal tanpa sync atau anti-tamper server; tidak mengandung data akun. Isi/key bank di situs statis publik memang bisa dibaca browser.

## Performa sebelum/sesudah

Pengukuran terkontrol terpisah: Chromium 141, lokal gzip, 1280px, tanpa throttle, satu warm-up dibuang,5 fresh contexts per page/version, urutan versi bergantian. Times termasuk polling automation; tidak setara Core Web Vitals/field data. File: `reports/evidence-current/performance-controlled.json`.

| Metrik median | Sebelum | Sesudah |
|---|---:|---:|
| Landing ready | 87.9 ms | 91.1 ms |
| Practice ready, MathJax startup selesai | 145.0 ms | 152.3 ms |
| Landing request / transferred bytes | 9 /205.558 | 9 /206.067 |
| Practice request / transferred bytes | 17 /564.602 | 17 /565.699 |
| Bank download landing / practice | 0 /1 | 0 /1 |
| Detached MathJax accumulation | 31 registered setelah 30 replacement,1 aktif | ≤4 registered setelah 60 navigasi,semua connected |

Tidak ada klaim speedup loading dari pengukuran ini. Tambahan guard/index menaikkan payload kurang lebih0,5KiB beranda dan1,1KiB latihan. Lazy bank loading sudah benar pada source asli dan dipertahankan. ID lookup kini cached Map; belum ada benchmark terpisah yang membuktikan besar peningkatannya. Heap Chromium10MB yang dibulatkan tidak dipakai sebagai bukti kebocoran; registry lifecycle adalah metrik yang terbukti.

## Build, Direct Upload, release dan batas

Output terdiri 3 HTML, 4 CSS, 80 JS, 932 JSON, 6 PNG, 23 WOFF dan `_headers`. Total 1.049 file / 47.933.842 byte; aset terbesar `assets/vendor/mathjax/tex-svg-full.js`2.275.113 byte. Preflight mengecek exact allowlist, source/output hashes, required assets, local refs, case collisions, encoded paths, JSON, credential patterns, CSP hashes, header-rule length/count, MIME berdasarkan ekstensi dan limits. Content type HTTP juga diuji pada preview; public verifier menunggu URL asli.

Wrangler Direct Upload konservatif Free: 20.000 file, 25 MiB per file; dashboard 1.000. Rilis 1.049 file memenuhi Wrangler dan memang melebihi drag-and-drop dashboard. Tidak ada asset fungsional yang dibuang untuk memenuhi 1.000. Seluruh 106 vendor files dipertahankan secara sengaja untuk font/extension integrity; dynamic loader berarti tidak semua perlu diunduh pada satu halaman.

Build fixed timestamp `2026-10-08T20:00:00.000Z` atau `SOURCE_DATE_EPOCH`, tanpa timestamp acak dalam assets. Source ZIP berisi aplikasi/tools/tests/config/docs/evidence tanpa node_modules, .wrangler, deployment.local.json, temporary stages atau dist ganda. Deploy ZIP tanpa wrapper directory dan harus byte-identical dengan dist. Automation ada di `tools/release/` dan archive companion. Existing `.github` hanya metadata historical; tidak dibutuhkan untuk install/build/upload.

`npm run prepare:release` menjalankan validasi → tests → build → browser dist → corpus MathJax → preflight, dan hanya menulis gate PASS jika semuanya berhasil. Deploy wrapper selalu menjalankan ulang persiapan; menolak perubahan hash, project Git dan preview yang sama dengan production. API membaca account/project/production_branch aktual; tidak menebak `main`. Upload dari temp cwd menghindari config/Functions/repository yang tidak diminta. Akun/permission/project URL nyata belum tersedia, sehingga jalur publik **Blocked**.

Windows guide memakai official Wrangler 4.149.0 / Node 24. Native OS resmi Windows 11; Windows 10 diarahkan ke WSL Ubuntu 22.04+ / glibc 2.35+, tanpa menjanjikan native support. Workerd preview sandbox perlu inspector-port eksplisit; wrapper menyediakannya. Rollback Pages hanya ke deployment produksi terdahulu yang sukses; backup source dapat dibangun ulang dan diupload sebagai deployment baru.

## Sisa risiko dan tindakan konkret

| Item | Severity / status | Tindakan berikut |
|---|---|---|
| Akun/project/branch/URL Cloudflare | Blocked, deployment external | Jalankan OAuth/configure/preview/verify sesuai Windows guide; setelah sukses deploy production dan verify. |
| 1.611 bank belum disertakan | Content scope, bukan runtime blocker | Tambahkan konten asli setelah review, register hash baru dan ulang prepare. |
| Seluruh kebenaran akademik | Medium, Partially Verified | Review manusia soal di luar grammar solver; konfirmasi niat42 duplicate groups. Tidak mengganti content hanya untuk memperoleh PASS. |
| Windows/WSL dan browser lain | Not Tested | Jalankan workflow pada mesin tujuan dan browser yang dibutuhkan. |
| Public cache/header/HTTPS/rollback | Not Tested | Verifikasi URL aktual dan deployment history; laporan lokal tidak mengesahkan edge production. |

Sumber resmi yang diperiksa: [Wrangler Pages commands](https://developers.cloudflare.com/workers/wrangler/commands/pages/), [Direct Upload](https://developers.cloudflare.com/pages/get-started/direct-upload/), [Pages limits](https://developers.cloudflare.com/pages/platform/limits/), [Wrangler prerequisites](https://developers.cloudflare.com/workers/wrangler/install-and-update/), [Project API](https://developers.cloudflare.com/api/resources/pages/subresources/projects/methods/get/), [Pages rollback](https://developers.cloudflare.com/pages/configuration/rollbacks/), [Microsoft WSL](https://learn.microsoft.com/en-us/windows/wsl/install). Pemeriksaan dokumentasi tidak menggantikan deployment pengguna yang belum dilakukan.
