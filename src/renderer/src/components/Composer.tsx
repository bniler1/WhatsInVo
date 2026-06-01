import { useState, useRef, useCallback } from 'react'

interface ComposerProps {
  chatWaId: string
  onSent?: () => void
}

export function Composer({ chatWaId, onSent }: ComposerProps) {
  const [text, setText]           = useState('')
  const [sending, setSending]     = useState(false)
  const [sendingFile, setSendingFile] = useState(false)
  const [error, setError]         = useState<string | null>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  // Imported chats (import:...) have no live WhatsApp connection
  const isImported = chatWaId.startsWith('import:')

  const clearError = () => setError(null)

  const send = useCallback(async () => {
    const trimmed = text.trim()
    if (!trimmed || sending || isImported) return
    setSending(true)
    setError(null)
    setText('')
    if (textareaRef.current) textareaRef.current.style.height = 'auto'
    try {
      const res = await window.api.messages.sendText(chatWaId, trimmed)
      if (!res.ok) setError(res.error ?? 'Send failed')
      else onSent?.()
    } catch (err) {
      setText(trimmed)
      setError(String(err))
    } finally {
      setSending(false)
    }
  }, [chatWaId, text, sending, isImported, onSent])

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() }
  }

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setText(e.target.value)
    e.target.style.height = 'auto'
    e.target.style.height = Math.min(e.target.scrollHeight, 120) + 'px'
  }

  const handleAttach = async () => {
    if (sendingFile || isImported) return
    setError(null)
    setSendingFile(true)
    try {
      const res = await window.api.messages.sendFile(chatWaId)
      if (res.ok) onSent?.()
      else if (!res.cancelled) setError(res.error ?? 'Could not send file')
    } catch (err) {
      setError(String(err))
    } finally {
      setSendingFile(false)
    }
  }

  return (
    <div className="shrink-0 bg-[#202c33] border-t border-[#2a3942]">
      {/* Error banner */}
      {error && (
        <div className="flex items-center justify-between px-4 py-2 bg-red-900/40 border-b border-red-800">
          <span className="text-xs text-red-300 flex-1">{error}</span>
          <button onClick={clearError} className="text-red-400 hover:text-red-200 ml-3 text-sm leading-none">✕</button>
        </div>
      )}

      {/* Imported chat notice */}
      {isImported && (
        <div className="px-4 py-2 text-center">
          <span className="text-xs text-gray-500">📥 Imported chat — read only. Connect to WhatsApp to send messages.</span>
        </div>
      )}

      {!isImported && (
        <div className="flex items-end gap-2 px-3 py-2.5">
          {/* Attach button */}
          <button
            onClick={handleAttach}
            disabled={sendingFile}
            className="shrink-0 p-2 text-gray-400 hover:text-white rounded-full hover:bg-[#2a3942] transition-colors mb-0.5 disabled:opacity-40"
            title="Attach file"
          >
            {sendingFile ? (
              <div className="h-5 w-5 border-2 border-gray-400 border-t-transparent rounded-full animate-spin" />
            ) : (
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
              </svg>
            )}
          </button>

          {/* Text input */}
          <div className="flex-1 bg-[#2a3942] rounded-3xl px-4 py-2">
            <textarea
              ref={textareaRef}
              rows={1}
              value={text}
              onChange={handleChange}
              onKeyDown={handleKeyDown}
              placeholder="Type a message"
              className="w-full bg-transparent text-sm text-[#e9edef] placeholder-gray-500 resize-none focus:outline-none leading-5"
              style={{ maxHeight: 120 }}
            />
          </div>

          {/* Send button */}
          <button
            onClick={send}
            disabled={!text.trim() || sending}
            className="shrink-0 p-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-full transition-colors mb-0.5"
            title="Send"
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
