"use client";

/**
 * Attendance Page — Timesheet-style check-in for employees.
 * 4-column grid (6 hours each). Select hours → check in as single block.
 * Points: 1000 first time, +10 each subsequent.
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
  points: number;
  offset: number;
}

const HOURS = Array.from({ length: 24 }, (_, i) => i);

// 4 columns: 00-06, 06-12, 12-18, 18-00
const COLUMNS = [
  { label: "00:00 – 06:00", hours: [0, 1, 2, 3, 4, 5] },
  { label: "06:00 – 12:00", hours: [6, 7, 8, 9, 10, 11] },
  { label: "12:00 – 18:00", hours: [12, 13, 14, 15, 16, 17] },
  { label: "18:00 – 00:00", hours: [18, 19, 20, 21, 22, 23] },
];

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
    points: (arg.points as number) || 0,
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
  const { connected } = useWalletMode();
  const [records, setRecords] = useState<EmployeeRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [checkingIn, setCheckingIn] = useState(false);
  const [search, setSearch] = useState("");
  const [selectedDate] = useState(todayKey());
  const [selectedHours, setSelectedHours] = useState<Set<number>>(new Set());
  const [pointsMessage, setPointsMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

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
    if (connected) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      fetchRecords();
    }
  }, [connected, fetchRecords]);

  const latestRecord = useMemo(() => {
    if (records.length === 0) return null;
    return records.reduce((a, b) => (a.offset > b.offset ? a : b));
  }, [records]);

  // Find which hours already have blocks on the selected date
  const existingByHour = useMemo(() => {
    const map = new Map<number, BlockInfo>();
    if (!latestRecord) return map;

    // Use local time for date base
    const [y, m, d] = selectedDate.split("-").map(Number);
    for (const h of HOURS) {
      const slotStart = new Date(y, m - 1, d, h, 0, 0, 0);
      const slotEnd = new Date(y, m - 1, d, h + 1, 0, 0, 0);

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

  const newSelectionCount = HOURS.filter((h) => selectedHours.has(h) && !existingByHour.has(h)).length;

  const handleCheckIn = useCallback(async () => {
    if (!connected || !latestRecord || newSelectionCount === 0) return;
    setCheckingIn(true);
    setPointsMessage(null);
    setError(null);

    try {
      const hoursToCheck = HOURS.filter((h) => selectedHours.has(h) && !existingByHour.has(h));
      if (hoursToCheck.length === 0) return;

      // Validate contiguous range
      const sorted = [...hoursToCheck].sort((a, b) => a - b);
      const isContiguous = sorted.every((h, i) => i === 0 || h === sorted[i - 1] + 1);
      if (!isContiguous) {
        setError("Please select a contiguous time range (e.g., 01:00–04:00). Non-contiguous selections are not allowed.");
        setCheckingIn(false);
        return;
      }

      // Single block: first selected hour → last selected hour + 1
      const firstHour = Math.min(...hoursToCheck);
      const lastHour = Math.max(...hoursToCheck);

      // Use local time (not UTC) to avoid timezone confusion
      const [y, m, d] = selectedDate.split("-").map(Number);
      const blockStart = new Date(y, m - 1, d, firstHour, 0, 0, 0);
      const blockEnd = new Date(y, m - 1, d, lastHour + 1, 0, 0, 0);

      await cli.contracts.exercise(
        "TamaFlow.Company.EmployeeRecord:EmployeeRecord",
        latestRecord.contractId,
        "CheckIn",
        { blockStart: blockStart.toISOString(), blockEnd: blockEnd.toISOString() }
      );

      // Determine points earned
      const isFirstCheckin = latestRecord.points === 0;
      const earnedPoints = isFirstCheckin ? 1000 : 10;
      setPointsMessage(
        isFirstCheckin
          ? `Welcome! You earned ${earnedPoints.toLocaleString()} points on your first check-in!`
          : `You earned ${earnedPoints} points!`
      );

      setSelectedHours(new Set());
      await fetchRecords();
    } catch (e) {
      console.error("[Attendance] Check-in failed:", e);
    } finally {
      setCheckingIn(false);
    }
  }, [connected, latestRecord, selectedHours, existingByHour, selectedDate, newSelectionCount, fetchRecords]);

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
      </div>

      {/* Points info banner — Dashboard Welcome card style */}
      <div className="relative bg-brand-navy text-white rounded-lg overflow-hidden p-5">
        {/* Teal halo */}
        <div
          className="absolute -top-20 -right-5 w-[200px] h-[200px] rounded-full pointer-events-none"
          style={{
            background: "radial-gradient(circle, rgba(62, 196, 192, 0.3) 0%, rgba(62, 196, 192, 0) 70%)",
          }}
        />
        <div className="relative flex items-start gap-3">
          <span className="text-xl mt-0.5 flex-shrink-0">🎁</span>
          <div>
            <p className="text-sm font-medium text-white m-0">
              Earn reward points with every check-in
            </p>
            <p className="text-xs text-white/70 mt-1 m-0">
              {latestRecord && latestRecord.points > 0
                ? `You have ${latestRecord.points.toLocaleString()} points. Earn 10 points for each check-in.`
                : "Check in to earn 1,000 points on your first time, then 10 points for each subsequent check-in."}
            </p>
          </div>
        </div>
      </div>

      {/* Points earned message */}
      {pointsMessage && (
        <div className="rounded-md border border-green-200 bg-green-50 p-3 flex items-center gap-2">
          <CheckCircle2 size={14} className="text-green-600 flex-shrink-0" />
          <span className="text-sm text-green-800">{pointsMessage}</span>
        </div>
      )}

      {/* Error message */}
      {error && (
        <div className="rounded-md border border-red-200 bg-red-50 p-3 flex items-center gap-2">
          <span className="text-sm text-red-700">{error}</span>
        </div>
      )}

      {/* Loading state */}
      {loading && !latestRecord && (
        <div className="flex flex-col items-center gap-3 py-16">
          <Loader2 size={24} className="animate-spin text-gray-400" />
          <p className="text-sm text-gray-400">Loading attendance data...</p>
        </div>
      )}

      {/* Timesheet Grid — 4 columns × 6 rows */}
      {latestRecord && (
        <div className="rounded-md border border-gray-200 bg-white">
          <div className="flex items-center justify-between border-b border-gray-200 bg-gray-50 px-4 py-2.5">
            <span className="font-mono text-[10px] font-semibold uppercase tracking-wider text-gray-400">
              Daily Timesheet — {todayDate()}
            </span>
            <div className="flex items-center gap-3">
              <span className="text-xs text-gray-500">
                {latestRecord.displayName} {latestRecord.role ? `· ${latestRecord.role}` : ""} · {latestRecord.companyName}
              </span>
              <span className="text-xs font-semibold text-gray-900">{totalChecked}/24 hours</span>
            </div>
          </div>

          {/* Column headers */}
          <div className="grid grid-cols-4 gap-0 border-b border-gray-200">
            {COLUMNS.map((col) => (
              <div key={col.label} className="px-3 py-2 text-center border-r border-gray-100 last:border-r-0">
                <span className="font-mono text-[10px] font-semibold uppercase tracking-wider text-gray-500">
                  {col.label}
                </span>
              </div>
            ))}
          </div>

          {/* 6 rows × 4 columns */}
          {Array.from({ length: 6 }).map((_, rowIdx) => (
            <div key={rowIdx} className="grid grid-cols-4 gap-0">
              {COLUMNS.map((col) => {
                const h = col.hours[rowIdx];
                const existing = existingByHour.get(h);
                const isSelected = selectedHours.has(h) && !existing;

                return (
                  <div key={h} className={`flex items-center gap-2 border-b border-r border-gray-100 last:border-r-0 px-3 py-2 ${existing ? "bg-green-50" : isSelected ? "bg-blue-50" : ""}`}>
                    <button
                      onClick={() => toggleSlot(h)}
                      disabled={!!existing}
                      className="flex h-5 w-5 items-center justify-center flex-shrink-0"
                    >
                      {existing ? (
                        <CheckCircle2 size={16} className="text-green-600" />
                      ) : isSelected ? (
                        <CheckCircle2 size={16} className="text-blue-600" />
                      ) : (
                        <Circle size={16} className="text-gray-300 hover:text-gray-400" />
                      )}
                    </button>
                    <span className={`text-xs ${existing ? "font-medium text-green-800" : isSelected ? "font-medium text-blue-800" : "text-gray-600"}`}>
                      {formatHour(h)}
                    </span>
                    {existing && (
                      <span className={`ml-auto inline-flex w-fit rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${
                        existing.status === "Confirmed" ? "bg-green-100 text-green-700" :
                        existing.status === "Rejected" ? "bg-red-100 text-red-700" :
                        "bg-yellow-100 text-yellow-700"
                      }`}>
                        {existing.status === "Confirmed" ? "Confirmed" :
                         existing.status === "Rejected" ? "Rejected" :
                         "Pending"}
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          ))}

          {/* Check In button at bottom */}
          <div className="border-t border-gray-200 px-4 py-3">
            <button
              onClick={handleCheckIn}
              disabled={checkingIn || newSelectionCount === 0}
              className="flex items-center justify-center gap-1.5 w-full rounded-md bg-green-600 px-4 py-2 text-xs font-bold uppercase tracking-wider text-white hover:opacity-90 disabled:opacity-50"
            >
              {checkingIn ? (
                <Loader2 size={12} className="animate-spin" />
              ) : (
                <Clock size={12} />
              )}
              {checkingIn
                ? `Checking in...`
                : `Check In${newSelectionCount > 0 ? ` (${newSelectionCount} hour${newSelectionCount > 1 ? "s" : ""})` : ""}`}
            </button>
          </div>
        </div>
      )}

      {/* Block History */}
      {latestRecord && (
        <div className="overflow-hidden rounded-md border border-gray-200 bg-white">
          <div className="flex items-center justify-between border-b border-gray-200 bg-gray-50 px-4 py-2.5">
            <span className="font-mono text-[10px] font-semibold uppercase tracking-wider text-gray-400">
              Attendance History
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
                          {block.status === "Confirmed" ? "Confirmed" :
                           block.status === "Rejected" ? "Rejected" : "Pending"}
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
