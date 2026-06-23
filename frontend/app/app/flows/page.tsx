"use client";

import { useState } from "react";
import Link from "next/link";
import PageHeader from "@/components/app/PageHeader";

/**
 * Active Flows placeholder — the unified flow list. Shows every
 * flow with a status pill. Filter chips at the top scope the list to
 * a single state (Draft / Review / Approved / Netting / Settled).
 *
 * Mirrors the desktop-app's ActiveFlows.tsx exactly so the data
 * layer can be ported without UI changes.
 */

type FlowStatus = "Draft" | "Review" | "Approved" | "Netting" | "Settled";

const FILTERS: Array<FlowStatus | "All"> = [
  "All",
  "Draft",
  "Review",
  "Approved",
  "Netting",
  "Settled",
];

export default function ActiveFlowsPage() {
  const [filter, setFilter] = useState<(typeof FILTERS)[number]>("All");

  return (
    <div>
      <PageHeader
        label="Workflow"
        title="Active Flows"
        subtitle="Every payroll flow in one place. Filter by status to focus on what needs you next."
      />

      {/* Filter chips */}
      <div className="flex items-center gap-2 mb-4 flex-wrap">
        {FILTERS.map((f) => (
          <button
            key={f}
            type="button"
            onClick={() => setFilter(f)}
            className={`py-1 px-3 rounded-full border font-mono text-[10px] tracking-wider2 uppercase cursor-pointer ${
              filter === f
                ? "bg-brand-blue text-white border-brand-blue font-bold"
                : "bg-white text-brand-muted border-brand-border font-normal hover:border-brand-blue hover:text-brand-navy"
            }`}
          >
            {f}
          </button>
        ))}
      </div>

      {/* List */}
      <div className="bg-white border border-brand-border rounded-md overflow-hidden">
        <div className="grid grid-cols-[1.5fr_1fr_1fr_1fr_auto] gap-4 py-3 px-4 border-b border-brand-border bg-brand-light">
          <span className="font-mono text-[10px] tracking-wider2 text-brand-muted uppercase font-semibold">
            Flow
          </span>
          <span className="font-mono text-[10px] tracking-wider2 text-brand-muted uppercase font-semibold">
            Period
          </span>
          <span className="font-mono text-[10px] tracking-wider2 text-brand-muted uppercase font-semibold">
            Employees
          </span>
          <span className="font-mono text-[10px] tracking-wider2 text-brand-muted uppercase font-semibold">
            Total
          </span>
          <span className="font-mono text-[10px] tracking-wider2 text-brand-muted uppercase font-semibold">
            Status
          </span>
        </div>
        <div className="py-12 text-center font-sans text-sm text-brand-muted">
          No flows yet — start one from{" "}
          <Link
            href="/app/flows/new"
            className="text-brand-blue font-medium"
          >
            New Flow
          </Link>
          .
        </div>
      </div>
    </div>
  );
}
