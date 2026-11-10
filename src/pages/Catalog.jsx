import { useState, useMemo, useEffect } from 'react'
import { RefreshCw, Plus, Loader, AlertCircle, PackageOpen } from 'lucide-react'
import { useGuns } from '../hooks/useGuns'
import GUNS_LOCAL from '../data/guns'
import GunCard from '../components/gun/GunCard'
import GunDetail from '../components/gun/GunDetail'
import AdvancedFilter from '../components/common/AdvancedFilter'
import Pagination from '../components/common/Pagination'
import ConfirmModal from '../components/modals/ConfirmModal'
import gunService from '../services/gunService'
import {
  matchesSearch,
  matchesCategory,
  sortItems,
  extractCategories,
} from '../utils/helpers'

// ---------------------------------------------------------------------------
// Catalog — Halaman utama daftar produk.
//
// FITUR BARU YANG DITAMBAHKAN:
//
// 1. PAGINASI (Server-side):
//    Data diambil per halaman dari Supabase menggunakan `offset` + `limit`.
//    State `currentPage` dikontrol di sini dan dikirim ke useGuns() sebagai
//    parameter, yang diteruskan ke gunService.getGuns() → Supabase query.
//
//    Alur data: currentPage → useGuns({page, limit}) → gunService → Supabase
//    Hasil    : guns (data halaman ini), pagination.hasMore (ada halaman lagi?)
//
// 2. QUERY CACHING:
//    useGuns() menggunakan withCache() dari queryCache.js.
//    Navigasi kembali ke halaman yang sama tidak menyebabkan request baru
//    selama cache belum kadaluarsa (60 detik).
//
// 3. SHARE LINK (Deep Linking):
//    URL ?gunId={id} dibaca saat mount untuk langsung membuka detail produk.
//    Ini memungkinkan pengguna lain membuka link yang dibagikan dan langsung
//    melihat produk yang dimaksud.
//
// 4. LAZY LOADING:
//    Setiap <img> di GunCard menggunakan loading="lazy" (browser-native).
// ---------------------------------------------------------------------------

/** Jumlah produk per halaman */
const ITEMS_PER_PAGE = 6

/**
 * @param {Object}   props
 * @param {Function} [props.onNavigate] — fungsi navigasi lintas halaman
 */
