import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts'

interface CountryChartCardProps {
  stats: [string, number][]
}

const COLORS = ['#1A1AE8', '#3EC4C0', '#8B5CF6', '#F59E0B', '#EF4444', '#10B981']

export function CountryChartCard({ stats }: CountryChartCardProps) {
  const data = stats.map(([country, count]) => ({ country, count }))

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-4">
      <div className="mb-3">
        <span className="font-mono text-[10px] uppercase tracking-wider2 text-gray-400 font-semibold">Employees by Country</span>
      </div>
      {data.length === 0 ? (
        <div className="py-8 text-center text-xs text-gray-400">No employees yet</div>
      ) : (
        <div className="h-[200px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} layout="vertical" margin={{ left: 10, right: 20, top: 5, bottom: 5 }}>
              <XAxis type="number" tick={{ fontSize: 10, fill: '#999' }} axisLine={false} tickLine={false} />
              <YAxis type="category" dataKey="country" tick={{ fontSize: 11, fill: '#333', fontWeight: 500 }} axisLine={false} tickLine={false} width={50} />
              <Tooltip
                contentStyle={{ fontSize: 11, borderRadius: 6, border: '1px solid #e5e7eb' }}
                formatter={(value: number) => [`${value} employees`, 'Count']}
              />
              <Bar dataKey="count" radius={[0, 4, 4, 0]} barSize={20}>
                {data.map((_, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  )
}
