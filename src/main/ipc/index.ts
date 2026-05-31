import { registerWhatsAppHandlers } from './whatsapp'
import { registerChatHandlers } from './chats'
import { registerMessageHandlers } from './messages'
import { registerSyncHandlers } from './sync'
import { registerImportHandlers } from './import'

export function registerIpcHandlers(): void {
  registerWhatsAppHandlers()
  registerChatHandlers()
  registerMessageHandlers()
  registerSyncHandlers()
  registerImportHandlers()
}
