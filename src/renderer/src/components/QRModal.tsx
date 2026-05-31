import { useState, useEffect, useRef } from 'react'

interface QRModalProps {
  onClose?: () => void
}

export function QRModal({ onClose }: QRModalProps) {
  const [qrCode, setQrCode] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [statusMsg, setStatusMsg] = useState('Waiting for WhatsApp QR code…')
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const fetchQR = async (): Promise<boolean> => {
    try {
      const result = await window.api.wa.getQR()
      if (result.ok && result.qrCode) {
        setQrCode(result.qrCode)
        setLoading(false)
        setStatusMsg('')
        return true
      }
      // OpenWA may still be initializing — keep polling silently
      setStatusMsg('Waiting for WhatsApp QR code…')
    } catch {
      setStatusMsg('Connecting to WhatsApp service…')
    }
    return false
  }

  useEffect(() => {
    // Initial fetch
    fetchQR()

    // Poll every 4 s until we get a QR code
    pollingRef.current = setInterval(async () => {
      const got = await fetchQR()
      if (got && pollingRef.current) {
        clearInterval(pollingRef.current)
        pollingRef.current = null
      }
    }, 4000)

    // Socket.IO push: OpenWA sends a new QR code (refreshed every ~60s)
    const unsubQR = window.api.wa.onQR((d) => {
      const data = d as { qrCode?: string; qr?: string }
      const code = data.qrCode || data.qr
      if (code) {
        setQrCode(code)
        setLoading(false)
        if (pollingRef.current) { clearInterval(pollingRef.current); pollingRef.current = null }
      }
    })

    const unsubAuth = window.api.wa.onAuth(() => { onClose?.() })
    const unsubStatus = window.api.wa.onSessionStatus((d) => {
      const data = d as { status: string }
      if (data.status === 'ready') onClose?.()
    })

    return () => {
      if (pollingRef.current) clearInterval(pollingRef.current)
      unsubQR(); unsubAuth(); unsubStatus()
    }
  }, [])

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70">
      <div className="bg-[#1f2c34] rounded-2xl p-8 max-w-sm w-full text-center shadow-2xl">
        <h2 className="text-white text-xl font-bold mb-2">Scan QR Code</h2>
        <p className="text-gray-400 text-sm mb-6">
          Open WhatsApp on your phone → Menu → Linked Devices → Link a Device
        </p>

        {loading && (
          <div className="h-48 flex flex-col items-center justify-center gap-3">
            <div className="w-8 h-8 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
            {statusMsg && <p className="text-gray-400 text-xs">{statusMsg}</p>}
          </div>
        )}

        {qrCode && !loading && (
          <img
            src={qrCode}
            alt="WhatsApp QR Code"
            className="mx-auto rounded-xl"
            style={{ width: 220, height: 220 }}
          />
        )}

        <p className="text-gray-500 text-xs mt-6">QR code refreshes automatically</p>
      </div>
    </div>
  )
}
