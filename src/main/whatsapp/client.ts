export interface WASettings {
  url: string
  apiKey: string
  sessionId: string
}

export interface WAContact {
  id: string
  name: string
  pushname: string
  number: string
  isGroup: boolean
  profilePicUrl?: string
}

export interface WAChat {
  id: string
  name: string
  isGroup: boolean
  unreadCount: number
  lastMessage?: { body: string; timestamp: number; fromMe: boolean }
  profilePicUrl?: string
}

export interface WAMessage {
  id: string
  body: string
  type: 'chat' | 'image' | 'video' | 'audio' | 'ptt' | 'document' | 'sticker' | 'unknown'
  fromMe: boolean
  from: string
  to: string
  timestamp: number
  hasMedia: boolean
  mediaUrl?: string
  filename?: string
  caption?: string
  mimetype?: string
  author?: string
}

export interface WASession {
  id: string
  name: string
  status: 'created' | 'initializing' | 'qr_ready' | 'authenticating' | 'ready' | 'disconnected' | 'failed'
  phone?: string | null
  pushName?: string | null
}

export class OpenWAClient {
  private base: string
  private headers: Record<string, string>
  private sessionName: string
  private sessionUuid: string | null = null

  constructor(settings: WASettings) {
    this.base = settings.url.replace(/\/$/, '') + '/api'
    this.headers = { 'Content-Type': 'application/json' }
    if (settings.apiKey) this.headers['x-api-key'] = settings.apiKey
    this.sessionName = settings.sessionId || 'default'
  }

  private async req<T>(path: string, opts?: RequestInit): Promise<T> {
    const res = await fetch(this.base + path, { headers: this.headers, ...opts })
    if (!res.ok) {
      const text = await res.text().catch(() => '')
      throw new Error(`OpenWA ${res.status}: ${text.slice(0, 200)}`)
    }
    return res.json() as Promise<T>
  }

  private async resolveUuid(): Promise<string> {
    if (this.sessionUuid) return this.sessionUuid
    const sessions = await this.listSessions()
    const match = sessions.find(s => s.name === this.sessionName)
    if (!match) throw new Error(`Session '${this.sessionName}' not found`)
    this.sessionUuid = match.id
    return this.sessionUuid
  }

  getSessionName(): string { return this.sessionName }
  clearUuidCache(): void { this.sessionUuid = null }

  async health(): Promise<boolean> {
    try {
      const res = await fetch(this.base + '/health', { signal: AbortSignal.timeout(3000) })
      return res.ok
    } catch { return false }
  }

  async createSession(): Promise<WASession> {
    const session = await this.req<WASession>(`/sessions`, {
      method: 'POST',
      body: JSON.stringify({ name: this.sessionName })
    })
    this.sessionUuid = session.id
    return session
  }

  async startSession(): Promise<WASession> {
    const uuid = await this.resolveUuid()
    return this.req(`/sessions/${uuid}/start`, { method: 'POST' })
  }

  async stopSession(): Promise<void> {
    const uuid = await this.resolveUuid()
    await this.req(`/sessions/${uuid}/stop`, { method: 'POST' })
  }

  async getSession(): Promise<WASession> {
    const uuid = await this.resolveUuid()
    return this.req(`/sessions/${uuid}`)
  }

  async getQR(): Promise<{ qrCode: string; status: string }> {
    const uuid = await this.resolveUuid()
    return this.req(`/sessions/${uuid}/qr`)
  }

  async listSessions(): Promise<WASession[]> {
    return this.req('/sessions')
  }

  async listContacts(): Promise<WAContact[]> {
    const uuid = await this.resolveUuid()
    return this.req(`/sessions/${uuid}/contacts`)
  }

  // Download media for a specific message by its WhatsApp ID (base64 returned)
  async downloadMessageMedia(
    messageId: string,
    chatId: string
  ): Promise<{ data: string; mimetype: string; filename: string } | null> {
    const uuid = await this.resolveUuid()
    return this.req(
      `/sessions/${uuid}/chats/${encodeURIComponent(chatId)}/messages/${encodeURIComponent(messageId)}/media`
    )
  }

  // Fetch chats directly from WhatsApp (not from OpenWA DB — use for initial sync)
  async listWhatsAppChats(): Promise<WAChat[]> {
    const uuid = await this.resolveUuid()
    return this.req(`/sessions/${uuid}/chats`)
  }

  // Fetch message history directly from WhatsApp for a specific chat
  async fetchChatMessages(chatId: string, limit = 100): Promise<WAMessage[]> {
    const uuid = await this.resolveUuid()
    return this.req(
      `/sessions/${uuid}/chats/${encodeURIComponent(chatId)}/messages?limit=${limit}`
    )
  }

  // Query OpenWA's stored messages (only useful for already-received messages)
  async listMessages(chatId: string, limit = 50, offset = 0): Promise<WAMessage[]> {
    const uuid = await this.resolveUuid()
    return this.req(
      `/sessions/${uuid}/messages?chatId=${encodeURIComponent(chatId)}&limit=${limit}&offset=${offset}`
    )
  }

  async downloadMedia(mediaUrl: string): Promise<Buffer> {
    const res = await fetch(mediaUrl, { headers: this.headers })
    if (!res.ok) throw new Error(`Media download failed: ${res.status}`)
    const buf = await res.arrayBuffer()
    return Buffer.from(buf)
  }

  async sendText(chatId: string, text: string): Promise<{ messageId: string }> {
    const uuid = await this.resolveUuid()
    return this.req(`/sessions/${uuid}/messages/send-text`, {
      method: 'POST',
      body: JSON.stringify({ chatId, text })
    })
  }

  async sendImage(chatId: string, url: string, caption = ''): Promise<{ messageId: string }> {
    const uuid = await this.resolveUuid()
    return this.req(`/sessions/${uuid}/messages/send-image`, {
      method: 'POST',
      body: JSON.stringify({ chatId, url, caption })
    })
  }

  async sendDocument(chatId: string, url: string, filename: string): Promise<{ messageId: string }> {
    const uuid = await this.resolveUuid()
    return this.req(`/sessions/${uuid}/messages/send-document`, {
      method: 'POST',
      body: JSON.stringify({ chatId, url, filename })
    })
  }

  async sendAudio(chatId: string, url: string): Promise<{ messageId: string }> {
    const uuid = await this.resolveUuid()
    return this.req(`/sessions/${uuid}/messages/send-audio`, {
      method: 'POST',
      body: JSON.stringify({ chatId, url })
    })
  }
}

let _client: OpenWAClient | null = null

export function getClient(): OpenWAClient {
  if (!_client) throw new Error('OpenWA client not initialised — call initClient() first')
  return _client
}

export function initClient(settings: WASettings): OpenWAClient {
  _client = new OpenWAClient(settings)
  return _client
}
