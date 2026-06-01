import { useState, useEffect } from 'react'

interface Props {
  onClose: () => void
  onImportDone?: (waId: string) => void
}

type Step = 'pick' | 'options' | 'importing' | 'done' | 'error'
type Mode = 'append' | 'overwrite'

interface Progress {
  phase: string
  current: number
  total: number
  pct: number
}

export function ImportModal({ onClose, onImportDone }: Props) {
  const [step, setStep]         = useState<Step>('pick')
  const [filePath, setFilePath] = useState<string | null>(null)
  const [mode, setMode]         = useState<Mode>('append')
  const [ownersName, setOwnersName] = useState('')
  const [progress, setProgress] = useState<Progress>({ phase: '', current: 0, total: 0, pct: 0 })
  const [result, setResult]     = useState<{ chatName: string; messages: number; media: number; waId: string } | null>(null)
  const [error, setError]       = useState<string | null>(null)

  useEffect(() => {
    const unsub = window.api.import.onProgress((d) => {
      setProgress(d as Progress)
    })
    return unsub
  }, [])

  const handlePickFile = async () => {
    const path = await window.api.import.pickFile()
    if (!path) return
    setFilePath(path)
    setStep('options')
  }

  const handleImport = async () => {
    if (!filePath) return
    setStep('importing')
    setProgress({ phase: 'Starting…', current: 0, total: 1, pct: 0 })

    const res = await window.api.import.run(filePath, mode, ownersName.trim() || null)
    if (res.ok) {
      setResult({ chatName: res.chatName, messages: res.messagesImported, media: res.mediaImported, waId: res.waId })
      setStep('done')
    } else {
      setError(res.error ?? 'Unknown error')
      setStep('error')
    }
  }

  const fileName = filePath ? filePath.split(/[/\\]/).pop() : ''

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70">
      <div className="bg-[#1f2c34] rounded-2xl shadow-2xl w-full max-w-md mx-4">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#2a3942]">
          <h2 className="text-white font-bold text-lg">Import WhatsApp Chat</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-white text-xl leading-none">✕</button>
        </div>

        <div className="px-6 py-5 space-y-5">

          {/* ── Step: pick file ──────────────────────────────────────────── */}
          {step === 'pick' && (
            <>
              <p className="text-gray-300 text-sm">
                Export a chat from WhatsApp (Menu → More → Export chat), then import it here.
                Supports <span className="text-emerald-400">.zip</span>,{' '}
                <span className="text-emerald-400">.txt</span>, or a{' '}
                <span className="text-emerald-400">folder</span> containing both.
              </p>
              <div className="space-y-3">
                <div className="flex flex-col gap-3">
                  <div className="p-4 border-2 border-dashed border-[#2a3942] rounded-xl text-center">
                    <div className="text-3xl mb-2">📁</div>
                    <p className="text-gray-400 text-sm mb-3">ZIP file, TXT file, or folder</p>
                    <button
                      onClick={handlePickFile}
                      className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-sm rounded-lg transition-colors"
                    >
                      Choose File or Folder
                    </button>
                  </div>
                </div>
              </div>
            </>
          )}

          {/* ── Step: options ────────────────────────────────────────────── */}
          {step === 'options' && (
            <>
              <div className="flex items-center gap-3 p-3 bg-[#2a3942] rounded-lg">
                <span className="text-2xl">📄</span>
                <span className="text-gray-300 text-sm truncate">{fileName}</span>
              </div>

              <div>
                <label className="block text-gray-400 text-xs mb-2 uppercase tracking-wider">Your name in this chat (optional)</label>
                <input
                  type="text"
                  value={ownersName}
                  onChange={e => setOwnersName(e.target.value)}
                  placeholder="e.g. My Name, Me, You"
                  className="w-full bg-[#2a3942] text-white text-sm px-3 py-2 rounded-lg focus:outline-none focus:ring-1 focus:ring-emerald-500 placeholder-gray-500"
                />
                <p className="text-gray-500 text-xs mt-1">Used to correctly label your messages as outgoing.</p>
              </div>

              <div>
                <label className="block text-gray-400 text-xs mb-2 uppercase tracking-wider">If chat already exists</label>
                <div className="space-y-2">
                  {[
                    { value: 'append', label: 'Append', desc: 'Keep existing messages, add new ones (skips duplicates)' },
                    { value: 'overwrite', label: 'Replace', desc: 'Delete all existing messages and reimport from scratch' },
                  ].map(opt => (
                    <label key={opt.value} className={`flex items-start gap-3 p-3 rounded-lg cursor-pointer transition-colors
                      ${mode === opt.value ? 'bg-emerald-900/40 border border-emerald-600' : 'bg-[#2a3942] border border-transparent hover:border-[#3d4f5a]'}`}>
                      <input
                        type="radio"
                        name="mode"
                        value={opt.value}
                        checked={mode === opt.value}
                        onChange={() => setMode(opt.value as Mode)}
                        className="mt-0.5 accent-emerald-500"
                      />
                      <div>
                        <p className="text-white text-sm font-medium">{opt.label}</p>
                        <p className="text-gray-400 text-xs">{opt.desc}</p>
                      </div>
                    </label>
                  ))}
                </div>
              </div>

              <div className="flex gap-3 pt-1">
                <button
                  onClick={() => setStep('pick')}
                  className="flex-1 py-2 text-sm text-gray-400 hover:text-white bg-[#2a3942] hover:bg-[#374650] rounded-lg transition-colors"
                >
                  Back
                </button>
                <button
                  onClick={handleImport}
                  className="flex-1 py-2 text-sm text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg transition-colors font-medium"
                >
                  Import Chat
                </button>
              </div>
            </>
          )}

          {/* ── Step: importing ──────────────────────────────────────────── */}
          {step === 'importing' && (
            <div className="py-4 space-y-4">
              <div className="text-center">
                <div className="w-10 h-10 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
                <p className="text-white font-medium text-sm">{progress.phase}</p>
                {progress.total > 0 && (
                  <p className="text-gray-400 text-xs mt-1">
                    {progress.current.toLocaleString()} / {progress.total.toLocaleString()}
                  </p>
                )}
              </div>

              {/* Progress bar */}
              <div>
                <div className="flex justify-between text-xs text-gray-500 mb-1">
                  <span>Progress</span>
                  <span>{progress.pct}%</span>
                </div>
                <div className="h-2.5 bg-gray-700 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-emerald-500 rounded-full transition-all duration-300"
                    style={{ width: `${progress.pct}%` }}
                  />
                </div>
              </div>

              {/* Phase steps */}
              <div className="space-y-1 text-xs text-gray-500">
                {['Extracting ZIP…', 'Parsing messages…', 'Indexing media files…', 'Saving messages…', 'Done'].map(phase => (
                  <div key={phase} className={`flex items-center gap-2 ${progress.phase === phase ? 'text-emerald-400' : progress.pct === 100 ? 'text-gray-600' : ''}`}>
                    <span>{progress.phase === phase ? '▶' : progress.pct === 100 ? '✓' : '·'}</span>
                    <span>{phase}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── Step: done ───────────────────────────────────────────────── */}
          {step === 'done' && result && (
            <div className="py-4 text-center space-y-4">
              <div className="text-5xl">✅</div>
              <div>
                <p className="text-white font-bold text-base">{result.chatName}</p>
                <p className="text-gray-400 text-sm mt-1">Import complete</p>
              </div>
              <div className="flex gap-4 justify-center">
                <div className="text-center">
                  <p className="text-emerald-400 text-2xl font-bold">{result.messages.toLocaleString()}</p>
                  <p className="text-gray-500 text-xs">messages</p>
                </div>
                <div className="w-px bg-[#2a3942]" />
                <div className="text-center">
                  <p className="text-emerald-400 text-2xl font-bold">{result.media.toLocaleString()}</p>
                  <p className="text-gray-500 text-xs">media files</p>
                </div>
              </div>
              <p className="text-gray-500 text-xs">
                Files saved to <code className="text-emerald-400">userData/chats/{result.chatName}/</code>
              </p>
              <button
                onClick={() => { onImportDone?.(result!.waId); onClose() }}
                className="w-full py-2 text-sm text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg transition-colors"
              >
                View Chat
              </button>
            </div>
          )}

          {/* ── Step: error ──────────────────────────────────────────────── */}
          {step === 'error' && (
            <div className="py-4 text-center space-y-4">
              <div className="text-5xl">❌</div>
              <p className="text-white font-medium">Import failed</p>
              <p className="text-red-400 text-sm bg-red-900/20 rounded-lg px-3 py-2">{error}</p>
              <button
                onClick={() => { setStep('pick'); setError(null) }}
                className="w-full py-2 text-sm text-white bg-gray-600 hover:bg-gray-700 rounded-lg transition-colors"
              >
                Try Again
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
