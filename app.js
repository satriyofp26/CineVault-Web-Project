"use strict";

const STORAGE_KEYS = {
  database: "cinevault.database.v1",
  user: "cinevault.current-user.v1"
};

const app = document.querySelector("#konten");
const toastRegion = document.querySelector("#toast-region");
const checkoutDialog = document.querySelector("#checkout-dialog");
const checkoutContent = document.querySelector("#checkout-content");
const money = new Intl.NumberFormat("id-ID", {
  style: "currency",
  currency: "IDR",
  maximumFractionDigits: 0
});

let catalog = { films: [], genres: [], licenseTypes: [], seed: null };
let database;
let currentUserId = null;
let currentRoute = "beranda";
let catalogQuery = "";
let catalogGenre = "";
let carouselIndex = 0;
let playerTimer = null;
let rentalTimer = null;
let toastTimer = null;
let toastSequence = 0;

const escapeHTML = (value) => String(value ?? "").replace(/[&<>"']/g, (character) => ({
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#39;"
})[character]);

const makeId = (prefix) => `${prefix}-${globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(16).slice(2)}`}`;
const clone = (value) => JSON.parse(JSON.stringify(value));
const filmById = (id) => catalog.films.find((film) => film.id === id);
const genreById = (id) => catalog.genres.find((genre) => genre.id === id);
const licenseTypeById = (id) => catalog.licenseTypes.find((type) => type.id === id);
const activeUser = () => database.users.find((user) => user.id === currentUserId) || null;
const userDisplayName = (userId) => database.users.find((user) => user.id === userId)?.display_name || "Penonton CineVault";
const belongsToCurrentUser = (license) => license.user_id === currentUserId;

function getUserLicenses(filmId) {
  return database.user_licenses.filter((license) => belongsToCurrentUser(license) && (!filmId || license.film_id === filmId));
}

function isLicenseValid(license) {
  if (!license) return false;
  const type = licenseTypeById(license.license_type_id);
  if (!type) return false;
  if (type.duration_days === null) return true;
  return Boolean(license.expires_at && new Date(license.expires_at).getTime() > Date.now());
}

function hasValidLicense(filmId) {
  return getUserLicenses(filmId).some(isLicenseValid);
}

function priceFor(film, type) {
  return Math.round(film.base_price * type.price_multiplier);
}

function saveDatabase() {
  try {
    localStorage.setItem(STORAGE_KEYS.database, JSON.stringify(database));
    return true;
  } catch (error) {
    console.error("CineVault gagal menyimpan perubahan ke penyimpanan lokal.", error);
    showToast("Perubahan belum tersimpan. Periksa ruang penyimpanan browser Anda.", "error");
    return false;
  }
}

function showToast(message, kind = "success") {
  const id = `toast-${++toastSequence}`;
  const icon = kind === "error" ? "!" : "✓";
  toastRegion.insertAdjacentHTML("beforeend", `
    <div class="toast toast--${kind}" id="${id}" role="status">
      <span class="toast-icon" aria-hidden="true">${icon}</span><span>${escapeHTML(message)}</span>
      <button class="toast-close" data-action="dismiss-toast" aria-label="Tutup pemberitahuan">×</button>
    </div>`);
  window.setTimeout(() => document.getElementById(id)?.remove(), 4600);
}

function posterMarkup(film, extraClass = "") {
  // Remote posters are optional: if one cannot load, the original CSS poster remains as fallback.
  const posterUrl = typeof film.poster_url === "string" && /^https:\/\/image\.tmdb\.org\/t\/p\/w500\//u.test(film.poster_url)
    ? film.poster_url
    : "";
  const posterClass = posterUrl ? "has-poster" : "";
  const posterImage = posterUrl
    ? `<img class="poster-photo" src="${escapeHTML(posterUrl)}" alt="" loading="lazy" decoding="async">`
    : "";
  return `<div class="poster-art poster-art--${escapeHTML(film.poster_theme)} ${extraClass} ${posterClass}" role="img" aria-label="Poster ${escapeHTML(film.title)}">
    ${posterImage}
    <span class="poster-kicker">KARYA CINEVAULT</span>
    <span class="poster-orbit" aria-hidden="true"></span>
    <span class="poster-title">${escapeHTML(film.title)}</span>
    <span class="poster-year">${escapeHTML(film.year)} · ILUSTRASI ORISINAL</span>
  </div>`;
}

function genreNames(filmId) {
  return database.film_genres
    .filter((entry) => entry.film_id === filmId)
    .map((entry) => genreById(entry.genre_id)?.name)
    .filter(Boolean);
}

function filmGenreLabels(filmId) {
  return genreNames(filmId).map((name) => `<span class="tag">${escapeHTML(name)}</span>`).join("");
}

function filmCard(film, { compact = false } = {}) {
  const wished = database.wishlists.some((entry) => entry.user_id === currentUserId && entry.film_id === film.id);
  const permanent = catalog.licenseTypes.find((type) => type.id === "permanen");
  const cardPrice = permanent ? priceFor(film, permanent) : film.base_price;
  return `<article class="film-card ${compact ? "film-card--compact" : ""}">
    <a class="film-card-link" href="#film/${encodeURIComponent(film.id)}" aria-label="Lihat detail film ${escapeHTML(film.title)}">
      <div class="film-card-art">${posterMarkup(film)}
        <span class="rating-badge"><span aria-hidden="true">★</span> ${escapeHTML(film.rating.toFixed(1))}</span>
        <span class="saving-badge" aria-label="Harga sewa 88 persen lebih rendah daripada lisensi permanen, dengan masa akses 48 jam">SEWA −88%</span>
        ${film.year >= 2026 ? '<span class="new-badge">BARU</span>' : ""}
        <span class="art-credit">${escapeHTML(film.artwork_credits)}</span>
      </div>
      <div class="film-card-info">
        <div class="film-card-titleline"><h3>${escapeHTML(film.title)}</h3><span>${escapeHTML(film.year)}</span></div>
        <p class="film-genres">${escapeHTML(genreNames(film.id).slice(0, 2).join(" · "))}</p>
        <div class="film-card-bottom"><span class="film-price">Dari ${money.format(Math.round(film.base_price * 0.12))}</span><span class="film-buy-price">${money.format(cardPrice)}</span></div>
      </div>
    </a>
    <button class="wishlist-toggle ${wished ? "is-active" : ""}" type="button" data-action="toggle-wishlist" data-film-id="${escapeHTML(film.id)}" aria-label="${wished ? "Hapus dari" : "Tambahkan ke"} daftar favorit: ${escapeHTML(film.title)}" aria-pressed="${wished}">
      <span aria-hidden="true">${wished ? "♥" : "♡"}</span>
    </button>
  </article>`;
}

function filmRail(title, films, link = "#katalog", options = {}) {
  const { eyebrow = "PILIHAN UNTUKMU", compact = false } = options;
  if (!films.length) return "";
  return `<section class="content-section">
    <div class="section-heading"><div><p class="eyebrow">${escapeHTML(eyebrow)}</p><h2>${escapeHTML(title)}</h2></div><a class="text-link" href="${link}">Lihat semua <span aria-hidden="true">↗</span></a></div>
    <div class="film-rail">${films.map((film) => filmCard(film, { compact })).join("")}</div>
  </section>`;
}

function pageHeader(eyebrow, title, description) {
  return `<header class="page-intro"><p class="eyebrow">${escapeHTML(eyebrow)}</p><h1>${escapeHTML(title)}</h1><p>${escapeHTML(description)}</p></header>`;
}

function pageBanner(eyebrow, title, description, modifier = "") {
  return `<header class="page-banner ${modifier}"><div><p class="eyebrow">${escapeHTML(eyebrow)}</p><h1>${escapeHTML(title)}</h1><p>${escapeHTML(description)}</p></div></header>`;
}

function getFeaturedFilms() {
  return [...catalog.films].sort((first, second) => second.rating - first.rating).slice(0, 4);
}

function homePage() {
  const featured = getFeaturedFilms();
  const feature = featured[carouselIndex % featured.length];
  const continueWatching = database.watch_history
    .filter((entry) => entry.user_id === currentUserId && hasValidLicense(entry.film_id))
    .sort((first, second) => new Date(second.updated_at) - new Date(first.updated_at))
    .map((entry) => filmById(entry.film_id))
    .filter(Boolean);
  const newest = [...catalog.films].sort((first, second) => second.year - first.year).slice(0, 5);
  const picks = [...catalog.films].sort((first, second) => second.rating - first.rating).slice(0, 5);
  return `<div class="page-content home-page">
    <section class="feature-wrap" aria-label="Film pilihan">
      <div class="feature-copy">${pageHeader("RUANG CERITA · NO. 01", "Satu film. Pilihanmu.", "Temukan cerita yang tinggal lebih lama. Beli lisensi permanen atau sewa 48 jam—tanpa langganan.")}</div>
      <div class="feature-card" id="feature-card" aria-live="polite">
        <div class="feature-art">${posterMarkup(feature, "poster-art--feature")}</div>
        <div class="feature-overlay"></div>
        <div class="feature-content">
          <div class="feature-topline"><span class="feature-label"><span class="live-dot" aria-hidden="true"></span> PILIHAN MINGGU INI</span><span class="feature-count">${String(carouselIndex + 1).padStart(2, "0")} <span>/ ${String(featured.length).padStart(2, "0")}</span></span></div>
          <div class="feature-bottom">
            <div><p class="eyebrow">${escapeHTML(genreNames(feature.id).join(" · "))} &nbsp;·&nbsp; ${feature.year}</p>
              <h2>${escapeHTML(feature.title)}</h2>
              <p class="feature-tagline">${escapeHTML(feature.tagline)}</p>
              <div class="feature-meta"><span class="rating-stars" aria-label="Penilaian ${feature.rating} dari 10">★ ${feature.rating.toFixed(1)}</span><span>${feature.duration_minutes} menit</span><span>${escapeHTML(feature.age_rating)}</span></div>
            </div>
            <div class="feature-ctas"><a class="button button--primary" href="#film/${encodeURIComponent(feature.id)}"><span aria-hidden="true">▶</span> Lihat film</a><button type="button" class="button button--glass" data-action="toggle-wishlist" data-film-id="${escapeHTML(feature.id)}" aria-label="Tambahkan ke daftar favorit: ${escapeHTML(feature.title)}">♡ <span>Simpan</span></button></div>
          </div>
          <aside class="feature-side-panel" aria-label="Informasi lisensi film pilihan">
            <p class="eyebrow">PILIH CARA MENONTON</p>
            <div class="side-panel-film"><span class="rating-stars">★ ${feature.rating.toFixed(1)}</span><span>${feature.rating_count} penilaian</span></div>
            <p class="side-panel-title">${escapeHTML(feature.title)}</p>
            <div class="side-panel-price"><span>Sewa 48 jam</span><strong>${money.format(Math.round(feature.base_price * 0.12))}</strong></div>
            <div class="side-panel-price"><span>Lisensi permanen</span><strong>${money.format(feature.base_price)}</strong></div>
            <span class="saving-badge saving-badge--panel" aria-label="Sewa 88 persen lebih rendah daripada lisensi permanen, dengan masa akses 48 jam">SEWA 88% LEBIH RINGAN*</span>
            <a href="#film/${encodeURIComponent(feature.id)}" class="button button--primary side-panel-link">Lihat pilihan lisensi <span aria-hidden="true">→</span></a>
            <p class="side-panel-footnote">*Dibandingkan harga permanen. Akses sewa berlaku 48 jam.</p>
          </aside>
        </div>
      </div>
      <div class="carousel-controls">
        <span class="carousel-caption">PILIHAN EDITOR CINEVAULT</span>
        <div><button type="button" class="carousel-arrow" data-action="carousel-prev" aria-label="Film sebelumnya">←</button><button type="button" class="carousel-arrow" data-action="carousel-next" aria-label="Film berikutnya">→</button></div>
      </div>
    </section>
    <section class="value-strip" aria-label="Keunggulan CineVault">
      <div><span class="value-icon" aria-hidden="true">◈</span><p><strong>Sekali bayar</strong><span>Tak ada tagihan bulanan.</span></p></div>
      <div><span class="value-icon" aria-hidden="true">∞</span><p><strong>Pilihan ada padamu</strong><span>Sewa 48 jam atau miliki selamanya.</span></p></div>
      <div><span class="value-icon" aria-hidden="true">⌂</span><p><strong>Library milikmu</strong><span>Koleksi tersimpan di satu tempat.</span></p></div>
    </section>
    ${continueWatching.length ? filmRail("Lanjutkan menonton", continueWatching, "#library", { eyebrow: "MASIH ADA CERITA" }) : ""}
    ${filmRail("Pilihan yang tak ingin dilewatkan", picks, "#katalog", { eyebrow: "DIKURASI UNTUKMU" })}
    ${filmRail("Pendatang baru", newest, "#katalog", { eyebrow: "BARU DI CINEVAULT" })}
    <section class="community-callout"><div><p class="eyebrow">CERITA JADI LEBIH SERU SAAT DIBAGIKAN</p><h2>Setelah menonton,<br>ceritakan kesanmu.</h2><p>Temukan ulasan komunitas atau tinggalkan ceritamu sendiri setelah menonton film.</p><a class="button button--light" href="#komunitas">Jelajahi komunitas <span aria-hidden="true">↗</span></a></div><div class="callout-orbit" aria-hidden="true">✳</div></section>
  </div>`;
}

function filteredFilms(query = catalogQuery, genre = catalogGenre) {
  const normalizedQuery = query.trim().toLocaleLowerCase("id-ID");
  return catalog.films.filter((film) => {
    const matchesGenre = !genre || genreNames(film.id).some((name) => genreById(genre)?.name === name);
    const searchText = [film.title, film.director, film.tagline, film.synopsis, ...genreNames(film.id)].join(" ").toLocaleLowerCase("id-ID");
    return matchesGenre && (!normalizedQuery || searchText.includes(normalizedQuery));
  }).sort((first, second) => second.rating - first.rating);
}

function catalogPage() {
  const filtered = filteredFilms();
  const genres = catalog.genres.map((genre) => `<option value="${escapeHTML(genre.id)}" ${catalogGenre === genre.id ? "selected" : ""}>${escapeHTML(genre.name)}</option>`).join("");
  return `<div class="page-content">
    ${pageHeader("SEMUA CERITA, SATU TEMPAT", "Jelajahi katalog", "Pilih cerita berikutnya. Beli lisensi permanen untuk koleksimu atau sewa akses selama 48 jam.")}
    <section class="catalog-tools" aria-label="Pencarian dan filter film">
      <label class="catalog-search"><span aria-hidden="true">⌕</span><span class="sr-only">Cari judul, sutradara, atau genre</span><input type="search" id="catalog-query" data-catalog-search placeholder="Cari judul, sutradara, atau genre…" value="${escapeHTML(catalogQuery)}"></label>
      <label class="filter-select"><span class="sr-only">Filter genre</span><select id="catalog-genre" data-catalog-genre><option value="">Semua genre</option>${genres}</select><span aria-hidden="true">⌄</span></label>
      <span class="results-count" id="catalog-count">${filtered.length} film</span>
    </section>
    <p class="inline-error" id="catalog-empty" ${filtered.length ? "hidden" : ""}>Film tidak ditemukan. Coba kata kunci atau genre lain.</p>
    <div class="film-grid" id="catalog-grid">${filtered.map((film) => filmCard(film)).join("")}</div>
    <section class="catalog-note"><span class="note-icon" aria-hidden="true">i</span><p>Beberapa judul memakai poster film dari TMDB; judul lainnya menggunakan ilustrasi CSS generatif. Proyek ini tidak menyertakan video film.</p></section>
  </div>`;
}

function detailPage(filmId) {
  const film = filmById(filmId);
  if (!film) return notFoundPage();
  const licenseTypes = catalog.licenseTypes.map((type) => `<button class="purchase-option" type="button" data-action="open-checkout" data-film-id="${escapeHTML(film.id)}" data-license-id="${escapeHTML(type.id)}">
    <span class="purchase-option-icon" aria-hidden="true">${type.duration_days ? "◷" : "∞"}</span><span class="purchase-option-copy"><strong>${escapeHTML(type.name)}</strong><span>${escapeHTML(type.description)}</span></span><span class="purchase-option-price">${money.format(priceFor(film, type))}<span aria-hidden="true">→</span></span>
  </button>`).join("");
  const owns = hasValidLicense(film.id);
  const reviews = database.reviews.filter((review) => review.film_id === film.id).length;
  return `<div class="page-content detail-page">
    <nav class="breadcrumbs" aria-label="Jejak navigasi"><a href="#beranda">Beranda</a><span aria-hidden="true">/</span><a href="#katalog">Katalog</a><span aria-hidden="true">/</span><span>${escapeHTML(film.title)}</span></nav>
    <section class="detail-layout">
      <div class="detail-poster">${posterMarkup(film)}<p class="art-credit-note">${escapeHTML(film.artwork_credits)}</p></div>
      <div class="detail-main">
        <header class="detail-intro"><p class="eyebrow">FILM PILIHAN CINEVAULT <span class="detail-year">${film.year}</span></p>
        <h1>${escapeHTML(film.title)}</h1><p class="detail-tagline">${escapeHTML(film.tagline)}</p></header>
        <div class="detail-rating"><span class="rating-stars">★ ${film.rating.toFixed(1)}</span><span>${film.rating_count} penilaian</span><span class="rating-divider">·</span><a href="#komunitas">Lihat ${reviews} ulasan</a></div>
        <div class="detail-tags">${filmGenreLabels(film.id)}<span class="tag">${escapeHTML(film.age_rating)}</span><span class="tag">${film.duration_minutes} menit</span></div>
        <div class="detail-facts"><div><span>SUTRADARA</span><strong>${escapeHTML(film.director)}</strong></div><div><span>TAHUN RILIS</span><strong>${film.year}</strong></div><div><span>DURASI</span><strong>${film.duration_minutes} menit</strong></div></div>
        <section class="purchase-panel" aria-labelledby="purchase-title"><div class="purchase-heading"><h2 id="purchase-title">Pilih cara menonton</h2><span>Tanpa langganan</span></div>${owns ? '<a class="button button--primary detail-play" href="#player/' + encodeURIComponent(film.id) + '">▶ &nbsp;Tonton dari Library</a>' : `<div class="purchase-options">${licenseTypes}</div>`}<p class="purchase-footnote">Pembayaran simulasi untuk keperluan demonstrasi. Tidak ada transaksi nyata.</p></section>
        <button class="wishlist-line" data-action="toggle-wishlist" data-film-id="${escapeHTML(film.id)}" type="button">${database.wishlists.some((entry) => entry.user_id === currentUserId && entry.film_id === film.id) ? "♥ Tersimpan di daftar favorit" : "♡ Tambahkan ke daftar favorit"}</button>
      </div>
    </section>
    <section class="content-section detail-synopsis"><div class="section-heading"><div><p class="eyebrow">TENTANG FILM</p><h2>Sebuah cerita untuk disimak.</h2></div></div><p>${escapeHTML(film.synopsis)}</p></section>
    ${filmRail("Cerita lain untukmu", catalog.films.filter((entry) => entry.id !== film.id).sort((first, second) => second.rating - first.rating).slice(0, 4), "#katalog", { eyebrow: "LANJUTKAN MENJELAJAH" })}
  </div>`;
}

function formatCountdown(expiresAt) {
  const milliseconds = Math.max(0, new Date(expiresAt).getTime() - Date.now());
  const totalSeconds = Math.floor(milliseconds / 1000);
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return days > 0 ? `${days}h ${String(hours).padStart(2, "0")}j ${String(minutes).padStart(2, "0")}m` : `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

