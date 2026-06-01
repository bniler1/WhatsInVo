/**
 * WhatsApp Chat Importer
 *
 * Accepts a .zip export, a .txt export, or a folder containing both.
 * Parses messages, creates a dedicated folder per chat under
 * userData/chats/<name>/, copies all media there, and writes to the
 * WhatsInVo SQLite database.
 *
 * Supports two modes:
 *   append    – INSERT OR IGNORE (keeps existing messages, adds new ones)
 *   overwrite – deletes all existing messages for the chat first
 */

import AdmZip from 'adm-zip'
import {
  existsSync, mkdirSync, readdirSync, copyFileSync,
  writeFileSync, statSync, readFileSync,
} from 'fs'
import { join, basename, extname } from 'path'
import { app, BrowserWindow } from 'electron'
import { db, persist, queryOne, run } from '../db'

// ── types ─────────────────────────────────────────────────────────────────────

export type ImportMode = 'append' | 'overwrite'

export interface ImportProgress {
  phase: string
  current: number
  total: number
  pct: number
}

export interface ImportResult {
  ok: boolean
  chatName: string
  waId: string
  messagesImported: number
  mediaImported: number
  error?: string
}

interface ParsedMessage {
  index: number
  timestamp: number    // unix seconds
  senderName: string
  body: string
  isMedia: boolean
  mediaFilename?: string   // filename as referenced in the chat text
}

// ── WhatsApp line format ──────────────────────────────────────────────────────

// Handles all common regional formats:
//  [12/25/23, 9:05:32 AM] Alice: text
//  12/25/23, 9:05 AM - Alice: text
//  [25/12/2023, 09:05:32] Alice: text
//  [2023-12-25, 09:05:32] Alice: text
const WA_LINE_RE =
  /^(?:\[)?(\d{1,4}[\/\-.]\d{1,2}[\/\-.]\d{2,4},?\s*\d{1,2}:\d{2}(?::\d{2})?(?:\s*[AP]M)?)(?:\])?\s*[-–]\s*([^:]+?):\s*([\s\S]*)$/i

const MEDIA_FILENAME_RE =
  /([A-Za-z0-9_\-]+\.(?:jpg|jpeg|png|gif|webp|heic|mp4|mov|3gp|avi|opus|ogg|aac|mp3|m4a|wav|pdf|docx?|xlsx?|pptx?|zip|txt))\s*(?:\(file attached\))?/i

const OMITTED_RE =
  /‎?(?:image|video|audio|document|sticker|GIF|voice message)\s+omitted/i

function parseWaTimestamp(raw: string): number {
  const s = raw
    .replace(/[.\-]/g, '/')
    .replace(/,\s*/, ' ')
    .replace(/(\d)(AM|PM)/i, '$1 $2')
  const d = new Date(s)
  return isNaN(d.getTime()) ? Math.floor(Date.now() / 1000) : Math.floor(d.getTime() / 1000)
}

function parseChatText(text: string): ParsedMessage[] {
  const lines = text.split(/\r?\n/)
  const messages: ParsedMessage[] = []
  let current: ParsedMessage | null = null
  let index = 0

  for (const line of lines) {
    const m = line.match(WA_LINE_RE)
    if (m) {
      if (current) messages.push(current)
      const [, dateStr, sender, body] = m
      const isMedia =
        OMITTED_RE.test(body) ||
        /attached:\s*\S+/i.test(body) ||
        MEDIA_FILENAME_RE.test(body)
      const mediaFilename = isMedia ? (body.match(MEDIA_FILENAME_RE)?.[1]) : undefined

      current = {
        index: index++,
        timestamp: parseWaTimestamp(dateStr),
        senderName: sender.trim(),
        body: body.trim(),
        isMedia,
        mediaFilename,
      }
    } else if (current && line.trim()) {
      current.body += '\n' + line
    }
  }
  if (current) messages.push(current)
  return messages
}

// ── helpers ───────────────────────────────────────────────────────────────────

const ME_LABELS = new Set(['me', 'you', 'eu', 'moi'])

