import { useEffect, useMemo, useState } from 'react'
import { MessageSquare, Bot, Copy, Check, AlertTriangle } from 'lucide-react'
import { useEmployees } from '../../context/EmployeeContext'
import { useFlows } from '../../context/FlowContext'
import { useCompany } from '../../context/CompanyContext'
import { useWallet } from '../../context/WalletContext'
import { useContracts } from '../../context/ContractsContext'
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
  invite?: string | null
  me?: { name: string } | null
  onNavigate?: (page: any) => void
}

// Format fiscal year start (MM-DD) to show period like "Jan 2025 - Dec 2025"
function formatFiscalYear(fiscalYearStart: string): string {
  const now = new Date()
  const currentYear = now.getFullYear()
  const [month] = fiscalYearStart.split('-')
  const monthNum = parseInt(month, 10)
  
  if (monthNum === 1) {
    // Calendar year: Jan - Dec
    return `Jan ${currentYear} – Dec ${currentYear}`
  }
  
  // Fiscal year spans two calendar years
  const startMonth = new Date(currentYear, monthNum - 1).toLocaleString('en', { month: 'short' })
  const endMonth = new Date(currentYear, monthNum - 2).toLocaleString('en', { month: 'short' })
  return `${startMonth} ${currentYear} – ${endMonth} ${currentYear + 1}`
}

export function DashboardPage({ invite, onNavigate }: DashboardPageProps) {
  const { employees } = useEmployees()
  const { flows } = useFlows()
  const { profile } = useCompany()
  const { status: walletStatus } = useWallet()
  const { totalCheckInHours, heatmapData, fetchEmployees } = useContracts()
  const [teamChatOpen, setTeamChatOpen] = useState(false)
  const [aiChatOpen, setAiChatOpen] = useState(false)
  const [copied, setCopied] = useState(false)

  const settledCount = useMemo(() => {
    let count = 0
    flows.forEach(f => { count += f.settledCount })
    return count
  }, [flows])

  // Fetch attendance data on mount so dashboard has real data
  useEffect(() => {
    if (walletStatus?.partyId) {
      fetchEmployees(walletStatus.partyId)
    }
  }, [walletStatus?.partyId, fetchEmployees])

  const countryStats = useMemo(() => {
    const counts: Record<string, number> = {}
    employees.forEach(e => { counts[e.country] = (counts[e.country] || 0) + 1 })
    return Object.entries(counts).sort((a, b) => b[1] - a[1])
  }, [employees])

  function handleCopyInvite() {
    if (!invite) return
    navigator.clipboard?.writeText(invite).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    })
  }

  return (
    <div className="max-w-7xl mx-auto">
      {/* Header with title and action buttons */}
      <div className="mb-4 flex items-center justify-between">
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

      {/* Company info row */}
      {profile ? (
        <div className="mb-4 flex items-center justify-between bg-white border border-gray-200 rounded-lg px-4 py-3">
          <div className="flex items-center gap-2 text-sm text-gray-600">
            <span className="font-medium text-gray-900">{profile.companyName}</span>
            <span className="text-gray-300">·</span>
            <span>{profile.country}</span>
            {profile.fiscalYearStart && (
              <>
                <span className="text-gray-300">·</span>
                <span>FY {formatFiscalYear(profile.fiscalYearStart)}</span>
              </>
            )}
          </div>
          {invite && (
            <div className="flex items-center gap-2">
              <span className="font-medium text-sm text-gray-900">
                Invite code
              </span> 
              <code className="text-xs text-gray-500 truncate max-w-[120px]" title={invite}>{invite}</code>
              <button onClick={handleCopyInvite} className="p-1 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded transition" title="Copy invite code">
                {copied ? <Check size={12} className="text-green-600" /> : <Copy size={12} />}
              </button>
            </div>
          )}
        </div>
      ) : (
        <div className="mb-4 flex items-center gap-2 bg-amber-50 border border-amber-200 rounded-lg px-4 py-3">
          <AlertTriangle size={16} className="text-amber-600 flex-shrink-0" />
          <span className="text-sm text-amber-800">
            Company profile not set.{' '}
            <button onClick={() => onNavigate?.('settings')} className="font-medium underline hover:text-amber-900 bg-transparent border-0 p-0 cursor-pointer text-sm text-amber-800">
              Set up in Settings
            </button>
          </span>
        </div>
      )}

      {/* Wallet warning */}
      {!walletStatus?.exists && (
        <div className="mb-4 flex items-center gap-2 bg-amber-50 border border-amber-200 rounded-lg px-4 py-3">
          <AlertTriangle size={16} className="text-amber-600 flex-shrink-0" />
          <span className="text-sm text-amber-800">
            Wallet not set up.{' '}
            <button onClick={() => onNavigate?.('assets')} className="font-medium underline hover:text-amber-900 bg-transparent border-0 p-0 cursor-pointer text-sm text-amber-800">
              Set up in Assets
            </button>
          </span>
        </div>
      )}

      {/* Row 1: Stat cards */}
      <StatCards employeeCount={employees.length} settledCount={settledCount} totalCheckInHours={totalCheckInHours} />

      {/* Row 2: Heatmap + Country chart */}
      <div className="grid grid-cols-2 gap-4 mb-4">
        <HeatmapCard data={heatmapData} />
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
