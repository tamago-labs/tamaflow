import {
  LayoutDashboard,
  Users,
  Plus,
  Activity,
  Coins,
  Inbox,
  Settings as SettingsIcon,
  type LucideIcon,
} from "lucide-react";

/* -------------------------------------------------------------------------- */
/* App-shell navigation                                                       */
/* Mirrors the desktop-app Sidebar structure. Two groups: "Payroll" +         */
/* "Account". Used by the in-app Sidebar component.                           */
/* -------------------------------------------------------------------------- */

export type IconType = LucideIcon;

export interface NavItem {
  path: string;
  label: string;
  icon: IconType;
  end?: boolean;
}

export interface NavCategory {
  key: string;
  label: string;
  items: NavItem[];
}

export const navCategories: NavCategory[] = [
  {
    key: "payroll",
    label: "Payroll",
    items: [
      { path: "/app", label: "Dashboard", icon: LayoutDashboard, end: true },
      { path: "/app/employees", label: "Employees", icon: Users },
      { path: "/app/flows/new", label: "New Flow", icon: Plus },
      { path: "/app/flows", label: "Active Flows", icon: Activity, end: true },
      { path: "/app/settlements", label: "Settlements", icon: Coins },
    ],
  },
  {
    key: "account",
    label: "Account",
    items: [
      { path: "/app/inbox", label: "Inbox", icon: Inbox },
      { path: "/app/settings", label: "Settings", icon: SettingsIcon },
    ],
  },
];

/* -------------------------------------------------------------------------- */
/* Route → breadcrumb label map for the TopBar                                 */
/* -------------------------------------------------------------------------- */
export const routeLabels: Record<string, string> = {
  app: "Dashboard",
  employees: "Employees",
  flows: "Active Flows",
  new: "New Flow",
  settlements: "Settlements",
  inbox: "Inbox",
  settings: "Settings",
};

/* -------------------------------------------------------------------------- */
/* Landing-page marketing nav                                                 */
/* -------------------------------------------------------------------------- */
export const marketingNav: { href: string; label: string }[] = [
  { href: "#problem", label: "Problem" },
  { href: "#solution", label: "Solution" },
  { href: "#flow", label: "How it works" },
  { href: "#features", label: "Features" },
  { href: "#why-canton", label: "Why Canton" },
];
