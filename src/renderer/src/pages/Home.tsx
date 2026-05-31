import { Outlet } from 'react-router-dom'
import { ChatSidebar } from '../components/ChatSidebar'

interface HomeProps {
  onImport: () => void
}

export function Home({ onImport }: HomeProps) {
  return (
    <div className="flex flex-1 overflow-hidden">
      <ChatSidebar onImport={onImport} />
      <main className="flex-1 flex flex-col overflow-hidden">
        <Outlet />
      </main>
    </div>
  )
}

export function EmptyThread() {
  return (
    <div className="flex-1 flex items-center justify-center" style={{ background: '#0b141a' }}>
      <div className="text-center">
        <div className="text-5xl mb-4">💬</div>
        <h2 className="text-white text-lg font-medium mb-2">WhatsInVo</h2>
        <p className="text-gray-500 text-sm max-w-xs">
          Select a chat from the sidebar to view messages, connect to WhatsApp to sync,
          or use the ↑ button to import a chat export.
        </p>
      </div>
    </div>
  )
}
