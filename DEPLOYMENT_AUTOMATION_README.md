> Historical supporting document. Current recovery status and evidence are in IMPLEMENTATION_REPORT.md, TEST_REPORT.md and CURRICULUM_UPDATE_GUIDE.md. This document alone does not certify the current release.

# DEPLOYMENT_AUTOMATION — companion package 1.2.0

Seluruh otomasi sudah termasuk source ZIP di `tools/release/`; pengguna biasa cukup memakai source ZIP dan `DEPLOYMENT_GUIDE_WINDOWS.md`.

Archive companion ini berisi scripts/config/package lock yang sama untuk inspeksi atau pemulihan tooling. Ini bukan website lengkap dan membutuhkan aplikasi, bank, validator serta test suite dari source ZIP versi 1.2.0. Untuk pemulihan, salin paths `tools/`, `package.json`, `package-lock.json` dan `wrangler.jsonc` ke root source yang cocok, lalu jalankan:

```bash
npm ci
npx playwright install chromium
npm run prepare:release
npm run preview
```

Build: `npm run build`. Quality checks: `npm run check` atau full `npm run prepare:release`. Preflight: `npm run preflight`. Preview upload: `npm run deploy:preview`. Production upload: `npm run deploy:production`. OAuth/project configuration dan verifier URL aktual ada di Windows guide. Deployment publik belum dilakukan selama audit.
