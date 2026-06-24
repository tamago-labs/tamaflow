/**
 * Shared constants for the TamaFlow DevNet faucet script.
 *
 * The Canton Wallet SDK splits into a base SDK (needs `ledgerClientUrl`)
 * and an `amulet` extension (needs `validatorUrl`, `scanApiUrl`,
 * `registryUrl`). All four URLs live here so a future move to TestNet
 * or MainNet only requires editing this file (plus swapping the auth
 * helper in `lib/auth.ts` if the new network uses a different OIDC
 * flow).
 *
 * Endpoints are the FiveNorth "Seaport Validator" DevNet sandbox.
 * Auth is OAuth2 `client_credentials` against FiveNorth's authentik
 * instance — see `lib/auth.ts`.
 */
export const DEVNET = {
  /** Canton Ledger JSON API. */
  ledgerClientUrl:
    'https://ledger-api.validator.devnet.sandbox.fivenorth.io',
  /**
   * Validator API base. Used by `amulet.tap` for both `ValidatorInternalClient`
   * (e.g. `/v0/validator-user`) and `ScanProxyClient` (e.g. `/v0/scan-proxy/amulet-rules`)
   * — FiveNorth co-hosts both APIs under `/api/validator/...`. The bare host
   * serves the validator's HTML frontend (963-byte SPA shell), so the
   * `/api/validator` prefix is required for the SDK's JSON calls.
   */
  validatorUrl:
    'https://wallet.validator.devnet.sandbox.fivenorth.io/api/validator',
  /**
   * Splice Scan API. FiveNorth does not run a separate scan host —
   * `scan.sv.devnet.sandbox.fivenorth.io` does not resolve — so we
   * point at the same `/api/validator` base (scan-proxy endpoints are
   * served there, behind the same bearer-token auth).
   */
  scanApiUrl:
    'https://wallet.validator.devnet.sandbox.fivenorth.io/api/validator',
  /**
   * Validator registry — base URL for token-metadata/instrument lookups
   * (e.g. `GET /registry/metadata/v1/instruments`). The OpenAPI client
   * uses this as the base, so it must NOT include `/v0/registry` (or
   * any trailing path) — the SDK appends `/registry/...` itself.
   * Same host + path as `validatorUrl` since FiveNorth serves the
   * registry off the validator API.
   */
  registryUrl:
    'https://wallet.validator.devnet.sandbox.fivenorth.io/api/validator',
  /** OAuth2 token endpoint (authentik `/application/o/token/`). */
  authTokenUrl:
    'https://auth.sandbox.fivenorth.io/application/o/token/',
  /**
   * OAuth2 `scope` requested for the access token. Per FiveNorth, this
   * must be `daml_ledger_api` for the resulting JWT to be accepted by
   * the validator.
   */
  authScope: 'daml_ledger_api',
} as const;

/**
 * Default amount to mint from the faucet. Canton amounts are decimal
 * strings with up to 10 fractional digits.
 */
export const DEFAULT_AMULET_AMOUNT = '1000.0000000000';