import { mkdirSync, writeFileSync } from 'fs'
import { join, extname } from 'path'
import { app } from 'electron'
import { getClient } from '../whatsapp/client'
import type { WAMessage } from '../whatsapp/client'

export async function downloadAndSaveMedia(
  msg: WAMessage,
  chatWaId: string
): Promise<string | null> {
  if (!msg.mediaUrl) return null

  try {
    const buf = await getClient().downloadMedia(msg.mediaUrl)

    const mediaRoot = join(app.getPath('userData'), 'media')
    const chatDir = join(mediaRoot, chatWaId.replace(/[^a-zA-Z0-9@._-]/g, '_'))
    mkdirSync(chatDir, { recursive: true })

    const ext = extname(msg.filename || '') || guessExt(msg.mimetype || '', msg.type)
    const filename = `${msg.timestamp}_${msg.id.slice(-8)}${ext}`
    const filePath = join(chatDir, filename)

    writeFileSync(filePath, buf)
    return filePath
  } catch (err) {
    console.error('[MediaDownloader] Failed to download media for', msg.id, err)
    return null
  }
}

function guessExt(mimetype: string, type: string): string {
  if (mimetype) {
    const map: Record<string, string> = {
      'image/jpeg': '.jpg', 'image/png': '.png', 'image/gif': '.gif',
      'image/webp': '.webp', 'video/mp4': '.mp4', 'video/quicktime': '.mov',
      'audio/mpeg': '.mp3', 'audio/ogg': '.ogg', 'audio/wav': '.wav',
      'application/pdf': '.pdf'
    }
    if (map[mimetype]) return map[mimetype]
  }
  switch (type) {
    case 'image': return '.jpg'
    case 'video': return '.mp4'
    case 'audio': case 'ptt': return '.ogg'
    case 'sticker': return '.webp'
    case 'document': return '.bin'
    default: return ''
  }
}
