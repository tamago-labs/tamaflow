// Tamaflow desktop sidebar navigation config.
//
// Two categories, mirroring the new Tamaflow in-app structure:
//   • Teamspace  — Chat / Shareable (team-shared content:
//                  1:1 + AI chat, plus cross-team shareable
//                  docs / scripts / templates)
//   • Payroll    — Employees / Flow Builder / Settlements / Assets
//                  (the employer-side operations surface)
//
// The sidebar (renderer/src/components/Sidebar.tsx) consumes this
// list directly. Page identifiers (`id`) match the keys of the
// `PAGES` map in AppShell.tsx — keep them in sync when renaming.

import {
  Boxes,
  CircleDollarSign,
  FileBox,
  MessageSquare,
  Share2,
  Users,
  Wallet,
  Workflow
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

export type PageId =
  | 'chat'
  | 'shareable'
  | 'employees'
  | 'flow-builder'
  | 'payment-settings'
  | 'settlements'
  | 'assets'
  | 'settings'

export interface NavItem {
  id: PageId
  label: string
  icon: LucideIcon
}

export interface NavCategory {
  /** Lowercased key for the `<div>` key. */
  key: string
  /** UPPERCASE mono label rendered above the items. */
  label: string
  items: NavItem[]
}

export const NAV_CATEGORIES: NavCategory[] = [
  {
    key: 'teamspace',
    label: 'Teamspace',
    items: [
      { id: 'chat', label: 'Chat', icon: MessageSquare },
      { id: 'shareable', label: 'Shareable', icon: Share2 }
    ]
  },
  {
    key: 'payroll',
    label: 'Payroll',
    items: [
      { id: 'employees', label: 'Employees', icon: Users },
      { id: 'flow-builder', label: 'Flow Builder', icon: Workflow },
      { id: 'payment-settings', label: 'Payment Settings', icon: Wallet },
      { id: 'settlements', label: 'Settlements', icon: Boxes },
      { id: 'assets', label: 'Assets', icon: CircleDollarSign }
    ]
  }
]

// Flat label lookup for the topbar breadcrumb (mirrors the
// frontend's `routeLabels`). Includes pages that don't sit in
// the sidebar categories (Settings is a bottom utility button,
// not a Payroll item) so the breadcrumb always renders a
// human label, not the raw page id.
export const PAGE_LABELS: Record<PageId, string> = {
  ...(Object.fromEntries(
    NAV_CATEGORIES.flatMap((c) => c.items).map((i) => [i.id, i.label])
  ) as Record<PageId, string>),
  settings: 'Settings'
}

// FileBox is imported above to keep the import surface stable
// (some tooling flags unused imports in a flat list).
export { FileBox }
