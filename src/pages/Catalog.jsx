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
// Catalog — Halaman utama daftar produk dengan integrasi:
//   1. Supabase REST API (dengan Query Caching)
//   2. Filter Kategori & Pencarian Teks responsif
//   3. Pengurutan (Sort by Name / Price)
//   4. Paginasi (6 item per halaman)
//   5. Lazy Loading Gambar
//   6. Share Link (Deep link via ?gunId=...)
// ---------------------------------------------------------------------------

const ITEMS_PER_PAGE = 6

// Daftar kategori permanen — selalu tampil lengkap dan tidak akan pernah hilang
const CATEGORIES = ['All', 'Handgun', 'Rifle', 'Shotgun']

export default function Catalog({ onNavigate }) {
  // ---- Fetch semua data produk dari Supabase (di-cache oleh queryCache) ----
  const { guns: apiGuns, loading, error, refetch } = useGuns({ limit: 100 })
  const [useLocal, setUseLocal] = useState(false)

  // Gunakan data API jika tersedia; jika kosong atau error, fallback ke data lokal
  const allGuns = useMemo(() => {
    const apiIsEmpty = !loading && apiGuns.length === 0
    if (useLocal || (error && apiIsEmpty) || (!error && apiIsEmpty && !loading)) {
      return GUNS_LOCAL.map((g, i) => ({ ...g, id: g.id ?? i + 1 }))
    }
    return apiGuns
  }, [apiGuns, error, useLocal, loading])

  // ---- Filter & Sort States ----
  const [search, setSearch] = useState('')
  const [activeCategory, setActiveCategory] = useState('All')
  const [sortKey, setSortKey] = useState('name')
  const [sortOrder, setSortOrder] = useState('asc')
  const [currentPage, setCurrentPage] = useState(1)

  // Gunakan kategori tetap agar pill Handgun, Rifle, Shotgun tidak pernah hilang
  const categories = CATEGORIES

  // ---- 1. FILTERING & SORTING ----
  const filteredGuns = useMemo(() => {
    let result = allGuns.filter((g) => {
      const matchQuery = matchesSearch(g, search)
      const matchCat = matchesCategory(g, activeCategory)
      return matchQuery && matchCat
    })
    return sortItems(result, sortKey, sortOrder)
  }, [allGuns, search, activeCategory, sortKey, sortOrder])

  // ---- 2. PAGINASI (6 item per halaman) ----
  const totalPages = Math.max(1, Math.ceil(filteredGuns.length / ITEMS_PER_PAGE))
  const paginatedGuns = useMemo(() => {
    const start = (currentPage - 1) * ITEMS_PER_PAGE
    return filteredGuns.slice(start, start + ITEMS_PER_PAGE)
  }, [filteredGuns, currentPage])

  // Reset ke halaman 1 saat filter berubah
  const handleSearch = (val) => {
    setSearch(val)
    setCurrentPage(1)
  }
  const handleCategory = (val) => {
    setActiveCategory(val)
    setCurrentPage(1)
  }
  const handleSort = ({ key, order }) => {
    setSortKey(key)
    setSortOrder(order)
    setCurrentPage(1)
  }

  // ---- 3. DEEP LINK SHARE LINK (?gunId=...) ----
  const [selectedGun, setSelectedGun] = useState(null)

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const gunId = params.get('gunId')
    if (!gunId) return

    // Cari dari daftar yang sudah dimuat atau panggil API
    const found = allGuns.find((g) => String(g.id) === String(gunId))
    if (found) {
      setSelectedGun(found)
    } else {
      gunService.getGunById(gunId)
        .then((res) => {
          if (res.success && res.data) setSelectedGun(res.data)
        })
        .catch(() => {})
    }

    // Bersihkan URL query
    window.history.replaceState({}, '', window.location.pathname)
  }, [allGuns])

  // ---- Delete Flow ----
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [deleting, setDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState('')

  const handleDelete = async () => {
    if (!deleteTarget) return
    try {
      setDeleting(true)
      setDeleteError('')
      await gunService.deleteGun(deleteTarget.id)
      setDeleteTarget(null)
      refetch()
    } catch (err) {
      setDeleteError(typeof err.message === 'string' ? err.message : 'Failed to delete.')
    } finally {
      setDeleting(false)
    }
  }

  // Detail view
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
              {filteredGuns.length} piece{filteredGuns.length !== 1 ? 's' : ''} (Halaman {currentPage} dari {totalPages})
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

        {/* Filter Bar (Search + Category Pills + Sort Dropdown) */}
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
        {loading && allGuns.length === 0 && (
          <div className="state-box">
            <Loader size={28} className="spin" />
            <p>Loading products from Supabase…</p>
          </div>
        )}

        {/* Error State */}
        {!loading && error && !useLocal && allGuns.length === 0 && (
          <div className="state-box state-box--error">
            <AlertCircle size={28} />
            <p>{typeof error === 'string' ? error : (error?.message || 'Failed to load products.')}</p>
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
        {!loading && filteredGuns.length === 0 && (
          <div className="state-box">
            <PackageOpen size={28} />
            <p>No products match your search or filter.</p>
          </div>
        )}

        {/* Product Grid — Kartu produk dengan Lazy Load & Share Link */}
        {paginatedGuns.length > 0 && (
          <ul className="stock">
            {paginatedGuns.map((gun) => (
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

        {/* Paginasi: Tampil jika jumlah hasil filter melebihi 6 item */}
        {filteredGuns.length > ITEMS_PER_PAGE && (
          <Pagination
            page={currentPage}
            hasMore={currentPage < totalPages}
            onPrev={() => setCurrentPage((p) => Math.max(1, p - 1))}
            onNext={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
            loading={loading}
          />
        )}

        {useLocal && (
          <p className="local-notice">
            Showing local catalog.{' '}
            <button
              type="button"
              className="link-btn"
              onClick={() => { setUseLocal(false); refetch() }}
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
