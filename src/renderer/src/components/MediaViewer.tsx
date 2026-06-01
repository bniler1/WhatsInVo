import { useState } from 'react'
import type { DbMessage } from '../../../shared/types'

function buildMediaUrl(filePath: string): string {
  const normalized = filePath.replace(/\\/g, '/')
  const withoutDrive = normalized.replace(/^([A-Za-z]:)/, '/$1')
  return `wa-media://${withoutDrive}`
}

function fileIcon(filename: string): string {
  const ext = (filename.split('.').pop() ?? '').toLowerCase()
  if (['pdf'].includes(ext)) return '📄'
  if (['doc', 'docx'].includes(ext)) return '📝'
  if (['xls', 'xlsx'].includes(ext)) return '📊'
  if (['ppt', 'pptx'].includes(ext)) return '📑'
  if (['zip', 'rar', '7z'].includes(ext)) return '🗜️'
  return '📎'
}

interface Props {
  msg: DbMessage
  edgeToEdge?: boolean
}

export function MediaViewer({ msg, edgeToEdge }: Props) {
  const [lightbox, setLightbox] = useState(false)
  const filePath = msg.media_path
  const url = filePath ? buildMediaUrl(filePath) : null
  const mime  = msg.media_mime || msg.mime_type || ''
  const type  = msg.type
  const name  = msg.filename || ''

  // Media omitted / not downloaded
  if (!filePath) {
    const label = name
      ? `📎 ${name}`
      : type === 'image'    ? '🖼️ Photo'
      : type === 'video'    ? '🎬 Video'
      : type === 'audio' || type === 'ptt' ? '🎤 Voice message'
      : type === 'document' ? '📄 Document'
      : '📎 Attachment'
    return (
      <div className="flex items-center gap-2 m-2 px-3 py-2 bg-black/20 rounded-xl">
        <span className="text-base">{label.split(' ')[0]}</span>
        <span className="text-[12px] text-gray-400 italic truncate">{label.slice(2)} — not downloaded</span>
      </div>
    )
  }

  // ── Image / Sticker ────────────────────────────────────────────────────────
  if (type === 'image' || type === 'sticker' || mime.startsWith('image/')) {
    return (
      <>
        <img
          src={url!}
          alt={name || 'image'}
          onClick={() => setLightbox(true)}
          className={`block cursor-pointer object-cover ${edgeToEdge ? 'w-full max-h-72' : 'max-w-full max-h-64 rounded-lg m-2'}`}
          loading="lazy"
          style={edgeToEdge ? { borderRadius: 0 } : undefined}
        />
        {lightbox && (
          <div
            className="fixed inset-0 z-[9999] bg-black/95 flex items-center justify-center"
            onClick={() => setLightbox(false)}
          >
            <button
              className="absolute top-4 right-4 text-white text-3xl leading-none opacity-80 hover:opacity-100"
              onClick={() => setLightbox(false)}
            >✕</button>
            <img
              src={url!}
              alt={name || 'image'}
              className="max-w-[92vw] max-h-[92vh] object-contain rounded-lg shadow-2xl"
              onClick={e => e.stopPropagation()}
            />
          </div>
        )}
      </>
    )
  }

  // ── Video ──────────────────────────────────────────────────────────────────
  if (type === 'video' || mime.startsWith('video/')) {
    return (
      <video
        src={url!}
        controls
        className={`block bg-black ${edgeToEdge ? 'w-full max-h-72' : 'max-w-full max-h-64 rounded-lg m-2'}`}
        style={edgeToEdge ? { borderRadius: 0 } : undefined}
      />
    )
  }

  // ── Audio / Voice message ──────────────────────────────────────────────────
  if (type === 'audio' || type === 'ptt' || mime.startsWith('audio/')) {
    return (
      <div className="flex items-center gap-2 m-2 px-2 py-1.5 bg-black/20 rounded-xl">
        <span className="text-xl shrink-0">{type === 'ptt' ? '🎤' : '🎵'}</span>
        <audio src={url!} controls className="flex-1" style={{ height: 36, maxWidth: 230 }} />
      </div>
    )
  }

  // ── Document ───────────────────────────────────────────────────────────────
  if (type === 'document' || mime === 'application/pdf' || name) {
    return (
      <button
        onClick={() => window.api.chats.openFile(filePath)}
        className="flex items-center gap-3 m-2 px-3 py-2.5 bg-black/25 rounded-xl hover:bg-black/35 transition-colors text-left w-[calc(100%-16px)]"
      >
        <span className="text-2xl shrink-0">{fileIcon(name)}</span>
        <div className="min-w-0">
          <p className="text-[13px] text-[#e9edef] font-medium truncate">{name || 'Document'}</p>
          <p className="text-[11px] text-gray-400 uppercase">{name.split('.').pop() ?? 'file'}</p>
        </div>
      </button>
    )
  }

  return null
}
