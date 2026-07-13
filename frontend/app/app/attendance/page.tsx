"use client";

/**
 * Attendance Page — Timesheet-style check-in for employees.
 * Shows 24-hour daily slots with checkboxes. Select hours → check in.
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import { Clock, Search, CheckCircle2, Circle, Loader2 } from "lucide-react";
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
  offset: number;
}

const HOURS = Array.from({ length: 24 }, (_, i) => i);

function formatHour(h: number): string {
  return `${String(h).padStart(2, "0")}:00`;
}

function todayKey(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function todayDate(): string {
  const d = new Date();
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

function parseRecord(c: Record<string, unknown>): EmployeeRecord {
  const entry = (c.contractEntry as Record<string, unknown>)?.JsActiveContract as Record<string, unknown> | undefined;
  const createdEvent = entry?.createdEvent as Record<string, unknown> | undefined;
  const arg = (createdEvent?.createArgument as Record<string, unknown>) || {};
  return {
    contractId: (createdEvent?.contractId as string) || "",
    employer: (arg.employer as string) || "",
    employee: (arg.employee as string) || "",
    companyName: (arg.companyName as string) || "",
    displayName: (arg.displayName as string) || "",
    role: (arg.role as string) || "",
    blocks: (arg.blocks as Record<string, BlockInfo>) || {},
    offset: (createdEvent?.offset as number) || 0,
  };
}

function deduplicate(records: EmployeeRecord[]): EmployeeRecord[] {
  const latestByCompany = new Map<string, EmployeeRecord>();
  for (const r of records) {
    const existing = latestByCompany.get(r.companyName);
    if (!existing || r.offset > existing.offset) {
      latestByCompany.set(r.companyName, r);
    }
  }
  return Array.from(latestByCompany.values());
}

export default function AttendancePage() {
  const { mode, cliPartyId } = useWalletMode();
  const [records, setRecords] = useState<EmployeeRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [checkingIn, setCheckingIn] = useState(false);
  const [search, setSearch] = useState("");
  const [selectedDate] = useState(todayKey());
  const [selectedHours, setSelectedHours] = useState<Set<number>>(new Set());

  const fetchRecords = useCallback(async () => {
    setLoading(true);
    try {
      const result = await cli.contracts.query("TamaFlow.Company.EmployeeRecord:EmployeeRecord");
      if (Array.isArray(result)) {
        setRecords(deduplicate(result.map(parseRecord)));
      }
    } catch (e) {
      console.error("[Attendance] Failed to fetch records:", e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (mode === "cli" && cliPartyId) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      fetchRecords();
    }
  }, [mode, cliPartyId, fetchRecords]);

  const latestRecord = useMemo(() => {
    if (records.length === 0) return null;
    return records.reduce((a, b) => (a.offset > b.offset ? a : b));
  }, [records]);

  // Find which hours already have blocks on the selected date
  const existingByHour = useMemo(() => {
    const map = new Map<number, BlockInfo>();
    if (!latestRecord) return map;

    const dateBase = new Date(selectedDate + "T00:00:00Z");
    for (const h of HOURS) {
      const slotStart = new Date(dateBase);
      slotStart.setUTCHours(h, 0, 0, 0);
      const slotEnd = new Date(dateBase);
      slotEnd.setUTCHours(h + 1, 0, 0, 0);

      for (const block of Object.values(latestRecord.blocks)) {
        const bStart = new Date(block.blockStart);
        const bEnd = new Date(block.blockEnd);
        if (bStart < slotEnd && bEnd > slotStart) {
          map.set(h, block);
          break;
        }
      }
    }
    return map;
  }, [latestRecord, selectedDate]);

  const toggleSlot = (hour: number) => {
    if (existingByHour.has(hour)) return;
    setSelectedHours((prev) => {
      const next = new Set(prev);
      if (next.has(hour)) next.delete(hour);
      else next.add(hour);
      return next;
    });
  };

  const toggleAll = () => {
    const available = HOURS.filter((h) => !existingByHour.has(h));
    const allSelected = available.every((h) => selectedHours.has(h));
    setSelectedHours(allSelected ? new Set() : new Set(available));
  };

  const newSelectionCount = HOURS.filter((h) => selectedHours.has(h) && !existingByHour.has(h)).length;

  const handleCheckIn = useCallback(async () => {
    if (mode !== "cli" || !cliPartyId || !latestRecord || newSelectionCount === 0) return;
    setCheckingIn(true);

    try {
      let currentContractId = latestRecord.contractId;
      const dateBase = new Date(selectedDate + "T00:00:00Z");
      const hoursToCheck = HOURS.filter((h) => selectedHours.has(h) && !existingByHour.has(h));

      for (const h of hoursToCheck) {
        const blockStart = new Date(dateBase);
        blockStart.setUTCHours(h, 0, 0, 0);
        const blockEnd = new Date(dateBase);
        blockEnd.setUTCHours(h + 1, 0, 0, 0);

        await cli.contracts.exercise(
          "TamaFlow.Company.EmployeeRecord:EmployeeRecord",
          currentContractId,
          "CheckIn",
          { blockStart: blockStart.toISOString(), blockEnd: blockEnd.toISOString() }
        );

        // Re-query to get new latest contract (nonconsuming creates new contract)
        const result = await cli.contracts.query("TamaFlow.Company.EmployeeRecord:EmployeeRecord");
        if (Array.isArray(result)) {
          const parsed = deduplicate(result.map(parseRecord));
          const latest = parsed.reduce((a, b) => (a.offset > b.offset ? a : b), parsed[0]);
          if (latest) currentContractId = latest.contractId;
        }
      }

      setSelectedHours(new Set());
      await fetchRecords();
    } catch (e) {
      console.error("[Attendance] Check-in failed:", e);
    } finally {
      setCheckingIn(false);
    }
  }, [mode, cliPartyId, latestRecord, selectedHours, existingByHour, selectedDate, newSelectionCount, fetchRecords]);

  const allBlocks = useMemo(() => {
    if (!latestRecord) return [];
    return Object.entries(latestRecord.blocks)
      .map(([blockId, block]) => ({ blockId, ...block }))
      .sort((a, b) => new Date(b.blockStart).getTime() - new Date(a.blockStart).getTime());
  }, [latestRecord]);

  const filteredBlocks = allBlocks.filter((b) => {
    const q = search.trim().toLowerCase();
    if (!q) return true;
    return b.status.toLowerCase().includes(q);
  });

  const totalChecked = existingByHour.size;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-light tracking-tight text-[#0a0a5c]">Attendance</h1>
        <div className="flex items-center gap-3">
          {mode === "cli" && latestRecord && (
            <button
              onClick={handleCheckIn}
              disabled={checkingIn || newSelectionCount === 0}
              className="flex items-center gap-1.5 rounded-md bg-green-600 px-4 py-2 text-xs font-bold uppercase tracking-wider text-white hover:opacity-90 disabled:opacity-50"
            >
              {checkingIn ? (
                <Loader2 size={12} className="animate-spin" />
              ) : (
                <Clock size={12} />
              )}
              {checkingIn
                ? `Checking in ${newSelectionCount} slot${newSelectionCount > 1 ? "s" : ""}...`
                : `Check In${newSelectionCount > 0 ? ` (${newSelectionCount})` : ""}`}
            </button>
          )}
        </div>
      </div>

      {/* Position info */}
      {latestRecord && (
        <div className="rounded-md border border-gray-200 bg-white p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-900">{latestRecord.companyName}</p>
              <p className="text-xs text-gray-500">
                {latestRecord.displayName} {latestRecord.role ? `· ${latestRecord.role}` : ""}
              </p>
            </div>
            <div className="text-right">
              <p className="text-xs text-gray-400">{totalChecked}/24 hours checked</p>
            </div>
          </div>
        </div>
      )}

      {/* Timesheet Grid */}
      {latestRecord && (
        <div className="rounded-md border border-gray-200 bg-white">
          <div className="flex items-center justify-between border-b border-gray-200 bg-gray-50 px-4 py-2.5">
            <span className="font-mono text-[10px] font-semibold uppercase tracking-wider text-gray-400">
              Daily Timesheet — {todayDate()}
            </span>
            <button
              onClick={toggleAll}
              className="text-[10px] font-semibold text-blue-600 hover:text-blue-800"
            >
              {HOURS.filter((h) => !existingByHour.has(h)).every((h) => selectedHours.has(h))
                ? "Deselect All"
                : "Select All"}
            </button>
          </div>

          <div className="grid grid-cols-[40px_1fr_80px] gap-0">
            {HOURS.map((h) => {
              const existing = existingByHour.get(h);
              const isSelected = selectedHours.has(h) && !existing;

              return (
                <div key={h} className="contents">
                  {/* Checkbox */}
                  <div className="flex items-center justify-center border-b border-r border-gray-100 px-2 py-2.5">
                    <button
                      onClick={() => toggleSlot(h)}
                      disabled={!!existing}
                      className="flex h-5 w-5 items-center justify-center"
                    >
                      {existing ? (
                        <CheckCircle2 size={16} className="text-green-600" />
                      ) : isSelected ? (
                        <CheckCircle2 size={16} className="text-blue-600" />
                      ) : (
                        <Circle size={16} className="text-gray-300 hover:text-gray-400" />
                      )}
                    </button>
                  </div>

                  {/* Time range */}
                  <div className={`flex items-center border-b border-r border-gray-100 px-3 py-2.5 ${existing ? "bg-green-50" : isSelected ? "bg-blue-50" : ""}`}>
                    <span className={`text-xs ${existing ? "font-medium text-green-800" : isSelected ? "font-medium text-blue-800" : "text-gray-600"}`}>
                      {formatHour(h)} - {formatHour((h + 1) % 24)}
                    </span>
                  </div>

                  {/* Status */}
                  <div className="flex items-center border-b border-gray-100 px-3 py-2.5">
                    {existing ? (
                      <span className={`inline-flex w-fit rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${
                        existing.status === "Confirmed" ? "bg-green-100 text-green-700" :
                        existing.status === "Rejected" ? "bg-red-100 text-red-700" :
                        "bg-yellow-100 text-yellow-700"
                      }`}>
                        {existing.status}
                      </span>
                    ) : isSelected ? (
                      <span className="text-[10px] font-medium text-blue-600">Selected</span>
                    ) : null}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Block History */}
      {latestRecord && (
        <div className="overflow-hidden rounded-md border border-gray-200 bg-white">
          <div className="flex items-center justify-between border-b border-gray-200 bg-gray-50 px-4 py-2.5">
            <span className="font-mono text-[10px] font-semibold uppercase tracking-wider text-gray-400">
              Block History
            </span>
            <div className="relative">
              <Search size={12} className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Filter..."
                className="w-32 rounded-md border border-gray-200 bg-white py-1 pl-6 pr-2 text-[10px] text-gray-900 placeholder:text-gray-400 focus:border-blue-500 focus:outline-none"
              />
            </div>
          </div>

          {filteredBlocks.length === 0 ? (
            <div className="py-12 text-center text-sm text-gray-400">
              {loading ? "Loading..." : "No blocks yet — check in using the timesheet above"}
            </div>
          ) : (
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-100">
                  <th className="px-4 py-2 text-left font-mono text-[10px] font-semibold uppercase tracking-wider text-gray-400">Date</th>
                  <th className="px-4 py-2 text-left font-mono text-[10px] font-semibold uppercase tracking-wider text-gray-400">Start</th>
                  <th className="px-4 py-2 text-left font-mono text-[10px] font-semibold uppercase tracking-wider text-gray-400">End</th>
                  <th className="px-4 py-2 text-left font-mono text-[10px] font-semibold uppercase tracking-wider text-gray-400">Duration</th>
                  <th className="px-4 py-2 text-left font-mono text-[10px] font-semibold uppercase tracking-wider text-gray-400">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filteredBlocks.map((block) => {
                  const start = new Date(block.blockStart);
                  const end = new Date(block.blockEnd);
                  const durationMs = end.getTime() - start.getTime();
                  const durationH = Math.round(durationMs / 3600000 * 10) / 10;
                  const dateStr = start.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
                  const startStr = start.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
                  const endStr = end.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });

                  return (
                    <tr key={block.blockId} className="hover:bg-gray-50">
                      <td className="px-4 py-2.5 text-xs text-gray-900">{dateStr}</td>
                      <td className="px-4 py-2.5 text-xs text-gray-600">{startStr}</td>
                      <td className="px-4 py-2.5 text-xs text-gray-600">{endStr}</td>
                      <td className="px-4 py-2.5 text-xs text-gray-600">{durationH}h</td>
                      <td className="px-4 py-2.5">
                        <span className={`inline-flex w-fit rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${
                          block.status === "Confirmed" ? "bg-green-100 text-green-700" :
                          block.status === "Rejected" ? "bg-red-100 text-red-700" :
                          "bg-yellow-100 text-yellow-700"
                        }`}>
                          {block.status}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* No positions */}
      {!loading && records.length === 0 && (
        <div className="rounded-md border border-gray-200 bg-white py-12 text-center text-sm text-gray-400">
          No positions found. Ask your employer to add you as an employee first.
        </div>
      )}
    </div>
  );
}
