"use client";

/**
 * SendModal — transfer CC (Canton Coin) from the connected Loop wallet
 * to a recipient partyId.
 *
 * Uses the Loop browser SDK's `provider.transfer(...)` which:
 *   1. Builds the `TransferFactory_Transfer` exercise command.
 *   2. Sends it over the Loop WebSocket to the connected Loop wallet.
 *   3. Loop's wallet UI pops up (configured via `requestSigningMode: "popup"`)
 *      and the user signs there.
 *   4. Resolves with the on-ledger response.
 *
 * The default instrument is `Amulet` (Canton Coin). For a different
 * instrument, pass `{ instrument_admin, instrument_id }` as the third arg.
 *
 * Two-step transfers (default) require the recipient to accept the
 * pending `TransferInstruction` to claim funds.
 */
import { useEffect, useState } from "react";
import { Loader2, Send, X } from "lucide-react";
import Modal from "@/components/shared/Modal";
import { useWallet } from "@/lib/wallet/WalletContext";
import { STYLES } from "@/lib/theme";

interface SendModalProps {
  onClose: () => void;
  /** Symbol being sent (used for the title + the amount label). */
  symbol?: string;
  /** Recipient's partyId, if pre-filled (e.g. from a QR scan). */
  initialRecipient?: string;
}

export default function SendModal({
  onClose,
  symbol = "CC",
  initialRecipient = "",
}: SendModalProps) {
  const { provider, refreshHoldings } = useWallet();

  const [recipient, setRecipient] = useState(initialRecipient);
  const [amount, setAmount] = useState("");
  const [memo, setMemo] = useState("");
  const [isBusy, setIsBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{
    updateId?: string;
    amount?: string;
    recipient?: string;
  } | null>(null);

  // Reset state when the modal is mounted/unmounted so reopening is clean.
  useEffect(() => {
    setRecipient(initialRecipient);
    setAmount("");
    setMemo("");
    setError(null);
    setResult(null);
    setIsBusy(false);
  }, [initialRecipient]);

  const handleSend = async () => {
    if (!provider) {
      setError("Wallet not connected");
      return;
    }
    setError(null);
    setResult(null);
    setIsBusy(true);
    try {
      // Loop's transfer() pops up the signing window and resolves with
      // the run-transaction response. Amount is forwarded as a string;
      // Loop's backend normalises to the instrument's decimal precision.
      const response = await provider.transfer(
        recipient.trim(),
        amount.trim(),
        { instrument_admin: "", instrument_id: "Amulet" },
        memo.trim()
          ? { memo: memo.trim(), message: `Send ${amount.trim()} ${symbol}` }
          : { message: `Send ${amount.trim()} ${symbol}` },
      );
      // The response shape from Loop's WS varies slightly between
      // versions; pull the most useful fields defensively.
      const updateId =
        (response as { update_id?: string })?.update_id ??
        (response as { command_id?: string })?.command_id;
      setResult({
        updateId,
        amount: amount.trim(),
        recipient: recipient.trim(),
      });
      // Refresh holdings so the table reflects the new balance.
      void refreshHoldings();
    } catch (e) {
      // Loop SDK throws structured errors (RejectRequestError, Error
      // instances) or plain objects. Extract both message + code so the
      // UI can show the underlying cause — bare `String(e)` would just
      // render "[object Object]" for plain-object throws.
      const err = e as {
        message?: string
        code?: string
        error?: { message?: string; code?: string }
      }
      const msg =
        err.message ??
        err.error?.message ??
        (e instanceof Error ? e.message : String(e))
      const code = err.code ?? err.error?.code
      const hint = hintForError(msg ?? '', code)
      const display = hint ? `${msg ?? 'Unknown error'}\n\n${hint}` : msg ?? 'Unknown error'
      setError(display)
    } finally {
      setIsBusy(false);
    }
  };

  // Map common Canton / Loop error patterns to user-facing hints.
  // The Loop popup usually surfaces the raw Canton error message; this
  // function just adds a one-liner pointing the user at the likely cause.
  function hintForError(message: string, code?: string): string | null {
    const m = message.toLowerCase()
    if (m.includes('operationerror') || m.includes('action failed')) {
      return 'The Canton ledger rejected the transaction. This usually means insufficient CC balance in your Loop wallet, or a stale UTXO. Try refreshing holdings, or check the Loop wallet for the full error trace.'
    }
    if (m.includes('insufficient') || m.includes('not enough')) {
      return 'Your Loop wallet does not have enough CC to cover this transfer.'
    }
    if (m.includes('unauthorized') || code === 'UNAUTHENTICATED') {
      return 'Your Loop session has expired. Reconnect the wallet and try again.'
    }
    if (m.includes('rejected') || code === 'REJECTED') {
      return 'The transfer was rejected by the Loop wallet.'
    }
    return null
  }

  const canSubmit =
    !isBusy &&
    !!provider &&
    recipient.trim().length >= 10 &&
    !!amount.trim() &&
    parseFloat(amount) > 0;

  return (
    <Modal open onClose={onClose} ariaLabelledBy="send-title" maxWidth="max-w-md">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-brand-border">
        <div>
          <p className="font-mono text-[10px] tracking-wider2 text-brand-muted uppercase m-0">
            Wallet
          </p>
          <h2
            id="send-title"
            className="font-sans text-lg font-medium text-brand-navy m-0"
          >
            Send {symbol}
          </h2>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="p-1 border-0 bg-transparent cursor-pointer text-brand-muted hover:text-brand-navy rounded"
          aria-label="Close"
        >
          <X size={16} />
        </button>
      </div>

      {/* Body */}
      <div className="p-5 space-y-4">
        <p className="font-sans text-xs text-brand-muted m-0 leading-relaxed">
          Transfer Canton Coin to any party on the network. Loop will pop
          up to sign the transaction.
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

        {/* Memo */}
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

        {/* Error */}
        {error && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-md">
            <p className="font-mono text-[10px] font-bold tracking-wider2 uppercase text-red-700 m-0 mb-1">
              Error
            </p>
            <p className="font-sans text-xs text-red-800 m-0 whitespace-pre-wrap break-words">
              {error}
            </p>
          </div>
        )}

        {/* Result */}
        {result && (
          <div className="p-3 bg-brand-light border border-brand-border rounded-md space-y-1">
            <p className="font-mono text-[10px] font-bold tracking-wider2 uppercase text-teal-700 m-0">
              Transfer Submitted
            </p>
            <p className="font-sans text-xs text-brand-navy m-0">
              Sent <strong>{result.amount}</strong> to{" "}
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

        {/* Actions */}
        <div className="flex items-center justify-end gap-2 pt-2">
          <button
            type="button"
            onClick={onClose}
            disabled={isBusy}
            className="px-4 py-2 bg-white text-brand-navy border border-brand-border rounded-md font-mono text-[11px] font-bold tracking-wider2 uppercase cursor-pointer hover:bg-brand-light disabled:opacity-50"
          >
            {result ? "Close" : "Cancel"}
          </button>
          {!result && (
            <button
              type="button"
              onClick={handleSend}
              disabled={!canSubmit}
              className={STYLES.buttonPrimary}
            >
              {isBusy ? (
                <Loader2 size={12} className="animate-spin" />
              ) : (
                <Send size={12} />
              )}
              {isBusy ? "Sending…" : "Send"}
            </button>
          )}
        </div>
      </div>
    </Modal>
  );
}
