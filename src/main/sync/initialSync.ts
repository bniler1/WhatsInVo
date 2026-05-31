import { BrowserWindow } from 'electron'
import { db, persist, queryOne, run } from '../db'
import { getClient } from '../whatsapp/client'
import { downloadAndSaveMedia } from './mediaDownloader'
import type { WAMessage, WAChat } from '../whatsapp/client'

function emitProgress(win: BrowserWindow | undefined, phase: string, pct: number, chatName = '') {
  win?.webContents.send('sync:progress', { status: 'syncing', phase, pct, chatName })
}

function upsertChat(chat: WAChat): number {
  const existing = queryOne<{ id: number }>(`SELECT id FROM chats WHERE wa_id = ?`, [chat.id])
  if (existing) {
    db.run(
      `UPDATE chats SET name = ?, is_group = ?, last_message_at = ?, last_message_preview = ?
       WHERE id = ?`,
      [
        chat.name || '',
        chat.isGroup ? 1 : 0,
        chat.lastMessage?.timestamp ?? null,
        (chat.lastMessage?.body || '').slice(0, 100),
        existing.id,
      ]
    )
    return existing.id
  }

  // Upsert contact for 1:1 chats
  let contactId: number | null = null
  if (!chat.isGroup) {
    const existingContact = queryOne<{ id: number }>(`SELECT id FROM contacts WHERE wa_id = ?`, [chat.id])
    if (existingContact) {
      contactId = existingContact.id
    } else {
      contactId = run(
        `INSERT INTO contacts (wa_id, name, push_name, phone) VALUES (?, ?, ?, ?)`,
        [chat.id, chat.name || '', chat.name || '', chat.id.replace(/@.*/, '')]
      )
    }
  }

  return run(
    `INSERT INTO chats (wa_id, name, contact_id, is_group, last_message_at, last_message_preview)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [
      chat.id,
      chat.name || '',
      contactId,
      chat.isGroup ? 1 : 0,
      chat.lastMessage?.timestamp ?? null,
      (chat.lastMessage?.body || '').slice(0, 100),
    ]
  )
}

function insertMessage(chatId: number, msg: WAMessage): number {
  const existing = queryOne<{ id: number }>(
    `SELECT id FROM messages WHERE wa_message_id = ?`, [msg.id]
  )
  if (existing) return existing.id

  return run(
    `INSERT INTO messages
       (chat_id, wa_message_id, timestamp, sender_wa_id, sender_name, body, type, direction,
        has_media, caption, filename, mime_type)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      chatId,
      msg.id,
      msg.timestamp,
      msg.fromMe ? '' : msg.from,
      msg.fromMe ? 'Me' : (msg.author || msg.from),
      msg.body || '',
      msg.type || 'chat',
      msg.fromMe ? 'outgoing' : 'incoming',
      msg.hasMedia ? 1 : 0,
      msg.caption || '',
      msg.filename || '',
      msg.mimetype || '',
    ]
  )
}

export async function runInitialSync(): Promise<void> {
  const win = BrowserWindow.getAllWindows()[0]
  const client = getClient()

  db.run(`UPDATE sync_state SET status = 'syncing' WHERE id = 1`)
  persist()

  try {
    emitProgress(win, 'Fetching chat list from WhatsApp…', 0)

    // Use the new direct-from-WhatsApp endpoint (not the DB-backed one)
    const chats = await client.listWhatsAppChats()

    if (!chats || chats.length === 0) {
      console.warn('[InitialSync] No chats returned — session may not be ready yet')
      db.run(`UPDATE sync_state SET status = 'idle' WHERE id = 1`)
      persist()
      return
    }

    console.log(`[InitialSync] Syncing ${chats.length} chats`)
    const mediaQueue: Array<{ msg: WAMessage; chatWaId: string; msgRowId: number }> = []

    for (let i = 0; i < chats.length; i++) {
      const chat = chats[i]
      const pct = Math.round((i / chats.length) * 75)
      emitProgress(win, 'Downloading messages', pct, chat.name || chat.id)

      const chatRowId = upsertChat(chat)

      // Fetch message history directly from WhatsApp for this chat
      let messages: WAMessage[] = []
      try {
        messages = await client.fetchChatMessages(chat.id, 100)
      } catch (err) {
        console.warn(`[InitialSync] Could not fetch messages for ${chat.id}:`, err)
        continue
      }

      for (const msg of messages) {
        const msgRowId = insertMessage(chatRowId, msg)
        if (msg.hasMedia && msg.mediaUrl && msgRowId) {
          mediaQueue.push({ msg, chatWaId: chat.id, msgRowId })
        }
      }

      persist()
    }

    // Download media files (best-effort)
    const total = mediaQueue.length
    for (let i = 0; i < total; i++) {
      const { msg, chatWaId, msgRowId } = mediaQueue[i]
      if (i % 10 === 0) {
        emitProgress(win, 'Downloading media', 75 + Math.round((i / Math.max(total, 1)) * 20))
      }
      try {
        const filePath = await downloadAndSaveMedia(msg, chatWaId)
        if (filePath) {
          const mediaId = run(
            `INSERT INTO media (message_id, file_path, mime_type, original_name)
             VALUES (?, ?, ?, ?)`,
            [msgRowId, filePath, msg.mimetype || '', msg.filename || '']
          )
          db.run(`UPDATE messages SET media_id = ? WHERE id = ?`, [mediaId, msgRowId])
        }
      } catch {
        // skip individual media failures silently
      }
    }

    db.run(`UPDATE sync_state SET status = 'done', last_full_sync_at = datetime('now') WHERE id = 1`)
    persist()

    win?.webContents.send('sync:progress', { status: 'done', phase: 'Complete', pct: 100, chatName: '' })
    win?.webContents.send('wa:chat-updated', {})
    console.log(`[InitialSync] Done — ${chats.length} chats synced`)
  } catch (err) {
    console.error('[InitialSync] Fatal error:', err)
    db.run(`UPDATE sync_state SET status = 'error' WHERE id = 1`)
    persist()
    win?.webContents.send('sync:progress', { status: 'error', phase: String(err), pct: 0, chatName: '' })
  }
}
