import { ipcMain, dialog, shell } from 'electron'
import { readFileSync, existsSync } from 'fs'
import { basename } from 'path'
import { initClient, getClient } from '../whatsapp/client'
import { queryAll, run, persist } from '../db'
import { connectEvents, disconnect, isConnected } from '../whatsapp/events'
import { loadSettings, saveSettings } from '../settings'
import { startOpenWA, stopOpenWA, getServerStatus, getServerUrl, getApiKey } from '../whatsapp/process'

function loadWASettings() {
  const s = loadSettings()
  // If the user hasn't manually set an API key, read the one OpenWA auto-generates
  // on first start and saves to openwa/data/.api-key
  const apiKey = s.wa_apiKey || getApiKey()
  return {
    url:       s.wa_url || 'http://localhost:3785',
    apiKey,
    sessionId: s.wa_sessionId || 'default'
  }
}

export function registerWhatsAppHandlers(): void {

  ipcMain.handle('wa:server-status', () => ({
    status: getServerStatus(),
    url: getServerUrl()
  }))

  ipcMain.handle('wa:server-restart', async () => {
    stopOpenWA()
    await new Promise(r => setTimeout(r, 1500))
    await startOpenWA()
    return { status: getServerStatus() }
  })

  ipcMain.handle('wa:get-settings', () => loadWASettings())

  ipcMain.handle('wa:save-settings', (_, wa: { url: string; apiKey: string; sessionId: string }) => {
    saveSettings({ wa_url: wa.url, wa_apiKey: wa.apiKey, wa_sessionId: wa.sessionId })
    return wa
  })

  ipcMain.handle('wa:connect', async () => {
    try {
      const cfg = loadWASettings()
      const client = initClient(cfg)

      const alive = await client.health()
      if (!alive) return { ok: false, error: `OpenWA not reachable at ${cfg.url}` }

      const sessions = await client.listSessions()
      const exists = sessions.some((s: { name: string }) => s.name === cfg.sessionId)
      if (!exists) await client.createSession()

      let session
      try {
        session = await client.startSession()
      } catch (startErr) {
        const msg = String(startErr)
        if (msg.includes('already started') || msg.includes('400')) {
          session = await client.getSession()
        } else {
          throw startErr
        }
      }

      // Pass the session UUID (not the name) so Socket.IO event filtering works:
      // OpenWA emits events with payload.sessionId = UUID, not the name string.
      const sessionUuid = (session as { id: string }).id
      connectEvents(cfg.url, sessionUuid)

      return { ok: true, session }
    } catch (err) {
      return { ok: false, error: String(err) }
    }
  })

  ipcMain.handle('wa:disconnect', async () => {
    try {
      disconnect()
      const client = getClient()
      await client.stopSession()
      return { ok: true }
    } catch (err) {
      return { ok: false, error: String(err) }
    }
  })

  ipcMain.handle('wa:status', async () => {
    try {
      const cfg = loadWASettings()
      const client = initClient(cfg)
      const alive = await client.health()
      if (!alive) return { connected: false, socketConnected: false }
      const session = await client.getSession()
      return { connected: true, socketConnected: isConnected(), session }
    } catch {
      return { connected: false, socketConnected: false }
    }
  })

  ipcMain.handle('wa:get-qr', async () => {
    try {
      const qr = await getClient().getQR()
      return { ok: true, qrCode: qr.qrCode }
    } catch (err) {
      return { ok: false, error: String(err) }
    }
  })

  ipcMain.handle('wa:open-dashboard', async () => {
    const cfg = loadWASettings()
    await shell.openExternal(cfg.url.replace('3785', '3886').replace('/api', ''))
  })
}

function getMime(ext: string): string {
  const map: Record<string, string> = {
    jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', gif: 'image/gif', webp: 'image/webp',
    mp4: 'video/mp4', mov: 'video/quicktime', avi: 'video/x-msvideo', webm: 'video/webm',
    mp3: 'audio/mpeg', ogg: 'audio/ogg', opus: 'audio/ogg', wav: 'audio/wav', aac: 'audio/aac', m4a: 'audio/mp4',
    pdf: 'application/pdf', doc: 'application/msword',
    docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    txt: 'text/plain', zip: 'application/zip'
  }
  return map[ext] || 'application/octet-stream'
}

export async function handleSendFile(chatId: string, providedPath?: string, caption = ''): Promise<{ ok: boolean; error?: string; cancelled?: boolean }> {
  // Imported chats can't send live messages — they have no real WhatsApp ID
  if (chatId.startsWith('import:')) {
    return { ok: false, error: 'This is an imported chat record. Connect to WhatsApp and use the live chat to send messages.' }
  }

  let filePath: string
  if (providedPath) {
    filePath = providedPath
  } else {
    // Legacy: open dialog and send immediately (kept for fallback)
    const result = await dialog.showOpenDialog({
      title: 'Select file to send',
      filters: [
        { name: 'Images',    extensions: ['jpg','jpeg','png','gif','webp'] },
        { name: 'Video',     extensions: ['mp4','mov','avi','webm','3gp'] },
        { name: 'Audio',     extensions: ['mp3','ogg','opus','wav','aac','m4a'] },
        { name: 'Documents', extensions: ['pdf','doc','docx','xls','xlsx','ppt','pptx','txt','zip'] },
        { name: 'All Files', extensions: ['*'] }
      ],
      properties: ['openFile']
    })
    if (result.canceled) return { ok: false, cancelled: true }
    filePath = result.filePaths[0]
  }

  const name = basename(filePath)
  const ext = name.split('.').pop()?.toLowerCase() ?? ''

  try {
    if (!existsSync(filePath)) return { ok: false, error: 'File not found' }
    const buf = readFileSync(filePath)
    const mime = getMime(ext)
    const base64 = buf.toString('base64')   // raw base64, no data: prefix

    const IMAGE_EXTS = /^(jpg|jpeg|png|gif|webp)$/
    const VIDEO_EXTS = /^(mp4|mov|avi|webm|3gp)$/
    const AUDIO_EXTS = /^(mp3|ogg|opus|wav|aac|m4a)$/

    const client = getClient()
    let messageId: string | undefined
    let msgType: string

    if (IMAGE_EXTS.test(ext)) {
      const r = await client.sendImage(chatId, base64, mime, name, caption)
      messageId = r.messageId; msgType = 'image'
    } else if (VIDEO_EXTS.test(ext)) {
      const r = await client.sendVideo(chatId, base64, mime, name, caption)
      messageId = r.messageId; msgType = 'video'
    } else if (AUDIO_EXTS.test(ext)) {
      const r = await client.sendAudio(chatId, base64, mime, name)
      messageId = r.messageId; msgType = 'audio'
    } else {
      const r = await client.sendDocument(chatId, base64, mime, name)
      messageId = r.messageId; msgType = 'document'
    }

    // Optimistically insert the sent file into the local DB so it appears in the chat log
    const chatRow = queryAll<{ id: number }>(`SELECT id FROM chats WHERE wa_id = ?`, [chatId])
    if (chatRow[0]) {
      const now = Math.floor(Date.now() / 1000)
      run(
        `INSERT OR IGNORE INTO messages
           (chat_id, wa_message_id, timestamp, sender_wa_id, sender_name, body, type, direction, has_media, filename)
         VALUES (?, ?, ?, '', 'Me', ?, ?, 'outgoing', 1, ?)`,
        [chatRow[0].id, messageId || `sent_file_${Date.now()}`, now, name, msgType, name]
      )
      persist()
    }

    return { ok: true }
  } catch (err) {
    return { ok: false, error: String(err) }
  }
}
