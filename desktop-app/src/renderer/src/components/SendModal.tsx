import { useEffect, useState } from 'react'
import { useWallet } from '../context/WalletContext'
import WalletModal from './WalletModal'
import { Loader2, Send } from 'lucide-react'

/**
 * SendModal — transfer CC (Canton Coin) from this wallet's party to a
 * recipient partyId. Uses the Canton Wallet SDK's
 * `sdk.token.transfer.create(...)` under the hood — see
 * `desktop-app/src/main/wallet.ts → transferAmulet`.
 *
 * Flow:
 *   1. User enters a recipient partyId and a human amount (e.g. "100").
 *   2. The renderer asks the main process to transfer; main process
 *      signs the prepared transfer with the wallet's own key and
 *      submits to the validator.
 *   3. On success we show the ledger updateId and refresh holdings.
 *
 * Notes:
 *   - CC has 10 decimal places; the main process pads the user-typed
 *     amount before submission. Users can type "100" or "100.5".
 *   - By default the transfer is TWO-STEP — the recipient must accept
 *     the pending TransferInstruction for funds to land. The button
 *     here submits the offer; downstream acceptance is out of scope
 *     for this UI.
 *   - No balance pre-check on the client: the main process will fail
 *     with a clear error if funds are insufficient.
 */

