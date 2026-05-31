import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'

export function Settings() {
  const navigate = useNavigate()
  const [settings, setSettings] = useState({ url: '', apiKey: '', sessionId: '' })
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    window.api.wa.getSettings().then(s => setSettings(s))
  }, [])

  const handleSave = async () => {
    await window.api.wa.saveSettings(settings)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  return (
    <div className="flex-1 p-8 max-w-lg" style={{ background: '#0b141a' }}>
      <div className="flex items-center gap-3 mb-8">
        <button
          onClick={() => navigate(-1)}
          className="p-1.5 text-gray-400 hover:text-white rounded-full hover:bg-[#2a3942] transition-colors"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <h1 className="text-white text-xl font-bold">Settings</h1>
      </div>

      <div className="space-y-5">
        <div>
          <label className="block text-sm text-gray-400 mb-1">OpenWA Server URL</label>
          <input
            type="text"
            value={settings.url}
            onChange={e => setSettings(s => ({ ...s, url: e.target.value }))}
            className="w-full bg-[#2a3942] text-white text-sm px-3 py-2 rounded-lg focus:outline-none focus:ring-1 focus:ring-emerald-500"
          />
          <p className="text-xs text-gray-500 mt-1">Default: http://localhost:3785</p>
        </div>

        <div>
          <label className="block text-sm text-gray-400 mb-1">Session Name</label>
          <input
            type="text"
            value={settings.sessionId}
            onChange={e => setSettings(s => ({ ...s, sessionId: e.target.value }))}
            className="w-full bg-[#2a3942] text-white text-sm px-3 py-2 rounded-lg focus:outline-none focus:ring-1 focus:ring-emerald-500"
          />
        </div>

        <div>
          <label className="block text-sm text-gray-400 mb-1">API Key (optional)</label>
          <input
            type="password"
            value={settings.apiKey}
            onChange={e => setSettings(s => ({ ...s, apiKey: e.target.value }))}
            className="w-full bg-[#2a3942] text-white text-sm px-3 py-2 rounded-lg focus:outline-none focus:ring-1 focus:ring-emerald-500"
          />
        </div>

        <button
          onClick={handleSave}
          className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-sm rounded-lg transition-colors"
        >
          {saved ? 'Saved ✓' : 'Save Settings'}
        </button>
      </div>
    </div>
  )
}
