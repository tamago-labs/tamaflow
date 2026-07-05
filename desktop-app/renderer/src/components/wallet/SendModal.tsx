// SendModal — transfer CC (Canton Coin) from this wallet's party to
// a recipient partyId. Calls the main process's
// `wallet:transfer` IPC, which signs the prepared transfer with the
// wallet's own key and submits to the validator.
//
// CC has 10 decimal places; the main process pads the user-typed
// amount before submission. Users can type "100" or "100.5".
// By default the transfer is TWO-STEP — the recipient must accept
// the pending TransferInstruction for funds to land. The button
// here submits the offer; downstream acceptance is via the
// PendingTransfersCard on the Assets page.

import { useEffect, useState } from 'react'
import { useWallet } from '../../context/WalletContext'
import { WalletModal } from './WalletModal'
import { Loader2, Send } from 'lucide-react'

export function SendModal() {
  const { modal, openSendSymbol, closeSend, transfer, refreshHoldings } =
    useWallet()
  const symbol = openSendSymbol ?? 'CC'
  const open = modal.sendOpen

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

  const handleSend = async () => {
    setError(null)
    setResult(null)
    setIsBusy(true)
    try {
      const r = await transfer({
        recipient: recipient.trim(),
        amount: amount.trim(),
        memo: memo.trim() || undefined
      })
      if (r.success) {
        setResult({
          updateId: r.updateId,
          amount: r.amount,
          recipient: r.recipient
        })
        refreshHoldings()
      } else {
        setError(r.error ?? 'Transfer failed')
      }
    } catch (e) {
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
      <div className='space-y-4'>
        <p className='m-0 font-sans text-sm text-brand-navy'>
          Send Canton Coin to any party on the network. The transfer is
          signed with this wallet's own key and submitted to the validator.
        </p>

        <div>
          <label
            htmlFor='send-recipient'
            className='mb-1.5 block font-mono text-[10px] uppercase tracking-wider2 text-brand-muted'
          >
            Recipient Party ID
          </label>
          <input
            id='send-recipient'
            type='text'
            value={recipient}
            onChange={(e) => setRecipient(e.target.value)}
            disabled={isBusy}
            placeholder='party-hint::1220abcd…'
            className='w-full rounded-md border border-brand-border bg-white px-3 py-2 font-mono text-xs text-brand-navy focus:border-brand-blue focus:outline-none'
          />
          <p className='m-0 mt-1 font-sans text-[11px] text-brand-muted'>
            Canton partyId format:{' '}
            <code className='font-mono'>hint::fingerprint</code> or a raw
            64-char hex fingerprint.
          </p>
        </div>

        <div>
          <label
            htmlFor='send-amount'
            className='mb-1.5 block font-mono text-[10px] uppercase tracking-wider2 text-brand-muted'
          >
            Amount
          </label>
          <div className='flex items-center gap-2'>
            <input
              id='send-amount'
              type='text'
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              disabled={isBusy}
              placeholder='0.00'
              className='flex-1 rounded-md border border-brand-border bg-white px-3 py-2 font-mono text-sm text-brand-navy focus:border-brand-blue focus:outline-none'
            />
            <span className='font-mono text-sm font-bold text-brand-muted'>
              {symbol}
            </span>
          </div>
        </div>

        <div>
          <label
            htmlFor='send-memo'
            className='mb-1.5 block font-mono text-[10px] uppercase tracking-wider2 text-brand-muted'
          >
            Memo{' '}
            <span className='text-brand-muted normal-case'>(optional)</span>
          </label>
          <input
            id='send-memo'
            type='text'
            value={memo}
            onChange={(e) => setMemo(e.target.value)}
            disabled={isBusy}
            placeholder='e.g. payroll-2026-06'
            className='w-full rounded-md border border-brand-border bg-white px-3 py-2 font-mono text-xs text-brand-navy focus:border-brand-blue focus:outline-none'
          />
        </div>

        {error && (
          <div className='rounded-md border border-brand-errBorder bg-brand-errBg p-3'>
            <p className='m-0 mb-1 font-mono text-[10px] font-bold uppercase tracking-wider2 text-brand-err'>
              Error
            </p>
            <p className='m-0 whitespace-pre-wrap font-sans text-xs text-brand-errDark'>
              {error}
            </p>
          </div>
        )}

        {result && (
          <div className='space-y-1 rounded-md border border-brand-border bg-brand-light p-3'>
            <p className='m-0 font-mono text-[10px] font-bold uppercase tracking-wider2 text-brand-tealAccent'>
              Transfer Submitted
            </p>
            <p className='m-0 font-sans text-xs text-brand-navy'>
              Sent <strong>{result.amount}</strong> to{' '}
              <span className='break-all font-mono text-[11px]'>
                {result.recipient}
              </span>
            </p>
            {result.updateId && (
              <p className='m-0 break-all font-mono text-[10px] text-brand-muted'>
                update: {result.updateId}
              </p>
            )}
            <p className='m-0 font-sans text-[11px] text-brand-muted'>
              The recipient must accept the pending TransferInstruction to
              claim the funds.
            </p>
          </div>
        )}

        <div className='flex items-center justify-end gap-2 pt-2'>
          <button
            type='button'
            onClick={closeSend}
            disabled={isBusy}
            className='cursor-pointer rounded-md border border-brand-border bg-white px-4 py-2 font-mono text-[11px] font-bold uppercase tracking-wider2 text-brand-navy hover:bg-brand-light disabled:opacity-50'
          >
            {result ? 'Close' : 'Cancel'}
          </button>
          {!result && (
            <button
              type='button'
              onClick={handleSend}
              disabled={!canSubmit}
              className='flex cursor-pointer items-center gap-1.5 rounded-md border-0 bg-brand-blue px-4 py-2 font-mono text-[11px] font-bold uppercase tracking-wider2 text-white hover:opacity-90 disabled:opacity-50'
            >
              {isBusy ? (
                <Loader2 size={12} className='animate-spin' />
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

export default SendModal
