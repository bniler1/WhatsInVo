import { ipcMain } from 'electron'
import { queryAll, run, persist } from '../db'
import { getClient } from '../whatsapp/client'
import { handleSendFile } from './whatsapp'
import type { DbMessage } from '../../shared/types'

export function registerMessageHandlers(): void {
  ipcMain.handle('messages:list', (_, chatWaId: string, limit = 50, beforeTimestamp?: number) => {
    if (beforeTimestamp) {
      return queryAll<DbMessage>(`
        SELECT m.*, med.file_path as media_path, med.mime_type as media_mime
        FROM messages m
        LEFT JOIN media med ON m.media_id = med.id
        JOIN chats c ON m.chat_id = c.id
        WHERE c.wa_id = ? AND m.timestamp < ?
        ORDER BY m.timestamp DESC
        LIMIT ?
      `, [chatWaId, beforeTimestamp, limit])
    }
    return queryAll<DbMessage>(`
      SELECT m.*, med.file_path as media_path, med.mime_type as media_mime
      FROM messages m
      LEFT JOIN media med ON m.media_id = med.id
      JOIN chats c ON m.chat_id = c.id
      WHERE c.wa_id = ?
      ORDER BY m.timestamp DESC
      LIMIT ?
    `, [chatWaId, limit])
  })

  ipcMain.handle('messages:send-text', async (_, chatWaId: string, text: string) => {
    try {
      const result = await getClient().sendText(chatWaId, text)
      // Optimistically insert the sent message into local DB
      const chatRow = queryAll<{ id: number }>(`SELECT id FROM chats WHERE wa_id = ?`, [chatWaId])
      if (chatRow[0]) {
        const now = Math.floor(Date.now() / 1000)
        run(
          `INSERT OR IGNORE INTO messages
             (chat_id, wa_message_id, timestamp, sender_wa_id, sender_name, body, type, direction)
           VALUES (?, ?, ?, '', 'Me', ?, 'chat', 'outgoing')`,
          [chatRow[0].id, result.messageId || `sent_${Date.now()}`, now, text]
        )
        persist()
      }
      return { ok: true, ...result }
    } catch (err) {
      return { ok: false, error: String(err) }
    }
  })

  ipcMain.handle('messages:send-file', async (_, chatWaId: string) => {
    return handleSendFile(chatWaId)
  })
}
