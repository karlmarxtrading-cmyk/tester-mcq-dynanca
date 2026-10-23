> Historical supporting document. Current recovery status and evidence are in IMPLEMENTATION_REPORT.md, TEST_REPORT.md and CURRICULUM_UPDATE_GUIDE.md. This document alone does not certify the current release.

# CHANGELOG_FIXES — DYNANCA REAL MCQ

Tanggal: **2026-10-08**. Seluruh perubahan dibandingkan dengan **REAL MCQ(1).zip** yang disimpan terpisah. Source SHA-256 `946552f1d8121bb108c1826ed26a878d7f76b52b2a853326014d1f0419cdc97e`. Semua **937** file asli tetap ada; **48** file sumber berubah dan **889** tetap byte-identik. Bukti seluruh path/hash termasuk tambahan artefak: [`audit/FILE_DIFF.json`](audit/FILE_DIFF.json).

## 1. Perubahan utama dan kompatibilitas

Generator resmi memperbaiki indeks ML; baseline dicatat terkontrol; kedua title ML menjadi **Machine Learning Fundamentals**. **57 perubahan hint**, **26 perubahan prompt**, **44 perubahan explanation** = **127 perubahan field** pada **110 objek soal**, tersebar dalam **29 bank konten**. Bank ML ke-30 hanya berubah judul. Semua **20.405 ID soal, label/teks opsi, key jawaban** tetap sama. 29 kelompok duplikasi dan 1.761 bank pending tetap.

Tidak ada perubahan source engine/state/reset/progress namespace, dua schema, traversal manifest, 106 file vendor MathJax, MathJax config, practice stylesheet, CSV/XLSX atau enam PNG. Dua renderer protected diperbaiki terbatas untuk injection/geometri/chart. Empat token warna shell dan preview redirect diperbaiki. `package.json` dan lockfile tetap; CI memakai Node 24.

## 2. Hash before/after seluruh protected file yang berubah

Hash **sebelum** di tabel ini berasal dari file lampiran yang benar-benar diterima; hash **sesudah** adalah file proyek final dan harus sama dengan baseline disetujui. Ada **33** file: manifest + 30 bank + 2 renderer. 851 protected file lainnya identik terhadap lampiran. Tidak ada refresh massal hash vendor atau schema.

