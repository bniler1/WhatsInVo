import { useState, useEffect } from 'react'
import type { SyncProgress } from '../../../shared/types'

const IDLE: SyncProgress = { status: 'idle', pct: 0, chatName: '', phase: '' }

export function useSyncState() {
  const [syncState, setSyncState] = useState<SyncProgress>(IDLE)

  useEffect(() => {
    window.api.sync.state().then(s => {
      if (s) setSyncState(s as SyncProgress)
    })
    const unsub = window.api.sync.onProgress((d) => setSyncState(d as SyncProgress))
    return unsub
  }, [])

  return syncState
}
