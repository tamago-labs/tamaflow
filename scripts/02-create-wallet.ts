/**
 * scripts/02-create-wallet.ts
 *
 * Generate a Canton external party (wallet) for TamaFlow on DevNet.
 *
 * Mirrors the pattern in example-scripts/02-create-external-party.ts, but
 * is purpose-built for end users (the example script is for the SDK's own
 * integration tests):
 *   1. Prompts for OAuth clientId + clientSecret + optional party hint.
 *   2. Exchanges creds for a short-lived bearer JWT (scripts/lib/auth.ts).
 *   3. Builds the base Canton Wallet SDK — no `amulet` extension, since
 *      wallet creation has no need for the faucet namespace.
 *   4. Generates an Ed25519 keypair, allocates the party on-ledger via a
 *      topology transaction signed by the private key.
 *   5. Persists the wallet to scripts/.wallet.json so it can be reused by
 *      subsequent commands.
 *
 * ⚠️  The private key is stored in PLAINTEXT in scripts/.wallet.json. This
 * CLI runs under raw Node, so it cannot use Electron's safeStorage. For
 * production, prefer the desktop app's Setup Wallet flow (encrypted at
 * rest via OS keychain). Keep `.wallet.json` out of source control —
 * scripts/.gitignore already does this.
 *
 * Run:
 *   cd scripts
 *   npm run create-wallet   # or: npm run 02
 */
import { SDK } from '@canton-network/wallet-sdk';
import { existsSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { logger } from './lib/logger.js';
import { prompt } from './lib/prompt.js';
import { fetchToken, staticAuth } from './lib/auth.js';
import { DEVNET } from './lib/constants.js';

const DEFAULT_PARTY_HINT = 'tamaflow';
const WALLET_FILE = resolve(process.cwd(), '.wallet.json');

interface PersistedWallet {
  partyId: string;
  partyHint: string;
  publicKey: string;
  privateKey: string;
  fingerprint: string;
  createdAt: string;
  network: 'devnet';
}

async function main(): Promise<void> {
  logger.info('TamaFlow — Create Canton wallet'); 

  // Refuse to silently clobber an existing wallet.
  if (existsSync(WALLET_FILE)) {
    logger.warn(
      { path: WALLET_FILE },
      'Existing .wallet.json found. It will be overwritten.',
    );
    const confirm = await prompt('Type OVERWRITE to continue: ');
    if (confirm !== 'OVERWRITE') {
      logger.info('Aborted.');
      process.exit(0);
    }
  }

  const partyHint =
    (await prompt(`Party hint [${DEFAULT_PARTY_HINT}]: `)) ||
    DEFAULT_PARTY_HINT;

  const clientId = await prompt('DevNet OAuth clientId: ');
  const clientSecret = await prompt('DevNet OAuth clientSecret: ', {
    secret: true,
  });

  // 1. Exchange client_credentials for a bearer JWT. FiveNorth's authentik
  //    doesn't expose standard OIDC discovery, so we hit the token endpoint
  //    directly (see scripts/lib/auth.ts).
  logger.info({ clientId }, 'Exchanging client_credentials for a bearer token…');
  const token = await fetchToken(clientId, clientSecret);

  // 2. Build the base SDK against the DevNet ledger. We skip the `amulet`
  //    extension — wallet creation only needs keys + party namespaces.
  logger.info('Building Canton Wallet SDK against DevNet…');
  const sdk = await SDK.create({
    auth: staticAuth(token),
    ledgerClientUrl: DEVNET.ledgerClientUrl,
  });

  // 3. Generate Ed25519 keypair (base64-encoded 32-byte public key + 64-byte
  //    expanded secret key — the format PreparedTransaction.sign expects).
  logger.info('Generating Ed25519 keypair…');
  const keyPair = sdk.keys.generate();
  logger.info({ publicKey: keyPair.publicKey }, 'Keypair generated');

  // 4. Derive the party fingerprint = sha256(pubKey) with `12` prefix.
  const fingerprint = await sdk.keys.fingerprint(keyPair.publicKey);
  logger.info({ fingerprint }, 'Fingerprint derived');

  // 5. Allocate the party on-ledger via a topology transaction signed by
  //    the freshly-generated private key. This is the same builder pattern
  //    as the example scripts: create(pubKey, opts).sign(privKey).execute().
  logger.info({ hint: partyHint }, 'Allocating external party on ledger…');
  const created = await sdk.party.external
    .create(keyPair.publicKey, { partyHint })
    .sign(keyPair.privateKey)
    .execute();

  const partyId = created.partyId;
  const publicKeyFingerprint = created.publicKeyFingerprint ?? fingerprint;
  logger.info({ partyId }, '✅ External party created');

  // 6. Persist to .wallet.json. Same shape as the desktop-app's wallet.json
  //    (minus the path/createdAt/encryption envelope), so a user can copy
  //    one to the other if they want to bootstrap the desktop app from the
  //    CLI.
  const wallet: PersistedWallet = {
    partyId,
    partyHint,
    publicKey: keyPair.publicKey,
    privateKey: keyPair.privateKey,
    fingerprint: publicKeyFingerprint,
    createdAt: new Date().toISOString(),
    network: 'devnet',
  };
  writeFileSync(WALLET_FILE, JSON.stringify(wallet, null, 2), 'utf8');

  logger.info(
    { partyId, fingerprint: publicKeyFingerprint, path: WALLET_FILE },
    '✅ Saved to .wallet.json',
  );
  logger.warn(
    'Private key is stored in PLAINTEXT. For production, use the desktop app\'s Setup Wallet (encrypted via safeStorage).',
  );
  logger.info(
    'Next: run `npm run faucet` (in 01-amulet-faucet.ts) to mint test Canton Coin into this wallet.',
  );
}

main().catch((err) => {
  logger.error({ err }, 'Create-wallet script failed');
  process.exit(1);
});