export default function Catalog({ onNavigate }) {
  // ---- Paginasi ----
  // currentPage adalah state utama paginasi.
  // Setiap kali berubah, useGuns() otomatis re-fetch data halaman baru.
  const [currentPage, setCurrentPage] = useState(1)

  // ---- Filter & Sort ----
  const [search, setSearch] = useState('')
  const [activeCategory, setActiveCategory] = useState('All')
  const [sortKey, setSortKey] = useState('name')
  const [sortOrder, setSortOrder] = useState('asc')

  // ---- API Data ----
  // useGuns dipanggil dengan parameter page + limit untuk server-side pagination.
  // Setiap kombinasi params unik akan memiliki cache tersendiri.
  const { guns: apiGuns, loading, error, pagination, refetch } = useGuns({
    page: currentPage,
    limit: ITEMS_PER_PAGE,
    search: search || undefined,
    category: activeCategory !== 'All' ? activeCategory : undefined,
    sort_by: sortKey,
    order: sortOrder,
  })

  const [useLocal, setUseLocal] = useState(false)

  // Tentukan sumber data: API atau lokal (fallback)
  // Fallback ke GUNS_LOCAL jika:
  //   1. Pengguna klik "View Local Catalog" (useLocal)
  //   2. Ada error API dan API tidak mengembalikan data
  //   3. API berhasil tapi mengembalikan data kosong (tabel Supabase kosong / RLS blocking)
  const rawGuns = useMemo(() => {
    const apiIsEmpty = !loading && apiGuns.length === 0

    if (useLocal || (error && apiIsEmpty) || (!error && apiIsEmpty && !loading)) {
      return GUNS_LOCAL.map((g, i) => ({ ...g, id: g.id || `local-${i}` }))
    }
    return apiGuns
  }, [apiGuns, error, useLocal, loading])

  // Client-side filtering hanya untuk data lokal (API sudah filter server-side)
  const filteredGuns = useMemo(() => {
    if (!useLocal && !error) {
      // Data dari API sudah difilter dan diurutkan oleh Supabase
      return rawGuns
    }
    // Fallback lokal: filter dan urutkan di sisi klien
    let result = rawGuns.filter(
      (g) => matchesSearch(g, search) && matchesCategory(g, activeCategory),
    )
    return sortItems(result, sortKey, sortOrder)
  }, [rawGuns, search, activeCategory, sortKey, sortOrder, useLocal, error])

  const categories = useMemo(() => extractCategories(rawGuns), [rawGuns])

  // ---- Detail View ----
  const [selectedGun, setSelectedGun] = useState(null)

  // ---- Deep Link via URL ?gunId=... ----
  // Saat komponen mount, cek apakah URL mengandung ?gunId=...
  // Jika ya, fetch produk tersebut dan tampilkan langsung di detail view.
  // Ini mendukung fitur Share Link — penerima link langsung melihat produk.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const gunId = params.get('gunId')
    if (!gunId) return

    // Fetch produk berdasarkan ID dari URL
    gunService.getGunById(gunId)
      .then((res) => {
        if (res.success && res.data) {
          setSelectedGun(res.data)
        }
      })
      .catch(() => {
        // ID tidak ditemukan — tampilkan catalog normal saja
      })

    // Bersihkan query string dari URL agar tidak terulang saat refresh filter
    const cleanUrl = window.location.pathname
    window.history.replaceState({}, '', cleanUrl)
  }, []) // Hanya run sekali saat mount

  // ---- Reset halaman saat filter/sort berubah ----
  // Ketika pengguna mengubah filter, kita kembali ke halaman 1
  // karena hasil pencarian baru mungkin memiliki jumlah halaman berbeda.
  const handleSearch = (val) => { setSearch(val); setCurrentPage(1) }
  const handleCategory = (val) => { setActiveCategory(val); setCurrentPage(1) }
  const handleSort = ({ key, order }) => { setSortKey(key); setSortOrder(order); setCurrentPage(1) }

  // ---- Delete ----
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [deleting, setDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState('')

  const handleDelete = async () => {
    if (!deleteTarget) return
    try {
      setDeleting(true)
      setDeleteError('')
      await gunService.deleteGun(deleteTarget.id)
      // deleteGun() otomatis invalidate cache, refetch akan ambil data segar
      setDeleteTarget(null)
      refetch()
    } catch (err) {
      setDeleteError(err.message || 'Failed to delete.')
    } finally {
      setDeleting(false)
    }
  }

  // ---- Jika sedang melihat detail produk ----
  if (selectedGun) {
    return (
      <GunDetail
        gun={selectedGun}
        onBack={() => setSelectedGun(null)}
        onEdit={(g) => onNavigate && onNavigate('Edit', g)}
        onDelete={(g) => { setSelectedGun(null); setDeleteTarget(g) }}
      />
    )
  }

  // ---- Tampilan utama catalog ----
  return (
    <>
      <section className="masthead">
        <h1 className="display">Hardware, by the spec sheet.</h1>
        <p className="lede">
          A small armory of pistols, rifles, and shotguns. Every piece listed
          with its type, caliber, and price — nothing else.
        </p>
      </section>

      <section>
        <div className="list-head">
          <h2>Current stock</h2>
          <div className="list-head-right">
            <span className="count">
              {filteredGuns.length} piece{filteredGuns.length !== 1 ? 's' : ''} (halaman {currentPage})
            </span>
            {onNavigate && (
              <button
                type="button"
                className="btn btn--primary btn--sm"
                onClick={() => onNavigate('Create')}
              >
                <Plus size={16} /> Add
              </button>
            )}
          </div>
        </div>

        {/*
         * Filter & Sort
         * Ketika filter berubah, currentPage direset ke 1 (lihat handler di atas)
         * dan useGuns() akan refetch dengan params baru.
         */}
        <AdvancedFilter
          search={search}
          onSearch={handleSearch}
          categories={categories}
          activeCategory={activeCategory}
          onCategory={handleCategory}
          sortKey={sortKey}
          sortOrder={sortOrder}
          onSort={handleSort}
        />

        {/* Loading State */}
        {loading && (
          <div className="state-box">
            <Loader size={28} className="spin" />
            <p>Loading products… (halaman {currentPage})</p>
          </div>
        )}

        {/* Error State */}
        {!loading && error && !useLocal && (
          <div className="state-box state-box--error">
            <AlertCircle size={28} />
            <p>{error}</p>
            <div className="state-box__actions">
              <button type="button" className="btn btn--outline" onClick={refetch}>
                <RefreshCw size={16} /> Retry
              </button>
              <button
                type="button"
                className="btn btn--outline"
                onClick={() => setUseLocal(true)}
              >
                View Local Catalog
              </button>
            </div>
          </div>
        )}

        {/* Empty State */}
        {!loading && filteredGuns.length === 0 && !error && (
          <div className="state-box">
            <PackageOpen size={28} />
            <p>No products match your search.</p>
          </div>
        )}

        {/*
         * Grid produk — menggunakan GunCard dengan lazy loading + share button.
         *
         * Setiap GunCard memiliki:
         *   - Gambar dengan loading="lazy" (lazy load)
         *   - Tombol share (share link)
         *   - Tombol favorit
         *   - Tombol edit/delete (admin)
         */}
        {filteredGuns.length > 0 && (
          <ul className="stock">
            {filteredGuns.map((gun) => (
              <GunCard
                key={gun.id || gun.name}
                gun={gun}
                onSelect={setSelectedGun}
                onEdit={onNavigate ? (g) => onNavigate('Edit', g) : undefined}
                onDelete={setDeleteTarget}
              />
            ))}
          </ul>
        )}

        {/*
         * PAGINASI:
         * Komponen Pagination menampilkan tombol Prev/Next dan nomor halaman.
         *
         * Logic:
         *   - canPrev: currentPage > 1
         *   - canNext: pagination.hasMore (dari Supabase — ada data di halaman berikut?)
         *   - Klik Prev: currentPage-- → useGuns refetch halaman sebelumnya
         *   - Klik Next: currentPage++ → useGuns refetch halaman berikutnya
         *
         * Query Caching memastikan navigasi kembali ke halaman sebelumnya
         * tidak memerlukan request API baru.
         */}
        {!useLocal && (filteredGuns.length > 0 || loading) && (
          <Pagination
            page={currentPage}
            hasMore={pagination?.hasMore ?? false}
            onPrev={() => setCurrentPage((p) => Math.max(1, p - 1))}
            onNext={() => setCurrentPage((p) => p + 1)}
            loading={loading}
          />
        )}

        {/* Notifikasi mode lokal */}
        {useLocal && (
          <p className="local-notice">
            Showing local catalog (server unavailable).{' '}
            <button
              type="button"
              className="link-btn"
              onClick={() => { setUseLocal(false); setCurrentPage(1); refetch() }}
            >
              Retry server
            </button>
          </p>
        )}
      </section>

      {/* Modal konfirmasi hapus */}
      <ConfirmModal
        open={!!deleteTarget}
        title="Delete Product"
        message={`Are you sure you want to delete "${deleteTarget?.name}"? This action cannot be undone.`}
        confirmLabel="Delete"
        danger
        loading={deleting}
        onConfirm={handleDelete}
        onCancel={() => { setDeleteTarget(null); setDeleteError('') }}
      />
      {deleteError && (
        <div className="toast toast--error">{deleteError}</div>
      )}
    </>
  )
}
