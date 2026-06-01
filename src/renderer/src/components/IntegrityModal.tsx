import { useState, useEffect } from 'react'

interface Result {
  ok: boolean; error?: string
  dbMessages: number; txtMessages: number | null
  mediaInDb: number; mediaOnDisk: number; mediaMissing: number; mediaOmitted: number
  integrity: 'complete' | 'incomplete' | 'unknown'
}

interface Props { chatWaId: string; onClose: () => void }

export function IntegrityModal({ chatWaId, onClose }: Props) {
  const [result, setResult] = useState<Result | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    window.api.chats.integrityCheck(chatWaId).then(r => {
      setResult(r as Result)
      setLoading(false)
    })
  }, [chatWaId])

  const statusBg  = result?.integrity === 'complete'   ? 'bg-emerald-900/40 border-emerald-700'
                  : result?.integrity === 'incomplete' ? 'bg-red-900/40 border-red-700'
                  : 'bg-gray-700/40 border-gray-600'
  const statusText = result?.integrity === 'complete'  ? '✅  Complete — all messages accounted for'
                   : result?.integrity === 'incomplete'? '⚠️  Incomplete — fewer messages than export file'
                   : '❓  Unknown — no export file found to compare'

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70" onClick={onClose}>
      <div
        className="bg-[#1f2c34] rounded-2xl shadow-2xl w-full max-w-sm mx-4 overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#2a3942]">
          <h3 className="text-white font-bold text-base">🔍 Integrity Check</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-white text-xl leading-none">✕</button>
        </div>

        <div className="px-5 py-4">
          {loading ? (
            <div className="flex justify-center py-8">
              <div className="w-6 h-6 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : !result?.ok ? (
            <p className="text-red-400 text-sm py-4 text-center">{result?.error ?? 'Check failed'}</p>
          ) : (
            <div className="space-y-4">
              <div className={`border rounded-xl px-4 py-3 text-sm font-medium text-center ${statusBg}`}>
                <span className="text-[#e9edef]">{statusText}</span>
              </div>

              <div className="space-y-0 divide-y divide-[#2a3942]">
                <Row label="Messages in DB"          value={result.dbMessages} />
                {result.txtMessages !== null && (
                  <Row label="Messages in export .txt" value={result.txtMessages}
                    highlight={result.dbMessages < result.txtMessages ? 'bad' : 'good'} />
                )}
                <Row label="Media attachments in DB"  value={result.mediaInDb} />
                <Row label="Media files on disk"      value={result.mediaOnDisk}
                  highlight={result.mediaOnDisk === result.mediaInDb && result.mediaInDb > 0 ? 'good' : undefined} />
                {result.mediaMissing > 0 && (
                  <Row label="Media files missing"    value={result.mediaMissing} highlight="bad" />
                )}
                {result.mediaOmitted > 0 && (
                  <Row label="Omitted by WhatsApp"    value={result.mediaOmitted} />
                )}
              </div>

              {result.txtMessages === null && (
                <p className="text-gray-500 text-xs text-center">
                  Export .txt not found in userData/chats/. Re-import to enable full check.
                </p>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function Row({ label, value, highlight }: { label: string; value: number; highlight?: 'good' | 'bad' }) {
  const valueClass = highlight === 'bad'  ? 'text-red-400 font-bold'
                   : highlight === 'good' ? 'text-emerald-400 font-bold'
                   : 'text-white font-medium'
  return (
    <div className="flex justify-between items-center py-2.5">
      <span className="text-gray-400 text-sm">{label}</span>
      <span className={`text-sm tabular-nums ${valueClass}`}>{value.toLocaleString()}</span>
    </div>
  )
}
