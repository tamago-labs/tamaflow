// PendingTransfersCard — Assets-page surface for incoming CC
// transfer offers that the wallet has not yet accepted.
//
// Canton defaults Splice transfers to two-step (offer) mode: when
// someone sends CC to this wallet, the funds are locked in a
// `TransferInstruction` contract that the recipient must explicitly
// exercise `TransferInstruction_Accept` to claim. Offers expire
// after `executeBefore` (24h by default) and return to the sender.
//
// Compact by default (single banner row), expands to a per-row
// table on tap. Returns `null` if the wallet isn't present or there
// are no pending offers — the Assets page is an asset table, not
// an inbox.

import { useState } from 'react'
import { useWallet } from '../context/WalletContext'
import { AlertTriangle, ChevronDown, ChevronUp, Loader2, X } from 'lucide-react'

function formatAmount(value: string | number | undefined): string {
  if (value === undefined || value === null || value === '') return '0'
  const n = typeof value === 'number' ? value : parseFloat(value)
  if (Number.isNaN(n)) return String(value)
  return n.toLocaleString('en-US', { maximumFractionDigits: 10 })
}

/** Truncate a Canton partyId: first 8 + … + last 6. */
function truncateParty(party: string): string {
  if (!party) return ''
  if (party.length <= 18) return party
  return `${party.slice(0, 8)}…${party.slice(-6)}`
}

/** Format time-until as "in 23h 47m" / "in 5m" / "expired". */
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

  const urgent = ms < 60 * 60 * 1000
  return { label, urgent, expired: false }
}

/** Map a Canton / Loop error string onto a short user hint. */
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

