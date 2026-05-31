import { spawn, ChildProcess, execFileSync } from 'child_process'
import { existsSync, mkdirSync, writeFileSync, readFileSync } from 'fs'
import { join, resolve } from 'path'
import { app, BrowserWindow } from 'electron'

const PORT = 3785
const BASE_URL = `http://localhost:${PORT}`

let proc: ChildProcess | null = null
let _status: 'stopped' | 'starting' | 'running' | 'error' = 'stopped'

function getOpenWADir(): string {
  const devPath = resolve(join(__dirname, '../../openwa'))
  if (existsSync(devPath)) return devPath
  const prodPath = join(process.resourcesPath, 'openwa')
  if (existsSync(prodPath)) return prodPath
  throw new Error(`OpenWA not found at:\n  ${devPath}\n  ${prodPath}`)
}

function findNode(): string {
  const candidates = process.platform === 'win32' ? ['node.exe', 'node'] : ['node']
  for (const n of candidates) {
    try {
      execFileSync(n, ['--version'], { stdio: 'pipe' })
      return n
    } catch {}
  }
  throw new Error('Node.js not found in PATH — required to run OpenWA')
}

function emit(event: string, data: unknown) {
  BrowserWindow.getAllWindows()[0]?.webContents.send(event, data)
}

export function getServerStatus() { return _status }
export function getServerUrl()    { return BASE_URL }

async function waitReady(timeoutMs = 90_000): Promise<void> {
  const healthUrl = `${BASE_URL}/api/health`
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    try {
      const res = await fetch(healthUrl, { signal: AbortSignal.timeout(2000) })
      if (res.ok) return
    } catch {}
    await new Promise(r => setTimeout(r, 2000))
  }
  throw new Error(`OpenWA did not become ready within ${timeoutMs / 1000}s (checked ${healthUrl})`)
}

export async function startOpenWA(): Promise<void> {
  if (_status === 'running') return

  try {
    const probe = await fetch(`${BASE_URL}/api/health`, { signal: AbortSignal.timeout(2000) })
    if (probe.ok) {
      _status = 'running'
      emit('wa:server-status', { status: 'running', url: BASE_URL })
      console.log('[OpenWA] Reusing already-running instance at', BASE_URL)
      return
    }
  } catch {}

  _status = 'starting'
  emit('wa:server-status', { status: 'starting' })

  const dir = getOpenWADir()
  const distMain = join(dir, 'dist', 'main.js')

  if (!existsSync(distMain)) {
    emit('wa:server-status', { status: 'error', error: 'OpenWA dist/main.js not found — run npm run build inside openwa/' })
    _status = 'error'
    return
  }

  mkdirSync(join(dir, 'data', 'sessions'), { recursive: true })
  mkdirSync(join(dir, 'data', 'media'), { recursive: true })

  const envPath = join(dir, '.env')
  if (!existsSync(envPath)) {
    writeFileSync(envPath, [
      `NODE_ENV=production`,
      `PORT=${PORT}`,
      `DATABASE_TYPE=sqlite`,
      `ENGINE_TYPE=whatsapp-web.js`,
      `SESSION_DATA_PATH=./data/sessions`,
      `STORAGE_TYPE=local`,
      `STORAGE_LOCAL_PATH=./data/media`,
      `REDIS_ENABLED=false`,
      `PUPPETEER_HEADLESS=true`,
      `PUPPETEER_ARGS=--no-sandbox,--disable-dev-shm-usage,--disable-gpu`,
      `CORS_ORIGINS=*`,
    ].join('\n'))
  }

  const nodeExe = findNode()

  proc = spawn(nodeExe, [distMain], {
    cwd: dir,
    env: {
      ...process.env,
      PORT:               String(PORT),
      NODE_ENV:           'production',
      DATABASE_TYPE:      'sqlite',
      ENGINE_TYPE:        'whatsapp-web.js',
      SESSION_DATA_PATH:  join(dir, 'data', 'sessions'),
      STORAGE_TYPE:       'local',
      STORAGE_LOCAL_PATH: join(dir, 'data', 'media'),
      REDIS_ENABLED:      'false',
      PUPPETEER_HEADLESS: 'true',
      PUPPETEER_ARGS:     '--no-sandbox,--disable-dev-shm-usage,--disable-gpu',
      CORS_ORIGINS:       '*',
    },
    stdio: ['ignore', 'pipe', 'pipe']
  })

  proc.stdout?.on('data', (d: Buffer) => {
    const line = d.toString().trim()
    console.log('[OpenWA]', line)
    emit('wa:server-log', { level: 'info', line })
  })

  proc.stderr?.on('data', (d: Buffer) => {
    const line = d.toString().trim()
    console.error('[OpenWA ERR]', line)
    emit('wa:server-log', { level: 'error', line })
  })

  proc.on('exit', (code) => {
    console.log(`[OpenWA] process exited (code ${code})`)
    _status = 'stopped'
    emit('wa:server-status', { status: 'stopped', code })
    proc = null
  })

  proc.on('error', (err) => {
    console.error('[OpenWA] spawn error:', err)
    _status = 'error'
    emit('wa:server-status', { status: 'error', error: err.message })
  })

  try {
    await waitReady()
    _status = 'running'
    emit('wa:server-status', { status: 'running', url: BASE_URL })
    console.log(`[OpenWA] Ready at ${BASE_URL}`)
  } catch (err) {
    _status = 'error'
    emit('wa:server-status', { status: 'error', error: String(err) })
    proc?.kill()
    proc = null
  }
}

export function stopOpenWA(): void {
  if (proc) {
    proc.kill('SIGTERM')
    proc = null
    _status = 'stopped'
  }
}

// Read the API key OpenWA auto-generates on first start.
// OpenWA saves it to data/.api-key so callers never need to configure it manually.
export function getApiKey(): string {
  try {
    const dir = getOpenWADir()
    const keyFile = join(dir, 'data', '.api-key')
    if (existsSync(keyFile)) return readFileSync(keyFile, 'utf-8').trim()
  } catch {}
  return ''
}

app.on('before-quit', stopOpenWA)
app.on('will-quit', stopOpenWA)
