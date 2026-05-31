import { useState, useRef, useCallback } from 'react'

interface ComposerProps {
  chatWaId: string
  onSent?: () => void
}

export function Composer({ chatWaId, onSent }: ComposerProps) {
  const [text, setText] = useState('')
  const [sending, setSending] = useState(false)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const send = useCallback(async () => {
    const trimmed = text.trim()
    if (!trimmed || sending) return
    setSending(true)
    setText('')
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto'
    }
    try {
      await window.api.messages.sendText(chatWaId, trimmed)
      onSent?.()
    } catch (err) {
      console.error('[Composer] Send error:', err)
      setText(trimmed)
    } finally {
      setSending(false)
    }
  }, [chatWaId, text, sending, onSent])

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      send()
    }
  }

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setText(e.target.value)
    e.target.style.height = 'auto'
    e.target.style.height = Math.min(e.target.scrollHeight, 120) + 'px'
  }

  const handleAttach = async () => {
    await window.api.messages.sendFile(chatWaId)
  }

  return (
    <div className="shrink-0 flex items-end gap-2 px-3 py-2.5 bg-[#202c33] border-t border-[#2a3942]">
      <button
        onClick={handleAttach}
        className="shrink-0 p-2 text-gray-400 hover:text-white rounded-full hover:bg-[#2a3942] transition-colors mb-0.5"
        title="Attach file"
      >
        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
        </svg>
      </button>

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

      <button
        onClick={send}
        disabled={!text.trim() || sending}
        className="shrink-0 p-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-full transition-colors mb-0.5"
        title="Send"
      >
        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
        </svg>
      </button>
    </div>
  )
}
