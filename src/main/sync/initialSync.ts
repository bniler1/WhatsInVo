import { BrowserWindow } from 'electron'
import { db, persist, queryOne, run } from '../db'
import { getClient } from '../whatsapp/client'
import { downloadAndSaveMedia } from './mediaDownloader'
import type { WAContact, WAMessage } from '../whatsapp/client'

function emitProgress(win: BrowserWindow | undefined, phase: string, pct: number, chatName = '') {
  win?.webContents.send('sync:progress', { status: 'syncing', phase, pct, chatName })
}

function upsertContact(c: WAContact): number {
  const existing = queryOne<{ id: number }>(`SELECT id FROM contacts WHERE wa_id = ?`, [c.id])
  if (existing) {
    db.run(`UPDATE contacts SET name = ?, push_name = ?, phone = ? WHERE id = ?`,
      [c.name || '', c.pushname || '', c.number || '', existing.id])
    return existing.id
  }
  return run(
    `INSERT INTO contacts (wa_id, name, push_name, phone) VALUES (?, ?, ?, ?)`,
    [c.id, c.name || '', c.pushname || '', c.number || '']
  )
}

function upsertChat(contactId: number, c: WAContact): number {
  const existing = queryOne<{ id: number }>(`SELECT id FROM chats WHERE wa_id = ?`, [c.id])
  if (existing) return existing.id
  return run(
    `INSERT INTO chats (wa_id, name, contact_id, is_group) VALUES (?, ?, ?, ?)`,
    [c.id, c.name || '', contactId, c.isGroup ? 1 : 0]
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
      msg.mimetype || ''
    ]
  )
}

export async function runInitialSync(): Promise<void> {
  const win = BrowserWindow.getAllWindows()[0]
  const client = getClient()

  // Mark sync started
  db.run(`UPDATE sync_state SET status = 'syncing' WHERE id = 1`)
  persist()

  try {
    emitProgress(win, 'Fetching contacts…', 0)
    const contacts = await client.listContacts()

    const mediaQueue: Array<{ msg: WAMessage; chatWaId: string; msgRowId: number }> = []

    for (let i = 0; i < contacts.length; i++) {
      const contact = contacts[i]
      const pct = Math.round((i / contacts.length) * 75)
      emitProgress(win, 'Syncing messages', pct, contact.name || contact.id)

      const contactId = upsertContact(contact)
      const chatId = upsertChat(contactId, contact)

      // Paginate all messages for this chat
      let offset = 0
      const pageSize = 100
      while (true) {
        let page: WAMessage[]
        try {
          page = await client.listMessages(contact.id, pageSize, offset)
        } catch {
          break
        }
        if (!page || page.length === 0) break

        for (const msg of page) {
          const msgRowId = insertMessage(chatId, msg)
          if (msg.hasMedia && msg.mediaUrl && msgRowId) {
            mediaQueue.push({ msg, chatWaId: contact.id, msgRowId })
          }
        }

        // Update chat's last_message_at from the most recent message
        if (offset === 0 && page.length > 0) {
          const latest = page.reduce((a, b) => a.timestamp > b.timestamp ? a : b)
          const preview = (latest.body || (latest.hasMedia ? `[${latest.type}]` : '')).slice(0, 100)
          db.run(
            `UPDATE chats SET last_message_at = ?, last_message_preview = ? WHERE id = ?`,
            [latest.timestamp, preview, chatId]
          )
        }

        persist()

        if (page.length < pageSize) break
        offset += pageSize
      }
    }

    // Download media (best-effort, non-blocking errors)
    const total = mediaQueue.length
    for (let i = 0; i < total; i++) {
      const { msg, chatWaId, msgRowId } = mediaQueue[i]
      const pct = 75 + Math.round((i / Math.max(total, 1)) * 20)
      if (i % 10 === 0) emitProgress(win, 'Downloading media', pct)

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
        // skip individual media failures
      }
    }

    db.run(`UPDATE sync_state SET status = 'done', last_full_sync_at = datetime('now') WHERE id = 1`)
    persist()

    win?.webContents.send('sync:progress', { status: 'done', phase: 'Complete', pct: 100, chatName: '' })
    win?.webContents.send('wa:chat-updated', {})
  } catch (err) {
    console.error('[InitialSync] Error:', err)
    db.run(`UPDATE sync_state SET status = 'error' WHERE id = 1`)
    persist()
    win?.webContents.send('sync:progress', { status: 'error', phase: String(err), pct: 0, chatName: '' })
  }
}
