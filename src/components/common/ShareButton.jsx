import { useState } from 'react'
import { Share2, Check, Copy, X } from 'lucide-react'

// ---------------------------------------------------------------------------
// ShareButton — Tombol Share Link untuk setiap katalog/produk.
//
// FITUR SHARE LINK:
// Share link memungkinkan pengguna berbagi tautan langsung ke halaman detail
// suatu produk. Ketika seseorang membuka link tersebut, mereka langsung
// diarahkan ke produk yang dimaksud.
//
// CARA KERJA:
//   1. Buat URL dengan format: {baseURL}?gunId={id}
//   2. Gunakan Web Share API (navigator.share) jika tersedia di perangkat
//      (umumnya tersedia di mobile browser yang mendukung PWA)
//   3. Fallback: salin URL ke clipboard menggunakan navigator.clipboard
//   4. Tampilkan konfirmasi visual selama 2 detik
//
// WEB SHARE API vs CLIPBOARD:
//   - Web Share API: membuka dialog share native OS (WhatsApp, Telegram, dll)
//   - Clipboard: menyalin link, lalu pengguna paste secara manual
// ---------------------------------------------------------------------------

/**
 * @param {Object}   props
 * @param {Object}   props.gun      — data produk yang akan dibagikan
 * @param {string}   [props.className] — kelas CSS tambahan
 */
export default function ShareButton({ gun, className = '' }) {
  // State untuk feedback visual setelah share/copy berhasil
  const [copied, setCopied] = useState(false)
  const [error, setError] = useState('')

  /**
   * Membangun URL share untuk produk ini.
   * Format: https://domain.com/?gunId={id}
   *
   * URL ini bisa dibuka siapapun dan langsung menampilkan detail produk
   * melalui mekanisme URL parsing di App.jsx.
   */
  const buildShareUrl = () => {
    const base = window.location.origin + window.location.pathname
    return `${base}?gunId=${encodeURIComponent(gun.id)}`
  }

  const handleShare = async () => {
    setError('')
    const shareUrl = buildShareUrl()
    const shareData = {
      title: gun.name || 'Hardware Item',
      text: `Lihat produk ini: ${gun.name}${gun.caliber ? ` (${gun.caliber})` : ''} — ${gun.type || ''}`,
      url: shareUrl,
    }

    // Coba gunakan Web Share API (tersedia di mobile / PWA)
    if (navigator.share) {
      try {
        await navigator.share(shareData)
        // Tidak perlu feedback tambahan karena dialog OS sudah muncul
        return
      } catch (err) {
        // Pengguna membatalkan dialog share → bukan error yang perlu ditampilkan
        if (err.name === 'AbortError') return
        // Jika error lain, fallback ke clipboard
      }
    }

    // Fallback: Salin URL ke clipboard
    try {
      await navigator.clipboard.writeText(shareUrl)
      setCopied(true)
      // Reset state setelah 2 detik
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // Clipboard API mungkin tidak tersedia (HTTP non-HTTPS)
      setError('Tidak dapat menyalin link. Gunakan HTTPS.')
      setTimeout(() => setError(''), 3000)
    }
  }

  return (
    <div className={`share-btn-wrap ${className}`}>
      <button
        type="button"
        className={`card-act-btn share-btn${copied ? ' share-btn--copied' : ''}`}
        onClick={handleShare}
        aria-label={copied ? 'Link disalin!' : `Bagikan ${gun.name}`}
        title={copied ? 'Link disalin!' : 'Bagikan produk ini'}
      >
        {copied ? <Check size={16} /> : <Share2 size={16} />}
      </button>

      {/* Tooltip feedback "Disalin!" */}
      {copied && (
        <span className="share-tooltip" role="status" aria-live="polite">
          <Copy size={12} /> Link disalin!
        </span>
      )}

      {/* Pesan error jika clipboard tidak tersedia */}
      {error && (
        <span className="share-tooltip share-tooltip--error" role="alert">
          <X size={12} /> {error}
        </span>
      )}
    </div>
  )
}
