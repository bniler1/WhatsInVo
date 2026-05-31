import { useSyncState } from '../hooks/useSyncState'

export function SyncModal() {
  const sync = useSyncState()

  if (sync.status !== 'syncing') return null

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/60">
      <div className="bg-[#1f2c34] rounded-2xl p-8 max-w-sm w-full text-center shadow-2xl">
        <div className="w-10 h-10 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
        <h2 className="text-white text-lg font-bold mb-1">Downloading your WhatsApp history…</h2>
        {sync.chatName && (
          <p className="text-gray-400 text-sm mb-4 truncate">{sync.chatName}</p>
        )}
        <div className="h-2 bg-gray-700 rounded-full overflow-hidden mb-3">
          <div
            className="h-full bg-emerald-500 transition-all duration-500"
            style={{ width: `${sync.pct}%` }}
          />
        </div>
        <p className="text-gray-500 text-xs">This only happens once. Please wait…</p>
      </div>
    </div>
  )
}
