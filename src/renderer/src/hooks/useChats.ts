import { useState, useEffect } from 'react'
import type { DbChat } from '../../../shared/types'

export function useChats() {
  const [chats, setChats] = useState<DbChat[]>([])
  const [loading, setLoading] = useState(true)

  const refresh = () => {
    window.api.chats.list().then(c => {
      setChats(c)
      setLoading(false)
    })
  }

  useEffect(() => {
    refresh()
    const unsub = window.api.chats.onUpdated(() => refresh())
    return unsub
  }, [])

  return { chats, loading, refresh }
}
