> Historical supporting document. Current recovery status and evidence are in IMPLEMENTATION_REPORT.md, TEST_REPORT.md and CURRICULUM_UPDATE_GUIDE.md. This document alone does not certify the current release.

# Panduan Windows — Cloudflare Pages Direct Upload

Rilis 1.2.0, diperiksa 9 Oktober 2026. Tidak memerlukan repository. Deployment publik belum dijalankan dalam audit ini karena akun Cloudflare belum terautentikasi.

## 1. Pilih environment

**Windows 11 + Git Bash:** pasang Node.js 24 LTS dari https://nodejs.org/en/download, lalu buka ulang terminal. Paket memakai minimum Node 22 dan Wrangler resmi **4.149.0** yang dipin pada lockfile.

**Windows 10:** Cloudflare tidak menyatakan Windows 10 sebagai OS yang didukung Wrangler terbaru. Gunakan WSL2 dengan Ubuntu 22.04 atau lebih baru (glibc minimum 2.35), bukan menjanjikan compatibility native yang belum diuji.

Di PowerShell Administrator pada Windows 10 versi 2004/build 19041 atau lebih baru:

```powershell
wsl --install -d Ubuntu
```

Restart jika diminta. Buka terminal Ubuntu, lalu pasang Node.js 24 memakai nvm, sesuai petunjuk maintainer nvm untuk WSL:

```bash
sudo apt-get update
sudo apt-get install -y curl ca-certificates
curl -fL https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.8/install.sh -o /tmp/dynanca-nvm-install.sh
bash /tmp/dynanca-nvm-install.sh
source ~/.bashrc
nvm install 24
nvm alias default 24
node --version
npm --version
```

nvm adalah alat instalasi Node, bukan repository aplikasi. Gunakan terminal Ubuntu untuk semua perintah npm/deploy berikutnya. Simpan proyek di filesystem Linux, misalnya `~/dynanca`, agar dependency Windows tidak dipakai oleh Linux. Jangan menyalin `node_modules` antar-OS.

Sumber resmi:

- https://developers.cloudflare.com/workers/wrangler/install-and-update/
- https://learn.microsoft.com/en-us/windows/wsl/install
- https://nodejs.org/en/download
- https://github.com/nvm-sh/nvm#installing-and-updating

Instalasi pada mesin Windows fisik belum diuji dalam sesi ini; workflow Node diuji di Linux.

## 2. Ekstrak paket source

Ekstrak `DYNANCA_REAL_MCQ_PRODUCTION_READY.zip`. Buka terminal pada folder `DYNANCA_REAL_MCQ` yang berisi `package.json`.

Contoh Git Bash (sesuaikan lokasi folder saja):

```bash
cd "/c/Users/$USERNAME/Downloads/DYNANCA_REAL_MCQ"
node --version
npm --version
npm ci
npx playwright install chromium
npm run prepare:release
```

Di WSL, pemasangan browser berikut juga memasang dependency sistem Chromium:

```bash
npx playwright install --with-deps chromium
npm run prepare:release
```

Persiapan menghasilkan `dist/`, `RELEASE_MANIFEST.json`, serta `reports/quality-gate.json` setelah semua pemeriksaan lulus. Ini dapat memerlukan beberapa menit karena seluruh bank dan puluhan ribu ekspresi MathJax diuji. Jika gagal, baca nama log yang dicetak; jangan lanjutkan deploy.

## 3. Preview lokal

```bash
npm run preview
```

Buka http://127.0.0.1:8788. Periksa katalog, pencarian, satu latihan, hint, jawaban, Next, Previous, reload, review, reset dan kedua tema. Tekan Ctrl+C sebelum rebuild. Inspector memakai 9235; port aplikasi dapat diganti:

```bash
npm run preview -- --port 8790 --inspector-port 9237
```

Alternatif server Node untuk dist beserta security headers:

```bash
npm run preview:static
```

Preview Node tidak meniru seluruh redirect/cache Cloudflare; preview Wrangler juga sudah diuji terpisah pada audit ini.

## 4. Login resmi dan identifikasi project