| File protected | SHA-256 sebelum (paket masuk) | SHA-256 sesudah (final) | Alasan |
|---|---|---|---|
| `master-manifest.json` | `0d709f51fcd5f7041ef25d4071cc496ceafa4b30d55997897fd4a953d56fdb49` | `3c4d706a6ad1c792281c9c305ec8cb95c1309b0e153ef3b264d5f06337d38c64` | ML sah dipertahankan; judul ML disetujui; manifest historis direkonstruksi dan dibuktikan. |
| `practice/math-visuals.js` | `2bb8bba23f2c121257bdf2d662ac100f2beeed16453358f66345eae5d5ad2998` | `370561624a70eaa6da786fc033c336312497d8aadbb157be3286b4938c775722` | Zero axis/endpoints negative chart dan pemisahan label. |
| `practice/venn-renderer.js` | `7092642eacfe2dfd7d16e153fd4298cf061dc3161bf2a5087d3f5e1259fc247a` | `b88ae43ebac92911f7c035d80bbc636b41a9b8354192b4b1ff50a0600d89e289` | Escape aria-label, perbaiki tiga-set bounds/label/outside path; data/two-set tetap. |
| `questions/comprehensive math/dynanca - 87.json` | `051bdf3dd2c75f2f8c8f6a6b1c9f04ffc9ec8c50ae7aab7e33714deaba80f9f2` | `021de9174975ac3bd5254f5e80bf1f867feaebd9ad29f323643c1c6aa1c4b5c3` | 1 hint dan 0 field prompt/explanation ditinjau; ID/opsi/key tetap. |
| `questions/computer science/ml.json` | `9804412deef068a91a94161b19a684ae6fafe289ca1bc4a81ea2dd6e0488c168` | `c4e009d2f3e542af205bd435d4448bc4066e79dbcf7a0234b0b4fd53e98bb839` | Title bank saja; 100 objek soal sama; sebelumnya belum dicatat baseline, kini --add-new. |
| `questions/math gaokao/math gaokao - 134.json` | `1449c4bb1f501738efcfdbfad01defd31696262f88553d8d357f0bc266af5468` | `3d80399a882a6fd23acb65c2f9137b23dbe81c467e9862dc6334860b82ac328c` | 1 hint dan 0 field prompt/explanation ditinjau; ID/opsi/key tetap. |
| `questions/math gaokao/math gaokao - 141.json` | `00e1ee6f5df178b8b6c4eb4b7bdd5497e221541aa1bc5e5661d827e68a662c28` | `dda21b7124f67e0421580e81964e05270a01c99bc87c982687cb7ad9f182fb9a` | 1 hint dan 0 field prompt/explanation ditinjau; ID/opsi/key tetap. |
| `questions/math gaokao/math gaokao - 16.json` | `2879e6ed85fec0088e1a5f1e35f7f134422201a21a2d5fe2150f1bc718497681` | `ace85f1f8c4cbfeae9bc2e578c345905b1ff6da48267a266e31f20bb2e50407b` | 1 hint dan 0 field prompt/explanation ditinjau; ID/opsi/key tetap. |
| `questions/math gaokao/math gaokao - 37.json` | `9913340432a50de507983f624264047f802b9c931eae179be4d9cbb3c1abd988` | `14930d6cdfaa7baeb3dc22b55a9655c6f4323cc43ac66289870a7ee9bccb3fe3` | 1 hint dan 0 field prompt/explanation ditinjau; ID/opsi/key tetap. |
| `questions/mathematics/algebra/ALGEBRA 04.json` | `83178c3621c7e8fb7ce5427b72f027192c6efd4c13ee5555515b98c084cd2508` | `6d3015c2d5b2a02c270e7b2be753e089e65ac9ad8d809e9b65b3c638eebc345e` | 1 hint dan 0 field prompt/explanation ditinjau; ID/opsi/key tetap. |
| `questions/mathematics/algebra/ALGEBRA 05.json` | `838881b9543094f4d13a330424c8f4f55f764e88aced53bb09eeaf14e75be858` | `3a05f9739b29abf3e1f0c9d56b24bbec627a30191ae87b53bf7a5d529b7e8e62` | 2 hint dan 0 field prompt/explanation ditinjau; ID/opsi/key tetap. |
| `questions/mathematics/algebra/ALGEBRA 06.json` | `53d61ebf25b229014b803fff37ecb5d930692880388d707132e5a13eb621b673` | `a48ccbe0fd46c0febce9853260254756bc93c1875360895fb85858c0fa445ad7` | 1 hint dan 0 field prompt/explanation ditinjau; ID/opsi/key tetap. |
| `questions/mathematics/algebra/FIRST MATH.json` | `be4966d25522f49f15047f6a2b24ed5de2e0f0e625eecef89b22867c809c319b` | `8b612a611d11d85b8ff8bf525682650c9d54a31c18fdb827d100781510f97818` | 0 hint dan 2 field prompt/explanation ditinjau; ID/opsi/key tetap. |
| `questions/mathematics/arithmetic/arithmetic-02.json` | `c52209cb12b053e0122c8ee926d6be7f11841cdbfce8c8da86b4ed5bfdde262f` | `24dbddce1f39b12be053185942fc7be919ffeb73bec8e2134c81dc784fc50083` | 0 hint dan 1 field prompt/explanation ditinjau; ID/opsi/key tetap. |
| `questions/mathematics/arithmetic/arithmetic-03.json` | `91241dba8999d938762d369d953081795b85336371f4adf1d74c29f47c2b2126` | `8be147bf62d6bdb8a273b8f5db427679f7ffb6e90c3962276d68ed80afd0ad8e` | 0 hint dan 6 field prompt/explanation ditinjau; ID/opsi/key tetap. |
| `questions/mathematics/calculus/BASIC CALCULUS-2.json` | `7d6180bfd7339157058f33442b641fe984899276484afa2fa2ce5078258f1751` | `c885c95a8a06117184984684bc16661c1cf2eb6ada4679a58a83db7fd417b2e3` | 1 hint dan 0 field prompt/explanation ditinjau; ID/opsi/key tetap. |
| `questions/mathematics/logic/logic-03.json` | `3388ceef4ac4ef77837b1c64ccd293ead2bc5c3436340a9603f07880077fd450` | `cfd9d3d728fc12a2a0f5b63bb2ddbd622cfb457c5dd4400edf9f05e70ef6fea5` | 5 hint dan 0 field prompt/explanation ditinjau; ID/opsi/key tetap. |
| `questions/mathematics/logic/logic-05.json` | `7c08d70c7c878e3fcd4e565f3b29253d16c4ce03bd54ca249b66b80ca6240705` | `8760b2a2a7e0ddb16cbd6da5aa106984fd72bf2571756485d4c6e1da9f1b1d41` | 10 hint dan 0 field prompt/explanation ditinjau; ID/opsi/key tetap. |
| `questions/mathematics/math-snack/math-snack-07.json` | `6ee81a47954f0774f89839b35e143e35a1b6ef3ddc9f3a1dbc63f087a8dfef07` | `971410c9df3ee55cb9d97adff4d11d02532d3ffafd5bb04bf6f057117d26e6db` | 0 hint dan 4 field prompt/explanation ditinjau; ID/opsi/key tetap. |
| `questions/mathematics/math-snack/math-snack-08.json` | `eb19bb4b870b3a1bc17d379b4e30d8be37e1631a49ce3e9f0addb5c5c676b0b7` | `b45a74f3e9d88e146c9345d3e65c46e18d63f8ea94556227b978108751d0206e` | 0 hint dan 4 field prompt/explanation ditinjau; ID/opsi/key tetap. |
| `questions/mathematics/statistics/LEARN STATISTICS 1.json` | `ae73a7ea4692aa89fd8876a367836b6bec6f68736feab20f1e3f300e14cc712b` | `ceada9ca8e24a1279d768d8326b713be1b410a75a9ccde8436096938bbe6f790` | 2 hint dan 1 field prompt/explanation ditinjau; ID/opsi/key tetap. |
| `questions/mathematics/statistics/LEARN STATISTICS 4.json` | `f81be6a834e65128300cdd7fba8f828168ad48b1249ea751f70a0b06381edbde` | `10f3eacb5d53e8e682853a6f7e6210e44188505a35c137b99012fd2e43ce471e` | 1 hint dan 12 field prompt/explanation ditinjau; ID/opsi/key tetap. |
| `questions/mathematics/statistics/LEARN STATISTICS 5.json` | `cb144ea0cd728117e2008345028c705f22dea962370d6e214006dbec1e033ecc` | `e53d86d3c788258f2a67081cba4c18c2a78c3c9efbf2c36942bfd185356e2387` | 0 hint dan 18 field prompt/explanation ditinjau; ID/opsi/key tetap. |
| `questions/quiz/quiz - 09.json` | `c51cf63f19df1b88349f9debc591de3ca00a246518e11aee8f4844a6711c2b6b` | `8402b82a8bf40405dea8ae2aa0c166715b84c1325395f886185916e43d32b709` | 0 hint dan 5 field prompt/explanation ditinjau; ID/opsi/key tetap. |
| `questions/quiz/quiz - 101.json` | `02a4c9c2821d8d644c233ce4b8ac52f187d3f3858bbf53250b44f728a1c18aee` | `2f8f18cdfc025b65c6a07a4ef3bc0cc16a1c399120577c306ba2e134a7b5a041` | 1 hint dan 0 field prompt/explanation ditinjau; ID/opsi/key tetap. |
| `questions/quiz/quiz - 102.json` | `cd1d056a063bc5ad21686c419c9e892fb7d4e6fa0be60e560836c736eedfd779` | `004bae412f3d769e9bf1099ebe002a0d6e631ba708e03239ef056a87f0daf55b` | 6 hint dan 0 field prompt/explanation ditinjau; ID/opsi/key tetap. |
| `questions/quiz/quiz - 103.json` | `8ed9783a67d658c3a56b2bc9e13b46904e73213a059af9c56a45857f39b133e5` | `218f37320db57c832bc5cb39de627352a2512e001e1509a49e22da4732088389` | 10 hint dan 0 field prompt/explanation ditinjau; ID/opsi/key tetap. |
| `questions/quiz/quiz - 104.json` | `fa968534b28b355dc0cce67166b4eb2de00906548c909f6ca63d55dd66f4cecf` | `4662a5cd2810dc9218d1e5e4dfcdf9c3f7d38f05ff3f13b1be18adcb18f1de92` | 4 hint dan 0 field prompt/explanation ditinjau; ID/opsi/key tetap. |
| `questions/quiz/quiz - 109.json` | `70ff52b17d950d8f700c37f4aa4757678e82665bc63a9cbb964f9053ea5f7d6c` | `238d3f818575fc3b75b32d191dfaf3f30d1bfc508af474cfe52574fe43ccd799` | 0 hint dan 9 field prompt/explanation ditinjau; ID/opsi/key tetap. |
| `questions/quiz/quiz - 15.json` | `d96631ea3d2e4cc664b45ab2324dd4f9c4e72e104d5ee72ad8d0efcc5df8a4a9` | `acda54b9aff7459cbb0b21c48636dff3244216852601178f1dd642ea3eb76e31` | 0 hint dan 6 field prompt/explanation ditinjau; ID/opsi/key tetap. |
| `questions/quiz/quiz - 27.json` | `a8bfe7faf8a3a5a6c58307170f930bb793a4299b070d117949f3f7f8e82552db` | `f7695ef13607a38a789a1a53685ea4b812e3dd2aee1b4cc8872881f61932de94` | 0 hint dan 1 field prompt/explanation ditinjau; ID/opsi/key tetap. |
| `questions/quiz/quiz - 31.json` | `cf68019e05f307d95098e15a37d2ee69330943c0fbb5837b77da22af9281a6fd` | `792bc3c48cf634d8638103f9a23fd9fe05107235ac8d70d1846775925688d162` | 0 hint dan 1 field prompt/explanation ditinjau; ID/opsi/key tetap. |
| `questions/quiz/quiz - 73.json` | `67f9f190f66e63d7a34863f93af107bc4fdc203ac7bf3d10b21f1a3ceeebbda2` | `2f10cd34711adda21c798b95a5d168f4f9aa17aac3779ce61694049571566773` | 8 hint dan 0 field prompt/explanation ditinjau; ID/opsi/key tetap. |


