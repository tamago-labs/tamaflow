import type { TokenProviderConfig } from '@canton-network/core-wallet-auth';
import { DEVNET } from './constants.js';

/**
 * Exchange an OAuth2 `client_credentials` pair for a short-lived JWT
 * against FiveNorth's authentik instance.
 *
 * The Canton Wallet SDK's `client_credentials` auth method requires an
 * OIDC discovery document at `configUrl`, which FiveNorth's authentik
 * does not expose — so we fetch the token ourselves and hand it to the
 * SDK via `method: 'static'`.
 *
 * Per RFC 6749 §2.3.1, client credentials go in an HTTP Basic auth
 * header (not the form body) for `client_credentials` grants. FiveNorth's
 * authentik rejects body-only credentials with `invalid_grant`.
 *
 * Per the FiveNorth Seaport Validator docs:
 *   - token endpoint: `DEVNET.authTokenUrl`
 *   - audience == clientId (the validator scopes tokens this way)
 *   - scope must be `daml_ledger_api`
 *
 * Returns the raw `access_token` string. Tokens are valid for 8 hours;
 * the script is short-lived so we don't bother caching.
 */
export async function fetchToken(
  clientId: string,
  clientSecret: string,
): Promise<string> {
  const basicAuth = Buffer.from(`${clientId}:${clientSecret}`).toString(
    'base64',
  );
  const body = new URLSearchParams({
    grant_type: 'client_credentials',
    audience: clientId,
    scope: DEVNET.authScope,
  });

  const res = await fetch(DEVNET.authTokenUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Authorization: `Basic ${basicAuth}`,
    },
    body: body.toString(),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(
      `Token endpoint returned ${res.status} ${res.statusText}: ${text}`,
    );
  }

  const json = (await res.json()) as { access_token?: string };
  if (!json.access_token) {
    throw new Error('Token endpoint response did not include access_token');
  }
  return json.access_token;
}

/**
 * Wrap a pre-fetched bearer token for the Canton Wallet SDK.
 *
 * The SDK accepts a static token via `method: 'static'` — it will pass
 * it as a `Bearer` header without trying to refresh or re-validate.
 * Since the faucet script is short-lived, an 8-hour token is plenty.
 */
export function staticAuth(token: string): TokenProviderConfig {
  return { method: 'static', token };
}