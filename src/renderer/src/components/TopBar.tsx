import { useNavigate } from 'react-router-dom'
import { useSyncState } from '../hooks/useSyncState'

interface TopBarProps {
  connStatus: 'disconnected' | 'connecting' | 'connected'
  serverStatus: 'stopped' | 'starting' | 'running' | 'error'
  connectError: string | null
  onConnect: () => void
  onDisconnect: () => void
  onDismissError: () => void
}

export function TopBar({ connStatus, serverStatus, connectError, onConnect, onDisconnect, onDismissError }: TopBarProps) {
  const navigate = useNavigate()
  const sync = useSyncState()
  const isSyncing = sync.status === 'syncing'

  const isServerReady = serverStatus === 'running'
  const isServerStarting = serverStatus === 'starting'

  // Derive the combined status label and colour
  let statusColor: string
  let statusLabel: string

  if (connStatus === 'connected') {
    statusColor = 'bg-green-500'
    statusLabel = 'Connected'
  } else if (connStatus === 'connecting') {
    statusColor = 'bg-yellow-500'
    statusLabel = 'Connecting…'
  } else if (isServerStarting) {
    statusColor = 'bg-yellow-500 animate-pulse'
    statusLabel = 'Starting service…'
  } else if (serverStatus === 'error') {
    statusColor = 'bg-red-500'
    statusLabel = 'Service error'
  } else if (serverStatus === 'stopped') {
    statusColor = 'bg-gray-500'
    statusLabel = 'Service stopped'
  } else {
    statusColor = 'bg-red-500'
    statusLabel = 'Disconnected'
  }

  return (
    <div className="shrink-0">
      {/* Main bar */}
      <div className="flex items-center justify-between px-4 py-2 bg-[#202c33] border-b border-[#2a3942]">
        <div className="flex items-center gap-3">
          <span className="text-lg font-bold text-white tracking-tight">WhatsInVo</span>
          <div className="flex items-center gap-1.5">
            <div className={`w-2 h-2 rounded-full ${statusColor}`} />
            <span className="text-xs text-gray-400">{statusLabel}</span>
          </div>
        </div>

        {isSyncing && (
          <div className="flex-1 mx-6 max-w-xs">
            <div className="text-xs text-gray-400 mb-1 truncate">{sync.chatName || sync.phase}</div>
            <div className="h-1 bg-gray-700 rounded-full overflow-hidden">
              <div
                className="h-full bg-emerald-500 transition-all duration-300"
                style={{ width: `${sync.pct}%` }}
              />
            </div>
          </div>
        )}

        <div className="flex items-center gap-2">
          {connStatus === 'connected' ? (
            <button
              onClick={onDisconnect}
              className="px-3 py-1 text-xs bg-gray-600 hover:bg-gray-700 text-white rounded-full transition-colors"
            >
              Disconnect
            </button>
          ) : connStatus === 'connecting' || isServerStarting ? (
            <div className="flex items-center gap-2 px-3 py-1">
              <div className="w-3 h-3 border-2 border-yellow-400 border-t-transparent rounded-full animate-spin" />
              <span className="text-xs text-yellow-400">
                {isServerStarting ? 'Starting…' : 'Connecting…'}
              </span>
            </div>
          ) : (
            <button
              onClick={onConnect}
              disabled={!isServerReady}
              title={!isServerReady ? 'Waiting for WhatsApp service to start…' : 'Connect to WhatsApp'}
              className="px-3 py-1 text-xs bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-full transition-colors"
            >
              Connect
            </button>
          )}

          <button
            onClick={() => navigate('/settings')}
            className="p-1.5 text-gray-400 hover:text-white rounded-full hover:bg-[#2a3942] transition-colors"
            title="Settings"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          </button>
        </div>
      </div>

      {/* Error banner */}
      {connectError && (
        <div className="flex items-center justify-between px-4 py-2 bg-red-900/60 border-b border-red-700 text-xs text-red-300">
          <span>⚠ {connectError}</span>
          <button onClick={onDismissError} className="ml-3 text-red-400 hover:text-white">✕</button>
        </div>
      )}
    </div>
  )
}
