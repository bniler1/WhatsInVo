import { useState, useRef, useCallback } from 'react'

interface ComposerProps {
  chatWaId: string
  onSent?: () => void
}

interface PendingFile {
  path: string
  name: string
  ext: string
  type: 'image' | 'video' | 'audio' | 'document'
}

function fileIcon(type: PendingFile['type'], name: string): string {
  if (type === 'image') return '🖼️'
  if (type === 'video') return '🎬'
  if (type === 'audio') return '🎵'
  const ext = name.split('.').pop()?.toLowerCase() ?? ''
  if (ext === 'pdf') return '📄'
  if (['doc','docx'].includes(ext)) return '📝'
  if (['xls','xlsx'].includes(ext)) return '📊'
  if (['zip','rar'].includes(ext)) return '🗜️'
  return '📎'
}

function buildPreviewUrl(filePath: string): string {
  const normalized = filePath.replace(/\\/g, '/').replace(/^([A-Za-z]:)/, '/$1')
  return `wa-media://${normalized}`
}

export function Composer({ chatWaId, onSent }: ComposerProps) {
  const [text, setText]               = useState('')
  const [sending, setSending]         = useState(false)
  const [picking, setPicking]         = useState(false)
  const [pendingFile, setPendingFile] = useState<PendingFile | null>(null)
  const [error, setError]             = useState<string | null>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const isImported = chatWaId.startsWith('import:')

  const clearError = () => setError(null)

  // Step 1: pick a file — show preview, do NOT send yet
  const handleAttach = useCallback(async () => {
    if (picking || sending || isImported) return
    setError(null)
    setPicking(true)
    try {
      const info = await window.api.messages.pickFileInfo()
      if (info) setPendingFile(info)
    } finally {
      setPicking(false)
    }
  }, [picking, sending, isImported])

  const cancelFile = () => { setPendingFile(null); setError(null) }

  // Step 2: send — either file+caption or plain text
  const send = useCallback(async () => {
    if (sending) return
    const caption = text.trim()

    if (pendingFile) {
      setSending(true)
      setError(null)
      try {
        const res = await window.api.messages.sendFile(chatWaId, pendingFile.path, caption)
        if (res.ok) {
          setPendingFile(null)
          setText('')
          if (textareaRef.current) textareaRef.current.style.height = 'auto'
          onSent?.()
        } else {
          setError(res.error ?? 'Send failed')
        }
      } catch (err) {
        setError(String(err))
      } finally {
        setSending(false)
      }
      return
    }

    if (!caption || isImported) return
    setSending(true)
    setError(null)
    setText('')
    if (textareaRef.current) textareaRef.current.style.height = 'auto'
    try {
      const res = await window.api.messages.sendText(chatWaId, caption)
      if (!res.ok) { setText(caption); setError(res.error ?? 'Send failed') }
      else onSent?.()
    } catch (err) {
      setText(caption)
      setError(String(err))
    } finally {
      setSending(false)
    }
  }, [chatWaId, text, sending, pendingFile, isImported, onSent])

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() }
  }

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setText(e.target.value)
    e.target.style.height = 'auto'
    e.target.style.height = Math.min(e.target.scrollHeight, 120) + 'px'
  }

  const canSend = !sending && (!!pendingFile || (!!text.trim() && !isImported))

  return (
    <div className="shrink-0 bg-[#202c33] border-t border-[#2a3942]">

      {/* Error banner */}
      {error && (
        <div className="flex items-center justify-between px-4 py-2 bg-red-900/40 border-b border-red-800">
          <span className="text-xs text-red-300 flex-1">{error}</span>
          <button onClick={clearError} className="text-red-400 hover:text-red-200 ml-3 text-sm leading-none">✕</button>
        </div>
      )}

      {/* Pending file preview */}
      {pendingFile && (
        <div className="mx-3 mt-2.5 mb-0 flex items-center gap-3 bg-[#2a3942] rounded-2xl px-3 py-2.5">
          {pendingFile.type === 'image' ? (
            <img
              src={buildPreviewUrl(pendingFile.path)}
              alt={pendingFile.name}
              className="w-14 h-14 rounded-lg object-cover shrink-0"
            />
          ) : (
            <span className="text-3xl shrink-0">{fileIcon(pendingFile.type, pendingFile.name)}</span>
          )}
          <div className="flex-1 min-w-0">
            <p className="text-sm text-[#e9edef] font-medium truncate">{pendingFile.name}</p>
            <p className="text-xs text-gray-400 uppercase">{pendingFile.ext} · {pendingFile.type}</p>
          </div>
          <button
            onClick={cancelFile}
            className="shrink-0 text-gray-500 hover:text-red-400 transition-colors p-1"
            title="Remove file"
          >✕</button>
        </div>
      )}

      {/* Imported chat notice */}
      {isImported && !pendingFile && (
        <div className="px-4 py-2 text-center">
          <span className="text-xs text-gray-500">📥 Imported chat — read only. Connect to WhatsApp to send messages.</span>
        </div>
      )}

      {/* Input row */}
      {!isImported && (
        <div className="flex items-end gap-2 px-3 py-2.5">
          <button
            onClick={handleAttach}
            disabled={picking || sending}
            className="shrink-0 p-2 text-gray-400 hover:text-white rounded-full hover:bg-[#2a3942] transition-colors mb-0.5 disabled:opacity-40"
            title="Attach file"
          >
            {picking ? (
              <div className="h-5 w-5 border-2 border-gray-400 border-t-transparent rounded-full animate-spin" />
            ) : (
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
              </svg>
            )}
          </button>

          <div className="flex-1 bg-[#2a3942] rounded-3xl px-4 py-2">
            <textarea
              ref={textareaRef}
              rows={1}
              value={text}
              onChange={handleChange}
              onKeyDown={handleKeyDown}
              placeholder={pendingFile ? 'Add a caption (optional)' : 'Type a message'}
              className="w-full bg-transparent text-sm text-[#e9edef] placeholder-gray-500 resize-none focus:outline-none leading-5"
              style={{ maxHeight: 120 }}
            />
          </div>

          <button
            onClick={send}
            disabled={!canSend}
            className="shrink-0 p-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-full transition-colors mb-0.5"
            title={pendingFile ? 'Send file' : 'Send message'}
          >
            {sending ? (
              <div className="h-5 w-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : (
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
              </svg>
            )}
          </button>
        </div>
      )}
    </div>
  )
}
