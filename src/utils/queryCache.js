// ---------------------------------------------------------------------------
// queryCache.js — Implementasi Query Caching sederhana berbasis Map.
//
// KONSEP QUERY CACHING:
// Query Caching adalah teknik menyimpan hasil dari permintaan API (query)
// ke dalam memori sementara (cache), sehingga ketika permintaan yang sama
// dilakukan lagi, hasilnya bisa langsung diambil dari cache tanpa perlu
// memanggil API ulang.
//
// MANFAAT:
//   1. Mengurangi jumlah request ke server → hemat bandwidth
//   2. Respons lebih cepat → user tidak perlu menunggu loading berulang
//   3. Mengurangi beban server
//
// CARA KERJA:
//   - Setiap query disimpan dengan "key" unik (biasanya URL + params)
//   - Cache memiliki TTL (Time To Live) — waktu kadaluarsa
//   - Jika data masih segar (belum expired), ambil dari cache
//   - Jika sudah expired atau tidak ada, fetch ulang dari API
// ---------------------------------------------------------------------------

/** @type {Map<string, { data: any, timestamp: number }>} */
const cache = new Map()

/**
 * Durasi cache sebelum kadaluarsa (dalam milidetik).
 * Default: 60 detik (60_000 ms).
 * Artinya data yang sama tidak akan di-fetch ulang selama 1 menit.
 */
const DEFAULT_TTL_MS = 60_000

/**
 * Mengambil data dari cache berdasarkan key.
 *
 * @param {string} key    — Kunci unik cache (misalnya: "guns-page-1-Pistol")
 * @param {number} [ttl]  — Waktu kadaluarsa dalam ms (default: 60 detik)
 * @returns {any|null}    — Data dari cache, atau null jika tidak ada / kadaluarsa
 */
export function getCache(key, ttl = DEFAULT_TTL_MS) {
  const entry = cache.get(key)
  if (!entry) return null // Cache miss: data tidak ada

  const isExpired = Date.now() - entry.timestamp > ttl
  if (isExpired) {
    // Cache expired: hapus dan kembalikan null
    cache.delete(key)
    return null
  }

  // Cache hit: kembalikan data yang sudah tersimpan
  return entry.data
}

/**
 * Menyimpan data ke cache dengan key tertentu.
 *
 * @param {string} key   — Kunci unik cache
 * @param {any}    data  — Data yang akan disimpan
 */
export function setCache(key, data) {
  cache.set(key, {
    data,
    timestamp: Date.now(), // Catat waktu penyimpanan
  })
}

/**
 * Menghapus satu entry dari cache berdasarkan key.
 * Berguna setelah mutasi (create/update/delete) agar data fresh kembali.
 *
 * @param {string} key
 */
export function invalidateCache(key) {
  cache.delete(key)
}

/**
 * Menghapus semua cache yang key-nya diawali dengan prefix tertentu.
 * Berguna untuk membersihkan semua cache produk sekaligus setelah mutasi.
 *
 * @param {string} prefix — Awalan key yang akan dihapus (misal: "guns-")
 */
export function invalidateCacheByPrefix(prefix) {
  for (const key of cache.keys()) {
    if (key.startsWith(prefix)) cache.delete(key)
  }
}

/**
 * Membersihkan seluruh cache.
 * Digunakan saat logout atau reload manual.
 */
export function clearCache() {
  cache.clear()
}

/**
 * Helper: jalankan fn() lalu cache hasilnya; atau kembalikan cache lama.
 *
 * PENGGUNAAN:
 *   const data = await withCache('my-key', () => fetch('/api/items'))
 *
 * @param {string}   key        — Kunci cache
 * @param {Function} fetcher    — Async function yang melakukan fetch ke API
 * @param {number}   [ttl]      — TTL dalam ms
 * @returns {Promise<any>}
 */
export async function withCache(key, fetcher, ttl = DEFAULT_TTL_MS) {
  // 1. Cek apakah ada di cache dan masih valid
  const cached = getCache(key, ttl)
  if (cached !== null) {
    console.debug(`[cache] HIT  → ${key}`) // Log cache hit untuk debugging
    return cached
  }

  // 2. Cache miss: jalankan fetcher dan simpan hasilnya
  console.debug(`[cache] MISS → ${key}`)
  const data = await fetcher()
  setCache(key, data)
  return data
}

/**
 * Mengembalikan jumlah item yang saat ini tersimpan di cache.
 * Berguna untuk debugging dan monitoring.
 */
export function getCacheSize() {
  return cache.size
}
