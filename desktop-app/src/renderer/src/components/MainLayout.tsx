import { Outlet } from 'react-router-dom'
import Sidebar from './Sidebar'
import TopBar from './TopBar'

/**
 * Main app shell — fixed 200px sidebar on the left, sticky top bar
 * across the top, content area with the brand-light background. The
 * routed page renders inside <Outlet />.
 *
 * Callbacks passed in from AppRouter are forwarded to child routes
 * via Outlet context, so Settings > AI Model can navigate the user
 * back to the model picker, and CompanyProfile can route the user
 * back to the company gate after a destroy — both without
 * prop-drilling.
 */
export default function MainLayout({
  onChangeModel,
  onCompanyDestroyed
}: {
  onChangeModel: () => void
  onCompanyDestroyed: () => void
}) {
  return (
    <div className="min-h-screen bg-brand-light flex">
      <Sidebar />
      <div className="flex-1 ml-[200px] flex flex-col min-h-screen">
        <TopBar />
        <main className="flex-1 p-8 overflow-y-auto">
          <Outlet context={{ onChangeModel, onCompanyDestroyed }} />
        </main>
      </div>
    </div>
  )
}
