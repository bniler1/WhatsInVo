import { useState } from 'react'
import { useNavigate, useParams, useMatch } from 'react-router-dom'
import { useChats } from '../hooks/useChats'
import type { DbChat } from '../../../shared/types'

function fmtTime(ts: number | null): string {
  if (!ts) return ''
  const d = new Date(ts * 1000)
  const now = new Date()
  const isToday = d.toDateString() === now.toDateString()
  if (isToday) return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  return d.toLocaleDateString([], { month: 'short', day: 'numeric' })
}

function initials(name: string): string {
  return name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2) || '?'
}

function ChatRow({ chat, active }: { chat: DbChat; active: boolean }) {
  const navigate = useNavigate()
  return (
    <button
      onClick={() => navigate(`/${encodeURIComponent(chat.wa_id)}`)}
      className={`w-full flex items-center gap-3 px-3 py-3 hover:bg-[#2a3942] transition-colors text-left border-b border-[#2a3942]/50
        ${active ? 'bg-[#2a3942]' : ''}`}
    >
      <div className="w-10 h-10 rounded-full bg-emerald-700 flex items-center justify-center shrink-0 text-sm font-semibold text-white">
        {initials(chat.name || chat.wa_id)}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex justify-between items-baseline">
          <span className="text-sm font-medium text-white truncate">{chat.name || chat.wa_id}</span>
          <span className="text-xs text-gray-500 shrink-0 ml-2">{fmtTime(chat.last_message_at)}</span>
        </div>
        <div className="flex justify-between items-center mt-0.5">
          <span className="text-xs text-gray-400 truncate">{chat.last_message_preview}</span>
          {chat.unread_count > 0 && (
            <span className="ml-2 shrink-0 bg-emerald-500 text-white text-[10px] font-bold rounded-full w-4 h-4 flex items-center justify-center">
              {chat.unread_count > 9 ? '9+' : chat.unread_count}
            </span>
          )}
        </div>
      </div>
    </button>
  )
}

interface ChatSidebarProps {
  onImport: () => void
}

export function ChatSidebar({ onImport }: ChatSidebarProps) {
  const { chatId } = useParams()
  const navigate = useNavigate()
  const onImportsPage = !!useMatch('/imports')
  const { chats, loading } = useChats()
  const [search, setSearch] = useState('')

  const filtered = chats.filter(c =>
    !search || c.name?.toLowerCase().includes(search.toLowerCase()) || c.wa_id.includes(search)
  )

  return (
    <div className="flex flex-col h-full bg-[#111b21] border-r border-[#2a3942] w-80 shrink-0">
      <div className="px-3 py-2 bg-[#202c33] flex items-center gap-2">
        <input
          type="search"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search chats…"
          className="flex-1 bg-[#2a3942] text-sm text-gray-300 placeholder-gray-500 px-3 py-1.5 rounded-lg focus:outline-none"
        />
      </div>
      {/* Import Manager button — always visible */}
      <button
        onClick={() => navigate('/imports')}
        className={`w-full flex items-center gap-2 px-4 py-2.5 text-sm font-medium transition-colors border-b border-[#2a3942]
          ${onImportsPage ? 'bg-emerald-900/40 text-emerald-400' : 'text-gray-400 hover:text-emerald-400 hover:bg-[#2a3942]'}`}
      >
        <span className="text-base">📥</span>
        Import Manager
      </button>
      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="p-4 text-center text-gray-500 text-sm">Loading chats…</div>
        ) : filtered.length === 0 ? (
          <div className="p-4 text-center text-gray-500 text-sm">
            {search ? 'No chats match your search.' : 'No chats yet. Connect to WhatsApp to sync.'}
          </div>
        ) : (() => {
          const synced   = filtered.filter(c => !c.wa_id.startsWith('import:'))
          const imported = filtered.filter(c =>  c.wa_id.startsWith('import:'))
          const active   = (chat: DbChat) => chatId ? decodeURIComponent(chatId) === chat.wa_id : false
          return (
            <>
              {synced.length > 0 && (
                <>
                  <div className="px-3 py-1.5 text-[10px] font-semibold uppercase tracking-widest text-gray-500 bg-[#0b141a] border-b border-[#2a3942]/50">
                    💬 Synced Chats
                  </div>
                  {synced.map(chat => <ChatRow key={chat.wa_id} chat={chat} active={active(chat)} />)}
                </>
              )}
              {imported.length > 0 && (
                <>
                  <div className="px-3 py-1.5 text-[10px] font-semibold uppercase tracking-widest text-gray-500 bg-[#0b141a] border-b border-[#2a3942]/50">
                    📥 Imported Chats
                  </div>
                  {imported.map(chat => <ChatRow key={chat.wa_id} chat={chat} active={active(chat)} />)}
                </>
              )}
            </>
          )
        })()}
      </div>
    </div>
  )
}
