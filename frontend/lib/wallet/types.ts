/**
 * Re-exports of the Loop SDK public types we use throughout the wallet UI.
 * Keeping them in one place means component code only depends on this module,
 * so we can swap the underlying SDK or mock it in tests without rewriting
 * every consumer.
 */
import type {
  Account,
  ActiveContract,
  Holding,
  InstrumentId,
  TransactionPayload,
  TransferOptions,
  EstimatedGasResponse,
  InstrumentSpec,
} from "@fivenorth/loop-sdk";

export type {
  Account,
  Holding,
  InstrumentId,
  ActiveContract,
  TransactionPayload,
  TransferOptions,
  EstimatedGasResponse,
  InstrumentSpec,
};

/**
 * The Loop SDK's `Provider` class isn't re-exported from the package
 * barrel. Rather than reach into the package's deep imports, we describe
 * the surface we actually use as a structural interface — anything that
 * matches this shape plays nicely with our code, including a mock.
 */
export interface WalletProvider {
  party_id: string;
  public_key: string;
  email?: string;
  getAuthToken(): string;
  getAccount(): Promise<Account>;
  getHolding(): Promise<Holding[]>;
  getActiveContracts(params?: {
    templateId?: string;
    interfaceId?: string;
  }): Promise<ActiveContract[]>;
  estimateGas(payload: TransactionPayload): Promise<EstimatedGasResponse>;
  submitTransaction(
    payload: TransactionPayload,
    options?: { message?: string; estimateTraffic?: boolean },
  ): Promise<unknown>;
  transfer(
    recipient: string,
    amount: string | number,
    instrument?: InstrumentSpec,
    options?: TransferOptions,
  ): Promise<unknown>;
  signMessage(message: string): Promise<unknown>;
}

/**
 * A holding pre-formatted for display. Built by `formatAmount` from the raw
 * SDK `Holding` so views don't redo the math.
 */
export type HoldingFormatted = {
  symbol: string;
  orgName: string;
  image: string;
  /** Pretty-printed unlocked amount (e.g. "1,000.0000000000"). */
  unlocked: string;
  /** Pretty-printed locked amount (e.g. "0.0000000000"). */
  locked: string;
  decimals: number;
  instrumentId: InstrumentId;
};

/**
 * The connection lifecycle. We keep it deliberately small — `connecting` covers
 * both the silent `autoConnect` resume and the explicit `connect()` click;
 * `isAutoConnecting` distinguishes the two for the UI.
 */
export type WalletStatus = "idle" | "connecting" | "connected" | "error";
