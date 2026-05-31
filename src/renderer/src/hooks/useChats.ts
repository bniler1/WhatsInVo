import { useState, useEffect, useCallback } from 'react'
import type { DbChat } from '../../../shared/types'

export function useChats() {
  const [chats, setChats] = useState<DbChat[]>([])
  const [loading, setLoading] = useState(true)

  const refresh = useCallback(() => {
    window.api.chats.list().then(c => {
      setChats(c)
      setLoading(false)
    })
  }, [])

  useEffect(() => {
    refresh()
    // IPC events from main process
    const unsubSync   = window.api.chats.onUpdated(() => refresh())
    const unsubImport = window.api.import.onDone(() => refresh())
    // DOM event dispatched by ImportModal "View Chat" button (belt-and-suspenders)
    const domHandler = () => refresh()
    window.addEventListener('whatsinvo:chats-changed', domHandler)
    return () => {
      unsubSync()
      unsubImport()
      window.removeEventListener('whatsinvo:chats-changed', domHandler)
    }
  }, [refresh])

  return { chats, loading, refresh }
}
