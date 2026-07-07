import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { MessageSquare, Bot } from 'lucide-react'
import { useEmployees } from '../../context/EmployeeContext'
import { useFlows } from '../../context/FlowContext'
import { StatCards } from './StatCards'
import { HeatmapCard } from './HeatmapCard'
import { CountryChartCard } from './CountryChartCard'
import { EmployeeListCard } from './EmployeeListCard'
import { FlowListCard } from './FlowListCard'
import Drawer from '../Drawer'
import type { RoomRole } from '../../hooks/useRoom'

interface DashboardPageProps {
  roomRole: RoomRole | null
  invite: string | null
  me: { name: string } | null
}

export function DashboardPage({ roomRole, invite, me }: DashboardPageProps) {
  const navigate = useNavigate()
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

export default DashboardPage
