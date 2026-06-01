/// <reference types="vite/client" />

import type { DbChat, DbMessage, SyncProgress } from '../../shared/types'

declare global {
// eslint-disable-next-line @typescript-eslint/no-empty-interface
interface Window {
  api: {
    wa: {
      getSettings(): Promise<{ url: string; apiKey: string; sessionId: string }>
      saveSettings(s: { url: string; apiKey: string; sessionId: string }): Promise<unknown>
      connect(): Promise<{ ok: boolean; error?: string; session?: unknown }>
      disconnect(): Promise<{ ok: boolean; error?: string }>
      status(): Promise<{ connected: boolean; socketConnected: boolean; session?: unknown }>
      getQR(): Promise<{ ok: boolean; qrCode?: string; error?: string }>
      openDashboard(): Promise<void>
      serverStatus(): Promise<{ status: string; url: string }>
      serverRestart(): Promise<{ status: string }>
      onServerStatus(cb: (d: unknown) => void): () => void
      onServerLog(cb: (d: unknown) => void): () => void
      onMessage(cb: (d: unknown) => void): () => void
      onQR(cb: (d: unknown) => void): () => void
      onAuth(cb: (d: unknown) => void): () => void
      onDisconnect(cb: (d: unknown) => void): () => void
      onStatus(cb: (d: unknown) => void): () => void
      onError(cb: (d: unknown) => void): () => void
      onSessionStatus(cb: (d: unknown) => void): () => void
    }
    chats: {
      list(): Promise<DbChat[]>
      get(waId: string): Promise<DbChat | undefined>
      markRead(waId: string): Promise<{ ok: boolean }>
      openFile(path: string): Promise<{ ok: boolean; error?: string }>
      retryMedia(waId: string): Promise<{ ok: boolean; total: number; downloaded: number; failed: number; error?: string }>
      integrityCheck(waId: string): Promise<{
        ok: boolean; error?: string
        dbMessages: number; txtMessages: number | null
        mediaInDb: number; mediaOnDisk: number; mediaMissing: number; mediaOmitted: number
        integrity: 'complete' | 'incomplete' | 'unknown'
      }>
      rename(waId: string, name: string): Promise<{ ok: boolean; error?: string }>
      delete(waId: string): Promise<{ ok: boolean; error?: string }>
      onUpdated(cb: (d: unknown) => void): () => void
    }
    messages: {
      list(chatWaId: string, limit?: number, before?: number): Promise<DbMessage[]>
      sendText(chatWaId: string, text: string): Promise<{ ok: boolean; error?: string }>
      pickFileInfo(): Promise<{ path: string; name: string; ext: string; type: 'image'|'video'|'audio'|'document' } | null>
      sendFile(chatWaId: string, filePath?: string, caption?: string): Promise<{ ok: boolean; error?: string; cancelled?: boolean }>
      onAppended(cb: (d: unknown) => void): () => void
      onUpdated(cb: (d: unknown) => void): () => void
    }
    sync: {
      state(): Promise<SyncProgress>
      runFull(): Promise<{ ok: boolean; error?: string }>
      abort(): Promise<{ ok: boolean }>
      onProgress(cb: (d: unknown) => void): () => void
    }
    import: {
      pickFile(): Promise<string | null>
      run(path: string, mode: string, ownersName: string | null): Promise<{
        ok: boolean; chatName: string; waId: string; messagesImported: number; mediaImported: number; error?: string
      }>
      onProgress(cb: (d: unknown) => void): () => void
      onDone(cb: (d: unknown) => void): () => void
    }
  }
}
}
