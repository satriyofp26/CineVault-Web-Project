# CineVault — Website Katalog Film

CineVault adalah prototipe website katalog film untuk UTS Pemrograman Web. Pengguna dapat menjelajahi film, mencari berdasarkan judul atau genre, melihat detail film, menyimpan film ke favorit, dan mencoba simulasi pembelian lisensi permanen atau penyewaan selama 48 jam.

Project ini dibuat menggunakan **HTML5, CSS3, JavaScript murni, dan JSON**, tanpa framework. Checkout, akun, dan pemutaran film masih berupa simulasi; website ini tidak memproses pembayaran sungguhan dan tidak menyediakan video film.

## 1. Struktur Project

```text
UTS/
├── index.html              # Struktur utama halaman
├── styles.css              # Desain, layout, dan responsivitas
├── app.js                  # Interaksi dan logika website
├── README.md               # Dokumentasi project
├── SRS.md                  # Software Requirements Specification
└── data/
    ├── films.json          # Data film
    ├── genres.json         # Data genre
    ├── license-types.json  # Jenis lisensi dan pengali harga
    └── database.json      # Data awal demo pengguna dan aktivitas
```

## 2. Struktur HTML

File [`index.html`](./index.html) menyediakan kerangka utama website, lalu menghubungkan `styles.css` dan `app.js`.

Beberapa elemen HTML yang digunakan:

- `<header>` untuk bagian atas website dan kolom pencarian.
- `<aside>` dan `<nav>` untuk sidebar serta menu navigasi.
- `<main>` sebagai tempat konten halaman yang ditampilkan oleh JavaScript.
- `<footer>` untuk bagian bawah halaman.
- `<form>`, `<input>`, dan `<button>` untuk pencarian, login, pendaftaran, ulasan, dan interaksi lainnya.
- `<dialog>` untuk menampilkan proses checkout simulasi.

Website menggunakan navigasi berbasis URL hash, misalnya `#beranda`, `#katalog`, dan `#library`. Elemen seperti `id`, `class`, dan `data-*` membantu JavaScript menemukan elemen serta mengetahui aksi yang dipilih pengguna.

## 3. Desain CSS

File [`styles.css`](./styles.css) mengatur tampilan visual CineVault, termasuk tema gelap, warna aksen, tipografi, kartu film, poster, tombol, formulir, dan jarak antarbagian.

Teknik CSS yang digunakan antara lain:

- **Flexbox dan Grid** untuk menyusun navigasi, kartu film, panel detail, dan bagian komunitas.
- **CSS variables** untuk mengelola warna dan nilai desain agar konsisten.
- **Media queries** untuk menyesuaikan layout pada ukuran layar yang berbeda.
- **Transitions dan hover/focus styles** untuk memberi respons visual saat pengguna berinteraksi.

Sebagian kartu menggunakan gambar poster film eksternal. Jika gambar poster tidak tersedia, website dapat menampilkan ilustrasi CSS sebagai fallback. Poster eksternal memerlukan koneksi internet.

## 4. Interaksi JavaScript

File [`app.js`](./app.js) mengatur perilaku website dan memperbarui konten halaman sesuai tindakan pengguna.

| Fitur/konsep | Penerapan di CineVault |
|---|---|
| **Fetch / AJAX** | `initialize()` mengambil data JSON dari folder `data/` menggunakan `fetch()` dan `Promise.all()`. |
| **DOM manipulation** | `render()` dan fungsi halaman menampilkan konten ke elemen utama website. |
| **Event handling** | Event listener menangani klik, input pencarian, pengiriman form, perubahan URL hash, dan keyboard. |
| **Pencarian dan filter** | `filteredFilms()` mencari film berdasarkan kata kunci dan genre. |
| **Form validation** | Form login, pendaftaran, ulasan, dan balasan memeriksa input serta menampilkan pesan kesalahan jika diperlukan. |
| **Navigasi halaman** | `routeInfo()` membaca hash URL, lalu `render()` menentukan halaman yang perlu ditampilkan. |
| **Penyimpanan lokal** | `saveDatabase()` menyimpan perubahan ke `localStorage`, sehingga data simulasi tetap ada saat halaman dimuat ulang pada browser yang sama. |
| **Lisensi dan checkout** | `priceFor()`, `submitCheckout()`, dan `isLicenseValid()` menangani perhitungan harga serta simulasi masa berlaku lisensi. |

