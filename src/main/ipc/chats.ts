import { ipcMain, shell, BrowserWindow } from 'electron'
import { existsSync, readFileSync, rmSync } from 'fs'
import { join, basename } from 'path'
import { app } from 'electron'
import { queryAll, queryOne, run, db, persist } from '../db'
import type { DbChat } from '../../shared/types'
import { downloadAndSaveMedia, guessMimeFromPath } from '../sync/mediaDownloader'
import type { WAMessage } from '../whatsapp/client'

const WA_LINE_RE = /^(?:\[)?(\d{1,4}[\/\-.]\d{1,2}[\/\-.]\d{2,4})/i

function sanitizeName(name: string): string {
  return name.replace(/[<>:"/\\|?*\x00-\x1F]/g, '_').trim().slice(0, 60) || 'Imported Chat'
}

export function registerChatHandlers(): void {
  ipcMain.handle('chats:list', () => {
    return queryAll<DbChat>(`
      SELECT c.*, co.avatar_path
      FROM chats c
      LEFT JOIN contacts co ON c.contact_id = co.id
      ORDER BY c.last_message_at DESC
    `)
  })

  ipcMain.handle('chats:get', (_, chatWaId: string) => {
    return queryOne<DbChat>(`
      SELECT c.*, co.avatar_path, co.name AS contact_name, co.push_name
      FROM chats c
      LEFT JOIN contacts co ON c.contact_id = co.id
      WHERE c.wa_id = ?
    `, [chatWaId])
  })

  ipcMain.handle('chats:mark-read', (_, chatWaId: string) => {
    db.run(`UPDATE chats SET unread_count = 0 WHERE wa_id = ?`, [chatWaId])
    persist()
    return { ok: true }
  })

  ipcMain.handle('chats:open-file', async (_, filePath: string) => {
    try {
      await shell.openPath(filePath)
      return { ok: true }
    } catch (e) {
      return { ok: false, error: String(e) }
    }
  })

  ipcMain.handle('chats:integrity-check', (_, chatWaId: string) => {
    const chat = queryOne<{ id: number; name: string }>(`SELECT id, name FROM chats WHERE wa_id = ?`, [chatWaId])
    if (!chat) return { ok: false, error: 'Chat not found' }

    const dbMessages = (queryOne<{ c: number }>(`SELECT COUNT(*) as c FROM messages WHERE chat_id = ?`, [chat.id])?.c) ?? 0
    const mediaInDb  = (queryOne<{ c: number }>(`SELECT COUNT(*) as c FROM messages WHERE chat_id = ? AND has_media = 1`, [chat.id])?.c) ?? 0

    const mediaRows = queryAll<{ file_path: string | null }>(
      `SELECT med.file_path FROM messages m LEFT JOIN media med ON m.media_id = med.id WHERE m.chat_id = ? AND m.has_media = 1`,
      [chat.id]
    )
    const mediaOnDisk  = mediaRows.filter(r => r.file_path && existsSync(r.file_path)).length
    const mediaMissing = mediaRows.filter(r => r.file_path && !existsSync(r.file_path)).length
    const mediaOmitted = mediaRows.filter(r => !r.file_path).length

    // Try to verify against the saved chat.txt
    let txtMessages: number | null = null
    const txtPath = join(app.getPath('userData'), 'chats', sanitizeName(chat.name), 'chat.txt')
    if (existsSync(txtPath)) {
      const lines = readFileSync(txtPath, 'utf-8').split(/\r?\n/)
      txtMessages = lines.filter(l => WA_LINE_RE.test(l)).length
    }

    const integrity = txtMessages !== null
      ? (dbMessages >= txtMessages ? 'complete' : 'incomplete')
      : 'unknown'

    return { ok: true, dbMessages, txtMessages, mediaInDb, mediaOnDisk, mediaMissing, mediaOmitted, integrity }
  })

  ipcMain.handle('chats:delete', (_, chatWaId: string) => {
    const chat = queryOne<{ id: number; name: string }>(`SELECT id, name FROM chats WHERE wa_id = ?`, [chatWaId])
    if (!chat) return { ok: false, error: 'Chat not found' }

    const chatFolder = join(app.getPath('userData'), 'chats', sanitizeName(chat.name))
    if (existsSync(chatFolder)) {
      rmSync(chatFolder, { recursive: true, force: true })
    }

    db.run(`DELETE FROM chats WHERE id = ?`, [chat.id])
    persist()
    return { ok: true }
  })

  ipcMain.handle('chats:retry-media', async (_, chatWaId: string) => {
    const chat = queryOne<{ id: number }>(`SELECT id FROM chats WHERE wa_id = ?`, [chatWaId])
    if (!chat) return { ok: false, error: 'Chat not found' }

    const pending = queryAll<{ id: number; wa_message_id: string; timestamp: number; type: string; filename: string | null }>(
      `SELECT id, wa_message_id, timestamp, type, filename FROM messages
       WHERE chat_id = ? AND has_media = 1 AND media_id IS NULL`,
      [chat.id]
    )

    if (pending.length === 0) return { ok: true, total: 0, downloaded: 0, failed: 0 }

    let downloaded = 0, failed = 0

    for (const row of pending) {
      await new Promise(r => setTimeout(r, 300))
      const stub = {
        id: row.wa_message_id,
        timestamp: row.timestamp,
        hasMedia: true,
        type: row.type as WAMessage['type'],
        filename: row.filename || '',
        body: '', fromMe: false, from: chatWaId, to: '',
        mimetype: '', caption: '', author: '',
      } as WAMessage

      const filePath = await downloadAndSaveMedia(stub, chatWaId)
      if (filePath) {
        const mime = guessMimeFromPath(filePath)
        const mediaId = run(
          `INSERT INTO media (message_id, file_path, mime_type, original_name)
           VALUES (?, ?, ?, ?)`,
          [row.id, filePath, mime, basename(filePath)]
        )
        db.run(`UPDATE messages SET media_id = ? WHERE id = ?`, [mediaId, row.id])
        persist()
        downloaded++
      } else {
        failed++
      }
    }

    BrowserWindow.getAllWindows()[0]?.webContents.send('wa:chat-updated', {})
    return { ok: true, total: pending.length, downloaded, failed }
  })
}