```bash
npm run wrangler -- --version
npm run wrangler -- login
npm run wrangler -- whoami
npm run wrangler -- pages project list
```

Selesaikan OAuth di browser yang dibuka Wrangler. Jangan menuliskan API token pada prompt, laporan atau berkas website.

Gunakan kembali project **Direct Upload** yang kompatibel. Wrapper menolak project dengan Git integration dan tidak mengubah project aktif. Jika belum ada, tentukan nama project dan label branch produksi untuk project baru:

```bash
read -r -p "Nama project baru: " PAGES_PROJECT
read -r -p "Label branch produksi untuk project baru: " PAGES_PRODUCTION_BRANCH
npm run wrangler -- pages project create "$PAGES_PROJECT" --production-branch "$PAGES_PRODUCTION_BRANCH"
```

Perintah tersebut benar-benar membuat project baru; jalankan hanya jika diperlukan. Label branch tidak memerlukan repository Git.

Untuk project baru atau yang sudah ada:

```bash
read -r -p "Nama project Direct Upload: " PAGES_PROJECT
read -r -p "Label branch preview: " PAGES_PREVIEW_BRANCH
npm run configure:deployment -- --project "$PAGES_PROJECT" --preview-branch "$PAGES_PREVIEW_BRANCH"
```

Wrapper membaca identitas akun dan data project Cloudflare, termasuk `production_branch` aktual. Preview harus berbeda dari branch produksi. Identitas nonrahasia tersimpan pada `deployment.local.json`, yang tidak masuk dist atau paket rilis.

Jika akun Anda memiliki lebih dari satu Cloudflare account:

```bash
read -r -p "Cloudflare account ID: " PAGES_ACCOUNT_ID
npm run configure:deployment -- --project "$PAGES_PROJECT" --preview-branch "$PAGES_PREVIEW_BRANCH" --account "$PAGES_ACCOUNT_ID"
```

Tidak ada tebakan account/project. Data credentials diperoleh oleh wrapper melalui CLI resmi, dipakai hanya di memori dan header API, serta tidak dicetak dalam laporan aplikasi.

## 5. Preview deployment dan verifikasi

```bash
npm run deploy:preview
```

Perintah menjalankan ulang seluruh persiapan, memverifikasi project aktual, kemudian memanggil `wrangler pages deploy dist --project-name ... --branch ...` dari direktori kosong. Output yang diunggah tetap dist; tidak ada Functions/backend yang ditambahkan.

Salin URL deployment yang benar-benar dicetak Wrangler:

```bash
read -r -p "URL preview aktual: " PAGES_PREVIEW_URL
npm run verify:deployment -- --url "$PAGES_PREVIEW_URL"
```

Verifier membandingkan semua aset publik dengan SHA-256 lokal, memeriksa content type, 404 untuk file internal, CSP serta tampilan browser pada lima lebar layar. Perbedaan atau error membuat verifikasi gagal. Tidak ada URL fiktif di paket ini.

## 6. Production deployment

Setelah preview lulus dan pemeriksaan visual Anda selesai:

```bash
npm run deploy:production
read -r -p "URL production aktual: " PAGES_PRODUCTION_URL
npm run verify:deployment -- --url "$PAGES_PRODUCTION_URL"
```

Ini tindakan publikasi aktual. Wrapper mengambil branch produksi aktual dari API, bukan mengasumsikan `main`. Jangan membuka terminal lain untuk mengubah/rebuild source atau dist saat quality gate/deploy sedang berjalan.

## 7. Paket hasil build saja

`DYNANCA_CLOUDFLARE_DEPLOY.zip` berisi tepat isi dist, tanpa direktori pembungkus. Gunakan paket source untuk workflow npm lengkap di atas. Paket deploy berguna sebagai backup output yang sudah tervalidasi; ekstrak ke folder kosong, misalnya `release-dist`.

Untuk rilis biasa dan pemulihan backup, gunakan source ZIP dengan versi yang sama, jalankan `npm ci` serta `npm run prepare:release`, lalu gunakan `deploy:preview`/`deploy:production`. Wrapper tersebut memverifikasi ulang output dan mengisolasi pemanggilan Wrangler dari konfigurasi workspace. Jangan mengunggah `DYNANCA_REAL_MCQ` sebagai direktori aset.

