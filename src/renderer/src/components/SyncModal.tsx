import { useState, useEffect } from 'react'
import { useSyncState } from '../hooks/useSyncState'

export function SyncModal() {
  const sync = useSyncState()
  const [aborting, setAborting]   = useState(false)
  const [dismissed, setDismissed] = useState(false)

  // Reset dismissed when a new sync starts
  useEffect(() => {
    if (sync.status === 'syncing') setDismissed(false)
  }, [sync.status])

  // Auto-dismiss the cancelled confirmation after 4 seconds
  useEffect(() => {
    if (sync.status === 'aborted') {
      const t = setTimeout(() => setDismissed(true), 4000)
      return () => clearTimeout(t)
    }
  }, [sync.status])

  const visible = (sync.status === 'syncing' || sync.status === 'aborted') && !dismissed
  if (!visible) return null

  const handleAbort = async () => {
    setAborting(true)
    await window.api.sync.abort()
  }

  const isAborted = sync.status === 'aborted'

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/70">
      <div className="bg-[#1f2c34] rounded-2xl p-8 max-w-sm w-full text-center shadow-2xl">

        {isAborted ? (
          <>
            <div className="text-4xl mb-3">⛔</div>
            <h2 className="text-white text-lg font-bold mb-2">Download cancelled</h2>
            <p className="text-gray-400 text-sm mb-5">Partial data has been saved. You can re-sync anytime.</p>
            <button
              onClick={() => setDismissed(true)}
              className="px-6 py-2 text-sm text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg transition-colors"
            >
              OK
            </button>
          </>
        ) : (
          <>
            {/* Percentage count-up */}
            <div className="text-5xl font-bold text-emerald-400 tabular-nums mb-2">
              {sync.pct}%
            </div>

            <h2 className="text-white text-base font-semibold mb-1">
              {sync.phase || 'Downloading your WhatsApp history…'}
            </h2>

            {sync.chatName && (
              <p className="text-gray-400 text-sm mb-4 truncate px-2" title={sync.chatName}>
                {sync.chatName}
              </p>
            )}

            {/* Progress bar */}
            <div className="h-2.5 bg-gray-700 rounded-full overflow-hidden mb-5">
              <div
                className="h-full bg-emerald-500 rounded-full transition-all duration-300"
                style={{ width: `${sync.pct}%` }}
              />
            </div>

            {/* Abort button */}
            <button
              onClick={handleAbort}
              disabled={aborting}
              className="px-5 py-2 text-sm text-red-400 border border-red-800 rounded-lg hover:bg-red-900/30 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {aborting ? 'Stopping after current item…' : 'Abort Download'}
            </button>
          </>
        )}
      </div>
    </div>
  )
}
