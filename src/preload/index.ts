import { contextBridge, ipcRenderer } from 'electron'

// Safe listener helper: adds a named listener and returns a cleanup that removes
// only THAT listener — not every listener on the channel (removeAllListeners is too broad).
function on(channel: string, cb: (d: unknown) => void): () => void {
  const handler = (_: Electron.IpcRendererEvent, d: unknown) => cb(d)
  ipcRenderer.on(channel, handler)
  return () => ipcRenderer.removeListener(channel, handler)
}

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
    onServerStatus: (cb: (d: unknown) => void) => on('wa:server-status',  cb),
    onServerLog:    (cb: (d: unknown) => void) => on('wa:server-log',     cb),
    onMessage:      (cb: (d: unknown) => void) => on('wa:message',        cb),
    onQR:           (cb: (d: unknown) => void) => on('wa:qr',             cb),
    onAuth:         (cb: (d: unknown) => void) => on('wa:authenticated',  cb),
    onDisconnect:   (cb: (d: unknown) => void) => on('wa:disconnected',   cb),
    onStatus:       (cb: (d: unknown) => void) => on('wa:status',         cb),
    onError:        (cb: (d: unknown) => void) => on('wa:error',          cb),
    onSessionStatus:(cb: (d: unknown) => void) => on('wa:session-status', cb),
  },
  chats: {
    list:           ()             => ipcRenderer.invoke('chats:list'),
    get:            (waId: string) => ipcRenderer.invoke('chats:get', waId),
    markRead:       (waId: string) => ipcRenderer.invoke('chats:mark-read', waId),
    openFile:       (path: string) => ipcRenderer.invoke('chats:open-file', path),
    integrityCheck: (waId: string) => ipcRenderer.invoke('chats:integrity-check', waId),
    retryMedia:     (waId: string) => ipcRenderer.invoke('chats:retry-media', waId),
    rename:         (waId: string, name: string) => ipcRenderer.invoke('chats:rename', waId, name),
    delete:         (waId: string) => ipcRenderer.invoke('chats:delete', waId),
    onUpdated:      (cb: (d: unknown) => void) => on('wa:chat-updated', cb),
  },
  messages: {
    list:         (chatWaId: string, limit?: number, before?: number)            => ipcRenderer.invoke('messages:list', chatWaId, limit, before),
    sendText:     (chatWaId: string, text: string)                              => ipcRenderer.invoke('messages:send-text', chatWaId, text),
    pickFileInfo: ()                                                             => ipcRenderer.invoke('messages:pick-file-info'),
    sendFile:     (chatWaId: string, filePath?: string, caption?: string)       => ipcRenderer.invoke('messages:send-file', chatWaId, filePath, caption),
    onAppended: (cb: (d: unknown) => void) => on('wa:message-appended', cb),
    onUpdated:  (cb: (d: unknown) => void) => on('wa:message-updated',  cb),
  },
  sync: {
    state:      ()  => ipcRenderer.invoke('sync:state'),
    runFull:    ()  => ipcRenderer.invoke('sync:run-full'),
    abort:      ()  => ipcRenderer.invoke('sync:abort'),
    onProgress: (cb: (d: unknown) => void) => on('sync:progress', cb),
  },
  import: {
    pickFile:   ()                                                          => ipcRenderer.invoke('import:pick-file'),
    run:        (path: string, mode: string, ownersName: string | null)     => ipcRenderer.invoke('import:run', path, mode, ownersName),
    onProgress: (cb: (d: unknown) => void) => on('import:progress', cb),
    onDone:     (cb: (d: unknown) => void) => on('import:done',     cb),
  },
})
