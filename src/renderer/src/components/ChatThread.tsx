import { useRef, useEffect, useCallback } from 'react'
import { useParams } from 'react-router-dom'
import { useMessages } from '../hooks/useMessages'
import { MessageBubble } from './MessageBubble'
import { Composer } from './Composer'

export function ChatThread() {
  const { chatId } = useParams<{ chatId: string }>()
  const decodedId = chatId ? decodeURIComponent(chatId) : ''
  const { messages, loading, loadMore } = useMessages(decodedId)
  const bottomRef = useRef<HTMLDivElement>(null)
  const scrollRef = useRef<HTMLDivElement>(null)
  const isAtBottom = useRef(true)

  useEffect(() => {
    if (isAtBottom.current) {
      bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
    }
  }, [messages.length])

  const handleScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    const el = e.currentTarget
    const distFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight
    isAtBottom.current = distFromBottom < 100

    if (el.scrollTop < 80) {
      loadMore()
    }
  }, [loadMore])

  const displayName = decodedId.split('@')[0]

  return (
    <div className="flex flex-col h-full">
      <div className="shrink-0 flex items-center gap-3 px-4 py-3 bg-[#202c33] border-b border-[#2a3942]">
        <div className="w-8 h-8 rounded-full bg-emerald-700 flex items-center justify-center text-xs font-semibold text-white shrink-0">
          {displayName.slice(0, 2).toUpperCase()}
        </div>
        <span className="text-sm font-medium text-white">{displayName}</span>
      </div>

      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto py-3"
        style={{ background: '#0b141a' }}
        onScroll={handleScroll}
      >
        {loading && (
          <div className="flex justify-center py-4">
            <div className="w-5 h-5 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
          </div>
        )}

        {messages.map(msg => (
          <MessageBubble key={msg.wa_message_id || msg.id} msg={msg} />
        ))}

        <div ref={bottomRef} />
      </div>

      <Composer chatWaId={decodedId} onSent={() => {
        setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 100)
      }} />
    </div>
  )
}
