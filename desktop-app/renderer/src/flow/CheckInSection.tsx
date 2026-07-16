import { useMemo } from 'react'
import { BORDER, MUTED, NAVY, monoFont, sansFont } from './theme'
import { useEmployees } from '../context/EmployeeContext'
import { useContracts } from '../context/ContractsContext'

const HISTORY_LIMIT = 3

interface CheckInSectionProps {
  employeeId: string
}

export default function CheckInSection({ employeeId }: CheckInSectionProps) {
  const { employees: rosterEmployees } = useEmployees()
  const { employees: contractEmployees } = useContracts()

  const selected = rosterEmployees.find((e) => e.id === employeeId) ?? null
  const cantonPartyId = selected?.cantonPartyId?.trim() ?? ''

  const contractEmp = useMemo(() => {
    if (!cantonPartyId) return null
    // Deduplicate: keep only the latest record per employee (highest offset)
    const matches = contractEmployees.filter((e) => e.employee === cantonPartyId)
    if (matches.length === 0) return null
    return matches.reduce((a, b) => (a.offset > b.offset ? a : b))
  }, [cantonPartyId, contractEmployees])

  const blocks = useMemo(() => {
    if (!contractEmp) return []
    return Object.entries(contractEmp.blocks)
      .map(([blockId, block]) => ({ blockId, ...block }))
      .sort((a, b) => new Date(b.blockStart).getTime() - new Date(a.blockStart).getTime())
  }, [contractEmp])

  const totalHours = useMemo(() => {
    if (!contractEmp) return 0
    let totalMs = 0
    for (const block of Object.values(contractEmp.blocks)) {
      const start = new Date(block.blockStart).getTime()
      const end = new Date(block.blockEnd).getTime()
      totalMs += end - start
    }
    return Math.round(totalMs / 3600000 * 10) / 10
  }, [contractEmp])

  if (!cantonPartyId) {
    return <div style={{ marginTop: 4, fontFamily: monoFont, fontSize: 9, letterSpacing: '0.06em', textTransform: 'uppercase', color: MUTED, fontStyle: 'italic' }}>No Canton party ID on this employee</div>
  }

  if (blocks.length === 0) {
    return <div style={{ marginTop: 4, fontFamily: monoFont, fontSize: 9, letterSpacing: '0.06em', textTransform: 'uppercase', color: MUTED, fontStyle: 'italic' }}>No check-ins recorded yet</div>
  }

  const latest = blocks.slice(0, HISTORY_LIMIT)
  return (
    <div style={{ marginTop: 4, display: 'flex', flexDirection: 'column', gap: 4 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 2 }}>
        <div style={{ fontFamily: monoFont, fontSize: 8, letterSpacing: '0.14em', textTransform: 'uppercase', color: MUTED }}>
          Check-in History
        </div>
        <div style={{ fontFamily: monoFont, fontSize: 9, color: NAVY, fontWeight: 700 }}>
          {totalHours}h total
        </div>
      </div>

      {latest.map((block) => {
        const start = new Date(block.blockStart)
        const end = new Date(block.blockEnd)
        const durationMs = end.getTime() - start.getTime()
        const durationH = Math.round(durationMs / 3600000 * 10) / 10
        const dateStr = start.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
        const startStr = start.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
        const endStr = end.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })

        return (
          <div key={block.blockId} style={{ padding: '4px 6px', background: '#f7f7fc', border: '1px solid ' + BORDER, borderRadius: 4, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 6 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
              <span style={{ fontFamily: monoFont, fontSize: 9, color: MUTED, letterSpacing: '0.06em' }}>{dateStr}</span>
              <span style={{ fontFamily: sansFont, fontSize: 10, color: NAVY, whiteSpace: 'nowrap' }}>{startStr} – {endStr}</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
              <span style={{ fontFamily: monoFont, fontSize: 9, color: MUTED }}>{durationH}h</span>
              <span style={{ fontFamily: monoFont, fontSize: 8, letterSpacing: '0.08em', textTransform: 'uppercase', fontWeight: 700, padding: '1px 5px', borderRadius: 8, ...(block.status === 'Confirmed' ? { background: 'rgba(34,197,94,0.12)', color: '#16a34a' } : block.status === 'Rejected' ? { background: 'rgba(200,48,48,0.10)', color: '#c83030' } : { background: 'rgba(251,191,36,0.12)', color: '#b45309' }) }}>
                {block.status}
              </span>
            </div>
          </div>
        )
      })}

      {blocks.length > HISTORY_LIMIT && (
        <div style={{ fontFamily: monoFont, fontSize: 8, letterSpacing: '0.06em', textTransform: 'uppercase', color: MUTED, opacity: 0.7 }}>
          +{blocks.length - HISTORY_LIMIT} earlier
        </div>
      )}
    </div>
  )
}
