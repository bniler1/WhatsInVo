import { io, Socket } from 'socket.io-client'
import { BrowserWindow } from 'electron'
import { handleIncomingMessage, handleDeletedMessage } from '../sync/realtimeSync'
import { runInitialSync } from '../sync/initialSync'
import { queryOne } from '../db'
import type { WAMessage } from './client'

let socket: Socket | null = null
let currentSessionId = ''   // stores the session UUID after connectEvents() is called

function emit(channel: string, data: unknown) {
  const win = BrowserWindow.getAllWindows()[0]
  win?.webContents.send(channel, data)
}

function maybeSyncOnReady() {
  const syncState = queryOne<{ last_full_sync_at: string | null }>(
    `SELECT last_full_sync_at FROM sync_state WHERE id = 1`
  )
  if (!syncState?.last_full_sync_at) {
    console.log('[Events] Session ready — starting initial sync')
    runInitialSync().catch(err => console.error('[InitialSync] Error:', err))
  }
}

export function connectEvents(baseUrl: string, sessionUuid: string): void {
  if (socket?.connected) disconnect()

  // Store the UUID — OpenWA emits events with payload.sessionId = UUID
  currentSessionId = sessionUuid
  const eventsUrl = baseUrl.replace(/\/$/, '').replace('/api', '') + '/events'

  socket = io(eventsUrl, {
    transports: ['websocket', 'polling'],
    reconnection: true,
    reconnectionDelay: 2000,
    reconnectionAttempts: 10
  })

  socket.on('connect', () => {
    console.log('[OpenWA] Socket connected, subscribing for session', sessionUuid)
    emit('wa:status', { connected: true })

    // Subscribe using the UUID so OpenWA puts us in the right rooms
    socket!.emit('message', {
      type: 'subscribe',
      sessionId: sessionUuid,
      events: [
        'message.received',
        'message.sent',
        'message.ack',
        'message.deleted',
        'session.status',
        'session.qr',
        'session.authenticated',
        'session.disconnected'
      ]
    })
  })

  socket.on('disconnect', () => {
    console.log('[OpenWA] Socket disconnected')
    emit('wa:status', { connected: false })
  })

  socket.on('message', (data: { type: string; payload?: unknown }) => {
    if (data.type !== 'event') return
    const payload = data.payload as { event: string; sessionId: string; data: unknown }

    // Accept events whose sessionId matches the UUID we subscribed with
    if (payload.sessionId !== currentSessionId) {
      console.log(`[Events] Dropped event "${payload.event}" — sessionId ${payload.sessionId} !== ${currentSessionId}`)
      return
    }

    console.log(`[Events] Received: ${payload.event}`)

    switch (payload.event) {
      case 'message.received':
        handleIncomingMessage(payload.data as WAMessage)
        emit('wa:message', { incoming: true, data: payload.data })
        break
      case 'message.sent':
        handleIncomingMessage(payload.data as WAMessage)
        emit('wa:message', { incoming: false, data: payload.data })
        break
      case 'message.deleted':
        handleDeletedMessage(payload.data as { id?: string; messageId?: string })
        emit('wa:message-deleted', payload.data)
        break
      case 'session.qr':
        emit('wa:qr', payload.data)
        break
      case 'session.authenticated':
        // QR was scanned — close the modal; sync waits for 'ready'
        emit('wa:authenticated', payload.data)
        break
      case 'session.disconnected':
        emit('wa:disconnected', payload.data)
        break
      case 'session.status': {
        const statusData = payload.data as { status: string }
        emit('wa:session-status', payload.data)
        // 'ready' means the engine is fully connected and getChats() will work
        if (statusData.status === 'ready' || statusData.status === 'READY') {
          maybeSyncOnReady()
        }
        break
      }
    }
  })

  socket.on('connect_error', (err: Error) => {
    console.error('[OpenWA] Socket error:', err.message)
    emit('wa:error', { message: err.message })
  })
}

export function disconnect(): void {
  socket?.disconnect()
  socket = null
}

export function isConnected(): boolean {
  return socket?.connected ?? false
}
