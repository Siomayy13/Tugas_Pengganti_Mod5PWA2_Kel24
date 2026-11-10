import { useState, useEffect, useCallback, useRef } from 'react'
import gunService from '../services/gunService'

// ---------------------------------------------------------------------------
// useGuns — Hook untuk mengambil daftar produk dengan dukungan:
//   1. PAGINASI  : Parameter `page` dan `limit` untuk memotong data per halaman
//   2. QUERY CACHING: Hasil fetch di-cache di queryCache.js sehingga navigasi
//      ulang ke halaman yang sama tidak memerlukan request API baru
//
// CARA KERJA PAGINASI:
//   - `page`  : Nomor halaman saat ini (default: 1)
//   - `limit` : Jumlah item per halaman (default: 6)
//   - `hasMore`: Boolean — apakah masih ada halaman berikutnya
//
// Returns { guns, loading, error, pagination, refetch }
// ---------------------------------------------------------------------------

export function useGuns(params = {}) {
  const [guns, setGuns] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [pagination, setPagination] = useState(null)

  // Serialise params sebagai dependency key agar effect re-run saat params berubah.
  // Menggunakan JSON.stringify memastikan perbandingan deep equality.
  const paramKey = JSON.stringify(params)

  // Gunakan ref untuk menyimpan paramKey terbaru sehingga cleanup bisa
  // membatalkan setState dari fetch yang sudah usang (race condition guard).
  const latestParamKey = useRef(paramKey)

  const fetchGuns = useCallback(async () => {
    // Tandai key yang sedang di-fetch agar kita bisa abaikan respons lama
    const currentKey = JSON.stringify(params)
    latestParamKey.current = currentKey

    try {
      setLoading(true)
      setError(null)

      // gunService.getGuns() akan menggunakan cache jika tersedia.
      // Jika cache miss, baru melakukan request ke Supabase API.
      const response = await gunService.getGuns(params)

      // Abaikan respons jika params sudah berubah (pengguna berpindah halaman)
      if (latestParamKey.current !== currentKey) return

      if (response.success) {
        setGuns(response.data || [])
        setPagination(response.pagination || null)
      } else {
        setError(response.message || 'Failed to fetch products.')
      }
    } catch (err) {
      if (latestParamKey.current !== currentKey) return
      setError(err.message || 'An error occurred while fetching products.')
      setGuns([])
    } finally {
      if (latestParamKey.current === currentKey) {
        setLoading(false)
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paramKey])

  useEffect(() => {
    fetchGuns()
  }, [fetchGuns])

  return { guns, loading, error, pagination, refetch: fetchGuns }
}

// ---------------------------------------------------------------------------
// useGunById — Hook untuk mengambil detail satu produk berdasarkan UUID.
//
// QUERY CACHING:
// Data detail produk di-cache dengan key "gun-{id}" selama 60 detik.
// Navigasi kembali ke detail produk yang sama tidak akan trigger request baru.
//
// Returns { gun, loading, error, refetch }
// ---------------------------------------------------------------------------

export function useGunById(id) {
  const [gun, setGun] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const fetchGun = useCallback(async () => {
    if (!id) {
      setLoading(false)
      return
    }
    try {
      setLoading(true)
      setError(null)

      // Cache key: "gun-{id}" — lihat queryCache.js dan gunService.js
      const response = await gunService.getGunById(id)

      if (response.success) {
        setGun(response.data)
      } else {
        setError(response.message || 'Product not found.')
      }
    } catch (err) {
      setError(err.message || 'Failed to load product details.')
      setGun(null)
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => {
    fetchGun()
  }, [fetchGun])

  return { gun, loading, error, refetch: fetchGun }
}
