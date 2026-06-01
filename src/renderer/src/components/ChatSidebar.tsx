import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
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
          <span className="text-sm font-medium text-white truncate">
            {chat.name || chat.wa_id}
            {chat.is_imported === 1 && <span className="ml-1 text-emerald-400">📥</span>}
          </span>
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
        <button
          onClick={onImport}
          title="Import WhatsApp chat export"
          className="shrink-0 p-1.5 text-gray-400 hover:text-emerald-400 hover:bg-[#2a3942] rounded-lg transition-colors"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
          </svg>
        </button>
      </div>
      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="p-4 text-center text-gray-500 text-sm">Loading chats…</div>
        ) : filtered.length === 0 ? (
          <div className="p-4 text-center text-gray-500 text-sm">
            {search ? 'No chats match your search.' : 'No chats yet. Connect to WhatsApp to sync.'}
          </div>
        ) : (
          filtered.map(chat => (
            <ChatRow
              key={chat.wa_id}
              chat={chat}
              active={chatId ? decodeURIComponent(chatId) === chat.wa_id : false}
            />
          ))
        )}
      </div>
    </div>
  )
}
