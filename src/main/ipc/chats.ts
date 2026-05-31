import { ipcMain } from 'electron'
import { queryAll, queryOne, db, persist } from '../db'
import type { DbChat } from '../../shared/types'

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
}
