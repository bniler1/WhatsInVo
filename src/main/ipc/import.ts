import { ipcMain, dialog } from 'electron'
import { importChat } from '../importer/chatImporter'
import type { ImportMode } from '../importer/chatImporter'

export function registerImportHandlers(): void {

  // Open a file/folder picker and return the selected path
  ipcMain.handle('import:pick-file', async () => {
    const result = await dialog.showOpenDialog({
      title: 'Select WhatsApp Chat Export',
      filters: [
        { name: 'WhatsApp Export', extensions: ['zip', 'txt'] },
        { name: 'All Files', extensions: ['*'] },
      ],
      properties: ['openFile'],
    })
    if (result.canceled || !result.filePaths.length) return null
    return result.filePaths[0]
  })

  // Run the import (called after user confirms in the modal)
  ipcMain.handle(
    'import:run',
    async (_, filePath: string, mode: ImportMode, ownersName: string | null) => {
      try {
        return await importChat(filePath, mode, ownersName)
      } catch (err) {
        return {
          ok: false,
          chatName: '',
          messagesImported: 0,
          mediaImported: 0,
          error: String(err),
        }
      }
    }
  )
}
