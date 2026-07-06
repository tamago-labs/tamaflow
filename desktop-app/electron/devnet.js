// FiveNorth Seaport Validator (DevNet) endpoints + faucet defaults.
//
// Mirrors scripts/lib/constants.ts. Kept as its own module so both the
// wallet module and the tap module can share the same endpoint config.
exports.DEVNET = {
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
   */
  registryUrl:
    'https://wallet.validator.devnet.sandbox.fivenorth.io/api/validator',
  /** OAuth2 token endpoint (authentik `/application/o/token/`). */
  authTokenUrl: 'https://auth.sandbox.fivenorth.io/application/o/token/',
  /**
   * OAuth2 `scope` requested for the access token. Per FiveNorth, this
   * must be `daml_ledger_api` for the resulting JWT to be accepted by
   * the validator.
   */
  authScope: 'daml_ledger_api'
}

/**
 * Default amount to mint from the faucet. Canton amounts are decimal
 * strings with up to 10 fractional digits.
 */
exports.DEFAULT_AMULET_AMOUNT = '1000.0000000000'

/** Party hint used when the desktop app creates a wallet. */
exports.DEFAULT_PARTY_HINT = 'tamaflow'
