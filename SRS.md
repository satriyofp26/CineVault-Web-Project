# Software Requirements Specification (SRS) — CineVault

**Versi:** 1.0  
**Jenis sistem:** situs statis satu halaman untuk demonstrasi akademik  
**Bahasa antarmuka:** Bahasa Indonesia  
**Batas implementasi:** HTML5, CSS3, JavaScript tanpa framework, JSON lokal, dan `localStorage`

## 1. Tujuan dan ruang lingkup

CineVault merupakan prototipe etalase lisensi film. Pengunjung dapat menelusuri katalog, membandingkan pembelian lisensi permanen dengan sewa selama 48 jam, menyimpan film, serta mengelola koleksi contoh. Tidak ada langganan, layanan autentikasi server, pemutaran film sungguhan, pemrosesan pembayaran, atau backend. Semua perubahan data pengguna bersifat lokal pada browser yang dipakai.

Situs dijalankan melalui server HTTP statis lokal atau GitHub Pages. Pembukaan langsung lewat `file://` bukan cara menjalankan yang didukung karena kebijakan browser membatasi `fetch()` ke berkas JSON.

## 2. Pengguna dan asumsi

- **Pengunjung:** dapat melihat Beranda, Katalog, detail film, Tentang Kami, dan ulasan komunitas.
- **Pengguna demo/terdaftar:** selain kemampuan pengunjung, dapat membuka Library dan Wishlist; pengguna yang memiliki lisensi aktif atas suatu film dapat membuka pemutar simulasi, menulis ulasan, membalas komentar, dan memberikan suara pada ulasan tentang film tersebut.
- **Browser modern:** mendukung JavaScript ES6+, `fetch`, `localStorage`, elemen `<dialog>`, dan CSS Grid.
- Akun demo ditujukan untuk demonstrasi. Kredensial disimpan tanpa enkripsi dalam JSON/penyimpanan lokal dan bukan kredensial yang aman.

## 3. Persyaratan fungsional

| ID | Persyaratan |
|---|---|
| F-01 | Sistem menampilkan header/judul dan deskripsi pada tiap tampilan, navigasi Beranda, Katalog, Komunitas, Library, Tentang Kami, serta tautan Wishlist dan akun. |
| F-02 | Sistem memuat data film, genre, tipe lisensi, dan tabel seed melalui `fetch()` dari berkas JSON lokal dan menampilkan status kesalahan jika data tidak tersedia. |
| F-03 | Pengguna dapat mencari film berdasarkan judul, sutradara, sinopsis, dan genre serta menyaring hasil berdasarkan genre. |
| F-04 | Detail film menampilkan sinopsis, tahun, sutradara, durasi, rating, klasifikasi usia, genre, harga, dan pilihan lisensi. |
| F-05 | Harga lisensi dihitung dengan rumus `harga = base_price × price_multiplier`. Tipe sewa memiliki `duration_days = 2`; tipe permanen memiliki `duration_days = null`. |
| F-06 | Konfirmasi checkout simulasi membuat catatan pesanan, item pesanan, pembayaran simulasi, serta lisensi milik akun aktif. Pesanan tidak menghubungkan ke penyedia pembayaran dan tidak menarik uang. |
| F-07 | Lisensi sewa menyimpan `expires_at` tepat 48 jam setelah pembelian. Lisensi permanen tidak memiliki kedaluwarsa. |
| F-08 | Library menampilkan lisensi dan status sewa; hitung mundur sisa waktu diperbarui setiap detik. Lisensi berakhir tidak dapat membuka pemutar. |
| F-09 | Halaman pemutar hanya dapat diakses jika akun memiliki lisensi valid untuk film yang dipilih. Pemutar simulasi memperbarui dan menyimpan progres tontonan lokal tanpa konten film/audio. |
| F-10 | Pengguna dapat menambah dan menghapus film dari Wishlist; perubahan disimpan pada `localStorage`. |
| F-11 | Hanya pemilik lisensi aktif untuk film tertentu yang dapat membuat satu ulasan untuk film tersebut dengan rating integer 1–10 dan teks ulasan yang valid. |
| F-12 | Pemilik lisensi film dapat membuat balasan komentar bertingkat dan memberi/mencabut suara “Membantu” pada ulasan film itu. |
| F-13 | Formulir daftar memvalidasi nama (2–40 karakter), format email, email unik, kata sandi minimal 8 karakter, dan konfirmasi kata sandi. Formulir masuk memvalidasi isian dan kredensial lokal. Kesalahan ditampilkan di dekat field terkait. |
| F-14 | Sistem menyediakan carousel pilihan editor, toggle sidebar, menu responsif, pemberitahuan aksi, serta navigasi keyboard ke pencarian. |
| F-15 | Pengguna dapat keluar dari sesi akun dan mengulang data demo dengan menghapus penyimpanan situs browser. |