function libraryPage() {
  const licenses = getUserLicenses().sort((first, second) => new Date(second.purchased_at) - new Date(first.purchased_at));
  const uniqueLicenses = licenses.filter((license, index) => {
    const activeIndex = licenses.findIndex((entry) => entry.film_id === license.film_id && isLicenseValid(entry));
    return activeIndex === index || (activeIndex < 0 && licenses.findIndex((entry) => entry.film_id === license.film_id) === index);
  });
  const expired = licenses.filter((license) => !isLicenseValid(license));
  const content = uniqueLicenses.map((license) => {
    const film = filmById(license.film_id);
    if (!film) return "";
    const type = licenseTypeById(license.license_type_id);
    const valid = isLicenseValid(license);
    const history = database.watch_history.find((entry) => entry.user_id === currentUserId && entry.film_id === film.id);
    const progress = history ? Math.min(100, Math.round(history.progress_seconds / history.duration_seconds * 100)) : 0;
    const countdown = license.expires_at ? `<span class="license-countdown ${valid ? "" : "is-expired"}" data-countdown="${escapeHTML(license.expires_at)}" aria-label="${valid ? "Sisa waktu sewa" : "Masa sewa berakhir"}">${valid ? formatCountdown(license.expires_at) : "Kedaluwarsa"}</span>` : '<span class="license-permanent">∞ Lisensi permanen</span>';
    return `<article class="library-card ${valid ? "" : "library-card--expired"}">
      <a class="library-art" href="${valid ? `#player/${encodeURIComponent(film.id)}` : `#film/${encodeURIComponent(film.id)}`}" aria-label="${valid ? "Tonton" : "Lihat lagi"} ${escapeHTML(film.title)}">${posterMarkup(film)}<span class="library-play" aria-hidden="true">${valid ? "▶" : "↗"}</span></a>
      <div class="library-info"><div class="library-title"><div><p class="eyebrow">${escapeHTML(type?.name || "Lisensi film")}</p><h2><a href="#film/${encodeURIComponent(film.id)}">${escapeHTML(film.title)}</a></h2></div>${countdown}</div><p>${escapeHTML(film.director)} <span aria-hidden="true">·</span> ${film.year} <span aria-hidden="true">·</span> ${film.duration_minutes} menit</p>
        ${history ? `<div class="watch-progress"><div><span>Terakhir ditonton</span><span>${progress}% selesai</span></div><progress value="${progress}" max="100" aria-label="${progress}% selesai">${progress}%</progress></div>` : ""}
        <div class="library-actions">${valid ? `<a class="button button--primary" href="#player/${encodeURIComponent(film.id)}">▶ &nbsp;${history ? "Lanjutkan menonton" : "Mulai menonton"}</a>` : '<span class="expired-note">Lisensi sewa ini sudah berakhir.</span>'}<a class="text-link" href="#film/${encodeURIComponent(film.id)}">Detail film</a></div>
      </div>
    </article>`;
  }).join("");
  return `<div class="page-content">
    ${pageBanner("RAK FILM PRIBADIMU", "Library", "Semua lisensi film yang kamu pilih, permanen atau untuk 48 jam.", "page-banner--library")}
    <div class="library-summary"><div><strong>${uniqueLicenses.filter(isLicenseValid).length}</strong><span>lisensi aktif</span></div><div><strong>${uniqueLicenses.filter((entry) => !entry.expires_at).length}</strong><span>koleksi permanen</span></div><div><strong>${expired.length}</strong><span>sewa berakhir</span></div></div>
    ${content ? `<section class="library-list" aria-label="Film dalam Library">${content}</section>` : `<section class="empty-state"><span class="empty-state-icon" aria-hidden="true">▤</span><h2>Rakmu masih menunggu cerita.</h2><p>Jelajahi katalog untuk membeli lisensi permanen atau menyewa film selama 48 jam.</p><a class="button button--primary" href="#katalog">Jelajahi katalog <span aria-hidden="true">→</span></a></section>`}
    ${filmRail("Mungkin kamu juga suka", catalog.films.filter((film) => !hasValidLicense(film.id)).slice(0, 4), "#katalog", { eyebrow: "PILIHAN SELANJUTNYA" })}
  </div>`;
}

function wishlistPage() {
  const wishedFilms = database.wishlists.filter((entry) => entry.user_id === currentUserId).map((entry) => filmById(entry.film_id)).filter(Boolean);
  return `<div class="page-content">
    ${pageHeader("CATATAN CERITA PILIHANMU", "Daftar Favorit", "Simpan judul yang menarik perhatianmu dan kembali kapan saja.")}
    ${wishedFilms.length ? `<p class="wishlist-intro">${wishedFilms.length} film tersimpan</p><div class="film-grid">${wishedFilms.map((film) => filmCard(film)).join("")}</div>` : `<section class="empty-state"><span class="empty-state-icon" aria-hidden="true">♡</span><h2>Belum ada film tersimpan.</h2><p>Tambahkan film ke daftar favorit untuk mengingat cerita yang ingin kamu tonton nanti.</p><a class="button button--primary" href="#katalog">Temukan film</a></section>`}
  </div>`;
}

function reviewCommentMarkup(comment, children, review, allComments) {
  const ownsFilm = hasValidLicense(review.film_id);
  return `<article class="review-comment" id="comment-${escapeHTML(comment.id)}">
    <div class="comment-marker" aria-hidden="true">${escapeHTML(userDisplayName(comment.user_id).slice(0, 1).toUpperCase())}</div>
    <div class="comment-body"><div class="comment-meta"><strong>${escapeHTML(userDisplayName(comment.user_id))}</strong><span>${new Date(comment.created_at).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" })}</span></div><p>${escapeHTML(comment.body)}</p>
      ${ownsFilm ? `<button class="reply-trigger" type="button" data-action="toggle-reply" data-comment-id="${escapeHTML(comment.id)}">↳ Balas</button>
      <form class="reply-form" data-reply-form="${escapeHTML(comment.id)}" data-review-id="${escapeHTML(review.id)}" hidden><label class="sr-only" for="reply-${escapeHTML(comment.id)}">Tulis balasan</label><textarea id="reply-${escapeHTML(comment.id)}" name="reply" maxlength="500" required placeholder="Tulis balasanmu…"></textarea><p class="field-error" data-error="reply"></p><button class="button button--small button--primary" type="submit">Kirim balasan</button></form>` : ""}
      ${children.length ? `<div class="comment-children">${children.map((child) => reviewCommentMarkup(child, allComments.filter((entry) => entry.parent_id === child.id), review, allComments)).join("")}</div>` : ""}
    </div>
  </article>`;
}

function reviewCard(review, index, comments) {
  const film = filmById(review.film_id);
  if (!film) return "";
  const own = database.review_votes.some((vote) => vote.review_id === review.id && vote.user_id === currentUserId);
  const helpful = database.review_votes.filter((vote) => vote.review_id === review.id && vote.vote === "membantu").length;
  const replies = comments.filter((comment) => comment.review_id === review.id);
  const roots = replies.filter((comment) => !comment.parent_id);
  const commentCount = replies.length;
  const reviewDate = new Date(review.created_at).toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" });
  return `<article class="review-card" id="review-${escapeHTML(review.id)}">
    <div class="review-card-aside"><span class="review-score">${review.rating}<small>/10</small></span><span class="review-stars" aria-label="Penilaian ${review.rating} dari 10">${"★".repeat(Math.min(5, Math.round(review.rating / 2)))}${"☆".repeat(5 - Math.min(5, Math.round(review.rating / 2)))}</span></div>
    <div class="review-card-main"><div class="review-author"><div class="avatar avatar--small">${escapeHTML(userDisplayName(review.user_id).slice(0, 1).toUpperCase())}</div><div><strong>${escapeHTML(userDisplayName(review.user_id))}</strong><span>menulis ulasan untuk <a href="#film/${encodeURIComponent(film.id)}">${escapeHTML(film.title)}</a></span></div><time datetime="${escapeHTML(review.created_at)}">${escapeHTML(reviewDate)}</time></div>
      <p class="review-text">${escapeHTML(review.body)}</p>
      <div class="review-actions">${hasValidLicense(review.film_id) ? `<button type="button" class="helpful-button ${own ? "is-active" : ""}" data-action="vote-helpful" data-review-id="${escapeHTML(review.id)}" aria-pressed="${own}">♧ Membantu <span>${helpful}</span></button>` : '<span class="community-locked" title="Hanya pemilik lisensi yang dapat memberi suara">♧ Membantu ' + helpful + '</span>'}<span class="comment-count">↳ ${commentCount} balasan</span></div>
      ${roots.length ? `<div class="comment-thread">${roots.map((comment) => reviewCommentMarkup(comment, replies.filter((child) => child.parent_id === comment.id), review, replies)).join("")}</div>` : ""}
    </div>
  </article>`;
}

function communityPage() {
  const reviews = [...database.reviews].sort((first, second) => new Date(second.created_at) - new Date(first.created_at));
  const ownedFilms = catalog.films.filter((film) => hasValidLicense(film.id));
  const filmOptions = ownedFilms.map((film) => `<option value="${escapeHTML(film.id)}">${escapeHTML(film.title)}</option>`).join("");
  return `<div class="page-content community-page">
    ${pageBanner("RUANG PENONTON CINEVAULT", "Komunitas", "Ulasan jujur dari sesama penonton. Ceritakan pengalamanmu setelah memiliki lisensi dan menonton film.", "page-banner--community")}
    <div class="community-layout">
      <section class="review-feed" aria-label="Ulasan komunitas"><div class="community-feed-heading"><div><p class="eyebrow">CATATAN PARA PENONTON</p><h2>Sudut pandang lain.</h2></div><span>${reviews.length} ulasan</span></div>
        ${reviews.length ? reviews.map((review, index) => reviewCard(review, index, database.review_comments)).join("") : '<p class="empty-note">Belum ada ulasan. Jadilah yang pertama!</p>'}
      </section>
      <aside class="review-sidebar">
        ${ownedFilms.length ? `<section class="review-form-card"><p class="eyebrow">SUDAH MENONTON?</p><h2>Ceritakan kesanmu.</h2><p class="form-intro">Ulasan hanya tersedia untuk pemilik lisensi film di Library.</p>
          <form id="review-form" novalidate>
            <label for="review-film">Pilih film</label><select id="review-film" name="filmId" required><option value="">Pilih dari Library</option>${filmOptions}</select><p class="field-error" data-error="filmId"></p>
            <label for="review-rating">Penilaian <span class="label-hint">1–10</span></label><div class="rating-input"><input id="review-rating" name="rating" type="range" min="1" max="10" value="8" aria-describedby="rating-value"><output id="rating-value" for="review-rating">8 <span>/ 10</span></output></div><p class="field-error" data-error="rating"></p>
            <label for="review-body">Ulasanmu</label><textarea id="review-body" name="body" rows="5" minlength="20" maxlength="1200" required placeholder="Apa yang membuat film ini berkesan bagimu?"></textarea><div class="field-hint-row"><p class="field-error" data-error="body"></p><span id="review-char-count">0/1200</span></div>
            <button class="button button--primary button--full" type="submit">Terbitkan ulasan <span aria-hidden="true">↗</span></button><p class="form-status" id="review-status" aria-live="polite"></p>
          </form></section>` : `<section class="review-form-card review-form-card--locked"><span class="locked-icon" aria-hidden="true">⌑</span><p class="eyebrow">KOMUNITAS TERBUKA UNTUK PEMILIK</p><h2>Cerita dimulai dari Library.</h2><p>Miliki lisensi film, tonton, lalu bagikan penilaian dan ulasanmu kepada komunitas.</p><a class="button button--primary button--full" href="#katalog">Jelajahi katalog</a></section>`}
        <section class="community-rules"><p class="eyebrow">RUANG YANG NYAMAN</p><p>Ulasan ditulis oleh penonton yang memiliki lisensi. Sampaikan pendapat dengan santun, hindari spoiler tanpa peringatan, dan hargai sudut pandang yang berbeda.</p></section>
      </aside>
    </div>
  </div>`;
}

function loginPage() {
  return `<div class="page-content auth-page">
    ${pageHeader("SELAMAT DATANG KEMBALI", "Masuk ke CineVault", "Lanjutkan menonton dan kelola seluruh lisensi film dalam satu Library.")}
    <section class="auth-card"><div class="auth-card-head"><span class="auth-monogram" aria-hidden="true">cv</span><h2>Masuk ke akunmu.</h2><p>Belum punya akun? <a href="#daftar">Daftar gratis</a>.</p></div>
      <form id="login-form" novalidate><label for="login-email">Alamat email</label><input id="login-email" name="email" type="email" autocomplete="email" required placeholder="nama@email.com"><p class="field-error" data-error="email"></p>
      <label for="login-password">Kata sandi</label><input id="login-password" name="password" type="password" autocomplete="current-password" required placeholder="Masukkan kata sandi"><p class="field-error" data-error="password"></p>
      <p class="form-status" id="login-status" aria-live="polite"></p><button class="button button--primary button--full" type="submit">Masuk <span aria-hidden="true">→</span></button></form>
      <div class="demo-login"><span aria-hidden="true">✳</span><p><strong>Jelajahi dengan akun demo</strong><br>Email: <code>demo@cinevault.id</code> · Kata sandi: <code>bioskop48</code></p></div>
    </section>
  </div>`;
}

function registerPage() {
  return `<div class="page-content auth-page">
    ${pageHeader("MULAI KOLEKSI CERITAMU", "Buat akun CineVault", "Gratis untuk mendaftar. Bayar hanya saat memilih lisensi film.")}
    <section class="auth-card"><div class="auth-card-head"><span class="auth-monogram" aria-hidden="true">cv</span><h2>Ruang ceritamu menunggu.</h2><p>Sudah punya akun? <a href="#masuk">Masuk</a>.</p></div>
      <form id="register-form" novalidate><label for="register-name">Nama tampilan</label><input id="register-name" name="displayName" type="text" autocomplete="name" minlength="2" maxlength="40" required placeholder="Nama panggilanmu"><p class="field-error" data-error="displayName"></p>
      <label for="register-email">Alamat email</label><input id="register-email" name="email" type="email" autocomplete="email" required placeholder="nama@email.com"><p class="field-error" data-error="email"></p>
      <label for="register-password">Kata sandi <span class="label-hint">minimal 8 karakter</span></label><input id="register-password" name="password" type="password" autocomplete="new-password" minlength="8" required placeholder="Buat kata sandi"><p class="field-error" data-error="password"></p>
      <label for="register-password-confirm">Ulangi kata sandi</label><input id="register-password-confirm" name="confirmPassword" type="password" autocomplete="new-password" required placeholder="Masukkan sekali lagi"><p class="field-error" data-error="confirmPassword"></p>
      <p class="form-status" id="register-status" aria-live="polite"></p><button class="button button--primary button--full" type="submit">Buat akun <span aria-hidden="true">→</span></button>
      <p class="auth-disclaimer">Akun dan kata sandi disimpan di browser ini hanya untuk simulasi proyek akademik. Jangan gunakan kata sandi sungguhan.</p></form>
    </section>
  </div>`;
}

function aboutPage() {
  return `<div class="page-content about-page">
    ${pageBanner("CERITA PUNYA RUANGNYA SENDIRI", "Tentang CineVault", "Temukan film pilihan, tentukan cara menikmatinya, dan simpan cerita yang ingin kamu ingat.", "page-banner--about")}
    <section class="about-intro"><div class="about-monogram" aria-hidden="true"><span class="brand-mark"><span></span><span></span><span></span></span></div><div><p class="eyebrow">MENONTON DENGAN CARA KAMU</p><h2>Lebih bebas memilih.<br>Tanpa terikat langganan.</h2><p>CineVault membuat pengalaman memilih film terasa lebih sederhana. Jelajahi katalog, lihat informasi dan harga dengan jelas, lalu pilih lisensi permanen atau sewa selama 48 jam. Kamu juga bisa menyimpan film favorit dan mengelola koleksi dari satu tempat.</p></div></section>
    <section class="about-values"><article><span>01</span><h3>Harga transparan</h3><p>Lihat pilihan lisensi dan harganya sebelum menentukan film yang ingin kamu nikmati.</p></article><article><span>02</span><h3>Akses fleksibel</h3><p>Pilih lisensi permanen atau sewa 48 jam sesuai kebutuhanmu, tanpa paket bulanan.</p></article><article><span>03</span><h3>Koleksi teratur</h3><p>Simpan film favorit, temukan kembali koleksimu di Library, dan berbagi ulasan dengan komunitas.</p></article></section>
    <section class="about-spec"><div><p class="eyebrow">KENAPA CINEVAULT?</p><h2>Lebih fleksibel,<br>lebih praktis.</h2></div><ul><li><span>01</span>Tanpa biaya langganan bulanan</li><li><span>02</span>Pilihan beli atau sewa yang jelas</li><li><span>03</span>Harga terlihat sejak awal</li><li><span>04</span>Favorit dan koleksi tersimpan rapi</li><li><span>05</span>Ulasan komunitas untuk menemukan cerita baru</li></ul></section>
    <p class="credits-note"><strong>Kredit visual:</strong> poster Interstellar, Spider-Man: Into the Spider-Verse, dan Your Name dimuat dari CDN The Movie Database (TMDB). Judul lainnya menggunakan ilustrasi grafis orisinal sebagai visual katalog.</p>
  </div>`;
}

function playerPage(filmId) {
  const film = filmById(filmId);
  if (!film) return notFoundPage();
  const license = getUserLicenses(film.id).find(isLicenseValid);
  if (!license) {
    return `<div class="page-content">${pageHeader("AKSES LIBRARY", "Lisensi diperlukan", "Pemutar hanya tersedia selama lisensi film ini aktif.")}<section class="empty-state"><span class="empty-state-icon" aria-hidden="true">⌑</span><h2>${escapeHTML(film.title)} belum ada di Library.</h2><p>Pilih lisensi permanen atau sewa 48 jam untuk membuka pemutar film simulasi.</p><a class="button button--primary" href="#film/${encodeURIComponent(film.id)}">Lihat pilihan lisensi</a></section></div>`;
  }
  const history = database.watch_history.find((entry) => entry.user_id === currentUserId && entry.film_id === film.id);
  const percentage = history ? Math.min(100, Math.round(history.progress_seconds / history.duration_seconds * 100)) : 0;
  return `<div class="page-content player-page">
    ${pageHeader("PEMUTAR CINEVAULT", film.title, `${film.director} · ${film.year} · ${film.duration_minutes} menit`)}
    <section class="player-shell" aria-label="Pemutar film simulasi">
      <div class="player-screen" id="player-screen">${posterMarkup(film, "poster-art--player")}<div class="player-screen-vignette"></div><div class="player-center-mark" aria-hidden="true">CV</div><span class="player-screen-label" id="player-screen-label">SIMULASI PEMUTAR · KONTEN FILM TIDAK DISERTAKAN</span><div class="player-controls">
        <button type="button" class="player-control-button" id="player-toggle" data-action="toggle-player" aria-label="Mulai pemutaran">▶</button>
        <span id="player-time">${Math.floor((history?.progress_seconds || 0) / 60)}:${String((history?.progress_seconds || 0) % 60).padStart(2, "0")}</span>
        <label class="sr-only" for="player-progress">Posisi pemutaran</label><input id="player-progress" type="range" min="0" max="${film.duration_minutes * 60}" value="${history?.progress_seconds || 0}" aria-valuetext="${percentage}% selesai">
        <span>${film.duration_minutes}:00</span><button type="button" class="player-control-button player-volume" data-action="toggle-volume" aria-label="Bisukan suara simulasi">◖</button><button type="button" class="player-control-button" data-action="toggle-fullscreen" aria-label="Layar penuh">⛶</button>
      </div><span class="player-pause-badge" id="player-pause-badge">Jeda</span></div>
      <div class="player-note"><span aria-hidden="true">i</span><p><strong>Pemutar demonstrasi.</strong> File film tidak disertakan dalam proyek. Kontrol pemutar mensimulasikan progres tontonan dan tidak memutar konten audiovisual.</p></div>
    </section>
    <section class="player-film-info"><div><p class="eyebrow">SEDANG KAMU TONTON</p><h2>${escapeHTML(film.title)}</h2><p>${escapeHTML(film.tagline)}</p></div><a class="text-link" href="#film/${encodeURIComponent(film.id)}">Detail film ↗</a></section>
  </div>`;
}

function notFoundPage() {
  return `<div class="page-content">${pageHeader("CERITA TIDAK DITEMUKAN", "Halaman ini belum ada.", "Mungkin ceritanya sudah dipindahkan. Mari temukan yang lain.")}<section class="empty-state"><a class="button button--primary" href="#beranda">Kembali ke Beranda</a></section></div>`;
}

function authRequiredPage() {
  return `<div class="page-content">${pageHeader("RUANG PRIBADI", "Masuk untuk melanjutkan.", "Library, daftar favorit, dan ulasanmu disimpan pada akun CineVault di browser ini.")}<section class="empty-state"><a class="button button--primary" href="#masuk">Masuk ke CineVault</a><a class="text-link" href="#daftar">Belum punya akun? Daftar gratis.</a></section></div>`;
}

function routeInfo() {
  const route = location.hash.slice(1);
  const [path, query = ""] = route.split("?");
  if (!path) return { name: "beranda" };
  const [name, id] = path.split("/");
  const params = new URLSearchParams(query);
  return { name, id: id ? decodeURIComponent(id) : null, params };
}

function updateChrome() {
  document.querySelectorAll(".nav-link").forEach((link) => {
    const active = link.dataset.route === currentRoute || (link.dataset.route === "katalog" && currentRoute === "film");
    link.classList.toggle("is-active", active);
    if (active) link.setAttribute("aria-current", "page");
    else link.removeAttribute("aria-current");
  });
  document.querySelector("#library-count").textContent = String(getUserLicenses().filter(isLicenseValid).length);
  const user = activeUser();
  const profile = document.querySelector("#profile-button");
  profile.textContent = user ? user.display_name.slice(0, 1).toUpperCase() : "↗";
  profile.setAttribute("aria-label", user ? `Akun ${user.display_name} — keluar` : "Masuk atau daftar");
  const sidebarAccount = document.querySelector("#sidebar-account");
  sidebarAccount.innerHTML = user
    ? `<span class="avatar">${escapeHTML(user.display_name.slice(0, 1).toUpperCase())}</span><span class="sidebar-user"><strong>${escapeHTML(user.display_name)}</strong><span>Penonton CineVault</span></span><button type="button" data-action="logout" class="logout-button" aria-label="Keluar dari akun">↗</button>`
    : `<a class="account-signin" href="#masuk"><span class="avatar">↗</span><span class="sidebar-user"><strong>Masuk ke akunmu</strong><span>Sinkronkan ceritamu</span></span></a>`;
}

function render({ focusMain = false } = {}) {
  window.clearInterval(playerTimer);
  window.clearInterval(rentalTimer);
  const { name, id, params } = routeInfo();
  currentRoute = name;
  if (name === "katalog" && params?.has("q")) catalogQuery = params.get("q") || "";
  if (["library", "wishlist", "komunitas"].includes(name) && !activeUser()) {
    app.innerHTML = authRequiredPage();
  } else {
    switch (name) {
      case "beranda": app.innerHTML = homePage(); break;
      case "katalog": app.innerHTML = catalogPage(); break;
      case "film": app.innerHTML = detailPage(id); break;
      case "library": app.innerHTML = libraryPage(); rentalTimer = window.setInterval(updateCountdowns, 1000); break;
      case "wishlist": app.innerHTML = wishlistPage(); break;
      case "komunitas": app.innerHTML = communityPage(); break;
      case "tentang": app.innerHTML = aboutPage(); break;
      case "masuk": app.innerHTML = loginPage(); break;
      case "daftar": app.innerHTML = registerPage(); break;
      case "player": app.innerHTML = playerPage(id); setupPlayer(id); break;
      default: app.innerHTML = notFoundPage();
    }
  }
  updateChrome();
  const globalSearch = document.querySelector("#search-input");
  if (globalSearch && currentRoute === "katalog" && catalogQuery) globalSearch.value = catalogQuery;
  if (focusMain) app.focus({ preventScroll: true });
}

function updateCountdowns() {
  let licenseExpired = false;
  document.querySelectorAll("[data-countdown]").forEach((element) => {
    const expiry = new Date(element.dataset.countdown).getTime();
    if (!Number.isFinite(expiry) || expiry <= Date.now()) {
      if (!element.classList.contains("is-expired")) licenseExpired = true;
      element.textContent = "Kedaluwarsa";
      element.classList.add("is-expired");
      const card = element.closest(".library-card");
      card?.classList.add("library-card--expired");
      const artLink = card?.querySelector(".library-art");
      const detailHref = card?.querySelector(".library-info h2 a")?.getAttribute("href");
      if (artLink && detailHref) artLink.href = detailHref;
      const play = card?.querySelector(".library-actions .button");
      if (play) {
        const link = document.createElement("a");
        link.className = "text-link";
        link.href = detailHref || artLink?.getAttribute("href") || "#katalog";
        link.textContent = "Beli lisensi lagi";
        play.replaceWith(link);
      }
    } else {
      element.textContent = formatCountdown(element.dataset.countdown);
    }
  });
  if (licenseExpired) updateLibrarySummary();
}


function updateLibrarySummary() {
  const licenses = getUserLicenses();
  const activeFilmIds = new Set(licenses.filter(isLicenseValid).map((license) => license.film_id));
  const permanentFilmIds = new Set(licenses.filter((license) => !license.expires_at).map((license) => license.film_id));
  const summary = document.querySelectorAll(".library-summary strong");
  if (summary.length >= 3) {
    summary[0].textContent = String(activeFilmIds.size);
    summary[1].textContent = String(permanentFilmIds.size);
    summary[2].textContent = String(licenses.filter((license) => !isLicenseValid(license)).length);
  }
  document.querySelector("#library-count").textContent = String(licenses.filter(isLicenseValid).length);
}

function filterCatalogInPlace() {
  const grid = document.querySelector("#catalog-grid");
  if (!grid) return;
  const filtered = filteredFilms();
  grid.innerHTML = filtered.map((film) => filmCard(film)).join("");
  document.querySelector("#catalog-count").textContent = `${filtered.length} film`;
  document.querySelector("#catalog-empty").hidden = filtered.length > 0;
}

function clearFieldErrors(form) {
  form.querySelectorAll(".field-error").forEach((element) => { element.textContent = ""; });
  form.querySelectorAll("[aria-invalid='true']").forEach((element) => element.removeAttribute("aria-invalid"));
  form.querySelectorAll(".form-status").forEach((element) => { element.textContent = ""; element.className = "form-status"; });
}

function setFieldError(form, field, message) {
  const input = form.elements.namedItem(field);
  const error = form.querySelector(`[data-error="${field}"]`);
  if (error) error.textContent = message;
  if (input instanceof HTMLElement) input.setAttribute("aria-invalid", "true");
}

function validateEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/u.test(email);
}

function submitLogin(form) {
  clearFieldErrors(form);
  const email = form.elements.namedItem("email").value.trim().toLocaleLowerCase("id-ID");
  const password = form.elements.namedItem("password").value;
  let valid = true;
  if (!email) { setFieldError(form, "email", "Alamat email wajib diisi."); valid = false; }
  else if (!validateEmail(email)) { setFieldError(form, "email", "Masukkan alamat email dengan format yang benar."); valid = false; }
  if (!password) { setFieldError(form, "password", "Kata sandi wajib diisi."); valid = false; }
  if (!valid) {
    form.querySelector("[aria-invalid='true']")?.focus();
    return;
  }
  const user = database.users.find((entry) => entry.email.toLocaleLowerCase("id-ID") === email && entry.password === password);
  if (!user) {
    const status = form.querySelector("#login-status");
    status.textContent = "Email atau kata sandi tidak cocok. Periksa kembali data akunmu.";
    status.classList.add("field-error");
    form.elements.namedItem("password").setAttribute("aria-invalid", "true");
    return;
  }
  try {
    localStorage.setItem(STORAGE_KEYS.user, user.id);
  } catch (error) {
    console.error("CineVault gagal menyimpan sesi akun.", error);
    showToast("Sesi tidak dapat disimpan. Periksa pengaturan penyimpanan browser.", "error");
    return;
  }
  currentUserId = user.id;
  showToast(`Selamat datang kembali, ${user.display_name}.`);
  location.hash = "#beranda";
}

function submitRegistration(form) {
  clearFieldErrors(form);
  const displayName = form.elements.namedItem("displayName").value.trim();
  const email = form.elements.namedItem("email").value.trim().toLocaleLowerCase("id-ID");
  const password = form.elements.namedItem("password").value;
  const confirmation = form.elements.namedItem("confirmPassword").value;
  let valid = true;
  if (displayName.length < 2) { setFieldError(form, "displayName", "Nama tampilan harus berisi minimal 2 karakter."); valid = false; }
  if (!validateEmail(email)) { setFieldError(form, "email", "Masukkan alamat email yang valid."); valid = false; }
  if (password.length < 8) { setFieldError(form, "password", "Kata sandi harus berisi minimal 8 karakter."); valid = false; }
  if (!confirmation) { setFieldError(form, "confirmPassword", "Konfirmasi kata sandi wajib diisi."); valid = false; }
  else if (confirmation !== password) { setFieldError(form, "confirmPassword", "Konfirmasi kata sandi belum sama."); valid = false; }
  if (database.users.some((user) => user.email.toLocaleLowerCase("id-ID") === email)) { setFieldError(form, "email", "Email ini sudah terdaftar. Silakan masuk."); valid = false; }
  if (!valid) {
    form.querySelector("[aria-invalid='true']")?.focus();
    return;
  }
  const user = { id: makeId("pengguna"), email, password, display_name: displayName, created_at: new Date().toISOString() };
  database.users.push(user);
  database.user_profiles.push({ user_id: user.id, avatar_initials: displayName.slice(0, 2).toUpperCase(), bio: "" });
  if (!saveDatabase()) {
    database.users.pop();
    database.user_profiles.pop();
    return;
  }
  try {
    localStorage.setItem(STORAGE_KEYS.user, user.id);
  } catch (error) {
    console.error("CineVault gagal menyimpan sesi pengguna baru.", error);
    showToast("Akun tersimpan, tetapi sesi tidak dapat dimulai. Silakan masuk.", "error");
    location.hash = "#masuk";
    return;
  }
  currentUserId = user.id;
  showToast("Akun CineVault berhasil dibuat.");
  location.hash = "#beranda";
}

function showCheckout(filmId, licenseId) {
  const film = filmById(filmId);
  const type = licenseTypeById(licenseId);
  if (!film || !type) {
    showToast("Pilihan lisensi tidak ditemukan.", "error");
    return;
  }
  if (!activeUser()) {
    showToast("Masuk atau daftar untuk melanjutkan simulasi pembelian.", "error");
    location.hash = "#masuk";
    return;
  }
  if (hasValidLicense(film.id)) {
    showToast("Lisensi film ini sudah aktif di Library.");
    return;
  }
  const price = priceFor(film, type);
  checkoutContent.innerHTML = `<p class="eyebrow">RINGKASAN PILIHAN</p><h2 id="checkout-title">Satu langkah menuju cerita.</h2>
    <div class="checkout-film">${posterMarkup(film)}<div><strong>${escapeHTML(film.title)}</strong><span>${escapeHTML(type.name)}</span><span>${escapeHTML(film.director)} · ${film.year}</span></div></div>
    <div class="checkout-total"><span>Total simulasi</span><strong>${money.format(price)}</strong></div>
    <p class="checkout-disclaimer">Ini hanya simulasi pembayaran untuk proyek akademik. Tidak ada pembayaran atau transaksi nyata.</p>
    <form id="checkout-form" data-film-id="${escapeHTML(film.id)}" data-license-id="${escapeHTML(type.id)}" novalidate><p class="field-error" data-error="checkout"></p><button type="submit" class="button button--primary button--full">Konfirmasi pembelian <span aria-hidden="true">→</span></button><button type="button" class="button button--quiet button--full" data-action="close-checkout">Kembali ke film</button></form>`;
  checkoutDialog.showModal();
}

function submitCheckout(form) {
  const film = filmById(form.dataset.filmId);
  const type = licenseTypeById(form.dataset.licenseId);
  if (!film || !type || !activeUser()) {
    const error = form.querySelector('[data-error="checkout"]');
    error.textContent = "Akun atau lisensi tidak tersedia. Silakan coba kembali.";
    return;
  }
  if (hasValidLicense(film.id)) {
    checkoutDialog.close();
    showToast("Lisensi film ini sudah aktif di Library.");
    return;
  }
  const now = new Date();
  const orderId = makeId("pesanan");
  const licenseId = makeId("lisensi");
  const order = { id: orderId, user_id: currentUserId, total: priceFor(film, type), status: "selesai", created_at: now.toISOString() };
  const expiry = type.duration_days ? new Date(now.getTime() + type.duration_days * 86400000).toISOString() : null;
  database.orders.push(order);
  database.order_items.push({ id: makeId("baris-pesanan"), order_id: orderId, film_id: film.id, license_type_id: type.id, unit_price: order.total });
  database.payments.push({ id: makeId("pembayaran"), order_id: orderId, method: "simulasi", status: "berhasil" });
  database.user_licenses.push({ id: licenseId, user_id: currentUserId, film_id: film.id, license_type_id: type.id, purchased_at: now.toISOString(), expires_at: expiry, order_id: orderId });
  if (!saveDatabase()) {
    database.orders.pop();
    database.order_items.pop();
    database.payments.pop();
    database.user_licenses.pop();
    return;
  }
  checkoutDialog.close();
  showToast(type.duration_days ? `Sewa aktif hingga ${new Date(expiry).toLocaleString("id-ID", { dateStyle: "medium", timeStyle: "short" })}.` : "Lisensi permanen tersimpan di Library.");
  location.hash = `#library`;
}

function toggleWishlist(filmId) {
  if (!activeUser()) {
    showToast("Masuk untuk menyimpan film ke daftar favorit.", "error");
    location.hash = "#masuk";
    return;
  }
  if (!filmById(filmId)) return;
  const index = database.wishlists.findIndex((entry) => entry.user_id === currentUserId && entry.film_id === filmId);
  if (index >= 0) {
    const [removed] = database.wishlists.splice(index, 1);
    if (!saveDatabase()) database.wishlists.splice(index, 0, removed);
    else showToast("Film dihapus dari wishlist.");
  } else {
    const entry = { user_id: currentUserId, film_id: filmId, created_at: new Date().toISOString() };
    database.wishlists.push(entry);
    if (!saveDatabase()) database.wishlists.pop();
    else showToast("Film ditambahkan ke daftar favorit.");
  }
  render();
}

function submitReview(form) {
  clearFieldErrors(form);
  const filmId = form.elements.namedItem("filmId").value;
  const rating = Number(form.elements.namedItem("rating").value);
  const body = form.elements.namedItem("body").value.trim();
  const film = filmById(filmId);
  let valid = true;
  if (!film) { setFieldError(form, "filmId", "Pilih film yang memiliki lisensi aktif di Library."); valid = false; }
  else if (!hasValidLicense(filmId)) { setFieldError(form, "filmId", "Ulasan hanya tersedia untuk pemilik lisensi film ini."); valid = false; }
  if (!Number.isInteger(rating) || rating < 1 || rating > 10) { setFieldError(form, "rating", "Pilih penilaian dari 1 sampai 10."); valid = false; }
  if (body.length < 20) { setFieldError(form, "body", "Ulasan harus berisi minimal 20 karakter."); valid = false; }
  else if (body.length > 1200) { setFieldError(form, "body", "Ulasan tidak boleh lebih dari 1.200 karakter."); valid = false; }
  if (database.reviews.some((review) => review.user_id === currentUserId && review.film_id === filmId)) {
    setFieldError(form, "filmId", "Kamu sudah menulis ulasan untuk film ini.");
    valid = false;
  }
  if (!valid) {
    form.querySelector("[aria-invalid='true']")?.focus();
    return;
  }
  const review = { id: makeId("ulasan"), user_id: currentUserId, film_id: filmId, rating, body, created_at: new Date().toISOString() };
  database.reviews.push(review);
  if (!saveDatabase()) {
    database.reviews.pop();
    return;
  }
  showToast("Ulasanmu berhasil dibagikan kepada komunitas.");
  render();
  document.querySelector(`#review-${CSS.escape(review.id)}`)?.scrollIntoView({ behavior: "smooth", block: "center" });
}

function submitReply(form) {
  const textArea = form.elements.namedItem("reply");
  const body = textArea.value.trim();
  const review = database.reviews.find((entry) => entry.id === form.dataset.reviewId);
  const parent = database.review_comments.find((entry) => entry.id === form.dataset.replyForm);
  const error = form.querySelector('[data-error="reply"]');
  error.textContent = "";
  if (!review || !parent || !hasValidLicense(review.film_id)) {
    error.textContent = "Balasan hanya tersedia untuk pemilik lisensi film.";
    return;
  }
  if (body.length < 2 || body.length > 500) {
    error.textContent = "Balasan harus berisi 2 sampai 500 karakter.";
    textArea.setAttribute("aria-invalid", "true");
    textArea.focus();
    return;
  }
  const comment = { id: makeId("komentar"), review_id: review.id, user_id: currentUserId, parent_id: parent.id, body, created_at: new Date().toISOString() };
  database.review_comments.push(comment);
  if (!saveDatabase()) {
    database.review_comments.pop();
    return;
  }
  showToast("Balasanmu berhasil dikirim.");
  render();
  document.querySelector(`#comment-${CSS.escape(comment.id)}`)?.scrollIntoView({ behavior: "smooth", block: "center" });
}

function voteHelpful(reviewId) {
  const review = database.reviews.find((entry) => entry.id === reviewId);
  if (!review || !hasValidLicense(review.film_id)) {
    showToast("Hanya pemilik lisensi film yang dapat memberi suara.", "error");
    return;
  }
  const index = database.review_votes.findIndex((vote) => vote.review_id === reviewId && vote.user_id === currentUserId);
  if (index >= 0) {
    const [removed] = database.review_votes.splice(index, 1);
    if (!saveDatabase()) database.review_votes.splice(index, 0, removed);
  } else {
    database.review_votes.push({ review_id: reviewId, user_id: currentUserId, vote: "membantu" });
    if (!saveDatabase()) database.review_votes.pop();
  }
  render();
}

function writeWatchHistory(filmId, progressSeconds) {
  const film = filmById(filmId);
  if (!film || !hasValidLicense(filmId)) return;
  const durationSeconds = film.duration_minutes * 60;
  const existing = database.watch_history.find((entry) => entry.user_id === currentUserId && entry.film_id === filmId);
  if (existing) {
    existing.progress_seconds = Math.max(0, Math.min(progressSeconds, durationSeconds));
    existing.duration_seconds = durationSeconds;
    existing.updated_at = new Date().toISOString();
  } else {
    database.watch_history.push({ user_id: currentUserId, film_id: filmId, progress_seconds: Math.max(0, progressSeconds), duration_seconds: durationSeconds, updated_at: new Date().toISOString() });
  }
  saveDatabase();
}

let playerPlaying = false;
let playerPosition = 0;
let playerLastSavedAt = 0;
function setupPlayer(filmId) {
  if (!hasValidLicense(filmId)) return;
  const film = filmById(filmId);
  const range = document.querySelector("#player-progress");
  if (!film || !range) return;
  playerPosition = Number(range.value);
  playerPlaying = false;
  playerLastSavedAt = Date.now();
  updatePlayerDisplay(film);
  playerTimer = window.setInterval(() => {
    const screen = document.querySelector("#player-screen");
    if (!screen) return;
    if (!hasValidLicense(filmId)) {
      playerPlaying = false;
      window.clearInterval(playerTimer);
      showToast("Masa sewa film telah berakhir.", "error");
      location.hash = `#film/${encodeURIComponent(filmId)}`;
      return;
    }
    if (playerPlaying) {
      playerPosition = Math.min(film.duration_minutes * 60, playerPosition + 1);
      updatePlayerDisplay(film);
      if (Date.now() - playerLastSavedAt >= 15000 || playerPosition === film.duration_minutes * 60) {
        writeWatchHistory(filmId, playerPosition);
        playerLastSavedAt = Date.now();
      }
      if (playerPosition === film.duration_minutes * 60) {
        playerPlaying = false;
        showToast("Film selesai. Terima kasih sudah menonton.");
      }
    }
  }, 1000);
}

function updatePlayerDisplay(film) {
  const playButton = document.querySelector("#player-toggle");
  const progress = document.querySelector("#player-progress");
  const time = document.querySelector("#player-time");
  const label = document.querySelector("#player-screen-label");
  const pauseBadge = document.querySelector("#player-pause-badge");
  if (!playButton || !progress || !time || !label) return;
  const minutes = Math.floor(playerPosition / 60);
  const seconds = playerPosition % 60;
  progress.value = String(playerPosition);
  progress.setAttribute("aria-valuetext", `${Math.floor(playerPosition / (film.duration_minutes * 60) * 100)}% selesai`);
  time.textContent = `${minutes}:${String(seconds).padStart(2, "0")}`;
  playButton.textContent = playerPlaying ? "Ⅱ" : "▶";
  playButton.setAttribute("aria-label", playerPlaying ? "Jeda pemutaran" : "Mulai pemutaran");
  label.textContent = playerPlaying ? "PEMUTAR SIMULASI BERJALAN · KONTEN FILM TIDAK DISERTAKAN" : "SIMULASI PEMUTAR · KONTEN FILM TIDAK DISERTAKAN";
  pauseBadge.textContent = playerPlaying ? "Berjalan" : "Jeda";
  pauseBadge.classList.toggle("is-playing", playerPlaying);
}

function logoutCurrentUser() {
  try {
    localStorage.removeItem(STORAGE_KEYS.user);
    currentUserId = null;
    showToast("Kamu sudah keluar dari akun.");
    if (location.hash !== "#beranda") location.hash = "#beranda";
    else render();
  } catch (error) {
    console.error("CineVault gagal menghapus sesi lokal.", error);
    showToast("Sesi tidak dapat dihapus dari browser.", "error");
  }
}

function toggleMobileNavigation(forceOpen) {
  const shell = document.querySelector(".site-shell");
  const button = document.querySelector("#mobile-menu");
  const open = typeof forceOpen === "boolean" ? forceOpen : !shell.classList.contains("mobile-nav-open");
  shell.classList.toggle("mobile-nav-open", open);
  button.setAttribute("aria-expanded", String(open));
  button.setAttribute("aria-label", open ? "Tutup navigasi" : "Buka navigasi");
}

document.addEventListener("error", (event) => {
  const image = event.target;
  if (image instanceof HTMLImageElement && image.classList.contains("poster-photo")) {
    const poster = image.closest(".poster-art");
    image.remove();
    poster?.classList.remove("has-poster");
  }
}, true);

document.addEventListener("click", (event) => {
  const actionButton = event.target.closest("[data-action]");
  if (actionButton) {
    switch (actionButton.dataset.action) {
      case "toggle-wishlist": toggleWishlist(actionButton.dataset.filmId); break;
      case "open-checkout": showCheckout(actionButton.dataset.filmId, actionButton.dataset.licenseId); break;
      case "close-checkout": checkoutDialog.close(); break;
      case "carousel-next": carouselIndex = (carouselIndex + 1) % getFeaturedFilms().length; render(); break;
      case "carousel-prev": carouselIndex = (carouselIndex - 1 + getFeaturedFilms().length) % getFeaturedFilms().length; render(); break;
      case "dismiss-toast": actionButton.closest(".toast")?.remove(); break;
      case "toggle-reply": {
        const form = document.querySelector(`[data-reply-form="${CSS.escape(actionButton.dataset.commentId)}"]`);
        form.hidden = !form.hidden;
        if (!form.hidden) form.querySelector("textarea").focus();
        break;
      }
      case "vote-helpful": voteHelpful(actionButton.dataset.reviewId); break;
      case "logout": logoutCurrentUser(); break;
      case "toggle-player": {
        const film = filmById(routeInfo().id);
        if (film && hasValidLicense(film.id)) {
          playerPlaying = !playerPlaying;
          updatePlayerDisplay(film);
        } else {
          showToast("Lisensi aktif diperlukan untuk memutar film.", "error");
        }
        break;
      }
      case "toggle-volume": actionButton.textContent = actionButton.textContent === "◖" ? "◗" : "◖"; actionButton.setAttribute("aria-label", actionButton.textContent === "◖" ? "Bisukan suara simulasi" : "Aktifkan suara simulasi"); break;
      case "toggle-fullscreen": {
        const screen = document.querySelector("#player-screen");
        if (document.fullscreenElement) document.exitFullscreen().catch((error) => console.error("Mode layar penuh gagal ditutup.", error));
        else if (screen?.requestFullscreen) screen.requestFullscreen().catch((error) => showToast(`Mode layar penuh tidak tersedia: ${error.message}`, "error"));
        break;
      }
      case "retry-data": window.location.reload(); break;
    }
  }
  if (event.target.closest(".nav-link")) toggleMobileNavigation(false);
});

document.addEventListener("submit", (event) => {
  const form = event.target;
  if (!(form instanceof HTMLFormElement)) return;
  if (form.id === "global-search") {
    event.preventDefault();
    catalogQuery = document.querySelector("#search-input").value.trim();
    catalogGenre = "";
    location.hash = `#katalog?q=${encodeURIComponent(catalogQuery)}`;
  } else if (form.id === "login-form") {
    event.preventDefault();
    submitLogin(form);
  } else if (form.id === "register-form") {
    event.preventDefault();
    submitRegistration(form);
  } else if (form.id === "review-form") {
    event.preventDefault();
    submitReview(form);
  } else if (form.matches("[data-reply-form]")) {
    event.preventDefault();
    submitReply(form);
  } else if (form.id === "checkout-form") {
    event.preventDefault();
    submitCheckout(form);
  }
});

document.addEventListener("input", (event) => {
  if (event.target.matches("[data-catalog-search]")) {
    catalogQuery = event.target.value;
    filterCatalogInPlace();
  }
  if (event.target.matches("[data-catalog-genre]")) {
    catalogGenre = event.target.value;
    filterCatalogInPlace();
  }
  if (event.target.id === "review-rating") {
    const output = document.querySelector("#rating-value");
    if (output) output.innerHTML = `${escapeHTML(event.target.value)} <span>/ 10</span>`;
  }
  if (event.target.id === "review-body") {
    const counter = document.querySelector("#review-char-count");
    if (counter) counter.textContent = `${event.target.value.length}/1200`;
  }
  if (event.target.id === "player-progress") {
    playerPosition = Number(event.target.value);
    const film = filmById(routeInfo().id);
    if (film && hasValidLicense(film.id)) {
      updatePlayerDisplay(film);
      writeWatchHistory(film.id, playerPosition);
    }
  }
});

document.querySelector("#mobile-menu").addEventListener("click", () => toggleMobileNavigation());
document.querySelector("#sidebar-toggle").addEventListener("click", (event) => {
  const collapsed = document.body.classList.toggle("sidebar-collapsed");
  event.currentTarget.setAttribute("aria-expanded", String(!collapsed));
  event.currentTarget.setAttribute("aria-label", collapsed ? "Perluas navigasi" : "Ciutkan navigasi");
  event.currentTarget.querySelector("span").textContent = collapsed ? "›" : "‹";
});
document.querySelector("#profile-button").addEventListener("click", () => {
  if (activeUser()) logoutCurrentUser();
  else location.hash = "#masuk";
});
document.addEventListener("keydown", (event) => {
  if (event.key === "/" && !event.ctrlKey && !event.metaKey && !["INPUT", "TEXTAREA", "SELECT"].includes(document.activeElement.tagName)) {
    event.preventDefault();
    document.querySelector("#search-input").focus();
  }
  if (event.key === "Escape") toggleMobileNavigation(false);
});

window.addEventListener("hashchange", () => {
  toggleMobileNavigation(false);
  render({ focusMain: true });
  window.scrollTo({ top: 0, behavior: "smooth" });
});

async function initialize() {
  document.querySelector("#year").textContent = String(new Date().getFullYear());
  try {
    const [filmsResponse, genresResponse, licenseResponse, databaseResponse] = await Promise.all([
      fetch("./data/films.json"),
      fetch("./data/genres.json"),
      fetch("./data/license-types.json"),
      fetch("./data/database.json")
    ]);
    for (const response of [filmsResponse, genresResponse, licenseResponse, databaseResponse]) {
      if (!response.ok) throw new Error(`Permintaan ${response.url} gagal (HTTP ${response.status}).`);
    }
    [catalog.films, catalog.genres, catalog.licenseTypes, catalog.seed] = await Promise.all([
      filmsResponse.json(), genresResponse.json(), licenseResponse.json(), databaseResponse.json()
    ]);
  } catch (error) {
    console.error("CineVault tidak dapat memuat data katalog JSON.", error);
    app.innerHTML = `<section class="data-error"><span aria-hidden="true">!</span><h1>Data CineVault belum dapat dimuat.</h1><p>${escapeHTML(error.message)}</p><p>Jalankan situs melalui server lokal (misalnya ekstensi Live Server atau <code>py -m http.server</code>). Fetch JSON tidak diizinkan saat membuka berkas dengan skema <code>file://</code>.</p><button class="button button--primary" type="button" data-action="retry-data">Coba lagi</button></section>`;
    return;
  }
  let savedDatabase;
  try {
    savedDatabase = localStorage.getItem(STORAGE_KEYS.database);
  } catch (error) {
    console.error("CineVault tidak dapat membaca penyimpanan lokal.", error);
    app.innerHTML = `<section class="data-error"><span aria-hidden="true">!</span><h1>Penyimpanan lokal tidak dapat diakses.</h1><p>${escapeHTML(error.message)}</p><p>Aktifkan penyimpanan situs pada browser agar akun dan lisensi dapat digunakan.</p></section>`;
    return;
  }
  const freshInstall = !savedDatabase;
  if (savedDatabase) {
    try {
      database = JSON.parse(savedDatabase);
      const tables = ["users", "user_profiles", "film_genres", "orders", "order_items", "payments", "user_licenses", "reviews", "review_comments", "review_votes", "wishlists", "watch_history", "notifications"];
      const invalidTable = tables.find((table) => !Array.isArray(database[table]));
      if (invalidTable) throw new Error(`Data lokal pada tabel ${invalidTable} tidak valid.`);
    } catch (error) {
      console.error("Data CineVault tersimpan di browser tidak valid.", error);
      app.innerHTML = `<section class="data-error"><span aria-hidden="true">!</span><h1>Data lokal tidak dapat dibaca.</h1><p>${escapeHTML(error.message)}</p><p>Gunakan tombol di bawah untuk memulai ulang data demo. Perubahan lokal yang rusak akan diganti dengan data awal.</p><button class="button button--primary" type="button" id="reset-local-data">Pulihkan data demo</button></section>`;
      document.querySelector("#reset-local-data").addEventListener("click", () => {
        try {
          localStorage.removeItem(STORAGE_KEYS.database);
          localStorage.removeItem(STORAGE_KEYS.user);
          window.location.reload();
        } catch (resetError) {
          console.error("CineVault gagal memulihkan data lokal.", resetError);
          showToast("Data lokal tidak dapat dihapus. Hapus data situs dari pengaturan browser.", "error");
        }
      });
      return;
    }
  } else {
    database = clone(catalog.seed);
    // Demo rentals begin one hour into a fresh 48-hour window on the first visit.
    const seedNow = Date.now();
    for (const license of database.user_licenses) {
      const type = licenseTypeById(license.license_type_id);
      if (type?.duration_days && !license.expires_at) {
        license.purchased_at = new Date(seedNow - 60 * 60 * 1000).toISOString();
        license.expires_at = new Date(seedNow + (type.duration_days - 1 / 24) * 86400000).toISOString();
        const order = database.orders.find((entry) => entry.id === license.order_id);
        if (order) order.created_at = license.purchased_at;
      }
    }
    if (!saveDatabase()) {
      app.innerHTML = `<section class="data-error"><span aria-hidden="true">!</span><h1>Penyimpanan lokal tidak tersedia.</h1><p>Izinkan browser menyimpan data situs agar simulasi Library dan akun dapat digunakan.</p></section>`;
      return;
    }
  }
  try {
    currentUserId = localStorage.getItem(STORAGE_KEYS.user) || (freshInstall ? "pengguna-demo" : null);
  } catch (error) {
    console.error("CineVault tidak dapat membaca sesi lokal.", error);
    app.innerHTML = `<section class="data-error"><span aria-hidden="true">!</span><h1>Sesi akun tidak dapat dibaca.</h1><p>${escapeHTML(error.message)}</p><p>Aktifkan penyimpanan situs agar akun dan lisensi dapat digunakan.</p></section>`;
    return;
  }
  if (!database.users.some((user) => user.id === currentUserId)) currentUserId = null;
  if (freshInstall && currentUserId) {
    try {
      localStorage.setItem(STORAGE_KEYS.user, currentUserId);
    } catch (error) {
      console.error("CineVault gagal memulai sesi demo.", error);
      showToast("Sesi demo tidak tersimpan; akun dapat digunakan selama halaman ini terbuka.", "error");
    }
  }
  render();
}

initialize();
