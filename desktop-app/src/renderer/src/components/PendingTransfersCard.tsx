import { useState } from 'react'
import { useWallet } from '../context/WalletContext'
import { ArrowDownToLine, ChevronDown, ChevronUp, Loader2, X } from 'lucide-react'

/**
 * PendingTransfersCard — Assets-page surface for incoming CC transfer
 * offers that the wallet has not yet accepted.
 *
 * Canton defaults Splice transfers to the two-step (offer) mode: when
 * someone sends CC to this wallet, the funds are locked in a
 * `TransferInstruction` contract that the recipient must explicitly
 * exercise `TransferInstruction_Accept` to claim. Offers expire after
 * `executeBefore` (24h by default) and return to the sender.
 *
 * Layout (compact by default, expands on tap):
 *
 *   ┌────────────────────────────────────────────────────────────────────┐
 *   │ ⤓ 3 incoming offers · 850.5000 CC total     [Reject all] [Accept] [▾]│  <- banner
 *   └────────────────────────────────────────────────────────────────────┘
 *
 *   - **No wallet or no offers** → returns `null` (the Assets page is
 *     an asset table; we don't compete for attention when there's
 *     nothing to do).
 *   - **Has offers, collapsed (default)** → one compact banner row:
 *     icon, count, total amount, accept-all + reject-all + expand toggle.
 *   - **Expanded** → the original per-row table (FROM / AMOUNT /
 *     EXPIRES / ACTION with per-row Accept / Reject + inline error
 *     chips).
 *   - **Mutual exclusion**: while ANY accept/reject is in-flight, ALL
 *     action buttons (banner + per-row) are disabled — single shared
 *     in-flight cid.
 *   - **Accept-all / Reject-all** walk the list sequentially, stopping
 *     on the first failure (the error surfaces inline on the failing
 *     row once the user expands the panel).
 */

function formatAmount(value: string | number | undefined): string {
  if (value === undefined || value === null || value === '') return '0'
  const n = typeof value === 'number' ? value : parseFloat(value)
  if (Number.isNaN(n)) return String(value)
  return n.toLocaleString('en-US', { maximumFractionDigits: 10 })
}

/** Truncate a Canton partyId: first 8 + … + last 6 (or 14 total). */
function truncateParty(party: string): string {
  if (!party) return ''
  if (party.length <= 18) return party
  return `${party.slice(0, 8)}…${party.slice(-6)}`
}

/**
 * Format the time until `iso` (relative, "in 23h 47m"). Returns
 * "expired" when in the past, "—" when the input is unparseable.
 */
function formatRelativeExpiry(iso: string): {
  label: string
  urgent: boolean
  expired: boolean
} {
  if (!iso) return { label: '—', urgent: false, expired: false }
  const target = Date.parse(iso)
  if (Number.isNaN(target)) return { label: '—', urgent: false, expired: false }
  const ms = target - Date.now()
  if (ms <= 0) return { label: 'expired', urgent: true, expired: true }

  const totalMinutes = Math.floor(ms / 60_000)
  const days = Math.floor(totalMinutes / (60 * 24))
  const hours = Math.floor((totalMinutes % (60 * 24)) / 60)
  const minutes = totalMinutes % 60

  let label: string
  if (days > 0) label = `in ${days}d ${hours}h`
  else if (hours > 0) label = `in ${hours}h ${minutes}m`
  else label = `in ${minutes}m`

  // "Urgent" when less than an hour remains.
  const urgent = ms < 60 * 60 * 1000
  return { label, urgent, expired: false }
}

/**
 * Map a Canton / Loop error string onto a short hint for the user.
 * Returns null when no hint applies — the raw error string is shown
 * verbatim in that case.
 */
function hintForError(message: string): string | null {
  const m = message.toLowerCase()
  if (m.includes('operationerror') || m.includes('action failed')) {
    return 'The Canton ledger rejected this action. The offer may have already been accepted, rejected, or expired on-ledger.'
  }
  if (m.includes('expired') || m.includes('execute_before')) {
    return 'The offer has expired on-ledger. It will disappear after the next refresh.'
  }
  if (m.includes('not found') || m.includes('unknown contract')) {
    return 'The TransferInstruction contract is no longer on the ledger.'
  }
  return null
}