## 4. Persyaratan nonfungsional

| ID | Persyaratan |
|---|---|
| NF-01 | Halaman menggunakan elemen HTML semantik, satu bahasa dokumen (`lang="id"`), heading yang terstruktur, dan label formulir yang jelas. |
| NF-02 | Navigasi, tombol, formulir, status dinamis, dan fokus dapat digunakan dengan keyboard serta pembaca layar; hormati `prefers-reduced-motion`. |
| NF-03 | Tampilan responsif mendukung lebar desktop, tablet, dan ponsel tanpa framework CSS/JavaScript. |
| NF-04 | Aplikasi tidak mengirim data pribadi ke server eksternal. Data pengguna dan simulasi transaksi disimpan lokal pada browser. |
| NF-05 | Proyek dapat diterbitkan sebagai konten statis GitHub Pages tanpa langkah build dan tanpa backend. |
| NF-06 | Harga dan izin pemutar ditentukan dari data lisensi; lisensi sewa yang tidak memiliki waktu kedaluwarsa yang valid tidak dianggap aktif. |
| NF-07 | UI, notifikasi, error, kredit aset, serta petunjuk pengguna menggunakan Bahasa Indonesia. |
| NF-08 | Tiga judul contoh memuat poster dari CDN TMDB; judul lain menggunakan ilustrasi CSS generatif sebagai fallback. Tidak ada film audiovisual yang didistribusikan. |
| NF-09 | Kegagalan fetch, parsing data lokal, dan penyimpanan lokal disampaikan kepada pengguna, bukan disamarkan sebagai operasi berhasil. |

## 5. Use case

### UC-01 — Menjelajahi dan menyaring katalog

**Aktor:** pengunjung atau pengguna masuk  
**Prasyarat:** situs telah dimuat melalui HTTP dan JSON berhasil diambil.  
**Alur utama:** (1) Aktor membuka Katalog. (2) Aktor memasukkan judul, sutradara, sinopsis, atau genre. (3) Aktor dapat memilih satu genre. (4) Sistem memperbarui kisi hasil dan jumlah film tanpa memuat ulang dokumen.  
**Alur alternatif:** jika tidak ada hasil, sistem menampilkan pesan bahwa film tidak ditemukan.

### UC-02 — Membeli atau menyewa lisensi

**Aktor:** pengguna masuk  
**Prasyarat:** akun aktif dan data film/lisensi tersedia.  
**Alur utama:** (1) Aktor memilih film. (2) Sistem menampilkan opsi permanen dan sewa. (3) Sistem menghitung harga dari harga dasar dikalikan pengali lisensi. (4) Aktor meninjau dan mengonfirmasi dialog checkout. (5) Sistem menyimpan pesanan, item, pembayaran simulasi, dan lisensi ke `localStorage`. (6) Sistem membuka Library.  
**Alur alternatif:** jika belum masuk, sistem mengarahkan aktor ke halaman masuk. Jika lisensi sudah aktif, sistem memberi tahu pengguna dan tidak membuat transaksi duplikat.

### UC-03 — Menonton dari Library

**Aktor:** pemilik lisensi  
**Prasyarat:** lisensi permanen aktif atau lisensi sewa belum melewati `expires_at`.  
**Alur utama:** (1) Aktor membuka Library. (2) Sistem memperbarui sisa waktu sewa secara berkala. (3) Aktor memilih Tonton/Lanjutkan. (4) Sistem memeriksa ulang lisensi sebelum merender pemutar. (5) Kontrol pemutar simulasi memperbarui progres lokal pada riwayat tontonan.  
**Alur alternatif:** untuk lisensi berakhir, sistem menampilkan status kedaluwarsa dan tautan ke detail film; pemutar tidak dibuka.

### UC-04 — Membuat ulasan dan berdiskusi

**Aktor:** pemilik lisensi aktif  
**Prasyarat:** akun masuk dan memiliki lisensi aktif untuk film ulasan.  
**Alur utama:** (1) Aktor memilih film dari Library pada formulir komunitas. (2) Sistem menerima rating bilangan 1–10 serta ulasan 20–1.200 karakter. (3) Sistem menyimpan ulasan. (4) Pemilik lisensi dapat membalas komentar secara bertingkat dan menambah/mencabut suara membantu.  
**Alur alternatif:** sistem menampilkan kesalahan inline untuk film tanpa lisensi, rating di luar rentang, teks terlalu pendek/panjang, dan ulasan kedua dari pengguna yang sama atas film yang sama.

### UC-05 — Mendaftar dan masuk

