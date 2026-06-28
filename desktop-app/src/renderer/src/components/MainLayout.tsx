import { Outlet, useLocation } from 'react-router-dom'
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
 *
 * Canvas routes (`/flows/new`, `/flows/:id`) get a chrome-free layout:
 * the TopBar and `<main>` padding are dropped so <FlowBuilder> can
 * claim the full viewport (its internal toolbar / save-badge / name
 * editor are the only chrome the user sees). Everything else keeps
 * the standard shell.
 */
function isCanvasRoute(pathname: string): boolean {
  // Both `/flows/new` and `/flows/:id` count as canvas routes.
  // `/flows` itself (the list) is NOT — it still uses the normal
  // padding and TopBar.
  return pathname.startsWith('/flows/') && pathname !== '/flows'
}

export default function MainLayout({
  onChangeModel,
  onCompanyDestroyed
}: {
  onChangeModel: () => void
  onCompanyDestroyed: () => void
}) {
  const location = useLocation()
  const isCanvas = isCanvasRoute(location.pathname)

  return (
    <div className="min-h-screen bg-brand-light flex">
      <Sidebar />
      <div className="flex-1 ml-[200px] flex flex-col min-h-screen">
        {!isCanvas && <TopBar />}
        <main
          className={
            isCanvas
              ? 'flex-1 overflow-hidden'
              : 'flex-1 p-8 overflow-y-auto'
          }
        >
          <Outlet context={{ onChangeModel, onCompanyDestroyed }} />
        </main>
      </div>
    </div>
  )
}
