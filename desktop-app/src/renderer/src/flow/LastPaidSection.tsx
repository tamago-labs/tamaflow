// Last-paid history view shown inside the Payee card body.
//
// Reads every settled route for the bound employee via
// `useFlows().listRoutes(flowId)`, filters by employeeId, sorts
// by completedAt desc, and renders the most recent entry as a small
// summary row + a one-line list of older entries (capped at 2).
//
// Subscribes to `flows:onProgress` so a settle event updates the card
// live without a page reload.

import { useEffect, useState } from 'react'
import { BORDER, MUTED, NAVY, monoFont, sansFont } from './theme'
import { useFlows } from '../context/FlowContext'
import type { RouteSummary } from '../../../preload/index.d'

interface LastPaidSectionProps {
  flowId: string
  employeeId: string
}

const HISTORY_LIMIT = 3

export default function LastPaidSection({
  flowId,
  employeeId,
}: LastPaidSectionProps) {
  const { listRoutes, onProgress } = useFlows()
  const [routes, setRoutes] = useState<RouteSummary[]>([])
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    let cancelled = false
    const load = async () => {
      try {
        const all = await listRoutes(flowId)
        if (cancelled) return
        // Filter to this employee, sort newest first, drop non-settled.
        const settled = all
          .filter(
            (r) =>
              r.employeeId === employeeId &&
              (r.status === 'settled' || r.status === 'memoized'),
          )
          .sort((a, b) => {
            const ta = a.completedAt ?? ''
            const tb = b.completedAt ?? ''
            return ta < tb ? 1 : -1
          })
        setRoutes(settled)
        setLoaded(true)
      } catch (err) {
        console.error('[LastPaidSection] failed to load routes:', err)
        if (!cancelled) setLoaded(true)
      }
    }
    void load()
    const off = onProgress((updatedFlowId, next) => {
      if (updatedFlowId !== flowId) return
      const settled = next
        .filter(
          (r) =>
            r.employeeId === employeeId &&
            (r.status === 'settled' || r.status === 'memoized'),
        )
        .sort((a, b) => {
          const ta = a.completedAt ?? ''
          const tb = b.completedAt ?? ''
          return ta < tb ? 1 : -1
        })
      setRoutes(settled)
    })
    return () => {
      cancelled = true
      off?.()
    }
  }, [flowId, employeeId, listRoutes, onProgress])

  if (!loaded) {
    return (
      <div
        style={{
          fontFamily: monoFont,
          fontSize: 9,
          letterSpacing: '0.06em',
          textTransform: 'uppercase',
          color: MUTED,
          fontStyle: 'italic',
          marginTop: 4,
        }}
      >
        Loading history…
      </div>
    )
  }

  if (routes.length === 0) {
    return (
      <div
        style={{
          fontFamily: monoFont,
          fontSize: 9,
          letterSpacing: '0.06em',
          textTransform: 'uppercase',
          color: MUTED,
          fontStyle: 'italic',
          marginTop: 4,
        }}
      >
        No previous payments recorded
      </div>
    )
  }

  const [latest, ...older] = routes.slice(0, HISTORY_LIMIT)

  return (
    <div style={{ marginTop: 4, display: 'flex', flexDirection: 'column', gap: 4 }}>
      <div
        style={{
          fontFamily: monoFont,
          fontSize: 8,
          letterSpacing: '0.14em',
          textTransform: 'uppercase',
          color: MUTED,
        }}
      >
        Last paid ({routes.length})
      </div>
      <RouteRow route={latest} />
      {older.map((r) => (
        <RouteRow key={r.id} route={r} muted />
      ))}
      {routes.length > HISTORY_LIMIT && (
        <div
          style={{
            fontFamily: monoFont,
            fontSize: 8,
            letterSpacing: '0.06em',
            textTransform: 'uppercase',
            color: MUTED,
            opacity: 0.7,
          }}
        >
          +{routes.length - HISTORY_LIMIT} earlier
        </div>
      )}
    </div>
  )
}

function RouteRow({ route, muted }: { route: RouteSummary; muted?: boolean }) {
  const completedDate = route.completedAt
    ? route.completedAt.slice(0, 10)
    : '—'
  return (
    <div
      style={{
        padding: '4px 6px',
        background: muted ? '#f7f7fc' : 'rgba(26,26,232,0.04)',
        border: '1px solid ' + BORDER,
        borderRadius: 4,
        fontFamily: sansFont,
        fontSize: 10,
        color: NAVY,
        display: 'flex',
        flexDirection: 'column',
        gap: 2,
        opacity: muted ? 0.8 : 1,
      }}
    >
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'baseline',
          gap: 6,
        }}
      >
        <span
          style={{
            fontFamily: monoFont,
            fontSize: 9,
            color: MUTED,
            letterSpacing: '0.06em',
          }}
        >
          {completedDate}
        </span>
        <span style={{ fontWeight: 600 }}>
          {route.grossPay} {route.payCurrency}
        </span>
      </div>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'baseline',
          gap: 6,
        }}
      >
        <span
          style={{
            fontFamily: monoFont,
            fontSize: 9,
            color: MUTED,
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            maxWidth: 130,
          }}
          title={route.txHash ?? ''}
        >
          {route.txHash ? `${route.txHash.slice(0, 10)}…` : '—'}
        </span>
        <span
          style={{
            fontFamily: monoFont,
            fontSize: 9,
            color: MUTED,
            letterSpacing: '0.04em',
          }}
        >
          {route.amountCC} CC
        </span>
      </div>
    </div>
  )
}