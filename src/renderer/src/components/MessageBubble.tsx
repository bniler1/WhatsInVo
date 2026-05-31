import type { DbMessage } from '../../../shared/types'
import { MediaViewer } from './MediaViewer'

function fmtTime(ts: number): string {
  return new Date(ts * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

export function MessageBubble({ msg }: { msg: DbMessage }) {
  const isMe = msg.direction === 'outgoing'

  const bubbleBase = `max-w-xs lg:max-w-sm xl:max-w-md px-3 py-2 rounded-2xl shadow-sm`
  const outgoing = 'bg-[#005c4b] text-[#e9edef]'
  const incoming = 'bg-[#202c33] text-[#e9edef]'

  if (msg.is_deleted) {
    return (
      <div className={`flex mb-0.5 px-3 ${isMe ? 'justify-end' : 'justify-start'}`}>
        <div className={`${bubbleBase} ${isMe ? outgoing : incoming} opacity-60`}>
          <p className="text-sm line-through whitespace-pre-wrap break-words">{msg.body}</p>
          <p className="text-[10px] italic text-gray-500 mt-0.5">(deletion on WhatsApp)</p>
          <div className="flex justify-end mt-0.5">
            <span className="text-[10px] text-gray-500">{fmtTime(msg.timestamp)}</span>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className={`flex mb-0.5 px-3 ${isMe ? 'justify-end' : 'justify-start'}`}>
      <div className={`${bubbleBase} ${isMe ? outgoing : incoming}`}>
        {!isMe && msg.sender_name && msg.sender_name !== msg.sender_wa_id && (
          <p className="text-xs font-semibold text-emerald-400 mb-1">{msg.sender_name}</p>
        )}

        {msg.has_media === 1 && <MediaViewer msg={msg} />}

        {msg.body && (
          <p className="text-sm whitespace-pre-wrap break-words">{msg.body}</p>
        )}

        {msg.caption && !msg.body && (
          <p className="text-xs text-gray-400 mt-0.5">{msg.caption}</p>
        )}

        <div className={`flex items-center gap-1 mt-0.5 ${isMe ? 'justify-end' : 'justify-start'}`}>
          <span className="text-[10px] text-gray-400">{fmtTime(msg.timestamp)}</span>
          {isMe && <span className="text-[10px] text-[#53bdeb]">✓✓</span>}
        </div>
      </div>
    </div>
  )
}