function isOutgoing(senderName: string, ownersName: string | null): boolean {
  const s = senderName.trim().toLowerCase()
  return ME_LABELS.has(s) || (ownersName ? s === ownersName.toLowerCase() : false)
}

function sanitizeFolderName(name: string): string {
  return name.replace(/[<>:"/\\|?*\x00-\x1F]/g, '_').trim().slice(0, 60) || 'Imported Chat'
}

function chatWaId(chatName: string): string {
  return `import:${sanitizeFolderName(chatName).replace(/\s+/g, '_').toLowerCase()}`
}

function emitProgress(p: ImportProgress): void {
  BrowserWindow.getAllWindows()[0]?.webContents.send('import:progress', p)
}

// ── ZIP extraction ────────────────────────────────────────────────────────────

function extractZip(
  zipPath: string,
  destDir: string,
  onProgress: (done: number, total: number) => void
): string | null {
  mkdirSync(destDir, { recursive: true })
  const zip = new AdmZip(zipPath)
  const entries = zip.getEntries()
  let chatTxt: string | null = null

  entries.forEach((entry, i) => {
    onProgress(i + 1, entries.length)
    if (entry.isDirectory) return
    const name = basename(entry.entryName)
    const dest = join(destDir, name)
    zip.extractEntryTo(entry, destDir, false, true)
    if (/\.txt$/i.test(name) && !chatTxt) chatTxt = dest
  })
  return chatTxt
}

// ── DB writers ────────────────────────────────────────────────────────────────

function upsertImportedChat(chatName: string): { id: number; waId: string } {
  const importWaId = chatWaId(chatName)

  // 1. Exact wa_id match (previous import of same chat)
  const byImportId = queryOne<{ id: number }>(`SELECT id FROM chats WHERE wa_id = ?`, [importWaId])
  if (byImportId) return { id: byImportId.id, waId: importWaId }

  // 2. Match an existing live-synced chat by name — return its actual wa_id so navigation lands correctly
  const byName = queryOne<{ id: number; wa_id: string }>(
    `SELECT id, wa_id FROM chats WHERE lower(trim(name)) = lower(trim(?))`,
    [chatName]
  )
  if (byName) return { id: byName.id, waId: byName.wa_id }

  // 3. Create a new imported chat
  const id = run(`INSERT INTO chats (wa_id, name, is_group) VALUES (?, ?, 0)`, [importWaId, chatName])
  return { id, waId: importWaId }
}

function clearChatMessages(chatId: number): void {
  db.run(`DELETE FROM messages WHERE chat_id = ?`, [chatId])
}

function insertImportedMessage(
  chatId: number,
  msg: ParsedMessage,
  localMediaPath: string | null,
  ownersName: string | null
): void {
  const waId = `imp_${chatId}_${msg.index}_${msg.timestamp}`
  const direction = isOutgoing(msg.senderName, ownersName) ? 'outgoing' : 'incoming'
  const type = msg.isMedia ? guessType(msg.mediaFilename || '') : 'chat'

  const msgRowId = run(
    `INSERT OR IGNORE INTO messages
       (chat_id, wa_message_id, timestamp, sender_name, body, type, direction, has_media, filename)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [chatId, waId, msg.timestamp, msg.senderName, msg.body, type, direction,
     localMediaPath ? 1 : 0, msg.mediaFilename || '']
  )

  if (localMediaPath && msgRowId) {
    const mime = guessMime(localMediaPath)
    let size = 0
    try { size = statSync(localMediaPath).size } catch {}
    const mediaId = run(
      `INSERT INTO media (message_id, file_path, mime_type, file_size, original_name)
       VALUES (?, ?, ?, ?, ?)`,
      [msgRowId, localMediaPath, mime, size, basename(localMediaPath)]
    )
    db.run(`UPDATE messages SET media_id = ? WHERE id = ?`, [mediaId, msgRowId])
  }
}

function updateChatMeta(chatId: number): void {
  const last = queryOne<{ timestamp: number; body: string }>(
    `SELECT timestamp, body FROM messages WHERE chat_id = ? ORDER BY timestamp DESC LIMIT 1`,
    [chatId]
  )
  if (last) {
    db.run(
      `UPDATE chats SET last_message_at = ?, last_message_preview = ? WHERE id = ?`,
      [last.timestamp, last.body.slice(0, 100), chatId]
    )
  }
}

// ── mime / type helpers ───────────────────────────────────────────────────────

function guessType(filename: string): string {
  const ext = extname(filename).toLowerCase()
  if (/\.(jpg|jpeg|png|gif|webp|heic|bmp)$/.test(ext)) return 'image'
  if (/\.(mp4|mov|avi|3gp|webm|mkv)$/.test(ext)) return 'video'
  if (/\.(mp3|opus|ogg|aac|m4a|wav)$/.test(ext)) return 'audio'
  if (/\.(pdf|doc|docx|xls|xlsx|ppt|pptx|txt|zip)$/.test(ext)) return 'document'
  return 'document'
}

function guessMime(filepath: string): string {
  const ext = extname(filepath).toLowerCase()
  const map: Record<string, string> = {
    '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png',
    '.gif': 'image/gif', '.webp': 'image/webp', '.heic': 'image/heic',
    '.mp4': 'video/mp4', '.mov': 'video/quicktime', '.avi': 'video/x-msvideo',
    '.mp3': 'audio/mpeg', '.ogg': 'audio/ogg', '.opus': 'audio/ogg',
    '.aac': 'audio/aac', '.m4a': 'audio/mp4', '.wav': 'audio/wav',
    '.pdf': 'application/pdf',
    '.doc': 'application/msword',
    '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    '.xls': 'application/vnd.ms-excel',
    '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    '.zip': 'application/zip',
    '.txt': 'text/plain',
  }
  return map[ext] || 'application/octet-stream'
}

// ── main export ───────────────────────────────────────────────────────────────

export async function importChat(
  sourcePath: string,
  mode: ImportMode,
  ownersName: string | null = null
): Promise<ImportResult> {
  const chatsRoot = join(app.getPath('userData'), 'chats')
  mkdirSync(chatsRoot, { recursive: true })

  // ── Phase 1: locate chat.txt and media ──────────────────────────────────────

  let chatTxtPath: string | null = null
  let mediaSourceDir: string | null = null
  let chatName = 'Imported Chat'
  const ext = extname(sourcePath).toLowerCase()

  emitProgress({ phase: 'Preparing files…', current: 0, total: 1, pct: 2 })

  if (ext === '.zip') {
    const tmpDir = join(app.getPath('temp'), `whatsinvo_import_${Date.now()}`)
    chatTxtPath = extractZip(sourcePath, tmpDir, (done, total) => {
      emitProgress({
        phase: 'Extracting ZIP…',
        current: done, total,
        pct: Math.round((done / total) * 20),
      })
    })
    mediaSourceDir = tmpDir
    chatName = basename(sourcePath, '.zip')
      .replace(/^WhatsApp Chat with /i, '').trim()

  } else if (ext === '.txt') {
    chatTxtPath = sourcePath
    mediaSourceDir = join(sourcePath, '..')
    chatName = basename(sourcePath, '.txt')
      .replace(/^WhatsApp Chat with /i, '').trim()

  } else {
    // Folder — look for a .txt file inside
    const files = readdirSync(sourcePath)
    const txt = files.find(f => /\.txt$/i.test(f))
    if (!txt) return { ok: false, chatName: '', waId: '', messagesImported: 0, mediaImported: 0, error: 'No .txt file found in folder' }
    chatTxtPath = join(sourcePath, txt)
    mediaSourceDir = sourcePath
    chatName = basename(sourcePath)
  }

  if (!chatTxtPath || !existsSync(chatTxtPath)) {
    return { ok: false, chatName: '', waId: '', messagesImported: 0, mediaImported: 0, error: 'Could not find chat text file' }
  }

  // ── Phase 2: parse messages ──────────────────────────────────────────────────

  emitProgress({ phase: 'Parsing messages…', current: 0, total: 1, pct: 25 })
  const chatText = readFileSync(chatTxtPath, 'utf-8')
  const messages = parseChatText(chatText)

  if (messages.length === 0) {
    return { ok: false, chatName, waId: '', messagesImported: 0, mediaImported: 0, error: 'No messages found in the chat file' }
  }

  // ── Phase 3: create per-chat folder ─────────────────────────────────────────

  const folderName = sanitizeFolderName(chatName)
  const chatFolder = join(chatsRoot, folderName)
  mkdirSync(chatFolder, { recursive: true })

  // Copy the original txt into the chat folder for reference
  try { copyFileSync(chatTxtPath, join(chatFolder, 'chat.txt')) } catch {}

  // ── Phase 4: match and copy media files ─────────────────────────────────────

  emitProgress({ phase: 'Indexing media files…', current: 0, total: 1, pct: 30 })

  // Build a map: lowercase filename → absolute source path
  const mediaMap = new Map<string, string>()
  if (mediaSourceDir && existsSync(mediaSourceDir)) {
    try {
      const allFiles = readdirSync(mediaSourceDir)
      for (const f of allFiles) {
        if (/\.(jpg|jpeg|png|gif|webp|heic|mp4|mov|3gp|opus|ogg|aac|mp3|m4a|wav|pdf|docx?|xlsx?|pptx?|zip)$/i.test(f)) {
          mediaMap.set(f.toLowerCase(), join(mediaSourceDir, f))
        }
      }
    } catch {}
  }

  // For each media message, copy the file to chatFolder
  const localMediaPaths = new Map<number, string>()  // msg.index → local path
  const mediaMessages = messages.filter(m => m.isMedia)
  let mediaCopied = 0

  // Assign files to messages (by filename or sequentially)
  const unusedFiles = new Set(mediaMap.keys())

  for (const msg of mediaMessages) {
    const fn = msg.mediaFilename?.toLowerCase()
    const srcPath = fn ? mediaMap.get(fn) : undefined

    if (srcPath && unusedFiles.has(fn!)) {
      const destPath = join(chatFolder, basename(srcPath))
      try { copyFileSync(srcPath, destPath); mediaCopied++ } catch {}
      localMediaPaths.set(msg.index, destPath)
      unusedFiles.delete(fn!)
    }
  }

  // Sequential fallback: assign remaining unmatched media messages to unused files in order
  const unmatched = mediaMessages.filter(m => !localMediaPaths.has(m.index))
  const remainingFiles = [...unusedFiles].sort()
  for (let i = 0; i < unmatched.length && i < remainingFiles.length; i++) {
    const srcPath = mediaMap.get(remainingFiles[i])!
    const destPath = join(chatFolder, basename(srcPath))
    try { copyFileSync(srcPath, destPath); mediaCopied++ } catch {}
    localMediaPaths.set(unmatched[i].index, destPath)
  }

  // ── Phase 5: write to DB ─────────────────────────────────────────────────────

  const { id: chatId, waId: actualWaId } = upsertImportedChat(chatName)
  if (mode === 'overwrite') clearChatMessages(chatId)

  let msgCount = 0
  for (let i = 0; i < messages.length; i++) {
    if (i % 50 === 0) {
      emitProgress({
        phase: 'Saving messages…',
        current: i, total: messages.length,
        pct: 40 + Math.round((i / messages.length) * 55),
      })
    }
    const msg = messages[i]
    const mediaPath = localMediaPaths.get(msg.index) ?? null
    insertImportedMessage(chatId, msg, mediaPath, ownersName)
    msgCount++
  }

  updateChatMeta(chatId)
  persist()

  emitProgress({ phase: 'Done', current: messages.length, total: messages.length, pct: 100 })

  const win = BrowserWindow.getAllWindows()[0]
  win?.webContents.send('wa:chat-updated', {})
  win?.webContents.send('import:done', { chatName, waId: actualWaId, messagesImported: msgCount, mediaImported: mediaCopied })

  return { ok: true, chatName, waId: actualWaId, messagesImported: msgCount, mediaImported: mediaCopied }
}
