# CineVault

**CineVault** adalah prototipe etalase lisensi film statis untuk UTS Pemrograman Web. Penonton dapat memilih lisensi permanen atau menyewa film selama 48 jam—tanpa paket langganan. Situs ini dibuat hanya dengan HTML5, CSS3, JavaScript murni, dan berkas JSON; tidak ada framework, backend, pembayaran nyata, atau file film.

## Menjalankan situs

`fetch()` tidak dapat membaca berkas JSON lokal dengan aman jika `index.html` dibuka langsung melalui `file://`. Jalankan server file statis lokal dari folder proyek, misalnya:

```powershell
py -m http.server 8000
```

Buka **http://localhost:8000** di browser. Alternatifnya, gunakan ekstensi Live Server di Visual Studio Code. Tidak perlu memasang dependensi.

### Akun demo

- Email: `demo@cinevault.id`
- Kata sandi: `bioskop48`

Akun demo dimuat otomatis pada kunjungan pertama. Library contoh berisi satu lisensi permanen dan dua sewa 48 jam. Waktu sewa demo dimulai saat data awal dibuat di browser. Data, sesi demo, dan perubahan simulasi tetap berada di `localStorage` browser tersebut.

> **Catatan privasi dan keamanan:** akun, kata sandi demo, pesanan, lisensi, ulasan, dan progres tersimpan di browser untuk demonstrasi. Tidak ada autentikasi atau penyimpanan aman di server. Jangan gunakan kata sandi asli. Checkout hanya simulasi dan tidak meminta atau memproses informasi pembayaran.

## GitHub Pages

Untuk menerbitkan situs:

1. Unggah seluruh isi folder proyek ke sebuah repositori GitHub.
2. Buka **Settings → Pages**, pilih cabang publikasi (misalnya `main`) dan folder `/ (root)`, lalu simpan.
3. Setelah GitHub Pages selesai membangun situs, gunakan alamat berikut dengan mengganti nama pengguna dan repositori sesuai akunmu:

   `https://<nama-pengguna>.github.io/<nama-repositori>/`

File JSON dimuat dengan URL relatif `./data/...`, sehingga tetap berfungsi saat proyek diterbitkan di subfolder GitHub Pages. Alamat publik yang sebenarnya bergantung pada nama akun dan repositori dan baru tersedia setelah repositori diterbitkan.

## Struktur HTML

- [`index.html`](./index.html) menyediakan dokumen berbahasa Indonesia, tautan *skip to content*, sidebar navigasi semantik, bilah pencarian, landmark `<main>`, footer, region notifikasi aksesibel, dan dialog checkout.
- Setiap layar dirender sebagai tampilan halaman di dalam `<main>` menggunakan hash URL (`#beranda`, `#katalog`, `#film/...`, dan seterusnya). Setiap layar memiliki judul dan deskripsi yang tampil pada elemen header halaman.
- Navigasi utama selalu menyediakan **Beranda**, **Katalog**, **Komunitas**, **Library**, dan **Tentang Kami**. Wishlist, masuk, pendaftaran, detail, dan pemutar tersedia sebagai tampilan tambahan.
- Kartu film dan poster menggunakan struktur artikel, judul, tautan, tombol berlabel, serta status lisensi yang dapat dibaca pembaca layar.

## Desain CSS

[`styles.css`](./styles.css) membentuk tema gelap sinematik CineVault dengan warna arang, aksen koral hangat, aksen emas lembut, kartu film, dan komposisi banner orisinal. Sidebar dapat diciutkan di desktop dan menjadi navigasi seluler; kisi katalog, panel detail, Library, dan komunitas menyesuaikan ukuran layar.

Tiga contoh katalog memakai gambar poster film yang dimuat dari CDN The Movie Database (TMDB): *Interstellar*, *Spider-Man: Into the Spider-Verse*, dan *Your Name*. Entri lain tetap menggunakan poster CSS generatif sebagai fallback visual. Poster eksternal memerlukan koneksi internet; bila gambar gagal dimuat, ilustrasi CSS akan ditampilkan. Proyek ini hanya prototipe akademik dan tidak menyertakan video atau audio film.

## Fitur JavaScript

[`app.js`](./app.js) berisi router berbasis hash, komponen tampilan, delegasi event, pembaruan DOM, notifikasi, dan validasi formulir:

- **Fetch/AJAX:** katalog, genre, tipe lisensi, dan data relasional dimuat asinkron dari berkas JSON lokal pada folder [`data/`](./data). Kesalahan jaringan atau JSON ditampilkan secara eksplisit.
- **Pencarian dan filter:** pencarian judul, sutradara, sinopsis, dan genre; filter genre memperbarui kisi tanpa memindahkan fokus.
- **Carousel dan navigasi:** banner film pilihan dapat diganti, sidebar bisa diciutkan, tombol pintas `/` memfokuskan pencarian, dan menu seluler mendukung Escape.
- **Lisensi dan checkout simulasi:** harga dihitung sebagai `base_price × price_multiplier`. Lisensi sewa menyimpan waktu kedaluwarsa 48 jam sejak checkout; lisensi permanen tidak kedaluwarsa. Pembayaran hanya berupa dialog simulasi.
- **Library dan pemutar:** Library memperlihatkan hitung mundur yang diperbarui setiap detik. Halaman pemutar memeriksa lisensi aktif sebelum dibuka dan memeriksa kembali saat simulasi berjalan. Pemutar hanya menyimpan progres—**tidak ada video atau audio film** dalam proyek.
- **Wishlist dan komunitas:** wishlist, rating 1–10, ulasan, balasan bertingkat, dan suara “Membantu” tersimpan secara lokal. Ulasan baru, balasan, dan suara hanya dapat dikirim oleh pemilik lisensi aktif untuk film terkait.
- **Validasi:** formulir masuk, daftar, ulasan, dan balasan memiliki pemeriksaan serta pesan kesalahan inline. Pendaftaran memeriksa format email, panjang nama/kata sandi, email duplikat, dan kecocokan konfirmasi.
- **Persistensi:** perubahan simulasi tersimpan pada `localStorage` per browser. JSON awal merupakan seed; `localStorage` menampung keadaan pengguna setelah situs berjalan.
- **Aksesibilitas:** label formulir, status live, fokus keyboard yang tampak, tombol berlabel, `aria-current`, tautan lewati konten, dan dukungan `prefers-reduced-motion`.

## Data dan model

[`data/films.json`](./data/films.json), [`data/genres.json`](./data/genres.json), [`data/license-types.json`](./data/license-types.json), dan [`data/database.json`](./data/database.json) bersama-sama menyimulasikan 16 tabel: `users`, `user_profiles`, `films`, `genres`, `film_genres`, `license_types`, `orders`, `order_items`, `payments`, `user_licenses`, `reviews`, `review_comments`, `review_votes`, `wishlists`, `watch_history`, dan `notifications`. Ringkasan relasi dan batasan model tersedia di [`SRS.md`](./SRS.md).

## Pemeriksaan mandiri

- Buka katalog, cari film, lalu pilih genre.
- Buka detail film dan periksa dua opsi lisensi serta rumus harga.
- Masuk dengan akun demo; lihat hitung mundur sewa di Library dan buka pemutar film berlisensi.
- Coba membuka pemutar film tanpa lisensi—akses akan ditolak.
- Tambahkan film ke wishlist, tulis ulasan untuk film berlisensi, balas komentar, lalu beri atau cabut suara “Membantu”.
- Daftar akun baru untuk memeriksa validasi formulir dan alur akun lokal.
- Hapus data situs dari pengaturan browser untuk mengulang simulasi dari JSON awal.

