import { mkdirSync, writeFileSync } from 'fs'
import { join, extname } from 'path'
import { app } from 'electron'
import { getClient } from '../whatsapp/client'
import type { WAMessage } from '../whatsapp/client'

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))

export async function downloadAndSaveMedia(
  msg: WAMessage,
  chatWaId: string,
  retries = 3
): Promise<string | null> {
  if (!msg.hasMedia) return null

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const result = await getClient().downloadMessageMedia(msg.id, chatWaId)
      if (!result || !result.data) return null   // media not available — don't retry

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
      const is429 = String(err).includes('429')
      if (is429 && attempt < retries) {
        const wait = 1500 * Math.pow(2, attempt)   // 1.5s, 3s, 6s
        console.warn(`[Media] 429 rate-limited for ${msg.id}, retrying in ${wait}ms (attempt ${attempt + 1}/${retries})`)
        await sleep(wait)
        continue
      }
      console.error('[Media] Failed for', msg.id, String(err))
      return null
    }
  }
  return null
}

export function guessMimeFromPath(filePath: string): string {
  const ext = extname(filePath).toLowerCase()
  const map: Record<string, string> = {
    '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png',
    '.gif': 'image/gif', '.webp': 'image/webp', '.heic': 'image/heic',
    '.mp4': 'video/mp4', '.mov': 'video/quicktime', '.avi': 'video/x-msvideo',
    '.webm': 'video/webm', '.3gp': 'video/3gpp',
    '.mp3': 'audio/mpeg', '.ogg': 'audio/ogg', '.opus': 'audio/ogg',
    '.wav': 'audio/wav', '.aac': 'audio/aac', '.m4a': 'audio/mp4',
    '.pdf': 'application/pdf', '.doc': 'application/msword',
    '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    '.xls': 'application/vnd.ms-excel',
    '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    '.zip': 'application/zip',
  }
  return map[ext] || 'application/octet-stream'
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
