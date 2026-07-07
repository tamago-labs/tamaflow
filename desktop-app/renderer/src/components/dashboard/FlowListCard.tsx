import { ArrowRight } from 'lucide-react'
import type { FlowSummary } from '../../ai/types'

interface FlowListCardProps {
  flows: FlowSummary[]
  onNavigate: () => void
}

export function FlowListCard({ flows, onNavigate }: FlowListCardProps) {
  const display = flows.slice(0, 5)

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-4 h-full">
      <div className="flex items-center justify-between mb-3">
        <span className="font-mono text-[10px] uppercase tracking-wider2 text-gray-400 font-semibold">Recent Flows</span>
        <button onClick={onNavigate} className="flex items-center gap-1 text-xs text-[#1A1AE8] font-medium hover:underline cursor-pointer bg-transparent border-0 p-0">
          View all <ArrowRight size={12} />
        </button>
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
              <span className={`px-1.5 py-0.5 text-[9px] font-bold uppercase rounded ${f.status === 'draft' ? 'bg-gray-100 text-gray-600' : f.status === 'active' ? 'bg-green-50 text-green-600' : 'bg-blue-50 text-blue-600'}`}>
                {f.status}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
