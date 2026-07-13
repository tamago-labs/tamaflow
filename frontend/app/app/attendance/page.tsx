"use client";

/**
 * Attendance Page — Check-in for employees.
 * Uses EmployeeRecord contracts from TamaFlow.Company.EmployeeRecord.
 */

import { useCallback, useEffect, useState } from "react";
import { Clock, Search } from "lucide-react";
import { cli } from "@/lib/cli";
import { useWalletMode } from "@/lib/wallet/useWalletMode";

interface BlockInfo {
  blockStart: string;
  blockEnd: string;
  status: string;
}

interface EmployeeRecord {
  contractId: string;
  employer: string;
  employee: string;
  companyName: string;
  displayName: string;
  role: string;
  blocks: Record<string, BlockInfo>;
}

export default function AttendancePage() {
  const { mode, cliPartyId } = useWalletMode();
  const [records, setRecords] = useState<EmployeeRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [checkingIn, setCheckingIn] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  const fetchRecords = useCallback(async () => {
    setLoading(true);
    try {
      const result = await cli.contracts.query("TamaFlow.Company.EmployeeRecord:EmployeeRecord");
      if (Array.isArray(result)) {
        setRecords(result.map((c: Record<string, unknown>) => {
          const created = (c.contractEntry as Record<string, unknown>)?.JsActiveContract as Record<string, unknown> | undefined;
          const createdEvent = created?.createdEvent as Record<string, unknown> | undefined;
          const arg = (createdEvent?.createArgument as Record<string, unknown>) || {};
          return {
            contractId: (createdEvent?.contractId as string) || "",
            employer: (arg.employer as string) || "",
            employee: (arg.employee as string) || "",
            companyName: (arg.companyName as string) || "",
            displayName: (arg.displayName as string) || "",
            role: (arg.role as string) || "",
            blocks: (arg.blocks as Record<string, BlockInfo>) || {},
          };
        }));
      }
    } catch (e) {
      console.error("[Attendance] Failed to fetch records:", e);
    } finally {
      setLoading(false);
    }
  }, []);

  // Fetch employee records on mount
  useEffect(() => {
    if (mode === "cli" && cliPartyId) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      fetchRecords();
    }
  }, [mode, cliPartyId, fetchRecords]);

  const handleCheckIn = useCallback(async (contractId: string) => {
    if (mode !== "cli" || !cliPartyId) return;
    setCheckingIn(contractId);
    try {
      const now = new Date();
      const blockStart = now.toISOString();
      const blockEnd = new Date(now.getTime() + 3600000).toISOString();

      await cli.contracts.exercise(
        "TamaFlow.Company.EmployeeRecord:EmployeeRecord",
        contractId,
        "CheckIn",
        { blockStart, blockEnd }
      );

      fetchRecords();
    } catch (e) {
      console.error("[Attendance] Check-in failed:", e);
    } finally {
      setCheckingIn(null);
    }
  }, [mode, cliPartyId, fetchRecords]);

  // Flatten blocks from all records for display
  const allBlocks = records.flatMap((r) =>
    Object.entries(r.blocks).map(([blockId, block]) => ({
      blockId,
      ...block,
      employer: r.employer,
      companyName: r.companyName,
      displayName: r.displayName,
      contractId: r.contractId,
    }))
  );

  const filteredBlocks = allBlocks.filter((b) => {
    const q = search.trim().toLowerCase();
    if (!q) return true;
    return (
      b.displayName.toLowerCase().includes(q) ||
      b.companyName.toLowerCase().includes(q) ||
      b.status.toLowerCase().includes(q)
    );
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-light tracking-tight text-[#0a0a5c]">Attendance</h1>
        <div className="flex items-center gap-3">
          {mode === "cli" && records.length > 0 && (
            <button
              onClick={() => handleCheckIn(records[0].contractId)}
              disabled={checkingIn !== null}
              className="flex items-center gap-1.5 rounded-md bg-green-600 px-4 py-2 text-xs font-bold uppercase tracking-wider text-white hover:opacity-90 disabled:opacity-50"
            >
              <Clock size={12} />
              {checkingIn ? "Checking In..." : "Check In"}
            </button>
          )}
        </div>
      </div>

      {/* Filter */}
      <div className="relative">
        <Search size={12} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Filter by employee or company..."
          className="w-full rounded-md border border-gray-200 bg-white py-1.5 pl-8 pr-3 text-xs text-gray-900 placeholder:text-gray-400 focus:border-blue-500 focus:outline-none"
        />
      </div>

      {/* Employee records with check-in buttons */}
      {records.length > 0 && (
        <div className="rounded-md border border-gray-200 bg-white p-4">
          <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-gray-400">Your Positions</h2>
          <div className="grid grid-cols-3 gap-4">
            {records.map((r) => (
              <div key={r.contractId} className="flex items-center justify-between rounded-md border border-gray-100 bg-gray-50 p-3">
                <div>
                  <p className="text-sm font-medium text-gray-900">{r.companyName}</p>
                  <p className="text-xs text-gray-500">{r.displayName} {r.role ? `· ${r.role}` : ""}</p>
                </div>
                <button
                  onClick={() => handleCheckIn(r.contractId)}
                  disabled={checkingIn !== null}
                  className="rounded-md bg-green-600 px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-white hover:opacity-90 disabled:opacity-50"
                >
                  {checkingIn === r.contractId ? "..." : "Check In"}
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Table */}
      <div className="overflow-hidden rounded-md border border-gray-200 bg-white">
        <div className="grid grid-cols-[2fr_2fr_1fr_1fr_1fr] gap-4 border-b border-gray-200 bg-gray-50 px-4 py-2.5">
          <span className="font-mono text-[10px] font-semibold uppercase tracking-wider text-gray-400">Employee</span>
          <span className="font-mono text-[10px] font-semibold uppercase tracking-wider text-gray-400">Company</span>
          <span className="font-mono text-[10px] font-semibold uppercase tracking-wider text-gray-400">Block Start</span>
          <span className="font-mono text-[10px] font-semibold uppercase tracking-wider text-gray-400">Block End</span>
          <span className="font-mono text-[10px] font-semibold uppercase tracking-wider text-gray-400">Status</span>
        </div>

        {filteredBlocks.length === 0 ? (
          <div className="py-12 text-center text-sm text-gray-400">
            {loading ? "Loading..." : "No attendance records yet"}
          </div>
        ) : (
          <ul className="divide-y divide-gray-200">
            {filteredBlocks.map((block) => (
              <li key={block.blockId} className="grid grid-cols-[2fr_2fr_1fr_1fr_1fr] items-center gap-4 px-4 py-3 hover:bg-gray-50">
                <span className="text-sm text-gray-900">{block.displayName}</span>
                <span className="text-xs text-gray-600">{block.companyName}</span>
                <span className="text-xs text-gray-600">{new Date(block.blockStart).toLocaleString()}</span>
                <span className="text-xs text-gray-600">{new Date(block.blockEnd).toLocaleString()}</span>
                <span className={`inline-flex w-fit rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${
                  block.status === "Confirmed" ? "bg-green-100 text-green-700" :
                  block.status === "Rejected" ? "bg-red-100 text-red-700" :
                  "bg-yellow-100 text-yellow-700"
                }`}>
                  {block.status}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
