import { useMemo, useState } from 'react'
import { MessageSquare, Bot } from 'lucide-react'
import { useEmployees } from '../../context/EmployeeContext'
import { useFlows } from '../../context/FlowContext'
import { StatCards } from '../dashboard/StatCards'
import { HeatmapCard } from '../dashboard/HeatmapCard'
import { CountryChartCard } from '../dashboard/CountryChartCard'
import { EmployeeListCard } from '../dashboard/EmployeeListCard'
import { FlowListCard } from '../dashboard/FlowListCard'
import { TeamChatDrawer } from '../dashboard/TeamChatDrawer'
import { AIChatDrawer } from '../dashboard/AIChatDrawer'
import type { RoomRole } from '../../hooks/useRoom'

interface DashboardPageProps {
  roomRole: RoomRole | null
  invite: string | null
  me: { name: string } | null
  onNavigate?: (page: string) => void
}

export function DashboardPage({ roomRole, invite, me, onNavigate }: DashboardPageProps) {
  const { employees } = useEmployees()
  const { flows } = useFlows()
  const [teamChatOpen, setTeamChatOpen] = useState(false)
  const [aiChatOpen, setAiChatOpen] = useState(false)

  const settledCount = useMemo(() => {
    let count = 0
    flows.forEach(f => { count += f.settledCount })
    return count
  }, [flows])

  const countryStats = useMemo(() => {
    const counts: Record<string, number> = {}
    employees.forEach(e => { counts[e.country] = (counts[e.country] || 0) + 1 })
    return Object.entries(counts).sort((a, b) => b[1] - a[1])
  }, [employees])

  return (
    <div className="max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <h1 className="m-0 text-2xl font-light tracking-tight text-[#0a0a5c]">Dashboard</h1>
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
      <StatCards employeeCount={employees.length} settledCount={settledCount} />

      {/* Row 2: Heatmap + Country chart */}
      <div className="grid grid-cols-2 gap-4 mb-4">
        <HeatmapCard />
        <CountryChartCard stats={countryStats} />
      </div>

      {/* Row 3: Employee list (70%) + Flow list (30%) */}
      <div className="grid grid-cols-[7fr_3fr] gap-4">
        <EmployeeListCard employees={employees} onNavigate={() => onNavigate?.('employees')} />
        <FlowListCard flows={flows} onNavigate={() => onNavigate?.('flow-builder')} />
      </div>

      {/* Team Chat Drawer */}
      <TeamChatDrawer open={teamChatOpen} onClose={() => setTeamChatOpen(false)} />

      {/* AI Chat Drawer */}
      <AIChatDrawer open={aiChatOpen} onClose={() => setAiChatOpen(false)} />
    </div>
  )
}

export default DashboardPage