### Manifest: baseline historis berbeda dari source-before

- Hash **baseline historis**: `c288e1ba510c920c5bc3998e685732616edd24d637a5f511cee5b0292f141524`.
- Hash **source masuk**: `0d709f51fcd5f7041ef25d4071cc496ceafa4b30d55997897fd4a953d56fdb49`.
- Hash **final**: `3c4d706a6ad1c792281c9c305ec8cb95c1309b0e153ef3b264d5f06337d38c64`.

Penghapusan hanya blok ML dari source masuk menghasilkan hash historis secara **exact**, tanpa reformat JSON. Dengan demikian penambahan ML sah dipertahankan, baru title disetujui diselaraskan. Histori lama tetap. File ML sebelumnya **tidak terdaftar** baseline; source-before ML tetap dicatat lalu file didaftarkan melalui `--add-new`, yang **tidak mengubah hash protected file lama**.

Hash file baseline itu sendiri (bukan protected):

- Sebelum: `05e60374a93236c717b30bf5610bd3727004911a59a1d753faafce869f438377`.
- Sesudah: `1c2be2d1c01a3d3fb91821e89f1f9aa450f8c1ac36f929d963c0ee4b81163d97`.

Array `history` baseline menyimpan perubahan per tahap, termasuk hash intermediate hint sebelum perbaikan semantik, renderer sebelum/sesudah security dan geometry, serta alasan. Salinan lengkap history: [`audit/PROTECTED_CHANGES.json`](audit/PROTECTED_CHANGES.json). Tidak hanya hash final yang disimpan.

## 3. Seluruh file sumber yang diubah

