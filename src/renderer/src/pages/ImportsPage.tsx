import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useChats } from '../hooks/useChats'
import { ImportModal } from '../components/ImportModal'
import type { DbChat } from '../../../shared/types'

function fmtDate(ts: number | null): string {
  if (!ts) return ''
  const d = new Date(ts * 1000)
  return d.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })
}

function initials(name: string): string {
  return name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2) || '?'
}

function Avatar({ chat }: { chat: DbChat }) {
  const color = chat.is_group === 1 ? 'bg-blue-700' : 'bg-emerald-700'
  return (
    <div className={`w-10 h-10 rounded-full ${color} flex items-center justify-center shrink-0 text-sm font-semibold text-white`}>
      {chat.is_group === 1 ? '👥' : initials(chat.name || chat.wa_id)}
    </div>
  )
}

export function ImportsPage() {
  const navigate = useNavigate()
  const { chats, loading } = useChats()
  const [search, setSearch] = useState('')
  const [showImport, setShowImport] = useState(false)
  const [targetChat, setTargetChat] = useState<DbChat | null>(null)
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editValue, setEditValue] = useState('')

  const startEdit = (chat: DbChat) => {
    setEditingId(chat.wa_id)
    setEditValue(chat.name || '')
  }

  const saveEdit = async (chat: DbChat) => {
    if (!editValue.trim()) return
    await window.api.chats.rename(chat.wa_id, editValue.trim())
    window.dispatchEvent(new CustomEvent('whatsinvo:chats-changed'))
    setEditingId(null)
  }

  const handleDelete = async (chat: DbChat) => {
    setDeleting(true)
    await window.api.chats.delete(chat.wa_id)
    window.dispatchEvent(new CustomEvent('whatsinvo:chats-changed'))
    setConfirmDeleteId(null)
    setDeleting(false)
  }

  const q = search.toLowerCase()
  const filtered = chats.filter(c =>
    !q || (c.name || c.wa_id).toLowerCase().includes(q)
  )

  const imported = filtered.filter(c => c.wa_id.startsWith('import:'))
  const synced   = filtered.filter(c => !c.wa_id.startsWith('import:'))

  const openImport = (chat?: DbChat) => {
    setTargetChat(chat ?? null)
    setShowImport(true)
  }

  return (
    <div className="flex flex-col h-full bg-[#0b141a] text-[#e9edef] overflow-hidden">

      {/* Header */}
      <div className="shrink-0 flex items-center justify-between px-6 py-4 bg-[#202c33] border-b border-[#2a3942]">
        <div>
          <h1 className="text-lg font-bold text-white">Import Manager</h1>
          <p className="text-xs text-gray-500 mt-0.5">Import WhatsApp chat exports or archive synced chats</p>
        </div>
        <button
          onClick={() => openImport()}
          className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-medium rounded-lg transition-colors"
        >
          <span>+</span> New Import from file
        </button>
      </div>

      {/* Search */}
      <div className="shrink-0 px-6 py-3 bg-[#111b21] border-b border-[#2a3942]">
        <input
          type="search"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search chats…"
          className="w-full bg-[#2a3942] text-sm text-gray-300 placeholder-gray-500 px-4 py-2 rounded-lg focus:outline-none focus:ring-1 focus:ring-emerald-500"
        />
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-6 py-4 space-y-6">

        {loading ? (
          <div className="flex justify-center py-12">
            <div className="w-6 h-6 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : (
          <>
            {/* ── Imported chats ─────────────────────────────────────────── */}
            <section>
              <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">
                📥 Imported Chats ({imported.length})
              </h2>
              {imported.length === 0 ? (
                <div className="text-center py-8 bg-[#182229] rounded-xl border border-[#2a3942]">
                  <p className="text-gray-500 text-sm">No imported chats yet.</p>
                  <p className="text-gray-600 text-xs mt-1">Use "New Import from file" or import a synced chat below.</p>
                </div>
              ) : (
                <div className="space-y-1 bg-[#182229] rounded-xl overflow-hidden border border-[#2a3942]">
                  {imported.map(chat => (
                    <div key={chat.wa_id} className="flex items-center gap-3 px-4 py-3 hover:bg-[#2a3942] transition-colors border-b border-[#2a3942]/50 last:border-0">
                      <Avatar chat={chat} />
                      <div className="flex-1 min-w-0">
                        {editingId === chat.wa_id ? (
                          <div className="flex items-center gap-2">
                            <input
                              autoFocus
                              value={editValue}
                              onChange={e => setEditValue(e.target.value)}
                              onKeyDown={e => {
                                if (e.key === 'Enter') saveEdit(chat)
                                if (e.key === 'Escape') setEditingId(null)
                              }}
                              className="flex-1 bg-[#2a3942] text-sm text-white px-2 py-1 rounded focus:outline-none focus:ring-1 focus:ring-emerald-500"
                            />
                            <button onClick={() => saveEdit(chat)} className="text-xs text-emerald-400 hover:text-emerald-300">Save</button>
                            <button onClick={() => setEditingId(null)} className="text-xs text-gray-500 hover:text-gray-300">Cancel</button>
                          </div>
                        ) : (
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-medium text-white truncate">{chat.name || chat.wa_id}</span>
                            <span className="shrink-0 text-xs text-emerald-400">📥</span>
                            <button
                              onClick={() => startEdit(chat)}
                              className="shrink-0 text-xs text-gray-500 hover:text-gray-300 transition-colors"
                              title="Rename"
                            >✏️</button>
                          </div>
                        )}
                        <p className="text-xs text-gray-500 mt-0.5">
                          {chat.last_message_preview || 'No preview'} · {fmtDate(chat.last_message_at)}
                        </p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          onClick={() => navigate(`/${encodeURIComponent(chat.wa_id)}`)}
                          className="px-3 py-1.5 text-xs text-emerald-400 border border-emerald-800 rounded-lg hover:bg-emerald-900/30 transition-colors"
                        >
                          👁 View
                        </button>
                        <button
                          onClick={() => openImport(chat)}
                          className="px-3 py-1.5 text-xs text-gray-400 border border-[#2a3942] rounded-lg hover:bg-[#2a3942] transition-colors"
                        >
                          ↩ Re-import
                        </button>
                        {confirmDeleteId === chat.wa_id ? (
                          <>
                            <button
                              onClick={() => handleDelete(chat)}
                              disabled={deleting}
                              className="px-3 py-1.5 text-xs text-white bg-red-600 hover:bg-red-700 rounded-lg transition-colors disabled:opacity-50"
                            >
                              {deleting ? '…' : 'Confirm'}
                            </button>
                            <button
                              onClick={() => setConfirmDeleteId(null)}
                              className="px-3 py-1.5 text-xs text-gray-400 border border-[#2a3942] rounded-lg hover:bg-[#2a3942] transition-colors"
                            >
                              Cancel
                            </button>
                          </>
                        ) : (
                          <button
                            onClick={() => setConfirmDeleteId(chat.wa_id)}
                            className="px-3 py-1.5 text-xs text-red-400 border border-red-900 rounded-lg hover:bg-red-900/30 transition-colors"
                          >
                            🗑 Delete
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>

            {/* ── Synced chats ────────────────────────────────────────────── */}
            <section>
              <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">
                💬 Synced Chats ({synced.length})
              </h2>
              {synced.length === 0 ? (
                <div className="text-center py-8 bg-[#182229] rounded-xl border border-[#2a3942]">
                  <p className="text-gray-500 text-sm">No synced chats found.</p>
                  <p className="text-gray-600 text-xs mt-1">Connect to WhatsApp to sync your chats first.</p>
                </div>
              ) : (
                <div className="space-y-1 bg-[#182229] rounded-xl overflow-hidden border border-[#2a3942]">
                  {synced.map(chat => (
                    <div key={chat.wa_id} className="flex items-center gap-3 px-4 py-3 hover:bg-[#2a3942] transition-colors border-b border-[#2a3942]/50 last:border-0">
                      <Avatar chat={chat} />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-white truncate">{chat.name || chat.wa_id}</p>
                        <p className="text-xs text-gray-500 mt-0.5 truncate">
                          {chat.last_message_preview || '—'} · {fmtDate(chat.last_message_at)}
                        </p>
                      </div>
                      <button
                        onClick={() => openImport(chat)}
                        className="shrink-0 flex items-center gap-1.5 px-3 py-1.5 text-xs text-emerald-400 border border-emerald-800 rounded-lg hover:bg-emerald-900/30 transition-colors"
                      >
                        📥 Import from file
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </section>
          </>
        )}
      </div>

      {/* Import modal */}
      {showImport && (
        <ImportModal
          onClose={() => { setShowImport(false); setTargetChat(null) }}
          onImportDone={(waId) => {
            window.dispatchEvent(new CustomEvent('whatsinvo:chats-changed'))
            setShowImport(false)
            setTargetChat(null)
            navigate(`/${encodeURIComponent(waId)}`)
          }}
        />
      )}
    </div>
  )
}
