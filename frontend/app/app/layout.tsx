import type { Metadata } from "next";
import Sidebar from "@/components/app/Sidebar";
import AppShellClient from "@/components/app/AppShellClient";
import { WalletModeProvider } from "@/lib/wallet/useWalletMode";
import { PriceProvider } from "@/lib/price/PriceContext";

export const metadata: Metadata = {
  title: "Employee Portal",
  description:
    "TamaFlow in-app shell — privacy-first payroll on Canton. Manage employees, run flows, and settle on Canton.",
};

export default function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-brand-light flex">
      <WalletModeProvider>
        <PriceProvider>
          <Sidebar />
          <AppShellClient>{children}</AppShellClient>
        </PriceProvider>
      </WalletModeProvider>
    </div>
  );
}
