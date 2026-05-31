import { Outlet } from 'react-router-dom'
import { ChatSidebar } from '../components/ChatSidebar'

export function Home() {
  return (
    <div className="flex flex-1 overflow-hidden">
      <ChatSidebar />
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
          Select a chat from the sidebar to view messages, or connect to WhatsApp to start syncing.
        </p>
      </div>
    </div>
  )
}
