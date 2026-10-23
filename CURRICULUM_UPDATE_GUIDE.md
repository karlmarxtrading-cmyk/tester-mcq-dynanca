# Pembaruan kurikulum

Edit hanya master-manifest.json dan questions/**/*.json sesuai schema yang sudah ada. ID bank dan soal lama harus tetap stabil. Manifest terbaru pada paket ini memuat 1.236 bank/26.644 soal; angka tersebut bukan batas aplikasi.

Contoh entri pada subjects[].practice_files atau topics[].practice_files:
```json
{"id":"my-bank","name":"My Topic","file":"my-bank.json","path":"questions/computer science/my-bank.json","questionCount":20}
```
Bank memakai struktur bank yang sudah ada: id, title, questionCount, questions; salin pola metadata yang sesuai dari bank terkait. Setiap question.id harus unik global; opsi dan answer harus mengikuti schema aktual. Jika menambah soal, sesuaikan questionCount bank dan manifest. Nama file dengan spasi tetap didukung. Nama katalog memakai name pada manifest, sedangkan judul halaman latihan memakai title pada bank JSON. Perbarui keduanya melalui review/approval jika ingin judulnya sama; ID tetap dipertahankan.

1. Instal Node 22+ lalu npm ci. Jalankan npm run curriculum:review.
2. Baca reports/curriculum-proposal.json. Review menolak data invalid dan mencatat semua hash lama/baru, penambahan, penghapusan, serta perubahan file protected. Periksa substansi perubahan menggunakan diff editor/version control sebelum menyetujui.
3. Setelah pemilik menyetujui proposal tertentu, jalankan:
```bash
npm run curriculum:approve -- --proposal HASH_PROPOSAL --reason "Keputusan pemilik dan alasan perubahan"
```
Perintah ini adalah tindakan approval eksplisit, bukan bagian build. Source atau baseline yang berubah sesudah review membuat approval gagal. --add-new lama dinonaktifkan agar tidak melewati review.
4. npm run prepare:release menjalankan validasi, integrity, index, tes Node/release/kurikulum/browser, build, MathJax audit dan preflight. Kegagalan menghentikan release. Instal browser terlebih dahulu: npx playwright install chromium.
5. Deploy preview menggunakan workflow Wrangler yang sudah ada hanya setelah semua gate lulus. Verifikasi URL preview sebelum memublikasikan production. Tidak ada deployment dilakukan dalam pekerjaan ini.

Baseline paket source telah disahkan oleh pemilik untuk scope 1.236 bank/26.644 soal dan 321 perubahan. Approval diterapkan melalui CLI, bukan penyalinan baseline. Perubahan kurikulum berikutnya tetap memerlukan review dan approval baru.

Pemindahan path bank dengan ID bank/soal yang sama mempertahankan deep link berbasis ?quiz=ID dan progres berbasis ID. Validator memeriksa path baru; review menunjukkan file lama dihapus/file baru ditambahkan. Penggantian ID tidak otomatis dimigrasikan: perlu rencana migrasi eksplisit sebelum approval.

Rollback: simpan paket rilis sebelumnya, manifest, JSON, index dan baseline beserta history sebagai satu snapshot. Pulihkan snapshot lengkap, lalu jalankan prepare:release. Jangan mengembalikan baseline saja.

Laporan yang bertanggal 8/9 Oktober dalam source adalah bukti historis; lihat IMPLEMENTATION_REPORT.md dan TEST_REPORT.md untuk pekerjaan saat ini. Hash lokal tidak membuktikan bahwa orang yang menjalankan CLI adalah pemilik: otorisasi operasional dan kontrol repository tetap diperlukan.

Persetujuan pemilik: 2026-10-11; proposal `566f65f89f4ffd2fe467b0242c8d1c627aef09d3a4a0e736a092b39e65597b10`. Persetujuan ini mencakup baseline/scope; deployment belum dilakukan.