export function PendingTransfersCard() {
  const {
    status,
    loadStatus,
    pendingTransfers,
    pendingTransfersLoading,
    acceptPending,
    rejectPending,
    error: ctxError
  } = useWallet()

  const [inFlightCid, setInFlightCid] = useState<string | null>(null)
  const [rowError, setRowError] = useState<{ cid: string; message: string } | null>(
    null
  )
  const [expanded, setExpanded] = useState(false)

  if (loadStatus !== 'present' || !status?.exists) return null
  const hasPending = pendingTransfers.length > 0
  if (!hasPending) return null

  const isAnyInFlight = inFlightCid !== null

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

  const totalAmount = pendingTransfers.reduce((sum, t) => {
    const n = parseFloat(t.amount)
    return sum + (Number.isFinite(n) ? n : 0)
  }, 0)
  const totalDisplay = formatAmount(totalAmount)
  const offerWord = pendingTransfers.length === 1 ? 'offer' : 'offers'
  const instrumentLabel = pendingTransfers[0]?.instrumentId || 'CC'

  return (
    <div className='mb-4 overflow-hidden rounded-md border border-amber-200 bg-amber-50'>
      <div className='flex items-center justify-between gap-3 px-4 py-3'>
        <div className='flex min-w-0 items-center gap-3'>
          <div className='flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full border border-amber-300 bg-amber-100 text-amber-700'>
            <AlertTriangle size={14} />
          </div>
          <p className='m-0 truncate font-sans text-sm text-amber-900'>
            <span className='font-semibold'>
              {pendingTransfers.length} incoming {offerWord}
            </span>
            <span className='text-amber-800'>
              {' '}
              · {totalDisplay} {instrumentLabel} total
            </span>
          </p>
          {pendingTransfersLoading ? (
            <Loader2 size={12} className='flex-shrink-0 animate-spin text-amber-700' />
          ) : null}
          {ctxError ? (
            <span
              className='m-0 truncate font-mono text-[10px] uppercase tracking-wider2 text-brand-err'
              title={ctxError}
            >
              · {ctxError}
            </span>
          ) : null}
        </div>
        <div className='flex flex-shrink-0 items-center gap-1.5'>
          <button
            type='button'
            onClick={() => void handleRejectAll()}
            disabled={isAnyInFlight}
            className='inline-flex cursor-pointer items-center gap-1 rounded-md border border-brand-border bg-white px-2.5 py-1 font-mono text-[10px] font-bold uppercase tracking-wider2 text-brand-navy hover:bg-brand-light disabled:cursor-not-allowed disabled:opacity-50'
          >
            Reject all
          </button>
          <button
            type='button'
            onClick={() => void handleAcceptAll()}
            disabled={isAnyInFlight}
            className='inline-flex cursor-pointer items-center gap-1 rounded-md border-0 bg-brand-blue px-2.5 py-1 font-mono text-[10px] font-bold uppercase tracking-wider2 text-white hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50'
          >
            {isAnyInFlight ? <Loader2 size={10} className='animate-spin' /> : null}
            Accept all
          </button>
          <button
            type='button'
            onClick={() => setExpanded((v) => !v)}
            aria-expanded={expanded}
            aria-label={
              expanded ? 'Collapse incoming offers' : 'Expand incoming offers'
            }
            className='inline-flex h-7 w-7 cursor-pointer items-center justify-center rounded-md border border-brand-border bg-white text-brand-muted transition-colors hover:bg-brand-light hover:text-brand-navy'
          >
            {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </button>
        </div>
      </div>

      {expanded && (
        <div className='border-t border-brand-border'>
          <div className='grid grid-cols-[2fr_1fr_1fr_auto] gap-4 border-b border-brand-border bg-brand-light px-4 py-2'>
            <span className='font-mono text-[10px] font-semibold uppercase tracking-wider2 text-brand-muted'>
              From
            </span>
            <span className='text-right font-mono text-[10px] font-semibold uppercase tracking-wider2 text-brand-muted'>
              Amount
            </span>
            <span className='text-right font-mono text-[10px] font-semibold uppercase tracking-wider2 text-brand-muted'>
              Expires
            </span>
            <span className='text-right font-mono text-[10px] font-semibold uppercase tracking-wider2 text-brand-muted'>
              Action
            </span>
          </div>

          <ul className='divide-y divide-brand-border'>
            {pendingTransfers.map((t) => {
              const expiry = formatRelativeExpiry(t.executeBefore)
              const rowInFlight = inFlightCid === t.contractId
              const rowErr =
                rowError?.cid === t.contractId ? rowError.message : null
              const hint = rowErr ? hintForError(rowErr) : null
              return (
                <li
                  key={t.contractId}
                  className='grid grid-cols-[2fr_1fr_1fr_auto] items-center gap-4 rounded-md px-4 py-3 transition-colors hover:bg-brand-light/40'
                >
                  <div className='flex min-w-0 items-center gap-2'>
                    <AlertTriangle
                      size={14}
                      className='flex-shrink-0 text-amber-600'
                    />
                    <span
                      className='m-0 cursor-help truncate font-mono text-[11px] text-brand-navy'
                      title={t.sender}
                    >
                      {truncateParty(t.sender)}
                    </span>
                  </div>

                  <div className='text-right'>
                    <p className='m-0 whitespace-nowrap font-mono text-sm text-brand-navy'>
                      {formatAmount(t.amount)}{' '}
                      <span className='text-xs text-brand-muted'>
                        {t.instrumentId || 'Amulet'}
                      </span>
                    </p>
                  </div>

                  <div className='text-right'>
                    <p
                      className={`m-0 whitespace-nowrap font-mono text-xs ${
                        expiry.urgent
                          ? 'font-semibold text-amber-600'
                          : 'text-brand-muted'
                      }`}
                    >
                      {expiry.label}
                    </p>
                  </div>

                  <div className='text-right'>
                    {rowErr ? (
                      <div className='inline-flex max-w-[240px] flex-col items-end gap-1'>
                        <p
                          className='m-0 whitespace-pre-wrap break-words text-right font-mono text-[10px] text-brand-err'
                          title={rowErr}
                        >
                          {hint ?? rowErr}
                        </p>
                        <button
                          type='button'
                          onClick={() => setRowError(null)}
                          className='inline-flex items-center gap-1 rounded border border-brand-border bg-white px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-wider2 text-brand-muted hover:bg-brand-light'
                        >
                          <X size={9} />
                          dismiss
                        </button>
                      </div>
                    ) : (
                      <div className='inline-flex items-center justify-end gap-1.5'>
                        <button
                          type='button'
                          onClick={() => void handleReject(t.contractId)}
                          disabled={isAnyInFlight}
                          title='Reject the offer — returns the locked CC to the sender'
                          className='inline-flex cursor-pointer items-center gap-1 rounded-md border border-brand-border bg-white px-2.5 py-1 font-mono text-[10px] font-bold uppercase tracking-wider2 text-brand-navy hover:bg-brand-light disabled:cursor-not-allowed disabled:opacity-50'
                        >
                          {rowInFlight ? (
                            <Loader2 size={10} className='animate-spin' />
                          ) : null}
                          Reject
                        </button>
                        <button
                          type='button'
                          onClick={() => void handleAccept(t.contractId)}
                          disabled={isAnyInFlight}
                          title='Accept the offer — claims the locked CC into your wallet'
                          className='inline-flex cursor-pointer items-center gap-1 rounded-md border-0 bg-brand-blue px-2.5 py-1 font-mono text-[10px] font-bold uppercase tracking-wider2 text-white hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50'
                        >
                          {rowInFlight ? (
                            <Loader2 size={10} className='animate-spin' />
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

export default PendingTransfersCard
