import { useState } from 'react'
import { useWallet } from '../context/WalletContext'
import { ArrowDownToLine, Loader2, Wallet, X } from 'lucide-react'

/**
 * PendingTransfersCard — Assets-page hero card listing incoming CC
 * transfer offers that the wallet has not yet accepted.
 *
 * Canton defaults Splice transfers to the two-step (offer) mode: when
 * someone sends CC to this wallet, the funds are locked in a
 * `TransferInstruction` contract that the recipient must explicitly
 * exercise `TransferInstruction_Accept` to claim. Offers expire after
 * `executeBefore` (24h by default) and return to the sender.
 *
 * Rendered on the Assets page ABOVE the holdings table. Styled to match
 * the Dashboard's AI card (navy + halos) but kept compact — just the
 * eyebrow + table. Auto-refresh is handled centrally by WalletContext
 * via `usehooks-ts`'s `useInterval`, so the card only renders.
 *
 * UX:
 *   - No wallet → returns `null` (Assets already gates on
 *     walletPresent, but the check stays so the component is safe to
 *     drop into other layouts).
 *   - Wallet present, no pending → compact empty state.
 *   - Wallet present, has pending → header row + one row per offer with
 *     Accept / Reject buttons.
 *   - Mutual exclusion: while ANY accept/reject is in-flight on this
 *     card, ALL action buttons across ALL rows are disabled (single
 *     shared in-flight cid tracked at card level).
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

  // Defense-in-depth — Assets already gates on walletPresent, but if the
  // card is ever dropped into a different layout, hide it cleanly.
  if (loadStatus !== 'present' || !status?.exists) return null

  const isAnyInFlight = inFlightCid !== null
  const hasPending = pendingTransfers.length > 0

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

  return (
    <div className="relative bg-brand-navy text-white rounded-lg overflow-hidden p-6 lg:p-8 mb-6 flex flex-col">
      {/* Teal halo (top-right) — matches Dashboard AI card */}
      <div
        className="absolute -top-32 -right-32 w-[420px] h-[420px] rounded-full pointer-events-none"
        style={{
          background:
            'radial-gradient(circle, rgba(62, 196, 192, 0.3) 0%, rgba(62, 196, 192, 0) 70%)',
        }}
      />
      {/* Blue halo (bottom-left) — matches Dashboard AI card */}
      <div
        className="absolute -bottom-32 -left-32 w-[420px] h-[420px] rounded-full pointer-events-none"
        style={{
          background:
            'radial-gradient(circle, rgba(26, 26, 232, 0.25) 0%, rgba(26, 26, 232, 0) 70%)',
        }}
      />

      {/* Compact header — just eyebrow + count */}
      <div className="relative mb-4 flex items-center justify-between gap-3">
        <p className="font-mono text-[10px] tracking-wider2 text-brand-teal uppercase font-semibold m-0">
          Pending Transfers
          {hasPending ? (
            <span className="ml-2 text-white/60">· {pendingTransfers.length}</span>
          ) : null}
        </p>
        {pendingTransfersLoading && hasPending ? (
          <Loader2 size={12} className="animate-spin text-white/60" />
        ) : null}
      </div>

      {/* Body */}
      <div className="relative flex-1">
        {/* Global error from context (e.g. refresh failure) */}
        {ctxError && !hasPending && (
          <div className="mb-3 p-3 bg-red-500/10 border border-red-400/30 rounded-md">
            <p className="font-mono text-[10px] font-bold tracking-wider2 uppercase text-red-200 m-0 mb-1">
              Error
            </p>
            <p className="font-sans text-xs text-red-100 m-0 whitespace-pre-wrap break-words">
              {ctxError}
            </p>
          </div>
        )}

        {/* Loading state on first load (no rows yet) */}
        {pendingTransfersLoading && !hasPending && (
          <div className="py-10 text-center font-sans text-sm text-white/70">
            <Loader2
              size={16}
              className="animate-spin inline-block mr-2 align-middle"
            />
            Querying ledger for incoming transfers…
          </div>
        )}

        {/* Empty state */}
        {!pendingTransfersLoading && !hasPending && (
          <div className="flex items-center gap-3 py-6 px-1">
            <div className="w-8 h-8 rounded-full bg-white/10 border border-white/20 flex items-center justify-center text-white/70 flex-shrink-0">
              <Wallet size={16} />
            </div>
            <div className="min-w-0">
              <p className="font-sans text-sm font-medium text-white m-0">
                No incoming transfers
              </p>
              <p className="font-sans text-xs text-white/60 m-0 mt-0.5">
                Offers from other parties will appear here. They expire 24h after being sent.
              </p>
            </div>
          </div>
        )}

        {/* Pending rows */}
        {hasPending && (
          <>
            {/* Header row */}
            <div className="grid grid-cols-[2fr_1fr_1fr_auto] gap-4 py-2 px-3 border-b border-white/20">
              <span className="font-mono text-[10px] tracking-wider2 text-white/60 uppercase font-semibold">
                From
              </span>
              <span className="text-right font-mono text-[10px] tracking-wider2 text-white/60 uppercase font-semibold">
                Amount
              </span>
              <span className="text-right font-mono text-[10px] tracking-wider2 text-white/60 uppercase font-semibold">
                Expires
              </span>
              <span className="text-right font-mono text-[10px] tracking-wider2 text-white/60 uppercase font-semibold">
                Action
              </span>
            </div>

            <ul className="divide-y divide-white/10">
              {pendingTransfers.map((t) => {
                const expiry = formatRelativeExpiry(t.executeBefore)
                const rowInFlight = inFlightCid === t.contractId
                const rowErr =
                  rowError?.cid === t.contractId ? rowError.message : null
                const hint = rowErr ? hintForError(rowErr) : null
                return (
                  <li
                    key={t.contractId}
                    className="grid grid-cols-[2fr_1fr_1fr_auto] gap-4 items-center py-3 px-3 hover:bg-white/5 transition-colors rounded-md"
                  >
                    {/* From — truncated partyId */}
                    <div className="flex items-center gap-2 min-w-0">
                      <ArrowDownToLine
                        size={14}
                        className="text-brand-teal flex-shrink-0"
                      />
                      <span
                        className="font-mono text-[11px] text-white truncate cursor-help"
                        title={t.sender}
                      >
                        {truncateParty(t.sender)}
                      </span>
                    </div>

                    {/* Amount */}
                    <div className="text-right">
                      <p className="font-mono text-sm text-white m-0 whitespace-nowrap">
                        {formatAmount(t.amount)}{' '}
                        <span className="text-white/60 text-xs">
                          {t.instrumentId || 'Amulet'}
                        </span>
                      </p>
                    </div>

                    {/* Expires — relative, amber when urgent */}
                    <div className="text-right">
                      <p
                        className={`font-mono text-xs m-0 whitespace-nowrap ${
                          expiry.urgent
                            ? 'text-amber-300 font-semibold'
                            : 'text-white/70'
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
                            className="font-mono text-[10px] text-red-200 m-0 whitespace-pre-wrap break-words text-right"
                            title={rowErr}
                          >
                            {hint ?? rowErr}
                          </p>
                          <button
                            type="button"
                            onClick={() => setRowError(null)}
                            className="inline-flex items-center gap-1 py-0.5 px-1.5 bg-white/10 text-white/80 border border-white/20 rounded text-[9px] font-mono uppercase tracking-wider2 hover:bg-white/20"
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
                            className="inline-flex items-center gap-1 py-1 px-2.5 bg-transparent text-white border border-white/30 rounded-md font-mono text-[10px] font-bold tracking-wider2 uppercase cursor-pointer hover:bg-white/10 disabled:opacity-50 disabled:cursor-not-allowed"
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
                            className="inline-flex items-center gap-1 py-1 px-2.5 bg-brand-teal text-brand-navy rounded-md font-mono text-[10px] font-bold tracking-wider2 uppercase cursor-pointer hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
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
          </>
        )}
      </div>
    </div>
  )
}