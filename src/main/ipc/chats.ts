import { ipcMain, BrowserWindow, dialog } from 'electron'
import { writeFileSync } from 'fs'
import { queryAll, queryOne, db, persist } from '../db'
import type { DbChat } from '../../shared/types'

interface ExportMsg {
  timestamp: number
  sender_name: string
  body: string
  direction: string
  type: string
  filename: string | null
  original_name: string | null
}

function buildHtml(chatName: string, messages: ExportMsg[]): string {
  const exportDate = new Date().toLocaleString()
  let prevDate = ''
  const rows = messages.map(m => {
    const d = new Date(m.timestamp * 1000)
    const dateLabel = d.toLocaleDateString([], { month: 'long', day: 'numeric', year: 'numeric' })
    const timeLabel = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    const isOut = m.direction === 'outgoing'
    let dateSep = ''
    if (dateLabel !== prevDate) {
      prevDate = dateLabel
      dateSep = `<div class="date-sep">${dateLabel}</div>`
    }
    const mediaLine = m.type !== 'chat' && (m.filename || m.original_name)
      ? `<div class="media">📎 ${m.original_name || m.filename}</div>` : ''
    const bodyHtml = m.body ? `<div class="body">${m.body.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/\n/g,'<br>')}</div>` : ''
    return `${dateSep}
<div class="msg ${isOut ? 'out' : 'in'}">
  <div class="bubble">
    ${!isOut ? `<div class="sender">${m.sender_name.replace(/&/g,'&amp;').replace(/</g,'&lt;')}</div>` : ''}
    ${bodyHtml}${mediaLine}
    <div class="time">${timeLabel}</div>
  </div>
</div>`
  }).join('\n')

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>${chatName.replace(/</g,'&lt;')} — WhatsInVo</title>
<style>
  *{box-sizing:border-box;margin:0;padding:0}
  body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:#0b141a;color:#e9edef;padding:24px;max-width:820px;margin:0 auto}
  h1{font-size:20px;font-weight:600;padding-bottom:12px;border-bottom:1px solid #2a3942;margin-bottom:6px}
  .meta{font-size:12px;color:#8696a0;margin-bottom:24px}
  .date-sep{text-align:center;font-size:12px;color:#8696a0;background:#182229;display:inline-block;padding:3px 12px;border-radius:8px;margin:16px auto;display:flex;justify-content:center}
  .msg{display:flex;margin-bottom:6px}
  .msg.out{justify-content:flex-end}
  .bubble{max-width:68%;padding:8px 12px;border-radius:8px;word-break:break-word}
  .msg.in .bubble{background:#202c33}
  .msg.out .bubble{background:#005c4b}
  .sender{font-size:12px;color:#00a884;font-weight:600;margin-bottom:3px}
  .body{font-size:14px;line-height:1.45}
  .media{font-size:12px;color:#8696a0;font-style:italic;margin-top:3px}
  .time{font-size:11px;color:#8696a0;text-align:right;margin-top:4px}
</style>
</head>
<body>
<h1>💬 ${chatName.replace(/</g,'&lt;')}</h1>
<div class="meta">Exported from WhatsInVo &nbsp;·&nbsp; ${exportDate} &nbsp;·&nbsp; ${messages.length.toLocaleString()} messages</div>
${rows}
</body>
</html>`
}

export function registerChatHandlers(): void {
  ipcMain.handle('chats:list', () => {
    return queryAll<DbChat>(`
      SELECT c.*, co.avatar_path
      FROM chats c
      LEFT JOIN contacts co ON c.contact_id = co.id
      WHERE c.cleared_at IS NULL OR c.last_message_at IS NOT NULL
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

  ipcMain.handle('chats:export', async (_, chatWaId: string) => {
    const chat = queryOne<{ name: string }>(`SELECT name FROM chats WHERE wa_id = ?`, [chatWaId])
    if (!chat) return { ok: false, error: 'Chat not found' }

    const messages = queryAll<ExportMsg>(`
      SELECT m.timestamp, m.sender_name, m.body, m.direction, m.type, m.filename,
             med.original_name
      FROM messages m
      LEFT JOIN media med ON m.media_id = med.id
      JOIN chats c ON m.chat_id = c.id
      WHERE c.wa_id = ?
      ORDER BY m.timestamp ASC
    `, [chatWaId])

    const safeName = (chat.name || chatWaId).replace(/[<>:"/\\|?*]/g, '_').slice(0, 60)
    const { canceled, filePath } = await dialog.showSaveDialog({
      title: 'Save chat log',
      defaultPath: `${safeName}.html`,
      filters: [{ name: 'HTML', extensions: ['html'] }],
    })
    if (canceled || !filePath) return { ok: false, cancelled: true }

    writeFileSync(filePath, buildHtml(chat.name || chatWaId, messages), 'utf-8')
    return { ok: true, filePath }
  })

  ipcMain.handle('chats:clear-messages', (_, chatWaId: string) => {
    const chat = queryOne<{ id: number }>(`SELECT id FROM chats WHERE wa_id = ?`, [chatWaId])
    if (!chat) return { ok: false, error: 'Chat not found' }
    db.run(`DELETE FROM messages WHERE chat_id = ?`, [chat.id])
    db.run(
      `UPDATE chats SET cleared_at = datetime('now'), last_message_at = NULL,
       last_message_preview = '', unread_count = 0 WHERE id = ?`,
      [chat.id]
    )
    persist()
    BrowserWindow.getAllWindows()[0]?.webContents.send('wa:chat-updated', {})
    return { ok: true }
  })
}
