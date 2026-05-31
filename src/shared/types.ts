export interface DbContact {
  id: number
  wa_id: string
  name: string
  push_name: string
  phone: string
  avatar_path: string | null
  updated_at: string
}

export interface DbChat {
  id: number
  wa_id: string
  name: string
  contact_id: number | null
  is_group: number
  last_message_at: number | null
  last_message_preview: string
  unread_count: number
  synced_at: string | null
  created_at: string
  avatar_path?: string | null
}

export interface DbMessage {
  id: number
  chat_id: number
  wa_message_id: string
  timestamp: number
  sender_wa_id: string
  sender_name: string
  body: string
  type: string
  direction: 'incoming' | 'outgoing'
  has_media: number
  media_id: number | null
  media_path?: string | null
  media_mime?: string | null
  caption: string | null
  filename: string | null
  mime_type: string
  is_deleted: number
  deleted_at: string | null
  created_at: string
}

export interface DbMedia {
  id: number
  message_id: number
  file_path: string
  mime_type: string
  file_size: number
  original_name: string
  created_at: string
}

export interface SyncProgress {
  status: 'idle' | 'syncing' | 'done' | 'error'
  pct: number
  chatName: string
  phase: string
}
