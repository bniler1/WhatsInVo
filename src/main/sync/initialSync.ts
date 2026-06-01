import { BrowserWindow } from 'electron'
import { db, persist, queryOne, run } from '../db'
import { getClient } from '../whatsapp/client'
import { downloadAndSaveMedia } from './mediaDownloader'
import type { WAMessage, WAChat } from '../whatsapp/client'

let _abortRequested = false
export function requestAbort() { _abortRequested = true }

// Sleep that wakes up early (every 100ms) to check the abort flag
async function sleep(ms: number): Promise<void> {
  const step = 100
  let elapsed = 0
  while (elapsed < ms) {
    if (_abortRequested) return
    await new Promise(r => setTimeout(r, Math.min(step, ms - elapsed)))
    elapsed += step
  }
}

function emitProgress(win: BrowserWindow | undefined, phase: string, pct: number, chatName = '') {
  win?.webContents.send('sync:progress', { status: 'syncing', phase, pct: Math.min(Math.round(pct), 99), chatName })
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
  _abortRequested = false
  const win = BrowserWindow.getAllWindows()[0]
  const client = getClient()

  db.run(`UPDATE sync_state SET status = 'syncing' WHERE id = 1`)
  persist()

  try {
    emitProgress(win, 'Fetching chat list from WhatsApp…', 1)

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
      if (_abortRequested) break
      const chat = chats[i]
      const pct = 1 + Math.round((i / chats.length) * 74)
      emitProgress(win, 'Downloading messages', pct, chat.name || chat.id)

      const chatRowId = upsertChat(chat)

      // Fetch message history — retry up to 3× on 429 with backoff
      let messages: WAMessage[] = []
      let fetchSuccess = false
      for (let attempt = 0; attempt <= 3; attempt++) {
        try {
          messages = await client.fetchChatMessages(chat.id, 200)
          fetchSuccess = true
          break
        } catch (err) {
          const is429 = String(err).includes('429')
          if (is429 && attempt < 3) {
            const wait = 2000 * Math.pow(2, attempt)
            console.warn(`[InitialSync] 429 for ${chat.id}, retrying in ${wait}ms`)
            await sleep(wait)
          } else {
            console.warn(`[InitialSync] Could not fetch messages for ${chat.id}:`, err)
            break
          }
        }
      }
      if (!fetchSuccess) { await sleep(500); continue }

      for (const msg of messages) {
        const msgRowId = insertMessage(chatRowId, msg)
        if (msg.hasMedia && msgRowId) {
          mediaQueue.push({ msg, chatWaId: chat.id, msgRowId })
        }
      }

      persist()
      await sleep(200)   // inter-chat pause to reduce rate
    }

    // Download media files — with pacing to avoid rate limits
    const total = mediaQueue.length
    for (let i = 0; i < total; i++) {
      if (_abortRequested) break
      const { msg, chatWaId, msgRowId } = mediaQueue[i]
      if (i % 5 === 0) {
        emitProgress(win, 'Downloading media files', 75 + Math.round((i / Math.max(total, 1)) * 24))
      }
      await sleep(300)   // 300ms between downloads
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
        // individual failures already logged inside downloadAndSaveMedia
      }
    }

    if (_abortRequested) {
      db.run(`UPDATE sync_state SET status = 'idle' WHERE id = 1`)
      persist()
      win?.webContents.send('sync:progress', { status: 'aborted', phase: 'Download cancelled', pct: 0, chatName: '' })
      win?.webContents.send('wa:chat-updated', {})
      console.log('[InitialSync] Aborted by user')
      return
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
