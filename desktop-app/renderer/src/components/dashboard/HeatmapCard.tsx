import { useMemo } from 'react'

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri']
const HOURS = ['9am', '10am', '11am', '12pm', '1pm', '2pm', '3pm', '4pm', '5pm']

function generateMockData(): Record<string, number> {
  const data: Record<string, number> = {}
  for (const d of DAYS) {
    for (const h of HOURS) {
      // More check-ins during 10am-2pm, fewer early/late
      const hourIdx = HOURS.indexOf(h)
      const peak = hourIdx >= 1 && hourIdx <= 4 ? 8 : 4
      data[`${d}-${h}`] = Math.floor(Math.random() * peak)
    }
  }
  return data
}

export function HeatmapCard() {
  const data = useMemo(() => generateMockData(), [])
  const maxVal = Math.max(...Object.values(data), 1)

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-4">
      <div className="mb-3">
        <span className="font-mono text-[10px] uppercase tracking-wider2 text-gray-400 font-semibold">Check-in Heatmap</span>
      </div>
      <div className="w-full max-w-[320px] mx-auto">
        <div className="grid gap-0.5" style={{ gridTemplateColumns: `40px repeat(${DAYS.length}, 1fr)` }}>
          <div />
          {DAYS.map(d => <div key={d} className="font-mono text-[9px] text-gray-400 text-center pb-1">{d}</div>)}
          {HOURS.map(h => (
            <div key={h} className="contents">
              <div className="font-mono text-[9px] text-gray-400 text-right pr-1 flex items-center">{h}</div>
              {DAYS.map(d => {
                const val = data[`${d}-${h}`] || 0
                const intensity = val / maxVal
                return (
                  <div
                    key={`${d}-${h}`}
                    className="w-full aspect-square rounded-sm transition-colors"
                    style={{ background: `rgba(26,26,232,${0.1 + intensity * 0.8})` }}
                    title={`${d} ${h}: ${val} check-ins`}
                  />
                )
              })}
            </div>
          ))}
        </div>
      </div>
      <div className="flex items-center justify-end gap-2 mt-3">
        <span className="font-mono text-[9px] text-gray-400">Less</span>
        <div className="flex gap-0.5">
          {[0.1, 0.3, 0.5, 0.7, 0.9].map((v) => (
            <div key={v} className="w-3 h-3 rounded-sm" style={{ background: `rgba(26,26,232,${v})` }} />
          ))}
        </div>
        <span className="font-mono text-[9px] text-gray-400">More</span>
      </div>
    </div>
  )
}
