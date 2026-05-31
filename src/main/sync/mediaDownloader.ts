import { mkdirSync, writeFileSync } from 'fs'
import { join, extname } from 'path'
import { app } from 'electron'
import { getClient } from '../whatsapp/client'
import type { WAMessage } from '../whatsapp/client'

export async function downloadAndSaveMedia(
  msg: WAMessage,
  chatWaId: string
): Promise<string | null> {
  if (!msg.hasMedia) return null

  try {
    // Download media by message ID (historical messages have no mediaUrl)
    const result = await getClient().downloadMessageMedia(msg.id, chatWaId)
    if (!result || !result.data) return null

    const mediaRoot = join(app.getPath('userData'), 'media')
    const chatDir = join(mediaRoot, chatWaId.replace(/[^a-zA-Z0-9@._-]/g, '_'))
    mkdirSync(chatDir, { recursive: true })

    const mimetype = result.mimetype || msg.mimetype || ''
    const filename = result.filename || msg.filename || ''
    const ext = extname(filename) || guessExt(mimetype, msg.type)
    const localFilename = `${msg.timestamp}_${msg.id.slice(-8)}${ext}`
    const filePath = join(chatDir, localFilename)

    writeFileSync(filePath, Buffer.from(result.data, 'base64'))
    return filePath
  } catch (err) {
    console.error('[MediaDownloader] Failed for', msg.id, String(err))
    return null
  }
}

function guessExt(mimetype: string, type: string): string {
  if (mimetype) {
    const map: Record<string, string> = {
      'image/jpeg': '.jpg', 'image/png': '.png', 'image/gif': '.gif',
      'image/webp': '.webp', 'video/mp4': '.mp4', 'video/quicktime': '.mov',
      'audio/mpeg': '.mp3', 'audio/ogg': '.ogg', 'audio/wav': '.wav',
      'application/pdf': '.pdf', 'application/zip': '.zip',
      'application/msword': '.doc',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document': '.docx',
      'application/vnd.ms-excel': '.xls',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': '.xlsx',
    }
    if (map[mimetype]) return map[mimetype]
  }
  switch (type) {
    case 'image':    return '.jpg'
    case 'video':    return '.mp4'
    case 'audio':
    case 'ptt':      return '.ogg'
    case 'sticker':  return '.webp'
    case 'document': return '.bin'
    default:         return ''
  }
}