| File sumber yang diubah | Cakupan perubahan |
|---|---|
| `.github/workflows/ci.yml` | Node 24 kedua job; komentar 2.527/baseline reviewed. |
| `CHANGE_SUMMARY.md` | Ringkasan fix saat ini; histori lama diarsipkan. |
| `CONTENT_INTEGRATION_HANDOVER.md` | Handover current, --add-new benar, pending/full validation jujur. |
| `QA_REPORT_CURRENT.md` | QA current menunjuk laporan dan hasil aktual, bukan snapshot lama. |
| `README.md` | Counts/current reports/protection contract/renderers/CI/scope deploy. |
| `assets/css/shell.css` | Empat nilai palette kontras, tanpa desain ulang. |
| `assets/data/bank-index.json` | Artefak generator resmi: counts/hash/available ML. |
| `master-manifest.json` | Name ML diselaraskan; semua ID/path/order/count tetap. |
| `practice/math-visuals.js` | Negative bar/zero-axis/category-label rendering. |
| `practice/venn-renderer.js` | Escaping label dan perbaikan geometri/nama set tiga-set. |
| `questions/comprehensive math/dynanca - 87.json` | 1 hint; 0 prompt/explanation. Teks lengkap di JSON before/after. |
| `questions/computer science/ml.json` | Title ML saja; 100 objek soal identik. |
| `questions/math gaokao/math gaokao - 134.json` | 1 hint; 0 prompt/explanation. Teks lengkap di JSON before/after. |
| `questions/math gaokao/math gaokao - 141.json` | 1 hint; 0 prompt/explanation. Teks lengkap di JSON before/after. |
| `questions/math gaokao/math gaokao - 16.json` | 1 hint; 0 prompt/explanation. Teks lengkap di JSON before/after. |
| `questions/math gaokao/math gaokao - 37.json` | 1 hint; 0 prompt/explanation. Teks lengkap di JSON before/after. |
| `questions/mathematics/algebra/ALGEBRA 04.json` | 1 hint; 0 prompt/explanation. Teks lengkap di JSON before/after. |
| `questions/mathematics/algebra/ALGEBRA 05.json` | 2 hint; 0 prompt/explanation. Teks lengkap di JSON before/after. |
| `questions/mathematics/algebra/ALGEBRA 06.json` | 1 hint; 0 prompt/explanation. Teks lengkap di JSON before/after. |
| `questions/mathematics/algebra/FIRST MATH.json` | 0 hint; 2 prompt/explanation. Teks lengkap di JSON before/after. |
| `questions/mathematics/arithmetic/arithmetic-02.json` | 0 hint; 1 prompt/explanation. Teks lengkap di JSON before/after. |
| `questions/mathematics/arithmetic/arithmetic-03.json` | 0 hint; 6 prompt/explanation. Teks lengkap di JSON before/after. |
| `questions/mathematics/calculus/BASIC CALCULUS-2.json` | 1 hint; 0 prompt/explanation. Teks lengkap di JSON before/after. |
| `questions/mathematics/logic/logic-03.json` | 5 hint; 0 prompt/explanation. Teks lengkap di JSON before/after. |
| `questions/mathematics/logic/logic-05.json` | 10 hint; 0 prompt/explanation. Teks lengkap di JSON before/after. |
| `questions/mathematics/math-snack/math-snack-07.json` | 0 hint; 4 prompt/explanation. Teks lengkap di JSON before/after. |
| `questions/mathematics/math-snack/math-snack-08.json` | 0 hint; 4 prompt/explanation. Teks lengkap di JSON before/after. |
| `questions/mathematics/statistics/LEARN STATISTICS 1.json` | 2 hint; 1 prompt/explanation. Teks lengkap di JSON before/after. |
| `questions/mathematics/statistics/LEARN STATISTICS 4.json` | 1 hint; 12 prompt/explanation. Teks lengkap di JSON before/after. |
| `questions/mathematics/statistics/LEARN STATISTICS 5.json` | 0 hint; 18 prompt/explanation. Teks lengkap di JSON before/after. |
| `questions/quiz/quiz - 09.json` | 0 hint; 5 prompt/explanation. Teks lengkap di JSON before/after. |
| `questions/quiz/quiz - 101.json` | 1 hint; 0 prompt/explanation. Teks lengkap di JSON before/after. |
| `questions/quiz/quiz - 102.json` | 6 hint; 0 prompt/explanation. Teks lengkap di JSON before/after. |
| `questions/quiz/quiz - 103.json` | 10 hint; 0 prompt/explanation. Teks lengkap di JSON before/after. |
| `questions/quiz/quiz - 104.json` | 4 hint; 0 prompt/explanation. Teks lengkap di JSON before/after. |
| `questions/quiz/quiz - 109.json` | 0 hint; 9 prompt/explanation. Teks lengkap di JSON before/after. |
| `questions/quiz/quiz - 15.json` | 0 hint; 6 prompt/explanation. Teks lengkap di JSON before/after. |
| `questions/quiz/quiz - 27.json` | 0 hint; 1 prompt/explanation. Teks lengkap di JSON before/after. |
| `questions/quiz/quiz - 31.json` | 0 hint; 1 prompt/explanation. Teks lengkap di JSON before/after. |
| `questions/quiz/quiz - 73.json` | 8 hint; 0 prompt/explanation. Teks lengkap di JSON before/after. |
| `tests/browser/practice.spec.js` | Ekspektasi CS diturunkan dari manifest/index, bukan hard-code satu. |
| `tests/browser/support.js` | Kontras alpha/opacity/placeholder, inactive, rasio tanpa pembulatan. |
| `tools/dev-server/serve.js` | Query string tetap dalam directory redirect 308. |
| `tools/ecosystem-validator/validate-ecosystem.js` | Komentar snapshot/handover diperbarui; logika validasi tidak berubah. |
| `tools/integrity/protected-baseline.json` | Hash yang ditinjau dan history; penambahan proteksi ML. |
| `tools/integrity/verify-protected.js` | Komentar/pesan menunjuk baseline disetujui; algoritma tidak berubah. |
| `tools/manifest-generator/generate-manifest.js` | Komentar counts terkini; tetap menolak overwrite JSON. |
| `tools/tests/run-tests.js` | Komentar dan tujuh regresi ML/hint/Venn/bar; sintaks tool baru ikut diperiksa. |


## 4. Kode dan dokumen baru

| Tambahan | Fungsi |
|---|---|
| `tools/qa/audit-content.py` | Audit read-only seluruh JSON/bank/soal, grammar AST terbatas, coverage dan kandidat numerik/duplikasi |
| `tools/qa/audit-mathjax.js` | Audit seluruh ekspresi dengan bundled MathJax di Chromium+CSP |
| `tests/browser/release-audit.spec.js` | 14 E2E tambahan ML seluruh alur/four widths/two themes/security/chart/redirect/Venn/contrast negative control |
| `audit/geometry/venn-outside-path.py` | Rekonstruksi analitis exposed circle arcs untuk outside highlight; bukan dependency runtime |
| `FINAL_AUDIT_REPORT.md`, `TEST_RESULTS.md`, `CHANGELOG_FIXES.md` | Laporan final berbasis bukti aktual |
| `docs/archive/*BEFORE_REAL_MCQ_FIX.md`, `REAL_MCQ_AUDIT_REPORT_INPUT.md` | Tiga snapshot dokumentasi sumber dan laporan input, tanpa menghapus histori |
| `audit/*.json`, `audit/*.md`, `audit/logs/`, `audit/screenshots/`, `audit/browser-evidence/`, `audit/manifest/` | Inventaris, before/after, keputusan/guard, reproduksi, hasil final, screenshot dan byte manifest rekonstruksi |
| `audit/SOURCE_CHANGES.patch`, `audit/FILE_DIFF.json`, `audit/PACKAGING_VERIFICATION.json` | Diff seluruh source changes, daftar tambahan dengan hash, pemeriksaan paket |

Semua path tambahan dan SHA-256 tersedia dalam `FILE_DIFF.json`; keluaran audit/screenshot tidak diduplikasi sebagai blok jutaan baris di patch. Patch mencakup **seluruh file sumber yang diubah** dan tambahan executable/docs utama. Artefak baru bersifat lengkap dalam ZIP dan dapat ditelusuri melalui inventaris/hash.

## 5. Empat hint wajib: teks before/after

| ID | Hint sebelum | Hint sesudah |
|---|---|---|
| `math-gaokao-134-q006` | The new term added when \(n\) increases from \(k\) to \(k+1\) is \(\frac{1}{(k+1)(k+2)}\). | Compare the summation limits in the two induction statements and identify which summand appears only in the longer sum. |
| `math-gaokao-37-q007` | Multiply by \(\sqrt{5}-\sqrt{2}\) and simplify the denominator. | Use the conjugate of the denominator to remove radicals from it, then check for a common factor. |
| `questions-mathematics-statistics-statistics-q300` | Step 1: identify the quantity or decision being asked for. Step 2: choose the definition or formula that matches the setting. Key idea: an estimator is unbiased when its expected value equals the parameter it targets: \(E[\hat{\theta}]=\theta\). | Imagine repeating the sampling procedure many times. Decide which condition concerns systematic estimation error rather than the variability of one estimate. |
| `questions-mathematics-statistics-statistics-q333` | Step 1: identify the quantity or decision being asked for. Step 2: choose the definition or formula that matches the setting. Key idea: as degrees of freedom increase, the t distribution approaches the standard normal distribution. | Consider the effect of estimating the scale from a growing sample and how the extra tail uncertainty changes. |


