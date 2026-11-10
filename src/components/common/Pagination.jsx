import { ChevronLeft, ChevronRight } from 'lucide-react'

// ---------------------------------------------------------------------------
// Pagination — Komponen UI untuk navigasi antar halaman (paginasi).
//
// KONSEP PAGINASI:
// Paginasi adalah teknik membagi data dalam jumlah besar menjadi halaman-
// halaman kecil yang dapat dinavigasi pengguna. Ini meningkatkan performa
// karena tidak semua data dimuat sekaligus.
//
// JENIS PAGINASI YANG DIGUNAKAN:
// Offset-based Pagination (atau Cursor-based via Supabase `offset` + `limit`):
//   - `page`  : Nomor halaman saat ini (mulai dari 1)
//   - `limit` : Jumlah item per halaman (misalnya 6)
//   - `offset`: (page - 1) * limit → index item pertama di halaman ini
//
// Contoh dengan 20 item, limit 6:
//   Halaman 1: offset=0,  ambil item 1-6
//   Halaman 2: offset=6,  ambil item 7-12
//   Halaman 3: offset=12, ambil item 13-18
//   Halaman 4: offset=18, ambil item 19-20
//
// PROPS:
//   @param {number}   page        — Nomor halaman saat ini
//   @param {boolean}  hasMore     — Apakah masih ada halaman berikutnya
//   @param {Function} onPrev      — Callback untuk halaman sebelumnya
//   @param {Function} onNext      — Callback untuk halaman berikutnya
//   @param {boolean}  [loading]   — Nonaktifkan tombol saat loading
// ---------------------------------------------------------------------------

export default function Pagination({ page, hasMore, onPrev, onNext, loading = false }) {
  // Tombol "Sebelumnya" hanya aktif jika bukan halaman pertama
  const canPrev = page > 1
  // Tombol "Berikutnya" hanya aktif jika masih ada data
  const canNext = hasMore

  return (
    <nav
      className="pagination"
      aria-label="Navigasi halaman produk"
    >
      {/* Tombol halaman sebelumnya */}
      <button
        type="button"
        className="btn btn--outline pagination__btn"
        onClick={onPrev}
        disabled={!canPrev || loading}
        aria-label="Halaman sebelumnya"
        title="Halaman sebelumnya"
      >
        <ChevronLeft size={16} />
        <span>Prev</span>
      </button>

      {/* Indikator halaman saat ini */}
      <span className="pagination__info" aria-current="page">
        Halaman {page}
      </span>

      {/* Tombol halaman berikutnya */}
      <button
        type="button"
        className="btn btn--outline pagination__btn"
        onClick={onNext}
        disabled={!canNext || loading}
        aria-label="Halaman berikutnya"
        title="Halaman berikutnya"
      >
        <span>Next</span>
        <ChevronRight size={16} />
      </button>
    </nav>
  )
}