export default function SendModal() {
  const {
    modal,
    openSendSymbol,
    closeSend,
    transfer,
    refreshHoldings,
  } = useWallet()

  const symbol = openSendSymbol ?? 'CC'
  const open = modal.sendOpen

  // Pre-fill amount whenever a new Send is opened. Reset state on close.
  const [recipient, setRecipient] = useState('')
  const [amount, setAmount] = useState('')
  const [memo, setMemo] = useState('')
  const [isBusy, setIsBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<{
    updateId?: string
    amount?: string
    recipient?: string
  } | null>(null)

  useEffect(() => {
    if (!open) {
      setRecipient('')
      setAmount('')
      setMemo('')
      setError(null)
      setResult(null)
      setIsBusy(false)
    }
  }, [open])

  // Balance pre-check happens in the main process; we just need a
  // sensible upper bound for the UI affordances.

  const handleSend = async () => {

    console.log("helo...")

    setError(null)
    setResult(null)
    setIsBusy(true)
    try {

      console.log("before transfer...")

      const r = await transfer({
        recipient: recipient.trim(),
        amount: amount.trim(),
        memo: memo.trim() || undefined,
      })

       console.log("after transfer...", r)

      if (r.success) {
        setResult({
          updateId: r.updateId,
          amount: r.amount,
          recipient: r.recipient,
        })
        refreshHoldings()
      } else {
        setError(r.error ?? 'Transfer failed')
      }
    } catch (e) {
      console.log("error:", e)
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setIsBusy(false)
    }
  }

  const canSubmit =
    !isBusy &&
    recipient.trim().length >= 10 &&
    !!amount.trim() &&
    parseFloat(amount) > 0

  return (
    <WalletModal
      open={open}
      onClose={closeSend}
      title={`Send ${symbol}`}
      subtitle={`Transfer ${symbol} to another party`}
    >
      <div className="space-y-4">
        <p className="font-sans text-sm text-brand-navy m-0">
          Send Canton Coin to any party on the network. The transfer is
          signed with this wallet's own key and submitted to the validator.
        </p>

        {/* Recipient */}
        <div>
          <label
            htmlFor="send-recipient"
            className="block font-mono text-[10px] uppercase tracking-wider2 text-brand-muted mb-1.5"
          >
            Recipient Party ID
          </label>
          <input
            id="send-recipient"
            type="text"
            value={recipient}
            onChange={(e) => setRecipient(e.target.value)}
            disabled={isBusy}
            placeholder="party-hint::1220abcd…"
            className="w-full px-3 py-2 bg-white border border-brand-border rounded-md font-mono text-xs text-brand-navy focus:outline-none focus:border-brand-blue"
          />
          <p className="font-sans text-[11px] text-brand-muted m-0 mt-1">
            Canton partyId format: <code className="font-mono">hint::fingerprint</code> or
            a raw 64-char hex fingerprint.
          </p>
        </div>

        {/* Amount */}
        <div>
          <label
            htmlFor="send-amount"
            className="block font-mono text-[10px] uppercase tracking-wider2 text-brand-muted mb-1.5"
          >
            Amount
          </label>
          <div className="flex items-center gap-2">
            <input
              id="send-amount"
              type="text"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              disabled={isBusy}
              placeholder="0.00"
              className="flex-1 px-3 py-2 bg-white border border-brand-border rounded-md font-mono text-sm text-brand-navy focus:outline-none focus:border-brand-blue"
            />
            <span className="font-mono text-sm font-bold text-brand-muted">
              {symbol}
            </span>
          </div>
        </div>

        {/* Memo (optional) */}
        <div>
          <label
            htmlFor="send-memo"
            className="block font-mono text-[10px] uppercase tracking-wider2 text-brand-muted mb-1.5"
          >
            Memo <span className="text-brand-muted normal-case">(optional)</span>
          </label>
          <input
            id="send-memo"
            type="text"
            value={memo}
            onChange={(e) => setMemo(e.target.value)}
            disabled={isBusy}
            placeholder="e.g. payroll-2026-06"
            className="w-full px-3 py-2 bg-white border border-brand-border rounded-md font-mono text-xs text-brand-navy focus:outline-none focus:border-brand-blue"
          />
        </div>

        {error && (
          <div className="p-3 bg-brand-errBg border border-brand-errBorder rounded-md">
            <p className="font-mono text-[10px] font-bold tracking-wider2 uppercase text-brand-err m-0 mb-1">
              Error
            </p>
            <p className="font-sans text-xs text-brand-errDark m-0 whitespace-pre-wrap">
              {error}
            </p>
          </div>
        )}

        {result && (
          <div className="p-3 bg-brand-light border border-brand-border rounded-md space-y-1">
            <p className="font-mono text-[10px] font-bold tracking-wider2 uppercase text-brand-tealAccent m-0">
              Transfer Submitted
            </p>
            <p className="font-sans text-xs text-brand-navy m-0">
              Sent <strong>{result.amount}</strong> to{' '}
              <span className="font-mono text-[11px] break-all">
                {result.recipient}
              </span>
            </p>
            {result.updateId && (
              <p className="font-mono text-[10px] text-brand-muted m-0 break-all">
                update: {result.updateId}
              </p>
            )}
            <p className="font-sans text-[11px] text-brand-muted m-0">
              The recipient must accept the pending TransferInstruction to
              claim the funds.
            </p>
          </div>
        )}

        <div className="flex items-center justify-end gap-2 pt-2">
          <button
            type="button"
            onClick={closeSend}
            disabled={isBusy}
            className="px-4 py-2 bg-white text-brand-navy border border-brand-border rounded-md font-mono text-[11px] font-bold tracking-wider2 uppercase cursor-pointer hover:bg-brand-light disabled:opacity-50"
          >
            {result ? 'Close' : 'Cancel'}
          </button>
          {!result && (
            <button
              type="button"
              onClick={handleSend}
              disabled={!canSubmit}
              className="flex items-center gap-1.5 px-4 py-2 bg-brand-blue text-white border-0 rounded-md font-mono text-[11px] font-bold tracking-wider2 uppercase cursor-pointer hover:opacity-90 disabled:opacity-50"
            >
              {isBusy ? (
                <Loader2 size={12} className="animate-spin" />
              ) : (
                <Send size={12} />
              )}
              {isBusy ? 'Sending…' : 'Send'}
            </button>
          )}
        </div>
      </div>
    </WalletModal>
  )
}
