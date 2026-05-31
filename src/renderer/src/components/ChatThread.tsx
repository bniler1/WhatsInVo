import React, { useRef, useEffect, useCallback, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useMessages } from '../hooks/useMessages'
import { MessageBubble } from './MessageBubble'
import { Composer } from './Composer'
import type { DbChat } from '../../../shared/types'

export function ChatThread() {
  const { chatId } = useParams<{ chatId: string }>()
  const decodedId = chatId ? decodeURIComponent(chatId) : ''
  const navigate = useNavigate()
  const { messages, loading, loadMore } = useMessages(decodedId)
  const [chat, setChat] = useState<DbChat | null>(null)
  const [confirmClear, setConfirmClear] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)
  const scrollRef = useRef<HTMLDivElement>(null)
  const isAtBottom = useRef(true)

  // Load chat metadata (name, group flag) from local DB
  useEffect(() => {
    if (!decodedId) return
    window.api.chats.get(decodedId).then(c => setChat(c ?? null))
  }, [decodedId])

  useEffect(() => {
    if (isAtBottom.current) {
      bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
    }
  }, [messages.length])

  const handleClear = useCallback(async () => {
    if (!confirmClear) { setConfirmClear(true); return }
    setConfirmClear(false)
    await window.api.chats.clearMessages(decodedId)
    navigate('/')
  }, [confirmClear, decodedId, navigate])

  const handleScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    const el = e.currentTarget
    const distFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight
    isAtBottom.current = distFromBottom < 100
    if (el.scrollTop < 80) loadMore()
  }, [loadMore])

  // Prefer stored name; fall back to the part before @ in the WhatsApp ID
  const displayName = chat?.name || decodedId.split('@')[0]
  const isGroup = chat?.is_group === 1
  const initials = displayName.slice(0, 2).toUpperCase()
  const avatarColor = isGroup ? 'bg-blue-700' : 'bg-emerald-700'

  return (
    <div className="flex flex-col h-full">
      {/* Chat header */}
      <div className="shrink-0 flex items-center gap-3 px-4 py-3 bg-[#202c33] border-b border-[#2a3942]">
        <div className={`w-8 h-8 rounded-full ${avatarColor} flex items-center justify-center text-xs font-semibold text-white shrink-0`}>
          {isGroup ? '👥' : initials}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-white leading-tight truncate">{displayName}</p>
          {isGroup && <p className="text-xs text-gray-500">Group</p>}
        </div>
        {confirmClear ? (
          <div className="flex items-center gap-2 shrink-0">
            <span className="text-xs text-red-400">Clear all messages?</span>
            <button onClick={handleClear} className="text-xs text-red-400 hover:text-red-300 font-medium px-2 py-1 rounded bg-red-900/30 hover:bg-red-900/50 transition-colors">Confirm</button>
            <button onClick={() => setConfirmClear(false)} className="text-xs text-gray-400 hover:text-white px-2 py-1 rounded bg-[#2a3942] hover:bg-[#374650] transition-colors">Cancel</button>
          </div>
        ) : (
          <button
            onClick={handleClear}
            title="Clear all messages from this chat"
            className="shrink-0 text-gray-500 hover:text-red-400 transition-colors p-1 rounded"
          >
            🗑
          </button>
        )}
      </div>

      {/* Message list */}
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

        {messages.reduce<React.ReactNode[]>((nodes, msg, i) => {
          const dateStr = new Date(msg.timestamp * 1000).toLocaleDateString([], { month: 'long', day: 'numeric', year: 'numeric' })
          const prevDate = i > 0 ? new Date(messages[i - 1].timestamp * 1000).toLocaleDateString([], { month: 'long', day: 'numeric', year: 'numeric' }) : null
          if (dateStr !== prevDate) {
            nodes.push(
              <div key={`sep-${dateStr}`} className="flex justify-center my-3">
                <span className="text-xs text-gray-400 bg-[#182229] px-3 py-1 rounded-full select-none">{dateStr}</span>
              </div>
            )
          }
          nodes.push(<MessageBubble key={msg.wa_message_id || msg.id} msg={msg} />)
          return nodes
        }, [])}

        <div ref={bottomRef} />
      </div>

      <Composer chatWaId={decodedId} onSent={() => {
        setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 100)
      }} />
    </div>
  )
}
