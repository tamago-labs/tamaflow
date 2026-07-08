import {
  Boxes,
  CircleDollarSign,
  FileBox,
  FileText,
  CalendarCheck,
  LayoutDashboard,
  Users,
  Wallet,
  Workflow
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

export type PageId =
  | 'dashboard'
  | 'attendance'
  | 'chat'
  | 'payslips'
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
  key: string
  label: string
  items: NavItem[]
}

export const NAV_CATEGORIES: NavCategory[] = [
  {
    key: 'teamspace',
    label: 'Teamspace',
    items: [
      { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
      { id: 'attendance', label: 'Attendance', icon: CalendarCheck },
      { id: 'payslips', label: 'Payslips', icon: FileText }
    ]
  },
  {
    key: 'payroll',
    label: 'Payroll',
    items: [
      { id: 'employees', label: 'Employees', icon: Users },
      { id: 'flow-builder', label: 'Flow Builder', icon: Workflow },
      { id: 'payment-settings', label: 'Payment Settings', icon: Wallet },
      // { id: 'settlements', label: 'Settlements', icon: Boxes },
      { id: 'assets', label: 'Assets', icon: CircleDollarSign }
    ]
  }
]

export const PAGE_LABELS: Record<PageId, string> = {
  ...(Object.fromEntries(
    NAV_CATEGORIES.flatMap((c) => c.items).map((i) => [i.id, i.label])
  ) as Record<PageId, string>),
  settings: 'Settings'
}

export { FileBox }
