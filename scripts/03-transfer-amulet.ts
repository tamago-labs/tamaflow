/**
 * scripts/03-transfer-amulet.ts
 *
 * Send Canton Coin (Amulet) from a saved wallet to another party on
 * FiveNorth DevNet. Mirrors the desktop app's wallet:transfer IPC but
 * runs from the CLI — useful for automation, scripts, and as a smoke
 * test that the desktop flow will work.
 *
 * The Canton Wallet SDK's `sdk.token.transfer.create()` calls into the
 * CIP-0056 registry at the validator's URL, which FiveNorth's hosted
 * DevNet 404s on. The scan-proxy at the same host serves the registry
 * endpoints correctly (relays to the synchronizer validator that
 * actually hosts the registry logic). We bypass the high-level SDK
 * call and POST to that scan-proxy ourselves — see `lib/transfer.ts`.
 *
 * Flow:
 *   1. Read wallet from scripts/.wallet.json (written by
 *      `02-create-wallet.ts`) — sender partyId + privateKey.
 *   2. Prompt for receiver partyId + amount + OAuth clientId/secret.
 *   3. fetchToken(clientId, clientSecret)   — bearer JWT.
 *   4. buildSdk({ token })                  — SDK against DevNet.
 *   5. buildTransferCommand(token, …)       — lib/transfer.ts
 *   6. prepared.sign(privateKeyB64).execute() — prepare → sign → execute.
 *
 * Usage:
 *   cd scripts
 *   npm install            # one-time
 *   npm run 02             # create .wallet.json (or: npm run create-wallet)
 *   npm run faucet         # mint test Canton Coin (or: npm run 01)
 *   npm run 03             # send Canton Coin   (or: npm run transfer-amulet)
 */
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { logger } from './lib/logger.js';
import { prompt } from './lib/prompt.js';
import { fetchToken } from './lib/auth.js';
import { buildSdk } from './lib/sdk.js';
import { validatePartyId } from './lib/validate.js';
import { privateKeyToBase64 } from './lib/key.js';
import {
  buildTransferCommand,
  getAmuletDsoParty,
} from './lib/transfer.js';

const WALLET_FILE = resolve(process.cwd(), '.wallet.json');

/**
 * Canton amounts are decimal strings with up to 10 fractional digits.
 * Pad a user-entered amount ("100" → "100.0000000000") so the ledger
 * doesn't reject the transfer for insufficient precision.
 */
function padCantonCoinAmount(raw: string): string {
  const trimmed = raw.trim();
  if (!/^[0-9]+(\.[0-9]+)?$/.test(trimmed)) {
    throw new Error(
      `Invalid amount: ${raw}. Expected a positive decimal number.`,
    );
  }
  const [intPart, fracPart = ''] = trimmed.split('.');
  const padded = (fracPart + '0'.repeat(10)).slice(0, 10);
  return `${intPart}.${padded}`;
}

interface PersistedWallet {
  partyId: string;
  partyHint?: string;
  publicKey?: string;
  privateKey: string;
  fingerprint?: string;
  createdAt?: string;
  network?: 'devnet';
}

async function main(): Promise<void> {
  logger.info('TamaFlow — Send Canton Coin (Amulet)');

  // 0. Confirm we have a saved wallet from `02-create-wallet.ts`.
  if (!existsSync(WALLET_FILE)) {
    throw new Error(
      `No wallet found at ${WALLET_FILE}. Run \`npm run create-wallet\` first.`,
    );
  }
  const wallet = JSON.parse(
    readFileSync(WALLET_FILE, 'utf8'),
  ) as PersistedWallet;
  if (!wallet.partyId || !wallet.privateKey) {
    throw new Error(
      `.wallet.json is missing required fields (partyId, privateKey).`,
    );
  }
  logger.info({ sender: wallet.partyId }, 'Loaded wallet from .wallet.json');

  // 1. Gather inputs.
  const recipient = await prompt(
    'Recipient Canton party ID: ',
    { validate: validatePartyId },
  );
  const amountRaw = await prompt(
    'Amount in Canton Coin (e.g. "100" or "1.5"): ',
  );
  const amount = padCantonCoinAmount(amountRaw);
  const clientId = await prompt('DevNet OAuth clientId: ');
  const clientSecret = await prompt('DevNet OAuth clientSecret: ', {
    secret: true,
  });

  // 2. Exchange client_credentials for a short-lived bearer token.
  logger.info({ clientId }, 'Exchanging client_credentials for a bearer token…');
  const token = await fetchToken(clientId, clientSecret);

  // 3. Build the SDK against the DevNet ledger. The transfer path doesn't
  //    need the `amulet` extension — only `sdk.ledger.prepare()` is used
  //    below — but `buildSdk` is the canonical helper and matches 01/02.
  const { sdk } = await buildSdk({ token });

  // 4. Resolve the DSO party (Amulet admin) once and reuse for the
  //    choice-args' expectedAdmin + instrumentId.admin.
  const dsoParty = await getAmuletDsoParty(token);
  logger.info(
    { dsoParty, sender: wallet.partyId, recipient, amount },
    'Building transfer command…',
  );

  // 5. Build the ExerciseCommand + disclosed contracts (lib/transfer.ts).
  //    Bypasses sdk.token.transfer.create() because FiveNorth's validator
  //    404s on the SDK's registry endpoint; the scan-proxy serves it.
  const [transferCmd, disclosed] = await buildTransferCommand(token, {
    sender: wallet.partyId,
    recipient,
    amount,
    dsoParty,
  });

  // 6. Prepare → sign → execute. Same pattern as the faucet (01) and
  //    desktop wallet (wallet.ts).
  const privateKeyB64 = privateKeyToBase64(wallet.privateKey);
  const prepared = sdk.ledger.prepare({
    partyId: wallet.partyId,
    commands: transferCmd,
    disclosedContracts: disclosed,
  });
  logger.info('Prepared transaction, signing…');
  const signed = prepared.sign(privateKeyB64);

  logger.info('Executing transfer on ledger…');
  const result = await signed.execute({ partyId: wallet.partyId });

  const updateId =
    (result as { updateId?: string }).updateId ??
    (result as { transactionHash?: string }).transactionHash;
  logger.info(
    { updateId, amount, recipient },
    '✅ Transfer submitted — recipient must accept within 24h (default two-step transfer).',
  );
  logger.info(
    { updateId },
    'Use `npm run holdings` (or the desktop app\'s My Tokens card) to confirm after acceptance.',
  );
}

main().catch((err) => {
  logger.error({ err }, 'Transfer script failed');
  process.exit(1);
});