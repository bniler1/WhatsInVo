import { BrowserWindow } from 'electron'
import { db, persist, queryOne, run } from '../db'
import type { WAMessage } from '../whatsapp/client'
import { downloadAndSaveMedia } from './mediaDownloader'

function getWin(): BrowserWindow | undefined {
  return BrowserWindow.getAllWindows()[0]
}

function upsertContact(waId: string, name: string, pushName: string): number {
  const phone = waId.replace(/@.*/, '')
  const existing = queryOne<{ id: number }>(`SELECT id FROM contacts WHERE wa_id = ?`, [waId])
  if (existing) return existing.id
  return run(
    `INSERT INTO contacts (wa_id, name, push_name, phone) VALUES (?, ?, ?, ?)`,
    [waId, name, pushName, phone]
  )
}

function getOrCreateChat(waId: string, name: string, isGroup: boolean): number {
  const existing = queryOne<{ id: number }>(`SELECT id FROM chats WHERE wa_id = ?`, [waId])
  if (existing) return existing.id
  const contactId = isGroup ? null : upsertContact(waId, name, name)
  return run(
    `INSERT INTO chats (wa_id, name, contact_id, is_group) VALUES (?, ?, ?, ?)`,
    [waId, name, contactId, isGroup ? 1 : 0]
  )
}

export function handleIncomingMessage(msg: WAMessage): void {
  const chatWaId = msg.fromMe ? msg.to : msg.from
  const isGroup = chatWaId.endsWith('@g.us')
  const chatName = chatWaId
  const chatId = getOrCreateChat(chatWaId, chatName, isGroup)

  const senderName = msg.author || (msg.fromMe ? 'Me' : msg.from)

  db.run(
    `INSERT OR IGNORE INTO messages
      (chat_id, wa_message_id, timestamp, sender_wa_id, sender_name, body, type, direction,
       has_media, caption, filename, mime_type)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      chatId,
      msg.id,
      msg.timestamp,
      msg.fromMe ? '' : msg.from,
      senderName,
      msg.body || '',
      msg.type || 'chat',
      msg.fromMe ? 'outgoing' : 'incoming',
      msg.hasMedia ? 1 : 0,
      msg.caption || '',
      msg.filename || '',
      msg.mimetype || ''
    ]
  )

  const preview = (msg.body || (msg.hasMedia ? `[${msg.type}]` : '')).slice(0, 100)
  db.run(
    `UPDATE chats SET last_message_at = ?, last_message_preview = ?, unread_count = unread_count + 1
     WHERE id = ?`,
    [msg.timestamp, preview, chatId]
  )

  persist()

  if (msg.hasMedia && msg.mediaUrl) {
    downloadAndSaveMedia(msg, chatWaId).then(filePath => {
      if (filePath) {
        const msgRow = queryOne<{ id: number }>(
          `SELECT id FROM messages WHERE wa_message_id = ?`, [msg.id]
        )
        if (msgRow) {
          const mediaId = run(
            `INSERT INTO media (message_id, file_path, mime_type, original_name)
             VALUES (?, ?, ?, ?)`,
            [msgRow.id, filePath, msg.mimetype || '', msg.filename || '']
          )
          db.run(`UPDATE messages SET media_id = ? WHERE id = ?`, [mediaId, msgRow.id])
          persist()
        }
      }
    }).catch(err => console.error('[Sync] Media download failed:', err))
  }

  const win = getWin()
  win?.webContents.send('wa:message-appended', { chatId: chatWaId })
  win?.webContents.send('wa:chat-updated', { chatId: chatWaId })
}

export function handleDeletedMessage(data: { id?: string; messageId?: string }): void {
  const waId = data.id || data.messageId
  if (!waId) return

  db.run(
    `UPDATE messages SET is_deleted = 1, deleted_at = datetime('now') WHERE wa_message_id = ?`,
    [waId]
  )
  persist()

  getWin()?.webContents.send('wa:message-updated', { waMessageId: waId })
}
