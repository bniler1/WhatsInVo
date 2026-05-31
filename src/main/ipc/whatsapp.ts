import { ipcMain, dialog, shell } from 'electron'
import { readFileSync, existsSync } from 'fs'
import { basename } from 'path'
import { initClient, getClient } from '../whatsapp/client'
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

      connectEvents(cfg.url, cfg.sessionId)
      // Initial sync is triggered from events.ts when session.authenticated fires,
      // so it only runs after the session is confirmed connected.

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

export async function handleSendFile(chatId: string): Promise<{ ok: boolean; error?: string; cancelled?: boolean }> {
  const result = await dialog.showOpenDialog({
    title: 'Select file to send',
    filters: [
      { name: 'Images', extensions: ['jpg','jpeg','png','gif','webp'] },
      { name: 'Video', extensions: ['mp4','mov','avi','webm'] },
      { name: 'Audio', extensions: ['mp3','ogg','opus','wav','aac','m4a'] },
      { name: 'Documents', extensions: ['pdf','doc','docx','xls','xlsx','txt','zip'] },
      { name: 'All Files', extensions: ['*'] }
    ],
    properties: ['openFile']
  })
  if (result.canceled) return { ok: false, cancelled: true }

  const filePath = result.filePaths[0]
  const name = basename(filePath)
  const ext = name.split('.').pop()?.toLowerCase() ?? ''

  try {
    if (!existsSync(filePath)) return { ok: false, error: 'File not found' }
    const buf = readFileSync(filePath)
    const mime = getMime(ext)
    const dataUrl = `data:${mime};base64,${buf.toString('base64')}`

    const IMAGE_EXTS = /^(jpg|jpeg|png|gif|webp)$/
    const AUDIO_EXTS = /^(mp3|ogg|opus|wav|aac|m4a)$/

    const client = getClient()
    if (IMAGE_EXTS.test(ext)) {
      await client.sendImage(chatId, dataUrl)
    } else if (AUDIO_EXTS.test(ext)) {
      await client.sendAudio(chatId, dataUrl)
    } else {
      await client.sendDocument(chatId, dataUrl, name)
    }
    return { ok: true }
  } catch (err) {
    return { ok: false, error: String(err) }
  }
}
