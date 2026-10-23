# Revisi DYNANCA REAL MCQ

Status: BASELINE DISETUJUI — BUILD SOURCE LULUS — VERIFIKASI PREVIEW MENUNGGU.

Source terbaru digunakan sebagai kandidat tanpa memulihkan scope historis 2.527/2.528 bank dan tanpa menghapus konten soal. Perbandingan byte terhadap ZIP asli membuktikan seluruh 1.236 bank dan master-manifest.json tidak berubah. CONTENT_PRESERVATION.csv berisi SHA-256 setiap bank.

Indeks diregenerasi menjadi 1.236 available/0 pending/26.644 verified questions. Build kandidat menghasilkan 1.369 aset; 320 bank yang sebelumnya hilang kini tersedia. Release manifest berisi checksum seluruh aset.

Tool curriculum-update.js menyediakan review dan approval terpisah. Proposal terikat hash baseline dan seluruh perubahan protected; approval memvalidasi kembali data, menolak proposal usang/tampered, mencatat history dan memverifikasi baseline. Build tidak mengubah baseline. --add-new tidak lagi dapat melewati review.

Tes ML kini membedakan label katalog dari judul bank aktual tanpa mengubah keduanya. Tes browser baru membuka bank awal/akhir koleksi dan bank baru, typesetting, scoring serta reload. Tes kurikulum memakai salinan temporer; approval di sana hanya untuk pengujian.

Build dan prepare memakai validasi lengkap, sehingga bank manifest yang hilang memblokir release. Tes kurikulum masuk test/prepare. CI sekarang menjalankan gate penuh terhadap dist, bukan validator pending yang informasional. Proses prepare memakai lock eksklusif dan direktori hasil browser terpisah. Partisi pengujian semua bank menyesuaikan ukuran corpus; hitungan ML di tes mengikuti JSON aktual. Tidak ada redesign UI atau perubahan protected runtime/MathJax/CSP.

Baseline aktif source telah disahkan melalui approval CLI atas persetujuan eksplisit pemilik untuk 1.236 bank/26.644 soal dan 321 perubahan: satu manifest berubah + 320 bank baru; 916 bank lama identik. History baseline mencatat proposal dan alasan persetujuan. Build source aktual lulus. Dist tetap kandidat preview, belum deployment produksi.

Batas: tidak ada deployment Cloudflare/URL publik; tidak mengklaim verifikasi matematis independen 26.644 soal. Penggantian ID memerlukan migrasi khusus. Preview, browser lain/perangkat fisik dan validasi produksi tetap terpisah.

Protected baseline telah disahkan: perubahan 321 file mencakup manifest dan 320 bank baru. Selisih scope terhadap manifest historis dist adalah 3 entri baru, 1.294 entri historis tidak tercantum pada manifest terkini, dan 1 metadata entri berubah. Angka ini berbeda dari jumlah file bank baru karena banyak file baru sebelumnya sudah berupa referensi pending. Tidak ada penghapusan file bank dilakukan dalam revisi ini.

Persetujuan pemilik: 2026-10-11; proposal `566f65f89f4ffd2fe467b0242c8d1c627aef09d3a4a0e736a092b39e65597b10`. Persetujuan ini mencakup baseline/scope; deployment belum dilakukan.
