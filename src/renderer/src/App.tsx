import { useState, useEffect, useRef, useCallback } from 'react'
import { Routes, Route, useNavigate } from 'react-router-dom'
import { TopBar } from './components/TopBar'
import { QRModal } from './components/QRModal'
import { SyncModal } from './components/SyncModal'
import { Home, EmptyThread } from './pages/Home'
import { ChatThread } from './components/ChatThread'
import { ImportsPage } from './pages/ImportsPage'
import { Settings } from './pages/Settings'

type ConnStatus = 'disconnected' | 'connecting' | 'connected'
type ServerStatus = 'stopped' | 'starting' | 'running' | 'error'

export default function App() {
  const navigate = useNavigate()
  const [connStatus, setConnStatus]     = useState<ConnStatus>('disconnected')
  const [serverStatus, setServerStatus] = useState<ServerStatus>('stopped')
  const [showQR, setShowQR]             = useState(false)
  const [connectError, setConnectError] = useState<string | null>(null)
  // Prevent double-connect if server-ready event fires while already connecting
  const connectingRef = useRef(false)

  const doConnect = useCallback(async () => {
    if (connectingRef.current || connStatus === 'connected') return
    connectingRef.current = true
    setConnStatus('connecting')
    setConnectError(null)

    try {
      const result = await window.api.wa.connect()
      if (result.ok) {
        const session = result.session as { status?: string } | undefined
        if (session?.status === 'ready') {
          setConnStatus('connected')
        } else {
          // initializing / qr_ready — QR modal polls every 4s until the code arrives
          setShowQR(true)
        }
      } else {
        setConnStatus('disconnected')
        setConnectError(result.error ?? 'Could not connect to WhatsApp service')
      }
    } catch (e) {
      setConnStatus('disconnected')
      setConnectError(String(e))
    } finally {
      connectingRef.current = false
    }
  }, [connStatus])

  useEffect(() => {
    // ── Check if already connected from a previous session ──────────────────
    window.api.wa.status().then(s => {
      if (s.connected) setConnStatus('connected')
    })

    // Check initial server status
    window.api.wa.serverStatus().then(s => {
      setServerStatus(s.status as ServerStatus)
    })

    // ── Server lifecycle events ──────────────────────────────────────────────
    const unsubServer = window.api.wa.onServerStatus((d) => {
      const data = d as { status: string; error?: string }
      const st = data.status as ServerStatus
      setServerStatus(st)

      if (st === 'running') {
        // Server just became ready — auto-connect
        doConnect()
      } else if (st === 'stopped' || st === 'error') {
        setConnStatus('disconnected')
        setShowQR(false)
        if (st === 'error' && data.error) setConnectError(data.error)
      }
    })

    // ── WhatsApp session events ──────────────────────────────────────────────
    const unsubQR = window.api.wa.onQR(() => setShowQR(true))

    const unsubAuth = window.api.wa.onAuth(() => {
      setShowQR(false)
      setConnStatus('connected')
      setConnectError(null)
    })

    const unsubDisconnect = window.api.wa.onDisconnect(() => {
      setConnStatus('disconnected')
      setShowQR(false)
    })

    const unsubSessionStatus = window.api.wa.onSessionStatus((d) => {
      const data = d as { status: string }
      if (data.status === 'ready') {
        setConnStatus('connected')
        setShowQR(false)
        setConnectError(null)
      } else if (data.status === 'qr_ready') {
        setShowQR(true)
      }
    })

    return () => {
      unsubServer()
      unsubQR()
      unsubAuth()
      unsubDisconnect()
      unsubSessionStatus()
    }
  }, [doConnect])

  // Fallback polling: when QR modal is open, poll status every 3s.
  // This catches the "ready" transition even if Socket.IO events are delayed or missed.
  useEffect(() => {
    if (!showQR) return
    const poll = setInterval(async () => {
      try {
        const s = await window.api.wa.status()
        const sess = s.session as { status?: string } | undefined
        if (sess?.status === 'ready' || sess?.status === 'READY') {
          console.log('[App] Polling detected session ready — closing QR modal')
          setShowQR(false)
          setConnStatus('connected')
          setConnectError(null)
          // Trigger sync via IPC in case the socket event was missed
          window.api.sync.runFull().catch(console.error)
        }
      } catch { /* ignore */ }
    }, 3000)
    return () => clearInterval(poll)
  }, [showQR])

  const handleDisconnect = async () => {
    await window.api.wa.disconnect()
    setConnStatus('disconnected')
    setShowQR(false)
    setConnectError(null)
  }

  return (
    <div className="flex flex-col h-screen overflow-hidden">
      <TopBar
        connStatus={connStatus}
        serverStatus={serverStatus}
        connectError={connectError}
        onConnect={doConnect}
        onDisconnect={handleDisconnect}
        onDismissError={() => setConnectError(null)}
      />

      <Routes>
        <Route path="/" element={<Home onImport={() => navigate('/imports')} />}>
          <Route index element={<EmptyThread />} />
          <Route path=":chatId" element={<ChatThread />} />
          <Route path="/imports" element={<ImportsPage />} />
        </Route>
        <Route path="/settings" element={<Settings />} />
      </Routes>

      {showQR && <QRModal onClose={() => setShowQR(false)} />}
      <SyncModal />
    </div>
  )
}
