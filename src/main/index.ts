import { app, shell, BrowserWindow, protocol } from 'electron'
import { readFileSync, existsSync, statSync, openSync, readSync, closeSync } from 'fs'
import { extname, join } from 'path'
import { initDb } from './db'
import { registerIpcHandlers } from './ipc'
import { startOpenWA, stopOpenWA } from './whatsapp/process'

// Must be registered BEFORE app ready
protocol.registerSchemesAsPrivileged([
  { scheme: 'wa-media', privileges: { secure: true, standard: true, supportFetchAPI: true } }
])

const MIME: Record<string, string> = {
  jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', gif: 'image/gif',
  webp: 'image/webp', heic: 'image/heic', heif: 'image/heic', bmp: 'image/bmp',
  mp4: 'video/mp4', mov: 'video/quicktime', avi: 'video/x-msvideo',
  webm: 'video/webm', '3gp': 'video/3gpp', mkv: 'video/x-matroska',
  mp3: 'audio/mpeg', ogg: 'audio/ogg', opus: 'audio/ogg',
  wav: 'audio/wav', aac: 'audio/aac', m4a: 'audio/mp4',
  pdf: 'application/pdf'
}

function createWindow(): void {
  const mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    show: false,
    autoHideMenuBar: true,
    webPreferences: {
      preload: join(__dirname, '../preload/index.mjs'),
      sandbox: false,
      contextIsolation: true
    }
  })

  mainWindow.on('ready-to-show', () => {
    mainWindow.show()
  })

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  if (!app.isPackaged && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

app.whenReady().then(async () => {
  protocol.handle('wa-media', (request) => {
    try {
      const { pathname } = new URL(request.url)
      const filePath = decodeURIComponent(
        /^\/[A-Za-z]:/.test(pathname) ? pathname.slice(1) : pathname
      )
      if (!existsSync(filePath)) return new Response('Not found', { status: 404 })

      const ext = extname(filePath).slice(1).toLowerCase()
      const mime = MIME[ext] ?? 'application/octet-stream'
      const fileSize = statSync(filePath).size

      const rangeHeader = request.headers.get('Range')
      if (rangeHeader) {
        const match = rangeHeader.match(/bytes=(\d*)-(\d*)/)
        if (match) {
          const start = match[1] ? parseInt(match[1], 10) : 0
          const end   = match[2] ? Math.min(parseInt(match[2], 10), fileSize - 1) : fileSize - 1
          const chunkSize = end - start + 1
          const buf = Buffer.alloc(chunkSize)
          const fd = openSync(filePath, 'r')
          readSync(fd, buf, 0, chunkSize, start)
          closeSync(fd)
          return new Response(buf, {
            status: 206,
            headers: {
              'Content-Type': mime,
              'Content-Range': `bytes ${start}-${end}/${fileSize}`,
              'Accept-Ranges': 'bytes',
              'Content-Length': String(chunkSize),
            }
          })
        }
      }

      const buf = readFileSync(filePath)
      return new Response(buf, {
        headers: {
          'Content-Type': mime,
          'Accept-Ranges': 'bytes',
          'Content-Length': String(fileSize),
        }
      })
    } catch (e) {
      return new Response(String(e), { status: 500 })
    }
  })

  await initDb()
  registerIpcHandlers()
  createWindow()

  startOpenWA().catch(err => console.error('[OpenWA] Failed to start:', err))

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  stopOpenWA()
  if (process.platform !== 'darwin') app.quit()
})
