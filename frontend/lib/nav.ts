import {
  LayoutDashboard,
  Wallet,
  ArrowRightLeft,
  Gift,
  Clock,
  BookOpen,
  type LucideIcon,
} from "lucide-react";

/* -------------------------------------------------------------------------- */
/* App-shell navigation                                                       */
/*                                                                             */
/* Layout in the Sidebar (top → bottom):                                      */
/*                                                                             */
/*   1. topItems      — top-level items, no category label                     */
/*                     (Dashboard · Assets · Payslips · Rewards Hub)           */
/*   2. navCategories — items grouped under a mono label                       */
/*                     (Account)                                              */
/*   3. bottomLink    — single utility link at the very bottom                 */
/*                     (Download Employer Client)                              */
/*                                                                             */
/* Every entry has an `icon` so the Sidebar can render them all without       */
/* any extra icon lookups.                                                    */
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

/** Top-level items, rendered above any category. */
export const topItems: NavItem[] = [
  { path: "/app", label: "Dashboard", icon: LayoutDashboard, end: true },
  { path: "/app/assets", label: "Assets", icon: Wallet },
  { path: "/app/attendance", label: "Attendance", icon: Clock },
  { path: "/app/payslips", label: "Payslips", icon: ArrowRightLeft },
  { path: "/app/knowledge", label: "Knowledge Base", icon: BookOpen },
  { path: "/app/rewards", label: "Rewards Hub", icon: Gift },
];

/** Categories grouped under a label. */
export const navCategories: NavCategory[] = [];

/** Single utility button rendered at the very bottom of the Sidebar.
 *  Opens the HowToUseModal rather than navigating.
 *  Keep the label short so it fits on a single line in the 200px sidebar. */
export const bottomLink: { href: string; label: string } = {
  href: "https://github.com/tamago-labs/tamaflow",
  label: "How to Use",
};

/* -------------------------------------------------------------------------- */
/* Route → breadcrumb label map for the TopBar                                 */
/* -------------------------------------------------------------------------- */
export const routeLabels: Record<string, string> = {
  app: "Dashboard",
  assets: "Assets",
  payslips: "Payslips",
  rewards: "Rewards Hub",
  attendance: "Attendance",
  identification: "Identification",
  security: "Security",
  statement: "Statements",
  settings: "Settings",
  knowledge: "Knowledge Base",
};

/* -------------------------------------------------------------------------- */
/* Landing-page marketing nav                                                 */
/*                                                                             */
/*   marketingNav    — items rendered as direct anchor links in the navbar     */
/*                     (desktop + mobile drawer).                              */
/*   marketingMore   — items rendered inside the navbar's "More ▾" dropdown. */
/*                     v1 ships with just the GitHub link, but the array is   */
/*                     structured so future items (Whitepaper, Docs, Discord)  */
/*                     can be added in one line.                               */
/* -------------------------------------------------------------------------- */
export const marketingNav: { href: string; label: string }[] = [
  { href: "#features", label: "Features" },
  { href: "#flow", label: "How it works" },
];

export interface MarketingMoreItem {
  label: string;
  href: string;
  external?: boolean;
}

export const marketingMore: MarketingMoreItem[] = [
  {
    label: "Watch Demo",
    href: "https://youtu.be/_k3mefQHz2c",
    external: true,
  },
  {
    label: "GitHub Repo",
    href: "https://github.com/tamago-labs/tamaflow",
    external: true,
  },
];
