import { Outlet } from 'react-router-dom'
import Sidebar from './Sidebar'
import TopBar from './TopBar'

/**
 * Main app shell — fixed 200px sidebar on the left, sticky top bar
 * across the top, content area with the brand-light background. The
 * routed page renders inside <Outlet />.
 *
 * `onChangeModel` is passed in from AppRouter and forwarded to child
 * routes via Outlet context, so Settings > AI Model can navigate the
 * user back to the model picker without prop-drilling.
 */
export default function MainLayout({ onChangeModel }: { onChangeModel: () => void }) {
  return (
    <div className="min-h-screen bg-brand-light flex">
      <Sidebar />
      <div className="flex-1 ml-[200px] flex flex-col min-h-screen">
        <TopBar onChangeModel={onChangeModel} />
        <main className="flex-1 p-8 overflow-y-auto">
          <Outlet context={{ onChangeModel }} />
        </main>
      </div>
    </div>
  )
}