## 6. Seluruh perubahan konten per ID/field

Tabel berikut mencatat **semua 127 perubahan field**. Teks before/after tanpa pemotongan ada pada [`audit/CONTENT_CHANGES.json`](audit/CONTENT_CHANGES.json) (57 hint) dan [`audit/SEMANTIC_CONTENT_CHANGES.json`](audit/SEMANTIC_CONTENT_CHANGES.json) (70 prompt/explanation), juga pada unified diff. Perubahan title ML di luar hitungan objek soal.

| ID | Field | File | Alasan review |
|---|---|---|---|
| `dynanca-87-q004` | `hint` | `questions/comprehensive math/dynanca - 87.json` | Original singles out the correct carry condition. |
| `math-gaokao-134-q006` | `hint` | `questions/math gaokao/math gaokao - 134.json` | Original states the exact term to choose. |
| `math-gaokao-141-q004` | `hint` | `questions/math gaokao/math gaokao - 141.json` | Original names the final expression in the correct option. |
| `math-gaokao-37-q007` | `hint` | `questions/math gaokao/math gaokao - 37.json` | Original contains the simplified answer. |
| `algebra-04-q019` | `hint` | `questions/mathematics/algebra/ALGEBRA 04.json` | Original contains the simplified answer. |
| `algebra-05-q189` | `hint` | `questions/mathematics/algebra/ALGEBRA 05.json` | Original explicitly names the conic asked for. |
| `algebra-05-q190` | `hint` | `questions/mathematics/algebra/ALGEBRA 05.json` | Original explicitly names the conic asked for. |
| `algebra-06-q139` | `hint` | `questions/mathematics/algebra/ALGEBRA 06.json` | Original states the requested form. |
| `basic-calculus-2-q410` | `hint` | `questions/mathematics/calculus/BASIC CALCULUS-2.json` | Original states both descriptors of the correct graph. |
| `questions-mathematics-logic-logic-03-q023` | `hint` | `questions/mathematics/logic/logic-03.json` | Original singles out the correct expression among the alternatives. |
| `questions-mathematics-logic-logic-03-q028` | `hint` | `questions/mathematics/logic/logic-03.json` | Original singles out the correct expression among the alternatives. |
| `questions-mathematics-logic-logic-03-q034` | `hint` | `questions/mathematics/logic/logic-03.json` | Original singles out the correct expression among the alternatives. |
| `questions-mathematics-logic-logic-03-q035` | `hint` | `questions/mathematics/logic/logic-03.json` | Original singles out the correct expression among the alternatives. |
| `questions-mathematics-logic-logic-03-q037` | `hint` | `questions/mathematics/logic/logic-03.json` | Original singles out the correct expression among the alternatives. |
| `questions-mathematics-logic-logic-05-q021` | `hint` | `questions/mathematics/logic/logic-05.json` | Original names the condition asked for. |
| `questions-mathematics-logic-logic-05-q051` | `hint` | `questions/mathematics/logic/logic-05.json` | Original names the condition asked for. |
| `questions-mathematics-logic-logic-05-q081` | `hint` | `questions/mathematics/logic/logic-05.json` | Original names the condition asked for. |
| `questions-mathematics-logic-logic-05-q111` | `hint` | `questions/mathematics/logic/logic-05.json` | Original names the condition asked for. |
| `questions-mathematics-logic-logic-05-q141` | `hint` | `questions/mathematics/logic/logic-05.json` | Original names the condition asked for. |
| `questions-mathematics-logic-logic-05-q171` | `hint` | `questions/mathematics/logic/logic-05.json` | Original names the condition asked for. |
| `questions-mathematics-logic-logic-05-q201` | `hint` | `questions/mathematics/logic/logic-05.json` | Original names the condition asked for. |
| `questions-mathematics-logic-logic-05-q231` | `hint` | `questions/mathematics/logic/logic-05.json` | Original names the condition asked for. |
| `questions-mathematics-logic-logic-05-q261` | `hint` | `questions/mathematics/logic/logic-05.json` | Original names the condition asked for. |
| `questions-mathematics-logic-logic-05-q291` | `hint` | `questions/mathematics/logic/logic-05.json` | Original names the condition asked for. |
| `questions-mathematics-statistics-statistics-q300` | `hint` | `questions/mathematics/statistics/LEARN STATISTICS 1.json` | Original states the defining equality that is the answer. |
| `questions-mathematics-statistics-statistics-q333` | `hint` | `questions/mathematics/statistics/LEARN STATISTICS 1.json` | Original names the limiting distribution. |
| `questions-mathematics-statistics-statistics-learning-03-q045` | `hint` | `questions/mathematics/statistics/LEARN STATISTICS 4.json` | Original applies the definition and names the answer. |
| `quiz-101-q062` | `hint` | `questions/quiz/quiz - 101.json` | Original names the requested result. |
| `math-gaokao-16-q005` | `hint` | `questions/math gaokao/math gaokao - 16.json` | Original gives the result for the exact expression or stated inputs. |
| `quiz-102-q039` | `hint` | `questions/quiz/quiz - 102.json` | Original gives the result for the exact expression or stated inputs. |
| `quiz-102-q048` | `hint` | `questions/quiz/quiz - 102.json` | Original gives the result for the exact expression or stated inputs. |
| `quiz-102-q060` | `hint` | `questions/quiz/quiz - 102.json` | Original gives the result for the exact expression or stated inputs. |
| `quiz-102-q062` | `hint` | `questions/quiz/quiz - 102.json` | Original gives the result for the exact expression or stated inputs. |
| `quiz-103-q046` | `hint` | `questions/quiz/quiz - 103.json` | Original gives the result for the exact expression or stated inputs. |
| `quiz-103-q050` | `hint` | `questions/quiz/quiz - 103.json` | Original gives the result for the exact expression or stated inputs. |
| `quiz-103-q129` | `hint` | `questions/quiz/quiz - 103.json` | Original gives the result for the exact expression or stated inputs. |
| `quiz-104-2-q022` | `hint` | `questions/quiz/quiz - 104.json` | Original gives the result for the exact expression or stated inputs. |
| `quiz-104-2-q023` | `hint` | `questions/quiz/quiz - 104.json` | Original gives the result for the exact expression or stated inputs. |
| `quiz-104-2-q026` | `hint` | `questions/quiz/quiz - 104.json` | Original gives the result for the exact expression or stated inputs. |
| `quiz-103-q117` | `hint` | `questions/quiz/quiz - 103.json` | Original displays the exact expression to choose. |
| `quiz-103-q118` | `hint` | `questions/quiz/quiz - 103.json` | Original displays the exact expression to choose. |
| `quiz-103-q119` | `hint` | `questions/quiz/quiz - 103.json` | Original displays the exact expression to choose. |
| `questions-quiz-quiz-73-q001` | `hint` | `questions/quiz/quiz - 73.json` | Original paraphrases the correct option in full. |
| `questions-quiz-quiz-73-q006` | `hint` | `questions/quiz/quiz - 73.json` | Original paraphrases the correct option in full. |
| `questions-quiz-quiz-73-q008` | `hint` | `questions/quiz/quiz - 73.json` | Original paraphrases the correct option in full. |
| `questions-quiz-quiz-73-q009` | `hint` | `questions/quiz/quiz - 73.json` | Original paraphrases the correct option in full. |
| `questions-quiz-quiz-73-q014` | `hint` | `questions/quiz/quiz - 73.json` | Original paraphrases the correct option in full. |
| `questions-quiz-quiz-73-q016` | `hint` | `questions/quiz/quiz - 73.json` | Original paraphrases the correct option in full. |
| `questions-quiz-quiz-73-q018` | `hint` | `questions/quiz/quiz - 73.json` | Original paraphrases the correct option in full. |
| `questions-quiz-quiz-73-q020` | `hint` | `questions/quiz/quiz - 73.json` | Original paraphrases the correct option in full. |
| `quiz-102-q004` | `hint` | `questions/quiz/quiz - 102.json` | Supplemental scan: original explicitly supplies the final truth value. |
| `quiz-102-q049` | `hint` | `questions/quiz/quiz - 102.json` | Supplemental scan: original explicitly supplies the final truth value. |
| `quiz-103-q002` | `hint` | `questions/quiz/quiz - 103.json` | Supplemental scan: original explicitly supplies the final truth value. |
| `quiz-103-q010` | `hint` | `questions/quiz/quiz - 103.json` | Supplemental scan: original explicitly supplies the final truth value. |
| `quiz-103-q051` | `hint` | `questions/quiz/quiz - 103.json` | Supplemental scan: original explicitly supplies the final truth value. |
| `quiz-103-q125` | `hint` | `questions/quiz/quiz - 103.json` | Supplemental scan: original explicitly supplies the final truth value. |
| `quiz-104-2-q028` | `hint` | `questions/quiz/quiz - 104.json` | Supplemental scan: original explicitly supplies the final truth value. |
| `questions-mathematics-algebra-first-math-600-q083` | `question` | `questions/mathematics/algebra/FIRST MATH.json` | Two options represent the correct numeric value; explicit requested canonical fraction disambiguates the existing approved key without changing options. |
| `questions-mathematics-algebra-first-math-600-q084` | `question` | `questions/mathematics/algebra/FIRST MATH.json` | Two options represent the correct numeric value; explicit requested canonical fraction disambiguates the existing approved key without changing options. |
| `questions-mathematics-statistics-statistics-q439` | `question` | `questions/mathematics/statistics/LEARN STATISTICS 1.json` | Two options represent the correct numeric value; explicit requested canonical fraction disambiguates the existing approved key without changing options. |
| `questions-quiz-quiz-31-q017` | `question` | `questions/quiz/quiz - 31.json` | Both 2^6 and 4^3 have the correct value; specify the intended base for the exponent-law task. |
| `questions-mathematics-statistics-statistics-learning-03-q007` | `explanation` | `questions/mathematics/statistics/LEARN STATISTICS 4.json` | Verified arithmetic agrees with the rounded result; mark approximation instead of exact equality. |
| `questions-mathematics-statistics-statistics-learning-03-q007` | `question` | `questions/mathematics/statistics/LEARN STATISTICS 4.json` | Stored answer is a two-decimal approximation; state the requested precision explicitly. |
| `questions-mathematics-statistics-statistics-learning-03-q011` | `explanation` | `questions/mathematics/statistics/LEARN STATISTICS 4.json` | Verified arithmetic agrees with the rounded result; mark approximation instead of exact equality. |
| `questions-mathematics-statistics-statistics-learning-03-q011` | `question` | `questions/mathematics/statistics/LEARN STATISTICS 4.json` | Stored answer is a two-decimal approximation; state the requested precision explicitly. |
| `questions-mathematics-statistics-statistics-learning-03-q019` | `explanation` | `questions/mathematics/statistics/LEARN STATISTICS 4.json` | Verified arithmetic agrees with the rounded result; mark approximation instead of exact equality. |
| `questions-mathematics-statistics-statistics-learning-03-q019` | `question` | `questions/mathematics/statistics/LEARN STATISTICS 4.json` | Stored answer is a two-decimal approximation; state the requested precision explicitly. |
| `questions-mathematics-statistics-statistics-learning-03-q027` | `explanation` | `questions/mathematics/statistics/LEARN STATISTICS 4.json` | Verified arithmetic agrees with the rounded result; mark approximation instead of exact equality. |
| `questions-mathematics-statistics-statistics-learning-03-q027` | `question` | `questions/mathematics/statistics/LEARN STATISTICS 4.json` | Stored answer is a two-decimal approximation; state the requested precision explicitly. |
| `questions-mathematics-statistics-statistics-learning-03-q039` | `explanation` | `questions/mathematics/statistics/LEARN STATISTICS 4.json` | Verified arithmetic agrees with the rounded result; mark approximation instead of exact equality. |
| `questions-mathematics-statistics-statistics-learning-03-q039` | `question` | `questions/mathematics/statistics/LEARN STATISTICS 4.json` | Stored answer is a two-decimal approximation; state the requested precision explicitly. |
| `questions-mathematics-statistics-statistics-learning-03-q047` | `explanation` | `questions/mathematics/statistics/LEARN STATISTICS 4.json` | Verified arithmetic agrees with the rounded result; mark approximation instead of exact equality. |
| `questions-mathematics-statistics-statistics-learning-03-q047` | `question` | `questions/mathematics/statistics/LEARN STATISTICS 4.json` | Stored answer is a two-decimal approximation; state the requested precision explicitly. |
| `questions-mathematics-statistics-statistics-learning-04-q009` | `explanation` | `questions/mathematics/statistics/LEARN STATISTICS 5.json` | Verified arithmetic agrees with the rounded result; mark approximation instead of exact equality. |
| `questions-mathematics-statistics-statistics-learning-04-q009` | `question` | `questions/mathematics/statistics/LEARN STATISTICS 5.json` | Stored answer is a two-decimal approximation; state the requested precision explicitly. |
| `questions-mathematics-statistics-statistics-learning-04-q013` | `explanation` | `questions/mathematics/statistics/LEARN STATISTICS 5.json` | Verified arithmetic agrees with the rounded result; mark approximation instead of exact equality. |
| `questions-mathematics-statistics-statistics-learning-04-q013` | `question` | `questions/mathematics/statistics/LEARN STATISTICS 5.json` | Stored answer is a two-decimal approximation; state the requested precision explicitly. |
| `questions-mathematics-statistics-statistics-learning-04-q017` | `explanation` | `questions/mathematics/statistics/LEARN STATISTICS 5.json` | Verified arithmetic agrees with the rounded result; mark approximation instead of exact equality. |
| `questions-mathematics-statistics-statistics-learning-04-q017` | `question` | `questions/mathematics/statistics/LEARN STATISTICS 5.json` | Stored answer is a two-decimal approximation; state the requested precision explicitly. |
| `questions-mathematics-statistics-statistics-learning-04-q021` | `explanation` | `questions/mathematics/statistics/LEARN STATISTICS 5.json` | Verified arithmetic agrees with the rounded result; mark approximation instead of exact equality. |
| `questions-mathematics-statistics-statistics-learning-04-q021` | `question` | `questions/mathematics/statistics/LEARN STATISTICS 5.json` | Stored answer is a two-decimal approximation; state the requested precision explicitly. |
| `questions-mathematics-statistics-statistics-learning-04-q025` | `explanation` | `questions/mathematics/statistics/LEARN STATISTICS 5.json` | Verified arithmetic agrees with the rounded result; mark approximation instead of exact equality. |
| `questions-mathematics-statistics-statistics-learning-04-q025` | `question` | `questions/mathematics/statistics/LEARN STATISTICS 5.json` | Stored answer is a two-decimal approximation; state the requested precision explicitly. |
| `questions-mathematics-statistics-statistics-learning-04-q029` | `explanation` | `questions/mathematics/statistics/LEARN STATISTICS 5.json` | Verified arithmetic agrees with the rounded result; mark approximation instead of exact equality. |
| `questions-mathematics-statistics-statistics-learning-04-q029` | `question` | `questions/mathematics/statistics/LEARN STATISTICS 5.json` | Stored answer is a two-decimal approximation; state the requested precision explicitly. |
| `questions-mathematics-statistics-statistics-learning-04-q033` | `explanation` | `questions/mathematics/statistics/LEARN STATISTICS 5.json` | Verified arithmetic agrees with the rounded result; mark approximation instead of exact equality. |
| `questions-mathematics-statistics-statistics-learning-04-q033` | `question` | `questions/mathematics/statistics/LEARN STATISTICS 5.json` | Stored answer is a two-decimal approximation; state the requested precision explicitly. |
| `questions-mathematics-statistics-statistics-learning-04-q041` | `explanation` | `questions/mathematics/statistics/LEARN STATISTICS 5.json` | Verified arithmetic agrees with the rounded result; mark approximation instead of exact equality. |
| `questions-mathematics-statistics-statistics-learning-04-q041` | `question` | `questions/mathematics/statistics/LEARN STATISTICS 5.json` | Stored answer is a two-decimal approximation; state the requested precision explicitly. |
| `questions-mathematics-statistics-statistics-learning-04-q045` | `explanation` | `questions/mathematics/statistics/LEARN STATISTICS 5.json` | Verified arithmetic agrees with the rounded result; mark approximation instead of exact equality. |
| `questions-mathematics-statistics-statistics-learning-04-q045` | `question` | `questions/mathematics/statistics/LEARN STATISTICS 5.json` | Stored answer is a two-decimal approximation; state the requested precision explicitly. |
| `questions-mathematics-math-snack-math-snack-07-q075` | `explanation` | `questions/mathematics/math-snack/math-snack-07.json` | Verified arithmetic agrees with the rounded result; mark approximation instead of exact equality. |
| `questions-mathematics-math-snack-math-snack-07-q076` | `explanation` | `questions/mathematics/math-snack/math-snack-07.json` | Verified arithmetic agrees with the rounded result; mark approximation instead of exact equality. |
| `questions-mathematics-math-snack-math-snack-07-q126` | `explanation` | `questions/mathematics/math-snack/math-snack-07.json` | Verified arithmetic agrees with the rounded result; mark approximation instead of exact equality. |
| `questions-mathematics-math-snack-math-snack-07-q175` | `explanation` | `questions/mathematics/math-snack/math-snack-07.json` | Verified arithmetic agrees with the rounded result; mark approximation instead of exact equality. |
| `questions-mathematics-math-snack-math-snack-08-q168` | `explanation` | `questions/mathematics/math-snack/math-snack-08.json` | Verified arithmetic agrees with the rounded result; mark approximation instead of exact equality. |
| `questions-mathematics-math-snack-math-snack-08-q168` | `question` | `questions/mathematics/math-snack/math-snack-08.json` | Stored answer is a two-decimal approximation; state the requested precision explicitly. |
| `questions-mathematics-math-snack-math-snack-08-q172` | `explanation` | `questions/mathematics/math-snack/math-snack-08.json` | Verified arithmetic agrees with the rounded result; mark approximation instead of exact equality. |
| `questions-mathematics-math-snack-math-snack-08-q172` | `question` | `questions/mathematics/math-snack/math-snack-08.json` | Stored answer is a two-decimal approximation; state the requested precision explicitly. |
| `questions-quiz-quiz-15-q006` | `explanation` | `questions/quiz/quiz - 15.json` | Verified arithmetic agrees with the rounded result; mark approximation instead of exact equality. |
| `questions-quiz-quiz-15-q009` | `explanation` | `questions/quiz/quiz - 15.json` | Verified arithmetic agrees with the rounded result; mark approximation instead of exact equality. |
| `questions-quiz-quiz-15-q010` | `explanation` | `questions/quiz/quiz - 15.json` | Verified arithmetic agrees with the rounded result; mark approximation instead of exact equality. |
| `questions-quiz-quiz-15-q013` | `explanation` | `questions/quiz/quiz - 15.json` | Verified arithmetic agrees with the rounded result; mark approximation instead of exact equality. |
| `questions-quiz-quiz-15-q014` | `explanation` | `questions/quiz/quiz - 15.json` | Verified arithmetic agrees with the rounded result; mark approximation instead of exact equality. |
| `questions-quiz-quiz-15-q015` | `explanation` | `questions/quiz/quiz - 15.json` | Verified arithmetic agrees with the rounded result; mark approximation instead of exact equality. |
| `questions-quiz-quiz-27-q011` | `explanation` | `questions/quiz/quiz - 27.json` | Verified arithmetic agrees with the rounded result; mark approximation instead of exact equality. |
| `questions-mathematics-arithmetic-arithmetic-02-q043` | `explanation` | `questions/mathematics/arithmetic/arithmetic-02.json` | A percentage represents a fraction of 100; the multiplied numeric percentage coefficient must not be equated to the percentage-valued fraction. |
| `quiz-109-2-q084` | `explanation` | `questions/quiz/quiz - 109.json` | A percentage represents a fraction of 100; the multiplied numeric percentage coefficient must not be equated to the percentage-valued fraction. |
| `quiz-109-2-q095` | `explanation` | `questions/quiz/quiz - 109.json` | A percentage represents a fraction of 100; the multiplied numeric percentage coefficient must not be equated to the percentage-valued fraction. |
| `quiz-109-2-q110` | `explanation` | `questions/quiz/quiz - 109.json` | A percentage represents a fraction of 100; the multiplied numeric percentage coefficient must not be equated to the percentage-valued fraction. |
| `quiz-109-2-q162` | `explanation` | `questions/quiz/quiz - 109.json` | A percentage represents a fraction of 100; the multiplied numeric percentage coefficient must not be equated to the percentage-valued fraction. |
| `quiz-109-2-q176` | `explanation` | `questions/quiz/quiz - 109.json` | A percentage represents a fraction of 100; the multiplied numeric percentage coefficient must not be equated to the percentage-valued fraction. |
| `quiz-109-2-q184` | `explanation` | `questions/quiz/quiz - 109.json` | A percentage represents a fraction of 100; the multiplied numeric percentage coefficient must not be equated to the percentage-valued fraction. |
| `quiz-109-2-q186` | `explanation` | `questions/quiz/quiz - 109.json` | A percentage represents a fraction of 100; the multiplied numeric percentage coefficient must not be equated to the percentage-valued fraction. |
| `quiz-109-2-q190` | `explanation` | `questions/quiz/quiz - 109.json` | A percentage represents a fraction of 100; the multiplied numeric percentage coefficient must not be equated to the percentage-valued fraction. |
| `quiz-109-2-q198` | `explanation` | `questions/quiz/quiz - 109.json` | A percentage represents a fraction of 100; the multiplied numeric percentage coefficient must not be equated to the percentage-valued fraction. |
| `questions-mathematics-arithmetic-arithmetic-03-q003` | `explanation` | `questions/mathematics/arithmetic/arithmetic-03.json` | Replace a false literal equality caused by grouping/notation with the correct derived calculation; preserve the answer. |
| `questions-mathematics-arithmetic-arithmetic-03-q011` | `explanation` | `questions/mathematics/arithmetic/arithmetic-03.json` | Replace a false literal equality caused by grouping/notation with the correct derived calculation; preserve the answer. |
| `questions-mathematics-arithmetic-arithmetic-03-q017` | `explanation` | `questions/mathematics/arithmetic/arithmetic-03.json` | Replace a false literal equality caused by grouping/notation with the correct derived calculation; preserve the answer. |
| `questions-mathematics-arithmetic-arithmetic-03-q024` | `explanation` | `questions/mathematics/arithmetic/arithmetic-03.json` | Replace a false literal equality caused by grouping/notation with the correct derived calculation; preserve the answer. |
| `questions-mathematics-arithmetic-arithmetic-03-q032` | `explanation` | `questions/mathematics/arithmetic/arithmetic-03.json` | Replace a false literal equality caused by grouping/notation with the correct derived calculation; preserve the answer. |
| `questions-mathematics-arithmetic-arithmetic-03-q039` | `explanation` | `questions/mathematics/arithmetic/arithmetic-03.json` | Replace a false literal equality caused by grouping/notation with the correct derived calculation; preserve the answer. |
| `questions-quiz-quiz-09-q001` | `question` | `questions/quiz/quiz - 09.json` | Unambiguous grouping of fraction operands around division. The learning objective and worked solution establish fraction division; numerals, options and key retained. |
| `questions-quiz-quiz-09-q007` | `question` | `questions/quiz/quiz - 09.json` | Unambiguous grouping of fraction operands around division. The learning objective and worked solution establish fraction division; numerals, options and key retained. |
| `questions-quiz-quiz-09-q009` | `question` | `questions/quiz/quiz - 09.json` | Unambiguous grouping of fraction operands around division. The learning objective and worked solution establish fraction division; numerals, options and key retained. |
| `questions-quiz-quiz-09-q018` | `question` | `questions/quiz/quiz - 09.json` | Unambiguous grouping of fraction operands around division. The learning objective and worked solution establish fraction division; numerals, options and key retained. |
| `questions-quiz-quiz-09-q019` | `question` | `questions/quiz/quiz - 09.json` | Unambiguous grouping of fraction operands around division. The learning objective and worked solution establish fraction division; numerals, options and key retained. |


