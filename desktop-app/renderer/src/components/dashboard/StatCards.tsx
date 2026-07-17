import { Users, Workflow, Clock, FileText } from 'lucide-react'

interface StatCardProps {
  icon: React.ReactNode
  label: string
  value: string
  color: string
}

export function StatCard({ icon, label, value, color }: StatCardProps) {
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

interface StatCardsProps {
  employeeCount: number
  settledCount: number
  totalCheckInHours: number
  payslipTemplateCount: number
}

export function StatCards({ employeeCount, settledCount, totalCheckInHours, payslipTemplateCount }: StatCardsProps) {
  return (
    <div className="grid grid-cols-4 gap-4 mb-4">
      <StatCard icon={<Clock size={18} />} label="Check-in Hours" value={`${totalCheckInHours}h`} color="#3EC4C0" />
      <StatCard icon={<Workflow size={18} />} label="Settled This Month" value={String(settledCount)} color="#1A1AE8" />
      <StatCard icon={<FileText size={18} />} label="Payslip Templates" value={String(payslipTemplateCount)} color="#8B5CF6" />
      <StatCard icon={<Users size={18} />} label="Employees" value={String(employeeCount)} color="#F59E0B" />
    </div>
  )
}
