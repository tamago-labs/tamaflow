/**
 * 01-amulet-faucet.ts
 *
 * Devnet-only Canton Coin (Amulet) faucet, built on
 * @canton-network/wallet-sdk.
 *
 * Prompts the user for a Canton party ID (the "address" to fund), a
 * DevNet OAuth `clientId`/`clientSecret` (for authenticating against
 * the validator), and the matching Ed25519 private key, then submits
 * an `AmuletRules_Tap` exercise against the Splice AmuletRules
 * contract to mint Canton Coin into that wallet.
 *
 * Flow:
 *   1. prompt for partyId + OAuth clientId/secret + privateKey
 *   2. fetchToken(clientId, clientSecret)     — exchange creds for a bearer JWT
 *   3. buildSdk({ token })                    — SDK against DevNet (static token)
 *   4. buildTapCommand(token, partyId, amount) — see lib/tap.ts
 *   5. prepared.sign(privateKey).execute()    — prepare → sign → execute
 *
 * Usage:
 *   npm install
 *   npm run faucet        # or: npx tsx 01-amulet-faucet.ts
 */
import { logger } from './lib/logger.js';
import { prompt } from './lib/prompt.js';
import { buildSdk } from './lib/sdk.js';
import { fetchToken } from './lib/auth.js';
import { DEFAULT_AMULET_AMOUNT } from './lib/constants.js';
import { validatePartyId } from './lib/validate.js';
import { buildTapCommand } from './lib/tap.js';
import { privateKeyToBase64 } from './lib/key.js';

async function main(): Promise<void> {
  // 1. Gather inputs (always interactive; no env vars, no config file).
  const partyId = await prompt('Enter the Canton party ID (address) to fund: ', {
    validate: validatePartyId,
  });
  const clientId = await prompt(
    'Enter your DevNet OAuth clientId: ',
  );
  const clientSecret = await prompt(
    'Enter your DevNet OAuth clientSecret: ',
    { secret: true },
  );
  const privateKey = await prompt(
    'Enter the matching Ed25519 private key (hex 64 or 128 chars, or PEM): ',
    { secret: true },
  );

  // 2. Exchange client_credentials for a short-lived bearer token.
  //    FiveNorth's authentik doesn't expose standard OIDC discovery,
  //    so we hit the token endpoint directly instead of going through
  //    the SDK's `client_credentials` path.
  logger.info(
    { clientId },
    'Exchanging client_credentials for a bearer token…',
  );
  const token = await fetchToken(clientId, clientSecret);

  // 3. Build the SDK against the DevNet validator (static bearer token).
  logger.info('Building Canton Wallet SDK against DevNet…');
  const { sdk } = await buildSdk({ token });

  // 4. Build the tap command. FiveNorth's DevNet validator does not
  //    expose the CIP-0056 token-metadata-v1 registry endpoints that
  //    `sdk.amulet.tap()` requires, so we build the ExerciseCommand
  //    ourselves by fetching AmuletRules + the active OpenMiningRound
  //    from the scan-proxy endpoints (which DO work). See lib/tap.ts.
  logger.info(
    { receiver: partyId, amount: DEFAULT_AMULET_AMOUNT },
    'Building tap command…',
  );
  const [tapCmd, disclosed] = await buildTapCommand(
    token,
    partyId,
    DEFAULT_AMULET_AMOUNT,
  );

  // 5. Interactive submission: prepare → sign → execute.
  //    `prepared.sign(...)` expects a base64-encoded 64-byte Ed25519
  //    secret key (the format `sdk.keys.generate()` produces). The user
  //    may paste hex instead, so normalize first.
  const privateKeyB64 = privateKeyToBase64(privateKey);
  const prepared = sdk.ledger.prepare({
    partyId,
    commands: tapCmd,
    disclosedContracts: disclosed,
  });
  logger.info('Prepared transaction, signing…');
  const signed = prepared.sign(privateKeyB64);

  logger.info('Executing tap on ledger…');
  const result = await signed.execute({ partyId });

  logger.info(
    { updateId: result.updateId, completionOffset: result.completionOffset },
    '✅ Tap successful — Amulet minted',
  );
  logger.info('Done.');
}

main().catch((err) => {
  logger.error({ err }, 'Faucet script failed');
  process.exit(1);
});