import { SDK, type SDKInterface } from '@canton-network/wallet-sdk';
import { staticAuth } from './auth.js';
import { DEVNET } from './constants.js';
import { amuletConfig } from './namespaces.js';

/** SDK with the `amulet` extension enabled — needed for `sdk.amulet.tap()`. */
export type FullSdk = SDKInterface<'amulet'>;

export type BuildSdkOpts = {
  /** Bearer JWT (already exchanged from client_credentials). */
  token: string;
};

/**
 * Build a Canton Wallet SDK configured against the DevNet validator.
 *
 * The returned SDK has the standard `ledger`, `keys`, `party`, `user`,
 * `utils` namespaces plus the `amulet` extension. The faucet script
 * uses `sdk.amulet.tap(...)` and `sdk.ledger.prepare(...)`.
 *
 * Auth is via a pre-fetched bearer token (see `lib/auth.ts` for how it
 * is obtained). The SDK will pass it as `Authorization: Bearer …` and
 * will not try to refresh — fine for a short-lived faucet script.
 */
export async function buildSdk(
  opts: BuildSdkOpts,
): Promise<{ sdk: FullSdk }> {
  const baseSdk = await SDK.create({
    auth: staticAuth(opts.token),
    ledgerClientUrl: DEVNET.ledgerClientUrl,
  });

  const extendedSdk = await baseSdk.extend({
    amulet: amuletConfig(opts.token),
  });

  return { sdk: extendedSdk as unknown as FullSdk };
}