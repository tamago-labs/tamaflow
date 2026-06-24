import type { AmuletConfig } from '@canton-network/wallet-sdk';
import { DEVNET } from './constants.js';
import { staticAuth } from './auth.js';

/**
 * Build the `amulet` namespace config for the FiveNorth Seaport
 * Validator DevNet.
 *
 * Auth is via a pre-fetched bearer token (see `lib/auth.ts` for how it
 * is obtained). TestNet/MainNet would change the URLs in `constants.ts`
 * and might also need a different token-fetch path.
 */
export function amuletConfig(token: string): AmuletConfig {
  return {
    validatorUrl: DEVNET.validatorUrl,
    scanApiUrl: DEVNET.scanApiUrl,
    auth: staticAuth(token),
    registryUrl: new URL(DEVNET.registryUrl),
  };
}