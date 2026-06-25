import {
  LayoutDashboard,
  Wallet,
  ArrowRightLeft,
  Gift,
  IdCard,
  ShieldCheck,
  FileText,
  Settings as SettingsIcon,
  type LucideIcon,
} from "lucide-react";

/* -------------------------------------------------------------------------- */
/* App-shell navigation                                                       */
/*                                                                             */
/* Layout in the Sidebar (top → bottom):                                      */
/*                                                                             */
/*   1. topItems      — top-level items, no category label                     */
/*                     (Dashboard · Assets · Payments · Rewards Hub)           */
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
  { path: "/app/payments", label: "Payments", icon: ArrowRightLeft },
  { path: "/app/rewards", label: "Rewards Hub", icon: Gift },
];

/** Categorized items, rendered with a mono label. */
export const navCategories: NavCategory[] = [
  {
    key: "account",
    label: "Account",
    items: [
      { path: "/app/identification", label: "Identification", icon: IdCard },
      { path: "/app/security", label: "Security", icon: ShieldCheck },
      { path: "/app/statement", label: "Account Statement", icon: FileText },
      { path: "/app/settings", label: "Settings", icon: SettingsIcon },
    ],
  },
];

/** Single utility button rendered at the very bottom of the Sidebar.
 *  Opens the DownloadEmployerClientModal rather than navigating. */
export const bottomLink: { href: string; label: string } = {
  href: "https://github.com/tamago-labs/tamaflow",
  label: "Download",
};

/* -------------------------------------------------------------------------- */
/* Route → breadcrumb label map for the TopBar                                 */
/* -------------------------------------------------------------------------- */
export const routeLabels: Record<string, string> = {
  app: "Dashboard",
  assets: "Assets",
  payments: "Payments",
  rewards: "Rewards Hub",
  identification: "Identification",
  security: "Security",
  statement: "Account Statement",
  settings: "Settings",
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
  { href: "#flow", label: "How it works" },
  { href: "#features", label: "Features" },
  { href: "#why-canton", label: "Why Canton" },
];

export interface MarketingMoreItem {
  label: string;
  href: string;
  external?: boolean;
}

export const marketingMore: MarketingMoreItem[] = [
  {
    label: "GitHub Repo",
    href: "https://github.com/tamago-labs/tamaflow",
    external: true,
  },
];