### Alur aplikasi secara singkat

1. `initialize()` memuat data film, genre, jenis lisensi, dan data awal dari JSON.
2. Aplikasi membaca data yang sebelumnya tersimpan di `localStorage`, jika tersedia.
3. `routeInfo()` membaca alamat hash untuk mengetahui halaman yang diminta.
4. `render()` menampilkan halaman yang sesuai.
5. Event listener menjalankan fungsi yang sesuai ketika pengguna berinteraksi.
6. Perubahan data simulasi disimpan melalui `saveDatabase()`.

## 5. Data dan Penyimpanan

File JSON di folder [`data/`](./data) digunakan sebagai sumber data awal:

- `films.json`: informasi film seperti judul, deskripsi, tahun, dan harga dasar.
- `genres.json`: daftar genre film.
- `license-types.json`: pilihan lisensi beserta aturan harganya.
- `database.json`: data demo awal, seperti pengguna, lisensi, pesanan, wishlist, dan ulasan.

Data yang berubah selama penggunaan disimpan di **`localStorage` browser**, bukan di database server. Data lokal tersebut berlaku pada browser dan perangkat yang digunakan, serta bisa dihapus melalui pengaturan browser.

## 6. Cara Menjalankan Website

Karena website menggunakan `fetch()` untuk membaca file JSON, jalankan melalui server lokal dan jangan membuka `index.html` langsung dengan alamat `file://`.

**Menggunakan Python:**

```bash
python -m http.server 8000
```

Pada Windows, perintah berikut juga dapat digunakan jika Python terdaftar sebagai `py`:

```powershell
py -m http.server 8000
```

Jalankan perintah dari folder project yang berisi `index.html`, lalu buka **http://localhost:8000** di browser. Alternatifnya, gunakan ekstensi Live Server di Visual Studio Code.

### Akun demo

- **Email:** `demo@cinevault.id`
- **Kata sandi:** `bioskop48`

Akun ini hanya untuk demonstrasi. Data akun dan aktivitas simulasi disimpan di browser, jadi jangan gunakan kata sandi pribadi.

## 7. Hosting GitHub Pages

Untuk meng-host website:

1. Unggah file project ke repositori GitHub.
2. Buka **Settings → Pages** pada repositori.
3. Pilih branch yang digunakan, misalnya `main`, dan folder publikasi `/ (root)`, lalu simpan.
4. Setelah publikasi berhasil, buka alamat GitHub Pages yang ditampilkan GitHub.

**Alamat website:** `https://satriyofp26.github.io/CineVault-Web-Project/`

Ganti `<username>` dan `<nama-repositori>` dengan informasi repositori yang sebenarnya. Alamat final belum bisa ditentukan dari source code saja. File data dimuat menggunakan path relatif agar dapat digunakan saat project dipublikasikan pada subfolder GitHub Pages.

## 8. Pemeriksaan Fitur

Beberapa langkah sederhana untuk mencoba website:

1. Buka Beranda dan Katalog.
2. Cari film menggunakan kolom pencarian dan pilih genre.
3. Buka halaman detail film untuk melihat opsi lisensi.
4. Masuk menggunakan akun demo dan coba wishlist serta Library.
5. Coba checkout simulasi dan periksa perubahan data di Library.
6. Buka Komunitas untuk melihat fitur ulasan dan balasan.

## 9. Batasan Project

CineVault dibuat untuk demonstrasi interaksi web. Project ini belum menggunakan backend atau database server, pembayaran sungguhan, autentikasi produksi, maupun file video film. Data pengguna dan transaksi hanya simulasi lokal di browser.

Dokumentasi kebutuhan sistem dan rancangan fitur lebih lanjut tersedia pada [`SRS.md`](./SRS.md).
