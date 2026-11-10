import axios from 'axios'

// ---------------------------------------------------------------------------
// api.js — Konfigurasi Axios Instance untuk komunikasi dengan Supabase REST API
//
// KONFIGURASI API INDIVIDU:
// Project ini menggunakan Supabase pribadi sebagai backend database:
//   - URL : https://adofvknhfnfqfbtxqiqy.supabase.co/rest/v1
//   - KEY : sb_publishable_VkOo-2x5BmpCWjZ0OvS3uw_5s2G24Pk
//
// Nilai-nilai di atas didefinisikan di file `.env` (tidak di-commit ke git)
// dan dibaca melalui import.meta.env (Vite env variables).
// ---------------------------------------------------------------------------

// Baca konfigurasi dari environment variables (.env)
const BASE_URL = import.meta.env.VITE_API_BASE_URL || ''
const SUPABASE_KEY =
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ||
  import.meta.env.VITE_SUPABASE_ANON_KEY ||
  ''

// Deteksi apakah backend adalah Supabase berdasarkan URL atau keberadaan key
const IS_SUPABASE =
  BASE_URL.includes('supabase.co') || Boolean(SUPABASE_KEY)

if (!BASE_URL) {
  console.warn(
    '[api] VITE_API_BASE_URL is not set. API requests will use relative paths.',
  )
}

// ---------------------------------------------------------------------------
// Axios instance
//
// `baseURL` di-set ke BASE_URL dari .env sehingga seluruh request otomatis
// menggunakan base URL yang benar tanpa perlu mengetiknya berulang kali.
//
// `timeout`: Batas waktu request 10 detik untuk mencegah hang.
// ---------------------------------------------------------------------------
const apiClient = axios.create({
  baseURL: BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 10000, // 10 detik
})

// ---------------------------------------------------------------------------
// Request Interceptor — Menyisipkan Supabase Auth Headers secara otomatis
//
// Supabase membutuhkan dua header pada setiap request:
//   1. `apikey`        — Supabase publishable/anon key untuk identifikasi project
//   2. `Authorization` — Bearer token untuk autentikasi (sama dengan apikey
//                        jika menggunakan anon/publishable key)
//
// Interceptor memastikan header ini selalu ada tanpa perlu menulisnya
// secara manual di setiap pemanggilan API.
// ---------------------------------------------------------------------------
apiClient.interceptors.request.use(
  (config) => {
    if (IS_SUPABASE && SUPABASE_KEY) {
      config.headers['apikey'] = SUPABASE_KEY
      if (!config.headers['Authorization']) {
        config.headers['Authorization'] = `Bearer ${SUPABASE_KEY}`
      }
    }
    return config
  },
  (error) => Promise.reject(error),
)

// ---------------------------------------------------------------------------
// Response Interceptor — Unwrap data dan normalisasi error
//
// Fungsi:
//   1. SUKSES: langsung kembalikan response.data (bukan object Axios penuh)
//      sehingga kode pemanggil bisa langsung mengakses data tanpa `.data`
//   2. ERROR : ekstrak pesan error yang bermakna dari berbagai format respons
//              Supabase maupun REST API standar, lalu reject dengan object
//              error yang konsisten: { message, status, code, raw }
// ---------------------------------------------------------------------------
apiClient.interceptors.response.use(
  (response) => response.data,
  (error) => {
    let message = 'An unexpected error occurred'
    let status = null

    if (error.response) {
      status = error.response.status
      message =
        error.response.data?.message ||
        error.response.data?.msg ||
        error.response.data?.error ||
        error.response.data?.error_description ||
        `Server error (${status})`
    } else if (error.request) {
      message =
        'Unable to reach the server. Check your connection and try again.'
    } else {
      message = error.message || message
    }

    return Promise.reject({
      message,
      status,
      code: error.response?.data?.code,
      raw: error.response?.data,
    })
  },
)

export { apiClient, BASE_URL, SUPABASE_KEY, IS_SUPABASE }