## 7. Dasar perbaikan dan validasi

Kandidat kemiripan/ekivalensi tidak otomatis dihapus. Dua alternatif/general rule hint, interval, ukuran matriks, opsi distractor bernilai sama, tugas representasi dan pernyataan salah disengaja tetap sesuai konteks. 134 sinyal numerik final telah diputuskan dengan guard soal cocok. Pembuktian semantik hanya grammar eligible/review terarah; unsupported `NOT_PROVEN`.

Perbaikan minimal pada salinan asli menghasilkan **148 PASS / 0 FAIL** tanpa perubahan tes/bank. Versi final menambah regresi dan pemeriksaan sintaks menjadi **157/0** Node, **120/0/0 SKIP** browser. Semua sembilan perintah wajib dijalankan; `npm run validate` exit 1 **hanya 1.761 pending**. Hash vendor/source dan perlindungan final lulus. Hasil rinci/log aktual/percobaan gagal yang dipertahankan: [`TEST_RESULTS.md`](TEST_RESULTS.md).

Rujukan primer untuk Node 24 dan metode kontras: [Node Release](https://github.com/nodejs/Release), [W3C SC 1.4.3](https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html), diperiksa 2026-10-08. Deployment Cloudflare/live CI tidak dilakukan; tidak ada hasil produksi yang diklaim.
