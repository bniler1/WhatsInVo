import { readFileSync, writeFileSync, existsSync } from 'fs'
import { join } from 'path'
import { app } from 'electron'

interface AppSettings {
  wa_url: string
  wa_apiKey: string
  wa_sessionId: string
}

const DEFAULTS: AppSettings = {
  wa_url: 'http://localhost:3785',
  wa_apiKey: '',
  wa_sessionId: 'default'
}

function getSettingsPath(): string {
  return join(app.getPath('userData'), 'whatsinvo-settings.json')
}

export function loadSettings(): AppSettings {
  const p = getSettingsPath()
  if (!existsSync(p)) return { ...DEFAULTS }
  try {
    return { ...DEFAULTS, ...JSON.parse(readFileSync(p, 'utf-8')) }
  } catch {
    return { ...DEFAULTS }
  }
}

export function saveSettings(s: Partial<AppSettings>): AppSettings {
  const current = loadSettings()
  const updated = { ...current, ...s }
  writeFileSync(getSettingsPath(), JSON.stringify(updated, null, 2))
  return updated
}
