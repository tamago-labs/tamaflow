import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { App } from './App'
import { __tamaflowRoomStoreForTest } from './hooks/useRoom'
import './index.css'

const root = document.getElementById('root')
if (!root)
  throw new Error('Root element not found')

  // Test hook — exposes the room store snapshot to CDP-driven smoke
  // tests. `window.__tamaflow?.room.peek()` returns the latest state
  // without depending on DOM scraping. Safe in production (read-only
  // peek).
;(window as unknown as { __tamaflow?: unknown }).__tamaflow = {
  room: {
    ...__tamaflowRoomStoreForTest()
  }
}

createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>
)
