import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Users, Workflow, Clock, FileText, MessageSquare, Bot, Copy, Check, ArrowRight } from 'lucide-react'
import { useEmployees } from '../../context/EmployeeContext'
import { useFlows } from '../../context/FlowContext'
import { useRoom, type RoomRole } from '../../hooks/useRoom'
import { useAI } from '../../hooks/useAI'
import { usePrice } from '../../context/PriceContext'
import RouteStatusPill from '../RouteStatusPill'
import Drawer from '../Drawer'
import type { FlowSummary } from '../../ai/types'

// ─── Mock data ─────────────────────────────────────────────────
const MOCK_HOURS = 6.8
const MOCK_DOCS = 12

const MOCK_HEATMAP = (() => {
  const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri']
  const hours = ['9am', '10am', '11am', '12pm', '1pm', '2pm', '3pm', '4pm', '5pm']
  const data: Record<string, number> = {}
  for (const d of days) {
    for (const h of hours) {
      data[`${d}-${h}`] = Math.floor(Math.random() * 10)
    }
  }
  return data
})()

// ─── Dashboard Page ─────────────────────────────────────────────
interface DashboardPageProps {
  roomRole: RoomRole | null
  invite: string | null
  me: { name: string } | null
}

export function DashboardPage({ roomRole, invite, me }: DashboardPageProps) {
  const navigate = useNavigate()
  const { employees } = useEmployees()
  const { flows, listAllRoutes } = useFlows()
  const [teamChatOpen, setTeamChatOpen] = useState(false)
  const [aiChatOpen, setAiChatOpen] = useState(false)
  const [copied, setCopied] = useState(false)

  // Stats
  const thisMonthRoutes = useMemo(async () => {
    try {
      const all = await listAllRoutes()
      const now = new Date()
      const thisMonth = all.filter((r) => {
        const d = new Date(r.completedAt ?? r.createdAt)
        return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear() && r.status === 'settled'
      })
      return thisMonth.length
    } catch { return 0 }
  }, [listAllRoutes])

  const settledCount = useMemo(() => {
    // Simplified - count settled routes
    let count = 0
    flows.forEach(f => { count += f.settledCount })
    return count
  }, [flows])

  const countryStats = useMemo(() => {
    const counts: Record<string, number> = {}
    employees.forEach(e => { counts[e.country] = (counts[e.country] || 0) + 1 })
    return Object.entries(counts).sort((a, b) => b[1] - a[1])
  }, [employees])

  const maxCountryCount = countryStats.length > 0 ? countryStats[0][1] : 1

  function handleCopyInvite() {
    if (!invite) return
    navigator.clipboard?.writeText(invite).then(() => setCopied(true))
  }

  return (
    <div className="max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="m-0 text-2xl font-light tracking-tight text-[#0a0a5c]">Dashboard</h1>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setTeamChatOpen(true)} className="flex items-center gap-1.5 px-3 py-2 text-xs font-bold text-gray-700 bg-white border border-gray-200 rounded-md hover:bg-gray-50 transition">
            <MessageSquare size={14} /> Team Chat
          </button>
          <button onClick={() => setAiChatOpen(true)} className="flex items-center gap-1.5 px-3 py-2 text-xs font-bold text-white bg-[#1A1AE8] rounded-md hover:bg-[#1515c0] transition">
            <Bot size={14} /> Ask AI
          </button>
        </div>
      </div>

      {/* Row 1: Stat cards */}
      <div className="grid grid-cols-4 gap-4 mb-4">
        <StatCard icon={<Clock size={18} />} label="Avg. Daily Hours" value={`${MOCK_HOURS}h`} color="#3EC4C0" />
        <StatCard icon={<Workflow size={18} />} label="Settled This Month" value={String(settledCount)} color="#1A1AE8" />
        <StatCard icon={<FileText size={18} />} label="Payroll Docs" value={String(MOCK_DOCS)} color="#8B5CF6" />
        <StatCard icon={<Users size={18} />} label="Employees" value={String(employees.length)} color="#F59E0B" />
      </div>

      {/* Row 2: Heatmap + Country chart */}
      <div className="grid grid-cols-2 gap-4 mb-4">
        <HeatmapCard data={MOCK_HEATMAP} />
        <CountryChartCard stats={countryStats} maxCount={maxCountryCount} />
      </div>

      {/* Row 3: Employee list (70%) + Flow list (30%) */}
      <div className="grid grid-cols-[7fr_3fr] gap-4">
        <EmployeeListCard employees={employees} onNavigate={() => navigate('/employees')} />
        <FlowListCard flows={flows} onNavigate={() => navigate('/flow-builder')} />
      </div>

      {/* Team Chat Drawer */}
      <Drawer open={teamChatOpen} onClose={() => setTeamChatOpen(false)} title="Team Chat" subtitle="Chat with your team via P2P sync" width="480px">
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <MessageSquare size={40} className="text-gray-300 mb-4" />
          <p className="text-sm text-gray-500 m-0">Team chat coming soon.</p>
          <p className="text-xs text-gray-400 m-0 mt-1">Messages will sync peer-to-peer via Hyperswarm.</p>
        </div>
      </Drawer>

      {/* AI Chat Drawer */}
      <Drawer open={aiChatOpen} onClose={() => setAiChatOpen(false)} title="AI Assistant" subtitle="Ask questions about your payroll data" width="520px">
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <Bot size={40} className="text-gray-300 mb-4" />
          <p className="text-sm text-gray-500 m-0">AI assistant coming soon.</p>
          <p className="text-xs text-gray-400 m-0 mt-1">On-device AI will help analyze your payroll data.</p>
        </div>
      </Drawer>
    </div>
  )
}

// ─── Stat Card ─────────────────────────────────────────────────
function StatCard({ icon, label, value, color }: { icon: React.ReactNode; label: string; value: string; color: string }) {
  return (
    <div className="bg-white border border-gray-200 rounded-lg p-4">
      <div className="flex items-center gap-3 mb-3">
        <div className="w-9 h-9 rounded-lg flex items-center justify-center" style={{ background: `${color}15`, color }}>
          {icon}
        </div>
        <span className="font-mono text-[10px] uppercase tracking-wider2 text-gray-400 font-semibold">{label}</span>
      </div>
      <div className="text-2xl font-bold text-[#0a0a5c]">{value}</div>
    </div>
  )
}

// ─── Heatmap Card ──────────────────────────────────────────────
function HeatmapCard({ data }: { data: Record<string, number> }) {
  const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri']
  const hours = ['9am', '10am', '11am', '12pm', '1pm', '2pm', '3pm', '4pm', '5pm']
  const maxVal = Math.max(...Object.values(data), 1)

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-4">
      <div className="mb-3">
        <span className="font-mono text-[10px] uppercase tracking-wider2 text-gray-400 font-semibold">Check-in Heatmap</span>
      </div>
      <div className="overflow-x-auto">
        <div className="inline-grid gap-0.5" style={{ gridTemplateColumns: `40px repeat(${days.length}, 1fr)` }}>
          <div />
          {days.map(d => <div key={d} className="font-mono text-[9px] text-gray-400 text-center pb-1">{d}</div>)}
          {hours.map(h => (
            <div key={h} className="contents">
              <div className="font-mono text-[9px] text-gray-400 text-right pr-1 flex items-center">{h}</div>
              {days.map(d => {
                const val = data[`${d}-${h}`] || 0
                const intensity = val / maxVal
                return (
                  <div key={`${d}-${h}`} className="w-full aspect-square rounded-sm" style={{ background: `rgba(26,26,232,${0.1 + intensity * 0.8})` }} title={`${d} ${h}: ${val} check-ins`} />
                )
              })}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

// ─── Country Chart Card ────────────────────────────────────────
function CountryChartCard({ stats, maxCount }: { stats: [string, number][]; maxCount: number }) {
  return (
    <div className="bg-white border border-gray-200 rounded-lg p-4">
      <div className="mb-3">
        <span className="font-mono text-[10px] uppercase tracking-wider2 text-gray-400 font-semibold">Employees by Country</span>
      </div>
      {stats.length === 0 ? (
        <div className="py-8 text-center text-xs text-gray-400">No employees yet</div>
      ) : (
        <div className="space-y-2">
          {stats.map(([country, count]) => (
            <div key={country} className="flex items-center gap-3">
              <span className="w-8 font-mono text-[10px] text-gray-600 text-right">{country}</span>
              <div className="flex-1 h-5 bg-gray-100 rounded overflow-hidden">
                <div className="h-full bg-[#1A1AE8] rounded transition-all" style={{ width: `${(count / maxCount) * 100}%` }} />
              </div>
              <span className="w-6 font-mono text-[10px] text-gray-900 font-bold">{count}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Employee List Card ────────────────────────────────────────
function EmployeeListCard({ employees, onNavigate }: { employees: any[]; onNavigate: () => void }) {
  const display = employees.slice(0, 5)
  return (
    <div className="bg-white border border-gray-200 rounded-lg p-4">
      <div className="flex items-center justify-between mb-3">
        <span className="font-mono text-[10px] uppercase tracking-wider2 text-gray-400 font-semibold">Employees</span>
        <button onClick={onNavigate} className="flex items-center gap-1 text-xs text-[#1A1AE8] font-medium hover:underline cursor-pointer bg-transparent border-0 p-0">View all <ArrowRight size={12} /></button>
      </div>
      {display.length === 0 ? (
        <div className="py-8 text-center text-xs text-gray-400">No employees yet</div>
      ) : (
        <div className="divide-y divide-gray-100">
          {display.map(e => (
            <div key={e.id} className="flex items-center justify-between py-2">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-full bg-gray-100 flex items-center justify-center text-xs font-bold text-gray-500">{e.displayName?.[0] || '?'}</div>
                <div>
                  <div className="text-sm font-medium text-gray-900">{e.displayName}</div>
                  <div className="font-mono text-[10px] text-gray-400">{e.country} · {e.payCurrency}</div>
                </div>
              </div>
              <span className={`px-1.5 py-0.5 text-[9px] font-bold uppercase rounded ${e.status === 'active' ? 'bg-green-50 text-green-600' : 'bg-gray-100 text-gray-500'}`}>{e.status}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Flow List Card ────────────────────────────────────────────
function FlowListCard({ flows, onNavigate }: { flows: FlowSummary[]; onNavigate: () => void }) {
  const display = flows.slice(0, 5)
  return (
    <div className="bg-white border border-gray-200 rounded-lg p-4">
      <div className="flex items-center justify-between mb-3">
        <span className="font-mono text-[10px] uppercase tracking-wider2 text-gray-400 font-semibold">Recent Flows</span>
        <button onClick={onNavigate} className="flex items-center gap-1 text-xs text-[#1A1AE8] font-medium hover:underline cursor-pointer bg-transparent border-0 p-0">View all <ArrowRight size={12} /></button>
      </div>
      {display.length === 0 ? (
        <div className="py-8 text-center text-xs text-gray-400">No flows yet</div>
      ) : (
        <div className="divide-y divide-gray-100">
          {display.map(f => (
            <div key={f.id} className="flex items-center justify-between py-2">
              <div>
                <div className="text-sm font-medium text-gray-900 truncate max-w-[150px]">{f.name}</div>
                <div className="font-mono text-[10px] text-gray-400">{f.routeCount} routes</div>
              </div>
              <span className={`px-1.5 py-0.5 text-[9px] font-bold uppercase rounded ${f.status === 'draft' ? 'bg-gray-100 text-gray-600' : f.status === 'active' ? 'bg-green-50 text-green-600' : 'bg-blue-50 text-blue-600'}`}>{f.status}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export default DashboardPage
