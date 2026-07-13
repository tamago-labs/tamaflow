"use client";

/**
 * Attendance Page — Check-in for employees.
 * Uses CLI wallet for Canton interactions.
 */

import { useCallback, useEffect, useState } from "react";
import { Clock, Plus, Search } from "lucide-react";
import { cli } from "@/lib/cli";
import { useWalletMode } from "@/lib/wallet/useWalletMode";

interface TimeBlock {
  contractId: string;
  employee: string;
  employer: string;
  blockStart: string;
  blockEnd: string;
  status: string;
}

export default function AttendancePage() {
  const { mode, cliPartyId } = useWalletMode();
  const [blocks, setBlocks] = useState<TimeBlock[]>([]);
  const [loading, setLoading] = useState(false);
  const [checkingIn, setCheckingIn] = useState(false);
  const [search, setSearch] = useState("");

  // Fetch time blocks on mount
  useEffect(() => {
    if (mode === "cli" && cliPartyId) {
      fetchBlocks();
    }
  }, [mode, cliPartyId]);

  const fetchBlocks = async () => {
    setLoading(true);
    try {
      const result = await cli.contracts.query("TamaFlow.Attendance.TimeBlock:TimeBlock");
      if (Array.isArray(result)) {
        setBlocks(result.map((c: any) => ({
          contractId: c.contractEntry?.JsActiveContract?.createdEvent?.contractId || "",
          employee: c.contractEntry?.JsActiveContract?.createdEvent?.createArgument?.employee || "",
          employer: c.contractEntry?.JsActiveContract?.createdEvent?.createArgument?.employer || "",
          blockStart: c.contractEntry?.JsActiveContract?.createdEvent?.createArgument?.blockStart || "",
          blockEnd: c.contractEntry?.JsActiveContract?.createdEvent?.createArgument?.blockEnd || "",
          status: c.contractEntry?.JsActiveContract?.createdEvent?.createArgument?.status || "",
        })));
      }
    } catch (e) {
      console.error("[Attendance] Failed to fetch blocks:", e);
    } finally {
      setLoading(false);
    }
  };

  const handleCheckIn = useCallback(async () => {
    if (mode !== "cli" || !cliPartyId) return;
    setCheckingIn(true);
    try {
      const now = new Date();
      const blockStart = now.toISOString();
      const blockEnd = new Date(now.getTime() + 3600000).toISOString();

      await cli.contracts.exercise(
        "TamaFlow.Attendance.TimeBlock:TimeBlock",
        "check-in",
        "CheckIn",
        { blockStart, blockEnd }
      );

      fetchBlocks();
    } catch (e) {
      console.error("[Attendance] Check-in failed:", e);
    } finally {
      setCheckingIn(false);
    }
  }, [mode, cliPartyId]);

  const filteredBlocks = blocks.filter((b) => {
    const q = search.trim().toLowerCase();
    if (!q) return true;
    return b.employee.toLowerCase().includes(q) || b.status.toLowerCase().includes(q);
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-light tracking-tight text-[#0a0a5c]">Attendance</h1>
        <div className="flex items-center gap-3">
          {mode === "cli" && (
            <button
              onClick={handleCheckIn}
              disabled={checkingIn}
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
          placeholder="Filter by employee..."
          className="w-full rounded-md border border-gray-200 bg-white py-1.5 pl-8 pr-3 text-xs text-gray-900 placeholder:text-gray-400 focus:border-blue-500 focus:outline-none"
        />
      </div>

      {/* Table */}
      <div className="overflow-hidden rounded-md border border-gray-200 bg-white">
        <div className="grid grid-cols-[2fr_1fr_1fr_1fr] gap-4 border-b border-gray-200 bg-gray-50 px-4 py-2.5">
          <span className="font-mono text-[10px] font-semibold uppercase tracking-wider text-gray-400">Employee</span>
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
              <li key={block.contractId} className="grid grid-cols-[2fr_1fr_1fr_1fr] items-center gap-4 px-4 py-3 hover:bg-gray-50">
                <span className="text-sm text-gray-900">{block.employee}</span>
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
