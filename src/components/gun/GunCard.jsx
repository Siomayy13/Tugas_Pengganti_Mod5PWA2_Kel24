import FavoriteButton from '../common/FavoriteButton'
import ShareButton from '../common/ShareButton'
import { formatPrice, truncate } from '../../utils/helpers'

/**
 * GunCard — Kartu produk yang ditampilkan dalam grid catalog.
 *
 * FITUR:
 *   - Lazy loading gambar: `loading="lazy"` pada <img> memberitahu browser
 *     untuk hanya memuat gambar saat kartu mendekati viewport. Ini mengurangi
 *     penggunaan bandwidth dan mempercepat render awal halaman.
 *
 *   - Share Link: tombol berbagi URL produk menggunakan Web Share API
 *     (mobile/PWA) atau fallback ke clipboard. Format URL: ?gunId={id}
 *
 *   - Favorite: menyimpan produk ke daftar favorit (server + localStorage)
 *
 * @param {Object}   props
 * @param {Object}   props.gun       — data produk
 * @param {Function} props.onSelect  — dipanggil saat kartu diklik
 * @param {Function} [props.onEdit]  — dipanggil saat Edit diklik (admin)
 * @param {Function} [props.onDelete]— dipanggil saat Delete diklik (admin)
 */
export default function GunCard({ gun, onSelect, onEdit, onDelete }) {
  const imgSrc = gun.image_url || gun.image || '/guns/pistol.svg'
  const category = gun.type || gun.category || '—'
  const caliber = gun.caliber || gun.difficulty || ''
  const price = gun.price ?? gun.cook_time ?? 0

  return (
    <li className="card">
      {/*
       * Tombol utama kartu — klik membuka detail produk.
       * Dibuat sebagai <button> (bukan <div>) untuk aksesibilitas keyboard.
       */}
      <button
        type="button"
        className="card-btn"
        onClick={() => onSelect(gun)}
        aria-label={`View ${gun.name}`}
      >
        {/*
         * LAZY LOADING GAMBAR:
         * Atribut loading="lazy" memberitahu browser agar menunda pemuatan
         * gambar sampai kartu berada (atau mendekati) area tampilan layar.
         *
         * Tanpa lazy loading: semua gambar dimuat bersamaan saat halaman buka
         *   → lambat, boros bandwidth.
         * Dengan lazy loading: hanya gambar yang terlihat yang dimuat
         *   → lebih cepat, hemat bandwidth.
         *
         * width & height diberikan untuk mencegah Cumulative Layout Shift (CLS)
         * — pergeseran tata letak saat gambar selesai dimuat.
         */}
        <img
          className="card-img"
          src={imgSrc}
          alt={gun.name}
          width="240"
          height="180"
          loading="lazy"
        />

        <span className="name display">{gun.name}</span>

        <span className="type">
          {category}
          {caliber ? ` · ${caliber}` : ''}
        </span>

        {gun.description && (
          <span className="card-desc">{truncate(gun.description, 72)}</span>
        )}

        <span className="price">{formatPrice(price)}</span>
      </button>

      {/* Baris aksi mengambang di sudut kartu */}
      <div className="card-actions">
        {/* Tombol Favorit: simpan/hapus dari shortlist */}
        <FavoriteButton gunId={gun.id || gun.name} />

        {/*
         * SHARE LINK:
         * Memungkinkan pengguna berbagi URL langsung ke produk ini.
         * Hanya ditampilkan jika produk memiliki ID server (bukan local-only).
         *
         * URL yang dibagikan: https://domain.com/?gunId={gun.id}
         * Penerima link langsung melihat detail produk yang dimaksud.
         */}
        {gun.id && !String(gun.id).startsWith('local-') && (
          <ShareButton gun={gun} />
        )}

        {/* Tombol Edit — hanya tampil jika onEdit tersedia (mode admin) */}
        {onEdit && (
          <button
            type="button"
            className="card-act-btn"
            onClick={(e) => { e.stopPropagation(); onEdit(gun) }}
            aria-label={`Edit ${gun.name}`}
            title="Edit"
          >
            ✏️
          </button>
        )}

        {/* Tombol Delete — hanya tampil jika onDelete tersedia (mode admin) */}
        {onDelete && (
          <button
            type="button"
            className="card-act-btn card-act-btn--danger"
            onClick={(e) => { e.stopPropagation(); onDelete(gun) }}
            aria-label={`Delete ${gun.name}`}
            title="Delete"
          >
            🗑️
          </button>
        )}
      </div>
    </li>
  )
}
