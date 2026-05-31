import type { DbMessage } from '../../../shared/types'

function buildMediaUrl(filePath: string): string {
  const normalized = filePath.replace(/\\/g, '/')
  const withoutDrive = normalized.replace(/^([A-Za-z]):/, '/$1:')
  return `wa-media://${withoutDrive}`
}

export function MediaViewer({ msg }: { msg: DbMessage }) {
  const filePath = msg.media_path
  if (!filePath) return null

  const url = buildMediaUrl(filePath)
  const mime = msg.media_mime || msg.mime_type || ''
  const type = msg.type

  if (type === 'image' || type === 'sticker' || mime.startsWith('image/')) {
    return (
      <img
        src={url}
        alt={msg.filename || 'image'}
        className="rounded-lg max-w-full max-h-64 mb-1 object-contain"
        loading="lazy"
      />
    )
  }

  if (type === 'video' || mime.startsWith('video/')) {
    return (
      <video
        src={url}
        controls
        className="rounded-lg max-w-full max-h-64 mb-1"
      />
    )
  }

  if (type === 'audio' || type === 'ptt' || mime.startsWith('audio/')) {
    return (
      <audio src={url} controls className="w-full mb-1" style={{ maxWidth: 260 }} />
    )
  }

  if (type === 'document' || mime === 'application/pdf') {
    return (
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        className="flex items-center gap-2 p-2 bg-black/20 rounded-lg mb-1 text-sm text-blue-400 hover:text-blue-300 transition-colors"
      >
        <span>📎</span>
        <span className="truncate">{msg.filename || 'document'}</span>
      </a>
    )
  }

  return null
}