export default function PendingTransfersCard() {
  const {
    status,
    loadStatus,
    pendingTransfers,
    pendingTransfersLoading,
    acceptPending,
    rejectPending,
    error: ctxError,
  } = useWallet()

  // Single shared "in-flight" contract id so the card disables ALL
  // action buttons while ANY row's accept/reject is in progress —
  // prevents parallel submits against the same wallet.
  const [inFlightCid, setInFlightCid] = useState<string | null>(null)
  const [rowError, setRowError] = useState<{ cid: string; message: string } | null>(
    null,
  )
  // Banner collapse state — the surface is collapsed by default so the
  // Assets page reads as a balance table until the user opts in.
  const [expanded, setExpanded] = useState(false)

  // Defense-in-depth — Assets already gates on walletPresent, but if the
  // card is ever dropped into a different layout, hide it cleanly.
  if (loadStatus !== 'present' || !status?.exists) return null

  const isAnyInFlight = inFlightCid !== null
  const hasPending = pendingTransfers.length > 0

  // No offers → render nothing. The Assets page is an asset table, not
  // an inbox; the banner only earns its pixels when there's something
  // for the recipient to act on.
  if (!hasPending) return null

  const handleAccept = async (contractId: string) => {
    setRowError(null)
    setInFlightCid(contractId)
    try {
      const r = await acceptPending(contractId)
      if (!r.success) {
        setRowError({ cid: contractId, message: r.error ?? 'Accept failed' })
      }
    } finally {
      setInFlightCid(null)
    }
  }

  const handleReject = async (contractId: string) => {
    setRowError(null)
    setInFlightCid(contractId)
    try {
      const r = await rejectPending(contractId)
      if (!r.success) {
        setRowError({ cid: contractId, message: r.error ?? 'Reject failed' })
      }
    } finally {
      setInFlightCid(null)
    }
  }

  // Sequential batch ops. Stop on the first failure — the error will
  // surface on the failing row once the user expands the panel.
  const handleAcceptAll = async () => {
    setRowError(null)
    for (const t of pendingTransfers) {
      setInFlightCid(t.contractId)
      try {
        const r = await acceptPending(t.contractId)
        if (!r.success) {
          setRowError({ cid: t.contractId, message: r.error ?? 'Accept failed' })
          break
        }
      } finally {
        setInFlightCid(null)
      }
    }
  }

  const handleRejectAll = async () => {
    setRowError(null)
    for (const t of pendingTransfers) {
      setInFlightCid(t.contractId)
      try {
        const r = await rejectPending(t.contractId)
        if (!r.success) {
          setRowError({ cid: t.contractId, message: r.error ?? 'Reject failed' })
          break
        }
      } finally {
        setInFlightCid(null)
      }
    }
  }

  // Banner aggregates — total CC across the pending list, plus a hint
  // about the dominant instrumentId so the row reads naturally.
  const totalAmount = pendingTransfers.reduce((sum, t) => {
    const n = parseFloat(t.amount)
    return sum + (Number.isFinite(n) ? n : 0)
  }, 0)
  const totalDisplay = formatAmount(totalAmount)
  const offerWord = pendingTransfers.length === 1 ? 'offer' : 'offers'
  const instrumentLabel = pendingTransfers[0]?.instrumentId || 'CC'

  return (
    <div className="bg-white border border-brand-border rounded-md overflow-hidden mb-4">
      {/* Compact banner — single row, icon + count + actions. */}
      <div className="flex items-center justify-between gap-3 px-4 py-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-7 h-7 rounded-full bg-brand-light border border-brand-border flex items-center justify-center text-brand-teal flex-shrink-0">
            <ArrowDownToLine size={14} />
          </div>
          <p className="font-sans text-sm text-brand-navy m-0 truncate">
            <span className="font-semibold">
              {pendingTransfers.length} incoming {offerWord}
            </span>
            <span className="text-brand-muted">
              {' '}
              · {totalDisplay} {instrumentLabel} total
            </span>
          </p>
          {pendingTransfersLoading ? (
            <Loader2 size={12} className="animate-spin text-brand-muted flex-shrink-0" />
          ) : null}
          {ctxError ? (
            <span
              className="font-mono text-[10px] uppercase tracking-wider2 text-brand-err truncate"
              title={ctxError}
            >
              · {ctxError}
            </span>
          ) : null}
        </div>
        <div className="flex items-center gap-1.5 flex-shrink-0">
          <button
            type="button"
            onClick={() => void handleRejectAll()}
            disabled={isAnyInFlight}
            className="inline-flex items-center gap-1 py-1 px-2.5 bg-white text-brand-navy border border-brand-border rounded-md font-mono text-[10px] font-bold tracking-wider2 uppercase cursor-pointer hover:bg-brand-light disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Reject all
          </button>
          <button
            type="button"
            onClick={() => void handleAcceptAll()}
            disabled={isAnyInFlight}
            className="inline-flex items-center gap-1 py-1 px-2.5 bg-brand-blue text-white rounded-md font-mono text-[10px] font-bold tracking-wider2 uppercase cursor-pointer hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isAnyInFlight ? <Loader2 size={10} className="animate-spin" /> : null}
            Accept all
          </button>
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            aria-expanded={expanded}
            aria-label={expanded ? 'Collapse incoming offers' : 'Expand incoming offers'}
            className="inline-flex items-center justify-center w-7 h-7 bg-white text-brand-muted border border-brand-border rounded-md cursor-pointer hover:bg-brand-light hover:text-brand-navy transition-colors"
          >
            {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </button>
        </div>
      </div>

      {/* Expanded panel — per-row details + per-row Accept/Reject. */}
      {expanded && (
        <div className="border-t border-brand-border">
          {/* Header row */}
          <div className="grid grid-cols-[2fr_1fr_1fr_auto] gap-4 py-2 px-4 border-b border-brand-border bg-brand-light">
            <span className="font-mono text-[10px] tracking-wider2 text-brand-muted uppercase font-semibold">
              From
            </span>
            <span className="text-right font-mono text-[10px] tracking-wider2 text-brand-muted uppercase font-semibold">
              Amount
            </span>
            <span className="text-right font-mono text-[10px] tracking-wider2 text-brand-muted uppercase font-semibold">
              Expires
            </span>
            <span className="text-right font-mono text-[10px] tracking-wider2 text-brand-muted uppercase font-semibold">
              Action
            </span>
          </div>

          <ul className="divide-y divide-brand-border">
            {pendingTransfers.map((t) => {
              const expiry = formatRelativeExpiry(t.executeBefore)
              const rowInFlight = inFlightCid === t.contractId
              const rowErr =
                rowError?.cid === t.contractId ? rowError.message : null
              const hint = rowErr ? hintForError(rowErr) : null
              return (
                <li
                  key={t.contractId}
                  className="grid grid-cols-[2fr_1fr_1fr_auto] gap-4 items-center py-3 px-4 hover:bg-brand-light/40 transition-colors rounded-md"
                >
                  {/* From — truncated partyId */}
                  <div className="flex items-center gap-2 min-w-0">
                    <ArrowDownToLine
                      size={14}
                      className="text-brand-teal flex-shrink-0"
                    />
                    <span
                      className="font-mono text-[11px] text-brand-navy truncate cursor-help"
                      title={t.sender}
                    >
                      {truncateParty(t.sender)}
                    </span>
                  </div>

                  {/* Amount */}
                  <div className="text-right">
                    <p className="font-mono text-sm text-brand-navy m-0 whitespace-nowrap">
                      {formatAmount(t.amount)}{' '}
                      <span className="text-brand-muted text-xs">
                        {t.instrumentId || 'Amulet'}
                      </span>
                    </p>
                  </div>

                  {/* Expires — relative, amber when urgent */}
                  <div className="text-right">
                    <p
                      className={`font-mono text-xs m-0 whitespace-nowrap ${
                        expiry.urgent
                          ? 'text-amber-600 font-semibold'
                          : 'text-brand-muted'
                      }`}
                    >
                      {expiry.label}
                    </p>
                  </div>

                  {/* Action — Accept + Reject buttons (mutual exclusion) */}
                  <div className="text-right">
                    {rowErr ? (
                      <div className="inline-flex flex-col items-end gap-1 max-w-[240px]">
                        <p
                          className="font-mono text-[10px] text-brand-err m-0 whitespace-pre-wrap break-words text-right"
                          title={rowErr}
                        >
                          {hint ?? rowErr}
                        </p>
                        <button
                          type="button"
                          onClick={() => setRowError(null)}
                          className="inline-flex items-center gap-1 py-0.5 px-1.5 bg-white text-brand-muted border border-brand-border rounded text-[9px] font-mono uppercase tracking-wider2 hover:bg-brand-light"
                        >
                          <X size={9} />
                          dismiss
                        </button>
                      </div>
                    ) : (
                      <div className="inline-flex items-center gap-1.5 justify-end">
                        <button
                          type="button"
                          onClick={() => void handleReject(t.contractId)}
                          disabled={isAnyInFlight}
                          title="Reject the offer — returns the locked CC to the sender"
                          className="inline-flex items-center gap-1 py-1 px-2.5 bg-white text-brand-navy border border-brand-border rounded-md font-mono text-[10px] font-bold tracking-wider2 uppercase cursor-pointer hover:bg-brand-light disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          {rowInFlight ? (
                            <Loader2 size={10} className="animate-spin" />
                          ) : null}
                          Reject
                        </button>
                        <button
                          type="button"
                          onClick={() => void handleAccept(t.contractId)}
                          disabled={isAnyInFlight}
                          title="Accept the offer — claims the locked CC into your wallet"
                          className="inline-flex items-center gap-1 py-1 px-2.5 bg-brand-blue text-white rounded-md font-mono text-[10px] font-bold tracking-wider2 uppercase cursor-pointer hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          {rowInFlight ? (
                            <Loader2 size={10} className="animate-spin" />
                          ) : null}
                          Accept
                        </button>
                      </div>
                    )}
                  </div>
                </li>
              )
            })}
          </ul>
        </div>
      )}
    </div>
  )
}
