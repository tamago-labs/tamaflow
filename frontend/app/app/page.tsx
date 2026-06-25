import HoldingsCard from "@/components/wallet/HoldingsCard";

/**
 * Dashboard placeholder — high-level overview:
 *   • AI status card with Load / Change Model actions
 *   • "Continue where you left off" card pointing at New Flow
 *   • Three small KPI tiles (employees, active flows, settled 30d)
 *
 * Mirrors the desktop-app Dashboard.tsx. Each card uses the same
 * `bg-white border border-brand-border rounded-md` shell.
 */
export default function DashboardPage() { 
  return (
    <div> 

      {/* Holdings — Loop SDK island */}
      <HoldingsCard />

      {/* KPI tiles */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 max-w-3xl">
        {[
          { label: "Employees", value: "—" },
          { label: "Active Flows", value: "0" },
          { label: "Settled (30d)", value: "0" },
        ].map((kpi) => (
          <div
            key={kpi.label}
            className="bg-white border border-brand-border rounded-md p-5"
          >
            <p className="font-mono text-[10px] tracking-wider2 text-brand-muted uppercase m-0 mb-2">
              {kpi.label}
            </p>
            <p className="font-sans text-2xl font-light text-brand-navy m-0">
              {kpi.value}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
