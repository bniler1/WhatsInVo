import { useState, useEffect, useCallback } from 'react'
import type { DbMessage } from '../../../shared/types'

export function useMessages(chatWaId: string) {
  const [messages, setMessages] = useState<DbMessage[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!chatWaId) return
    setLoading(true)

    window.api.messages.list(chatWaId, 50).then(msgs => {
      setMessages([...msgs].reverse())
      setLoading(false)
    })
    window.api.chats.markRead(chatWaId)

    const unsubAppended = window.api.messages.onAppended((d) => {
      const data = d as { chatId: string }
      if (data.chatId !== chatWaId) return
      window.api.messages.list(chatWaId, 1).then(([newest]) => {
        if (newest) setMessages(prev => {
          if (prev.some(m => m.wa_message_id === newest.wa_message_id)) return prev
          return [...prev, newest]
        })
      })
    })

    const unsubUpdated = window.api.messages.onUpdated((d) => {
      const data = d as { waMessageId: string }
      setMessages(prev => prev.map(m =>
        m.wa_message_id === data.waMessageId
          ? { ...m, is_deleted: 1, deleted_at: new Date().toISOString() }
          : m
      ))
    })

    return () => {
      unsubAppended()
      unsubUpdated()
    }
  }, [chatWaId])

  const loadMore = useCallback(() => {
    const oldest = messages[0]?.timestamp
    if (!oldest) return
    window.api.messages.list(chatWaId, 50, oldest).then(older => {
      if (!older.length) return
      setMessages(prev => {
        const existingIds = new Set(prev.map(m => m.wa_message_id))
        const newOnes = [...older].reverse().filter(m => !existingIds.has(m.wa_message_id))
        return [...newOnes, ...prev]
      })
    })
  }, [chatWaId, messages])

  return { messages, loading, loadMore }
}
