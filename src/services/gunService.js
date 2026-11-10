import { apiClient, IS_SUPABASE } from '../config/api'
import { withCache, invalidateCacheByPrefix } from '../utils/queryCache'

// ---------------------------------------------------------------------------
// normalizeProduct — standardizes product shape whether received from Supabase
// (public.products) or from the university API (/api/v1/recipes).
//
// Fungsi ini memastikan format data konsisten di seluruh aplikasi meskipun
// sumber data berbeda (Supabase vs REST API).
// ---------------------------------------------------------------------------
export const normalizeProduct = (item) => {
  if (!item) return null

  // Resolve specifications from Supabase `specs` (text array) or API `ingredients`
  let specsList = []
  if (Array.isArray(item.specs)) {
    specsList = item.specs.map((s, idx) => {
      if (typeof s === 'string') {
        const colonIndex = s.indexOf(':')
        if (colonIndex > -1) {
          return {
            id: `spec-${idx}`,
            name: s.substring(0, colonIndex).trim(),
            quantity: s.substring(colonIndex + 1).trim(),
          }
        }
        return {
          id: `spec-${idx}`,
          name: 'Specification',
          quantity: s.trim(),
        }
      }
      return s
    })
  } else if (Array.isArray(item.ingredients)) {
    specsList = item.ingredients
  }

  // Resolve steps
  const stepsList =
    Array.isArray(item.steps) && item.steps.length > 0
      ? item.steps
      : ['Verify firearm is completely unloaded and point in safe direction.', 'Inspect receiver and mechanism for maintenance.']

  return {
    ...item,
    id: item.id,
    name: item.name || 'Hardware Piece',
    type: item.type || item.category || 'Hardware',
    category: item.type || item.category || 'Hardware',
    caliber: item.caliber || 'Standard',
    price: Number(item.price ?? item.cook_time ?? 0),
    description: item.description || '',
    image_url: item.image_url || item.image || '/guns/pistol.svg',
    image: item.image_url || item.image || '/guns/pistol.svg',
    ingredients: specsList,
    steps: stepsList,
  }
}

// ---------------------------------------------------------------------------
// GunService — wraps backend CRUD endpoints dengan Query Caching.
//
// QUERY CACHING diterapkan pada:
//   - getGuns()    → cache key: "guns-{params}"
//   - getGunById() → cache key: "gun-{id}"
//
// Setelah mutasi (create/update/delete), cache produk dibersihkan agar data
// yang ditampilkan selalu sinkron dengan server.
//
// Mendukung Supabase PostgREST (/rest/v1/products) dan
// standard REST API (/api/v1/recipes).
// ---------------------------------------------------------------------------
class GunService {
  /**
   * Fetch a paginated, filterable list of products.
   *
   * QUERY CACHING:
   * Key cache dibentuk dari kombinasi semua parameter (search, category, page,
   * limit, sort). Ini memastikan tiap kombinasi filter disimpan sebagai cache
   * terpisah sehingga navigasi antar halaman / filter lebih responsif.
   *
   * @param {Object} params  — { search, category, page, limit, sort_by, order }
   * @returns {Promise<{ success: boolean, data: Array, pagination: Object }>}
   */
  async getGuns(params = {}) {
    if (IS_SUPABASE) {
      // Buat cache key unik berdasarkan seluruh parameter
      const cacheKey = `guns-${JSON.stringify(params)}`

      return withCache(cacheKey, async () => {
        const queryParts = ['select=*']

        if (params.search) {
          queryParts.push(`name=ilike.*${encodeURIComponent(params.search)}*`)
        }

        if (params.category && params.category !== 'All') {
          queryParts.push(`type=eq.${encodeURIComponent(params.category)}`)
        }

        if (params.sort_by) {
          const order = params.order === 'desc' ? 'desc' : 'asc'
          queryParts.push(`order=${encodeURIComponent(params.sort_by)}.${order}`)
        } else {
          queryParts.push('order=created_at.desc')
        }

        // Paginasi server-side: Supabase mendukung offset/limit
        // Hitung offset dari halaman dan jumlah item per halaman
        const page = params.page || 1
        const limit = params.limit || 6
        const offset = (page - 1) * limit
        queryParts.push(`limit=${limit}`)
        queryParts.push(`offset=${offset}`)

        const queryString = queryParts.join('&')

        // Supabase membutuhkan header Prefer: count=exact untuk mendapatkan total count
        const response = await apiClient.get(`/products?${queryString}`, {
          headers: {
            Prefer: 'count=exact',
          },
        })

        // apiClient sudah me-unwrap response.data, jadi `response` adalah array langsung.
        // Total count dikirim oleh Supabase via header Content-Range, tapi karena
        // interceptor kita unwrap ke response.data, kita gunakan estimasi dari slice.
        const list = Array.isArray(response) ? response.map(normalizeProduct) : []

        return {
          success: true,
          data: list,
          pagination: {
            page,
            limit,
            // Jika data yang dikembalikan kurang dari limit, berarti ini halaman terakhir
            hasMore: list.length === limit,
            total: null, // Total count membutuhkan perubahan pada interceptor Axios
          },
        }
      })
    }

    // Fallback: university REST API
    const clean = Object.fromEntries(
      Object.entries(params).filter(([, v]) => v !== '' && v != null),
    )
    return apiClient.get('/api/v1/recipes', { params: clean })
  }

