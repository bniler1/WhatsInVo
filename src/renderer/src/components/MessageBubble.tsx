import type { DbMessage } from '../../../shared/types'
import { MediaViewer } from './MediaViewer'

function fmtTime(ts: number): string {
  return new Date(ts * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

// Deterministic color per sender name — matches WhatsApp group chat coloring
const SENDER_COLORS = [
  '#FF6B6B', '#FF9F43', '#FECA57', '#48DBFB', '#FF9FF3',
  '#54A0FF', '#5F27CD', '#00D2D3', '#01ABC9', '#C8D6E5',
]
function senderColor(name: string): string {
  let h = 0
  for (let i = 0; i < name.length; i++) h = name.charCodeAt(i) + ((h << 5) - h)
  return SENDER_COLORS[Math.abs(h) % SENDER_COLORS.length]
}

interface Props {
  msg: DbMessage
  isGroup?: boolean
}

export function MessageBubble({ msg, isGroup }: Props) {
  const isMe = msg.direction === 'outgoing'
  const hasMedia = msg.has_media === 1
  const isVisualMedia = msg.type === 'image' || msg.type === 'video' || msg.type === 'sticker'

  // Bubble tail: pointed corner like WhatsApp
  const bubbleRadius = isMe
    ? 'rounded-tl-2xl rounded-tr-2xl rounded-bl-2xl rounded-br-[3px]'
    : 'rounded-tr-2xl rounded-tl-[3px] rounded-br-2xl rounded-bl-2xl'
  const bubbleColor  = isMe ? 'bg-[#005c4b]' : 'bg-[#202c33]'

  if (msg.is_deleted) {
    return (
      <div className={`flex mb-1 px-2 ${isMe ? 'justify-end' : 'justify-start'}`}>
        <div className={`${bubbleColor} ${bubbleRadius} px-3 py-2 max-w-[70%] opacity-60 shadow-sm`}>
          <p className="text-sm text-gray-400 italic">🚫 This message was deleted</p>
          <div className="flex justify-end mt-0.5">
            <span className="text-[11px] text-gray-500">{fmtTime(msg.timestamp)}</span>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className={`flex mb-[2px] px-2 ${isMe ? 'justify-end' : 'justify-start'}`}>
      <div
        className={`relative ${bubbleColor} ${bubbleRadius} max-w-[72%] shadow-sm overflow-hidden`}
        style={{ minWidth: 80 }}
      >
        {/* Sender name (groups, incoming only) */}
        {!isMe && isGroup && msg.sender_name && (
          <div className="px-3 pt-2 pb-0 leading-none">
            <span className="text-[12px] font-semibold leading-none" style={{ color: senderColor(msg.sender_name) }}>
              {msg.sender_name}
            </span>
          </div>
        )}

        {/* Media */}
        {hasMedia && (
          <MediaViewer msg={msg} edgeToEdge={isVisualMedia} />
        )}

        {/* Body text */}
        {msg.body && (
          <p className={`text-[14px] text-[#e9edef] whitespace-pre-wrap break-words leading-relaxed px-3 ${hasMedia && isVisualMedia ? 'pt-1' : 'pt-2'}`}>
            {msg.body}
          </p>
        )}

        {/* Caption (when media has a separate caption) */}
        {msg.caption && !msg.body && (
          <p className="text-[13px] text-[#e9edef] whitespace-pre-wrap break-words leading-relaxed px-3 pt-1">
            {msg.caption}
          </p>
        )}

        {/* Timestamp + delivery indicator */}
        <div className={`flex items-center justify-end gap-1 px-2 pb-1.5 ${(msg.body || msg.caption) ? 'pt-0.5' : (hasMedia ? 'pt-0.5' : 'pt-2')}`}>
          <span className="text-[11px] text-gray-400 select-none tabular-nums">{fmtTime(msg.timestamp)}</span>
          {isMe && <span className="text-[11px] text-[#53bdeb] select-none">✓✓</span>}
        </div>
      </div>
    </div>
  )
}
