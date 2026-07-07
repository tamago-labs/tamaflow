import { ArrowRight } from 'lucide-react'
import type { Employee } from '../../ai/types'

interface EmployeeListCardProps {
  employees: Employee[]
  onNavigate: () => void
}

export function EmployeeListCard({ employees, onNavigate }: EmployeeListCardProps) {
  const display = employees.slice(0, 5)

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-4 h-full">
      <div className="flex items-center justify-between mb-3">
        <span className="font-mono text-[10px] uppercase tracking-wider2 text-gray-400 font-semibold">Employees</span>
        <button onClick={onNavigate} className="flex items-center gap-1 text-xs text-[#1A1AE8] font-medium hover:underline cursor-pointer bg-transparent border-0 p-0">
          View all <ArrowRight size={12} />
        </button>
      </div>
      {display.length === 0 ? (
        <div className="py-8 text-center text-xs text-gray-400">No employees yet</div>
      ) : (
        <div className="divide-y divide-gray-100">
          {display.map(e => (
            <div key={e.id} className="flex items-center justify-between py-2">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-full bg-gray-100 flex items-center justify-center text-xs font-bold text-gray-500">
                  {e.displayName?.[0] || '?'}
                </div>
                <div>
                  <div className="text-sm font-medium text-gray-900">{e.displayName}</div>
                  <div className="font-mono text-[10px] text-gray-400">{e.country} · {e.payCurrency}</div>
                </div>
              </div>
              <span className={`px-1.5 py-0.5 text-[9px] font-bold uppercase rounded ${e.status === 'active' ? 'bg-green-50 text-green-600' : 'bg-gray-100 text-gray-500'}`}>
                {e.status}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