Batas yang diverifikasi: Direct Upload melalui Wrangler 20.000 file dan 25 MiB per aset untuk batas konservatif Free; dashboard drag-and-drop 1.000 file. Output rilis berisi 1.049 file dan harus diunggah melalui Wrangler. Sumber: https://developers.cloudflare.com/pages/get-started/direct-upload/ dan https://developers.cloudflare.com/pages/platform/limits/.

## 8. Troubleshooting

| Gejala | Tindakan |
|---|---|
| `npm` tidak ditemukan | Pasang Node 24; buka ulang terminal. |
| OS Windows 10 / native workerd gagal | Gunakan WSL Ubuntu 22.04+; compatibility native tidak dijanjikan. |
| Playwright executable/dependency tidak ditemukan | Jalankan perintah instalasi Chromium pada environment yang sama. |
| Protected check gagal setelah menambah bank | Tinjau bank baru, lalu jalankan `--add-new`. Perubahan berkas lama memerlukan audit hash/diff yang benar. |
| Index stale | `npm run build:index`, lalu `npm run prepare:release`. |
| Full `validate` gagal hanya karena pending | Gunakan `validate:shipped`; jangan membuat placeholder. |
| `Not authenticated` / HTTP 401/403 | Login ulang, pastikan account dan izin Pages sesuai. |
| Project menggunakan Git | Pilih project Direct Upload kompatibel; tidak perlu menghapus project lama. |
| Preview branch sama dengan produksi | Pilih label preview lain, configure ulang. |
| Port dipakai / enumerasi interface lokal gagal | Gunakan port aplikasi/inspector eksplisit seperti contoh preview. |
| Peringatan Request.cf placeholder dalam preview | Metadata edge tidak tersedia di preview lokal; situs statis ini tidak membutuhkannya. |
| 1.000-file error dashboard | Upload hanya dist menggunakan Wrangler. Jangan menghapus aset fungsional. |
| MathJax terkena CSP | Periksa hash inline dan `verify:csp`; jangan melemahkan CSP script. |
| HTTP 404 saat rebuild preview | Hentikan preview sebelum rebuild, lalu mulai kembali. |

## 9. Rollback

Cloudflare Pages mendukung rollback ke **deployment produksi terdahulu yang sukses**, bukan deployment preview. Buka project → Deployments → All deployments → menu tiga titik pada target produksi → **Rollback to this deployment**. Verifikasi URL production sesudahnya.

Daftar riwayat melalui CLI:

```bash
npm run wrangler -- pages deployment list --project-name "$PAGES_PROJECT" --environment production
```

Jangan memakai `wrangler rollback` untuk Pages; itu perintah Workers. Riwayat/target project pengguna belum dapat diverifikasi tanpa autentikasi, sehingga rollback belum dijalankan dalam audit ini.

Simpan source ZIP, deploy ZIP, dan release manifest untuk setiap rilis. Jika target riwayat tidak tersedia, restore backup source ke folder terpisah, jalankan `npm ci` serta `prepare:release`, configure project yang sama, kemudian deploy ulang ke produksi. Ini deployment baru, bukan rollback riwayat.

Sumber: https://developers.cloudflare.com/pages/configuration/rollbacks/.

## 10. Checklist rilis

- [ ] OS/Node/browser sesuai dan `npm ci` berhasil.
- [ ] `npm run prepare:release` PASS tanpa skipped mandatory test.
- [ ] `npm run preflight` PASS, output hanya runtime.
- [ ] Katalog, latihan, MathJax/SVG, mobile, progres dan review diperiksa.
- [ ] Project Direct Upload, account, branch produksi aktual dan preview telah diverifikasi.
- [ ] Preview deployment serta `verify:deployment` PASS.
- [ ] Backup dan manifest tersedia.
- [ ] Production deploy dilakukan sengaja, kemudian diverifikasi pada URL aktual.
- [ ] Sisa bank pending dan keterbatasan review akademik tetap dilaporkan jujur.
