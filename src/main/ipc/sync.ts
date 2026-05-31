import { ipcMain } from 'electron'
import { queryOne } from '../db'
import { runInitialSync } from '../sync/initialSync'
import type { SyncProgress } from '../../shared/types'

export function registerSyncHandlers(): void {
  ipcMain.handle('sync:state', () => {
    return queryOne<SyncProgress>(`SELECT * FROM sync_state WHERE id = 1`)
  })

  ipcMain.handle('sync:run-full', async () => {
    try {
      await runInitialSync()
      return { ok: true }
    } catch (err) {
      return { ok: false, error: String(err) }
    }
  })
}
