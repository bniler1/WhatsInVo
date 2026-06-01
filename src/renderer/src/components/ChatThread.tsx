import React, { useRef, useEffect, useCallback, useState } from 'react'
import { useParams } from 'react-router-dom'
import { useMessages } from '../hooks/useMessages'
import { MessageBubble } from './MessageBubble'
import { IntegrityModal } from './IntegrityModal'
import { Composer } from './Composer'
import type { DbChat } from '../../../shared/types'

export function ChatThread() {
  const { chatId } = useParams<{ chatId: string }>()
  const decodedId = chatId ? decodeURIComponent(chatId) : ''
  const { messages, loading, loadMore } = useMessages(decodedId)
  const [chat, setChat] = useState<DbChat | null>(null)
  const [showIntegrity, setShowIntegrity] = useState(false)
  const [retryStatus, setRetryStatus]     = useState<string | null>(null)
  const bottomRef = useRef<HTMLDivElement>(null)
  const scrollRef = useRef<HTMLDivElement>(null)
  const isAtBottom = useRef(true)

  useEffect(() => {
    if (!decodedId) return
    window.api.chats.get(decodedId).then(c => setChat(c ?? null))
  }, [decodedId])

  useEffect(() => {
    if (isAtBottom.current) {
      bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
    }
  }, [messages.length])

  const handleScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    const el = e.currentTarget
    const distFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight
    isAtBottom.current = distFromBottom < 100
    if (el.scrollTop < 80) loadMore()
  }, [loadMore])

  const displayName = chat?.name || decodedId.split('@')[0]
  const isGroup = chat?.is_group === 1
  const initials = displayName.slice(0, 2).toUpperCase()
  const avatarColor = isGroup ? 'bg-blue-700' : 'bg-emerald-700'

  return (
    <div className="flex flex-col h-full">
      {/* Chat header */}
      <div className="shrink-0 flex items-center gap-3 px-4 py-3 bg-[#202c33] border-b border-[#2a3942]">
        <div className={`w-9 h-9 rounded-full ${avatarColor} flex items-center justify-center text-sm font-semibold text-white shrink-0`}>
          {isGroup ? '👥' : initials}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-white leading-tight truncate">{displayName}</p>
          {isGroup && <p className="text-xs text-gray-500">Group</p>}
        </div>
        {retryStatus && (
          <span className="text-xs text-emerald-400 shrink-0">{retryStatus}</span>
        )}
        <button
          onClick={async () => {
            setRetryStatus('Downloading…')
            const r = await window.api.chats.retryMedia(decodedId)
            if (r.ok) {
              setRetryStatus(r.total === 0 ? 'No missing media' : `Downloaded ${r.downloaded}/${r.total}`)
            } else {
              setRetryStatus('Retry failed')
            }
            setTimeout(() => setRetryStatus(null), 4000)
          }}
          title="Retry downloading missing media"
          className="shrink-0 text-gray-500 hover:text-emerald-400 transition-colors p-1.5 rounded-lg hover:bg-[#2a3942]"
        >
          ⬇
        </button>
        <button
          onClick={() => setShowIntegrity(true)}
          title="Check chat integrity"
          className="shrink-0 text-gray-500 hover:text-emerald-400 transition-colors p-1.5 rounded-lg hover:bg-[#2a3942]"
        >
          🔍
        </button>
      </div>

      {/* Message list */}
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto py-2"
        style={{ background: '#0b141a' }}
        onScroll={handleScroll}
      >
        {loading && (
          <div className="flex justify-center py-4">
            <div className="w-5 h-5 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
          </div>
        )}

        {messages.reduce<React.ReactNode[]>((nodes, msg, i) => {
          const dateStr = new Date(msg.timestamp * 1000).toLocaleDateString([], { month: 'long', day: 'numeric', year: 'numeric' })
          const prevDate = i > 0
            ? new Date(messages[i - 1].timestamp * 1000).toLocaleDateString([], { month: 'long', day: 'numeric', year: 'numeric' })
            : null
          if (dateStr !== prevDate) {
            nodes.push(
              <div key={`sep-${dateStr}-${i}`} className="flex justify-center my-3">
                <span className="text-[12px] text-gray-400 bg-[#182229] px-3 py-1 rounded-full select-none shadow-sm">
                  {dateStr}
                </span>
              </div>
            )
          }
          nodes.push(
            <MessageBubble key={msg.wa_message_id || msg.id} msg={msg} isGroup={isGroup} />
          )
          return nodes
        }, [])}

        <div ref={bottomRef} />
      </div>

      <Composer chatWaId={decodedId} onSent={() => {
        setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 100)
      }} />

      {showIntegrity && (
        <IntegrityModal chatWaId={decodedId} onClose={() => setShowIntegrity(false)} />
      )}
    </div>
  )
}
