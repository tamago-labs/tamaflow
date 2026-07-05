// FlowBuilderPage — wraps the existing CanvasPage (toolbar + canvas
// viewport + right drawer + footer) so it renders as one of the
// pages in the in-app shell. The CanvasPage already owns its own
// state, the canvas reducer, the P2P snapshot hydration, etc., so
// this is a one-liner pass-through.
//
// We mount it full-bleed inside the AppShell main content area — the
// CanvasPage fills the available height and width.

import { CanvasPage } from '../CanvasPage'

export function FlowBuilderPage() {
  return <CanvasPage />
}

export default FlowBuilderPage
