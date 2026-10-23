# Cakupan semantik dan keputusan konten

Pemeriksaan otomatis struktur mencakup semua 20.405 soal. Solver independen memakai grammar aritmetika/Boolean yang sengaja terbatas; dukungan parser bukan bukti semua semantik matematika. Soal yang tidak memenuhi template diberi `NOT_PROVEN` di `QUESTION_COVERAGE.json`.

- Seluruh 100 soal ML ditinjau menurut asumsi, definisi, kunci, pembahasan, dan konteksnya; 19 contoh numerik/aljabar memiliki derivasi eksplisit di `ML_CONTENT_REVIEW.json`. Isi 100 soal ML tetap sama dengan sumber. Uji browser 100 jawaban memakai kunci bank, sehingga tidak dianggap sebagai pembuktian semantik.
- Scan seluruh hint menghasilkan 176 kandidat awal dengan 64 hint berbeda. Setiap kandidat dibaca bersama soal dan opsi; 50 direvisi dan 126 dipertahankan. Tujuh hint tambahan yang langsung menyimpulkan hasil juga diperbaiki. Total 57 perubahan hint ada di `CONTENT_CHANGES.json`; kandidat awal dan keputusan ada di `HINT_REVIEW_INITIAL.json` / `HINT_REVIEW_DECISIONS.json`. Scan ini tidak membuktikan ketiadaan semua kebocoran melalui parafrase.
- Empat soal beropsi bernilai sama diperjelas bentuk hasilnya: tiga pecahan harus dalam bentuk paling sederhana dan satu hasil pangkat harus berbasis 2. Opsi dan kunci tetap.
- 17 soal rata-rata kini menyebut pembulatan dua desimal. 28 pembahasan memakai `\approx` untuk nilai yang memang dibulatkan, 10 notasi konversi persen diperbaiki, dan enam rantai aritmetika/pembagian bersisa disusun ulang agar persamaan benar.
- Lima prompt pembagian pecahan Quiz 09 memakai `\frac` untuk menghilangkan ambiguitas urutan operasi garis miring. Angka, opsi, dan kunci tetap sesuai solusi yang diperiksa.
- Scan akhir masih memberi 129 pasangan opsi ekuivalen numerik dan lima persamaan numerik berbeda. Semuanya ditinjau dalam konteks, dengan alasan tersimpan di `NUMERIC_REVIEW_DECISIONS.json`: salah opsi sama bukan dua jawaban benar; ukuran matriks bukan perkalian; interval bukan pengurangan; normalisasi/konversi bentuk adalah bagian tugas; lima persamaan memang contoh pernyataan salah atau kontradiksi. Tidak ada kandidat ini yang otomatis dihapus.
- Semua 29 kelompok duplikasi dipertahankan setelah verifikasi kunci. Niat pedagogis penulis tetap belum dapat dikonfirmasi; lihat `DUPLICATE_REVIEW.md`.

Batas cakupan: audit ini tidak membuktikan satu per satu seluruh 20.405 kunci/pembahasan simbolik, tidak mengesahkan isi 1.761 bank yang belum ada, dan tidak menjamin semua parafrase hint telah ditemukan. Keputusan yang terkonfirmasi telah diperbaiki; data benar dipertahankan.