**Aktor:** pengunjung  
**Prasyarat:** penyimpanan lokal browser tersedia.  
**Alur utama pendaftaran:** (1) Pengunjung mengisi nama, email, kata sandi, dan konfirmasi. (2) Sistem memeriksa seluruh format, batas panjang, kecocokan kata sandi, dan email unik. (3) Akun lokal dibuat dan sesi dimulai.  
**Alur utama masuk:** (1) Pengunjung memasukkan email dan kata sandi. (2) Sistem memeriksa data seed/akun lokal. (3) Sistem menyimpan sesi akun pada browser.  
**Alur alternatif:** kesalahan dijelaskan di dekat kolom formulir; tidak ada data yang dikirim ke server.

### UC-06 — Mengelola Wishlist

**Aktor:** pengguna masuk  
**Prasyarat:** akun aktif.  
**Alur utama:** pengguna menambah atau menghapus sebuah film dari Wishlist menggunakan tombol pada kartu/detail film. Sistem memperbarui tampilan dan tabel `wishlists` lokal. Tanpa akun, pengguna mendapat tautan masuk.

## 6. Ringkasan ERD — 16 tabel

```text
users 1──1 user_profiles
users 1──* orders 1──* order_items *──1 films
orders 1──* payments
users 1──* user_licenses *──1 films
license_types 1──* order_items
license_types 1──* user_licenses
films *──* genres                 (melalui film_genres)
users 1──* reviews *──1 films
reviews 1──* review_comments      (parent_id mengacu komentar induk)
users 1──* review_comments
users 1──* review_votes *──1 reviews
users 1──* wishlists *──1 films
users 1──* watch_history *──1 films
```

| Tabel | Kolom penting dan fungsi |
|---|---|
| `users` | `id`, `email`, `password`, `display_name`, `created_at`; akun demo lokal. Kata sandi tidak aman untuk produksi. |
| `user_profiles` | `user_id`, `avatar_initials`, `bio`; profil tampilan pengguna. |
| `films` | `id`, `title`, `year`, `director`, `duration_minutes`, `age_rating`, `base_price`, `rating`, `synopsis`, `poster_theme`, `poster_url` (opsional), `artwork_credits`; katalog statis. |
| `genres` | `id`, `name`; daftar genre. |
| `film_genres` | `film_id`, `genre_id`; relasi banyak-ke-banyak film/genre. |
| `license_types` | `id`, `name`, `duration_days`, `price_multiplier`; tipe permanen atau sewa. |
| `orders` | `id`, `user_id`, `total`, `status`, `created_at`; pesanan simulasi. |
| `order_items` | `id`, `order_id`, `film_id`, `license_type_id`, `unit_price`; film dan lisensi yang dibeli. |
| `payments` | `id`, `order_id`, `method`, `status`; bukti pembayaran **simulasi**. |
| `user_licenses` | `id`, `user_id`, `film_id`, `license_type_id`, `purchased_at`, `expires_at`, `order_id`; pemeriksaan akses menonton. |
| `reviews` | `id`, `user_id`, `film_id`, `rating`, `body`, `created_at`; rating integer 1–10 dan teks ulasan. |
| `review_comments` | `id`, `review_id`, `user_id`, `parent_id`, `body`, `created_at`; komentar dan balasan bertingkat. |
| `review_votes` | `review_id`, `user_id`, `vote`; satu suara membantu per pengguna per ulasan. |
| `wishlists` | `user_id`, `film_id`, `created_at`; daftar film pilihan pengguna. |
| `watch_history` | `user_id`, `film_id`, `progress_seconds`, `duration_seconds`, `updated_at`; progres simulasi tontonan. |
| `notifications` | seed daftar kosong untuk kebutuhan notifikasi lokal mendatang. Notifikasi UI saat ini berupa toast. |

Data statis katalog, genre, dan tipe lisensi berada dalam tiga berkas JSON tersendiri. Tabel pengguna dan relasi yang berubah dimuat dari `data/database.json`, kemudian status berjalan diserialisasi ke `localStorage`. Struktur ini mencontohkan relasi ERD tetapi **bukan** basis data transaksional: tidak ada transaksi atomic, keamanan akun, atau sinkronisasi antarbrowser.

## 7. Batasan dan penerimaan

- Satu browser/perangkat menyimpan satu keadaan demo/localStorage; menghapus data browser akan memulihkan JSON seed.
- Katalog berisi contoh film dan simulasi lisensi. Tiga judul memakai poster TMDB; entri lainnya menggunakan poster CSS generatif. Tidak tersedia streaming film.
- Pemutar, checkout, pembayaran, autentikasi, dan data relasional adalah simulasi sisi klien.
- Situs diterima untuk cakupan tugas jika semua navigasi utama tersedia, data termuat melalui fetch lokal, interaksi katalog dan lisensi berfungsi, akses pemutar mengikuti izin aktif, formulir memvalidasi masukan, tampilan responsif dapat digunakan, dan README/SRS menjelaskan implementasi serta batasnya.

