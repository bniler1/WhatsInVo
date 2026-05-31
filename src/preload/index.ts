import { contextBridge, ipcRenderer } from 'electron'

contextBridge.exposeInMainWorld('api', {
  wa: {
    getSettings:    ()                                               => ipcRenderer.invoke('wa:get-settings'),
    saveSettings:   (s: unknown)                                     => ipcRenderer.invoke('wa:save-settings', s),
    connect:        ()                                               => ipcRenderer.invoke('wa:connect'),
    disconnect:     ()                                               => ipcRenderer.invoke('wa:disconnect'),
    status:         ()                                               => ipcRenderer.invoke('wa:status'),
    getQR:          ()                                               => ipcRenderer.invoke('wa:get-qr'),
    openDashboard:  ()                                               => ipcRenderer.invoke('wa:open-dashboard'),
    serverStatus:   ()                                               => ipcRenderer.invoke('wa:server-status'),
    serverRestart:  ()                                               => ipcRenderer.invoke('wa:server-restart'),
    onServerStatus: (cb: (d: unknown) => void) => { ipcRenderer.on('wa:server-status',   (_, d) => cb(d)); return () => ipcRenderer.removeAllListeners('wa:server-status') },
    onServerLog:    (cb: (d: unknown) => void) => { ipcRenderer.on('wa:server-log',      (_, d) => cb(d)); return () => ipcRenderer.removeAllListeners('wa:server-log') },
    onMessage:      (cb: (d: unknown) => void) => { ipcRenderer.on('wa:message',         (_, d) => cb(d)); return () => ipcRenderer.removeAllListeners('wa:message') },
    onQR:           (cb: (d: unknown) => void) => { ipcRenderer.on('wa:qr',              (_, d) => cb(d)); return () => ipcRenderer.removeAllListeners('wa:qr') },
    onAuth:         (cb: (d: unknown) => void) => { ipcRenderer.on('wa:authenticated',   (_, d) => cb(d)); return () => ipcRenderer.removeAllListeners('wa:authenticated') },
    onDisconnect:   (cb: (d: unknown) => void) => { ipcRenderer.on('wa:disconnected',    (_, d) => cb(d)); return () => ipcRenderer.removeAllListeners('wa:disconnected') },
    onStatus:       (cb: (d: unknown) => void) => { ipcRenderer.on('wa:status',          (_, d) => cb(d)); return () => ipcRenderer.removeAllListeners('wa:status') },
    onError:        (cb: (d: unknown) => void) => { ipcRenderer.on('wa:error',           (_, d) => cb(d)); return () => ipcRenderer.removeAllListeners('wa:error') },
    onSessionStatus:(cb: (d: unknown) => void) => { ipcRenderer.on('wa:session-status',  (_, d) => cb(d)); return () => ipcRenderer.removeAllListeners('wa:session-status') },
  },
  chats: {
    list:      ()                => ipcRenderer.invoke('chats:list'),
    markRead:  (waId: string)    => ipcRenderer.invoke('chats:mark-read', waId),
    onUpdated: (cb: (d: unknown) => void) => { ipcRenderer.on('wa:chat-updated', (_, d) => cb(d)); return () => ipcRenderer.removeAllListeners('wa:chat-updated') },
  },
  messages: {
    list:       (chatWaId: string, limit?: number, before?: number) => ipcRenderer.invoke('messages:list', chatWaId, limit, before),
    sendText:   (chatWaId: string, text: string)                    => ipcRenderer.invoke('messages:send-text', chatWaId, text),
    sendFile:   (chatWaId: string)                                  => ipcRenderer.invoke('messages:send-file', chatWaId),
    onAppended: (cb: (d: unknown) => void) => { ipcRenderer.on('wa:message-appended', (_, d) => cb(d)); return () => ipcRenderer.removeAllListeners('wa:message-appended') },
    onUpdated:  (cb: (d: unknown) => void) => { ipcRenderer.on('wa:message-updated',  (_, d) => cb(d)); return () => ipcRenderer.removeAllListeners('wa:message-updated') },
  },
  sync: {
    state:      ()  => ipcRenderer.invoke('sync:state'),
    runFull:    ()  => ipcRenderer.invoke('sync:run-full'),
    onProgress: (cb: (d: unknown) => void) => { ipcRenderer.on('sync:progress', (_, d) => cb(d)); return () => ipcRenderer.removeAllListeners('sync:progress') },
  }
})
