import type { Metadata } from "next";
import Sidebar from "@/components/app/Sidebar";
import TopBar from "@/components/app/TopBar";
import { WalletProvider } from "@/lib/wallet/WalletContext";
import { PriceProvider } from "@/lib/price/PriceContext";

export const metadata: Metadata = {
  title: "Employee Portal",
  description:
    "TamaFlow in-app shell — privacy-first payroll on Canton. Manage employees, run flows, and settle on Canton.",
};

/**
 * In-app shell — fixed 200px sidebar on the left, sticky top bar
 * across the top, content area with the brand-light background. The
 * routed page renders inside `children`.
 *
 * Visually identical to desktop-app's MainLayout.tsx so the web
 * build feels like the same product.
 */
export default function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-brand-light flex">
      <WalletProvider>
        <PriceProvider>
          <Sidebar />
          <div className="flex-1 ml-[200px] flex flex-col min-h-screen">
            <TopBar />
            <main className="flex-1 p-8 overflow-y-auto">{children}</main>
          </div>
        </PriceProvider>
      </WalletProvider>
    </div>
  );
}