  /**
   * Fetch a single product by ID.
   *
   * QUERY CACHING:
   * Data detail produk jarang berubah, sehingga aman di-cache lebih lama.
   * Cache key: "gun-{id}".
   */
  async getGunById(id) {
    if (IS_SUPABASE) {
      const cacheKey = `gun-${id}`

      return withCache(cacheKey, async () => {
        const data = await apiClient.get(`/products?id=eq.${id}&select=*`)
        if (Array.isArray(data) && data.length > 0) {
          return { success: true, data: normalizeProduct(data[0]) }
        }
        throw new Error('Hardware item not found.')
      })
    }
    return apiClient.get(`/api/v1/recipes/${id}`)
  }

  /**
   * Create a new product.
   *
   * Setelah berhasil create, invalidate cache "guns-*" agar catalog
   * menampilkan data terbaru dari server.
   */
  async createGun(data) {
    if (IS_SUPABASE) {
      const specsArray = Array.isArray(data.ingredients)
        ? data.ingredients.map((i) => `${i.name}: ${i.quantity}`)
        : Array.isArray(data.specs)
        ? data.specs
        : []

      const payload = {
        name: data.name,
        type: data.type || (data.category === 'minuman' ? 'Rifle' : 'Pistol'),
        caliber: data.caliber || '9mm',
        price: Number(data.price ?? data.cook_time ?? 0),
        description: data.description || '',
        specs: specsArray,
        image_url: data.image_url || null,
      }

      const res = await apiClient.post('/products', payload, {
        headers: { Prefer: 'return=representation' },
      })
      const created = Array.isArray(res) ? res[0] : res

      // Bersihkan semua cache produk agar catalog terupdate
      invalidateCacheByPrefix('guns-')

      return { success: true, data: normalizeProduct(created) }
    }
    return apiClient.post('/api/v1/recipes', data)
  }

  /**
   * Update existing product.
   *
   * Setelah update, invalidate cache spesifik produk dan daftar catalog.
   */
  async updateGun(id, data) {
    if (IS_SUPABASE) {
      const specsArray = Array.isArray(data.ingredients)
        ? data.ingredients.map((i) => `${i.name}: ${i.quantity}`)
        : Array.isArray(data.specs)
        ? data.specs
        : undefined

      const payload = {
        updated_at: new Date().toISOString(),
      }
      if (data.name !== undefined) payload.name = data.name
      if (data.type !== undefined) payload.type = data.type
      if (data.caliber !== undefined) payload.caliber = data.caliber
      if (data.price !== undefined || data.cook_time !== undefined) {
        payload.price = Number(data.price ?? data.cook_time ?? 0)
      }
      if (data.description !== undefined) payload.description = data.description
      if (specsArray !== undefined) payload.specs = specsArray
      if (data.image_url !== undefined) payload.image_url = data.image_url

      const res = await apiClient.patch(`/products?id=eq.${id}`, payload, {
        headers: { Prefer: 'return=representation' },
      })
      const updated = Array.isArray(res) ? res[0] : res

      // Bersihkan cache produk yang diupdate dan daftar catalog
      invalidateCacheByPrefix('guns-')
      invalidateCacheByPrefix(`gun-${id}`)

      return { success: true, data: normalizeProduct(updated) }
    }
    return apiClient.put(`/api/v1/recipes/${id}`, data)
  }

  /**
   * Partial update (PATCH).
   */
  async patchGun(id, data) {
    if (IS_SUPABASE) {
      return this.updateGun(id, data)
    }
    return apiClient.patch(`/api/v1/recipes/${id}`, data)
  }

  /**
   * Delete product.
   *
   * Setelah delete, invalidate seluruh cache produk.
   */
  async deleteGun(id) {
    if (IS_SUPABASE) {
      await apiClient.delete(`/products?id=eq.${id}`)

      // Bersihkan cache agar data terbaru ditampilkan
      invalidateCacheByPrefix('guns-')
      invalidateCacheByPrefix(`gun-${id}`)

      return { success: true }
    }
    return apiClient.delete(`/api/v1/recipes/${id}`)
  }
}

export default new GunService()
