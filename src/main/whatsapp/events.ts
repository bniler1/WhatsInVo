import { io, Socket } from 'socket.io-client'
import { BrowserWindow } from 'electron'
import { handleIncomingMessage, handleDeletedMessage } from '../sync/realtimeSync'
import { runInitialSync } from '../sync/initialSync'
import { queryOne } from '../db'
import type { WAMessage } from './client'

let socket: Socket | null = null
let currentSessionId = ''

function emit(channel: string, data: unknown) {
  const win = BrowserWindow.getAllWindows()[0]
  win?.webContents.send(channel, data)
}

export function connectEvents(baseUrl: string, sessionId: string): void {
  if (socket?.connected) disconnect()

  currentSessionId = sessionId
  const eventsUrl = baseUrl.replace(/\/$/, '').replace('/api', '') + '/events'

  socket = io(eventsUrl, {
    transports: ['websocket', 'polling'],
    reconnection: true,
    reconnectionDelay: 2000,
    reconnectionAttempts: 10
  })

  socket.on('connect', () => {
    console.log('[OpenWA] Socket connected')
    emit('wa:status', { connected: true })

    socket!.emit('message', {
      type: 'subscribe',
      sessionId,
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
    if (payload.sessionId !== currentSessionId) return

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
        emit('wa:authenticated', payload.data)
        // Trigger initial sync the first time a session is authenticated
        {
          const syncState = queryOne<{ last_full_sync_at: string | null }>(
            `SELECT last_full_sync_at FROM sync_state WHERE id = 1`
          )
          if (!syncState?.last_full_sync_at) {
            runInitialSync().catch(err => console.error('[InitialSync] Error:', err))
          }
        }
        break
      case 'session.disconnected':
        emit('wa:disconnected', payload.data)
        break
      case 'session.status':
        emit('wa:session-status', payload.data)
        break
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
