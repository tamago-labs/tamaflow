// HeatmapCard — weekly check-in heatmap.
// Uses real attendance data from ContractsContext.

import { useMemo } from 'react'

interface HeatmapEntry {
  day: string
  hour: string
  count: number
}

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri']
const HOURS = ['00-04', '04-08', '08-12', '12-16', '16-20', '20-24']

interface HeatmapCardProps {
  data: HeatmapEntry[]
}

export function HeatmapCard({ data }: HeatmapCardProps) {
  const maxCount = useMemo(() => {
    return Math.max(1, ...data.map((d) => d.count))
  }, [data])

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-4">
      <p className="font-mono text-[10px] uppercase tracking-wider2 text-gray-400 font-semibold mb-3">
        Check-in Heatmap
      </p>

      <div className="flex gap-1">
        {/* Hour labels */}
        <div className="flex flex-col gap-1 mr-1">
          {HOURS.map((h) => (
            <div key={h} className="h-6 flex items-center">
              <span className="font-mono text-[9px] text-gray-400">{h}</span>
            </div>
          ))}
        </div>

        {/* Grid */}
        <div className="flex gap-1 flex-1">
          {DAYS.map((day) => (
            <div key={day} className="flex flex-col gap-1 flex-1">
              {HOURS.map((hour) => {
                const entry = data.find((d) => d.day === day && d.hour === hour)
                const count = entry?.count || 0
                const intensity = count > 0 ? Math.max(0.2, count / maxCount) : 0
                return (
                  <div
                    key={`${day}-${hour}`}
                    className="h-6 rounded-sm"
                    style={{
                      background: count > 0
                        ? `rgba(26, 26, 232, ${intensity})`
                        : '#f3f4f6'
                    }}
                    title={`${day} ${hour}: ${count} check-in(s)`}
                  />
                )
              })}
            </div>
          ))}
        </div>
      </div>

      {/* Day labels */}
      <div className="flex gap-1 ml-7 mt-1">
        {DAYS.map((day) => (
          <div key={day} className="flex-1 text-center">
            <span className="font-mono text-[9px] text-gray-400">{day}</span>
          </div>
        ))}
      </div>

      {/* Legend */}
      <div className="flex items-center gap-2 mt-3 justify-end">
        <span className="font-mono text-[9px] text-gray-400">Less</span>
        <div className="flex gap-0.5">
          {[0.1, 0.3, 0.5, 0.7, 1.0].map((intensity) => (
            <div
              key={intensity}
              className="w-4 h-4 rounded-sm"
              style={{ background: `rgba(26, 26, 232, ${intensity})` }}
            />
          ))}
        </div>
        <span className="font-mono text-[9px] text-gray-400">More</span>
      </div>
    </div>
  )
}
