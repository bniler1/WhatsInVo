import { registerWhatsAppHandlers } from './whatsapp'
import { registerChatHandlers } from './chats'
import { registerMessageHandlers } from './messages'
import { registerSyncHandlers } from './sync'

export function registerIpcHandlers(): void {
  registerWhatsAppHandlers()
  registerChatHandlers()
  registerMessageHandlers()
  registerSyncHandlers()
}
