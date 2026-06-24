/**
 * Validators for the two user-supplied inputs: the Canton party ID to
 * fund, and the matching Ed25519 private key.
 *
 * Hex-encoded Ed25519 private keys come in two lengths:
 *   - 64 hex chars  (32 bytes) = seed only (RFC 8032 "raw" form)
 *   - 128 hex chars (64 bytes) = seed + public key concatenated
 *     ("expanded" form, the format most wallets export)
 * PEM-encoded keys start with "-----BEGIN".
 *
 * Canton party IDs always contain `::`. Two valid forms:
 *   - legacy:    party::1220abcd...   (literal "party" prefix)
 *   - new style: 8a57d77f...::1220... (32-hex namespace fingerprint ::
 *                                       64-hex party fingerprint)
 */
const HEX_PRIVATE_KEY_LENGTHS = [64, 128] as const;
const PARTY_ID_SEPARATOR = '::';

function requireNonEmpty(label: string, value: string): string {
  const trimmed = value.trim();
  if (!trimmed) throw new Error(`${label} cannot be empty.`);
  return trimmed;
}

export function validatePartyId(partyId: string): string {
  const trimmed = requireNonEmpty('Party ID', partyId);
  if (!trimmed.includes(PARTY_ID_SEPARATOR)) {
    throw new Error(
      `Invalid party ID — must contain "${PARTY_ID_SEPARATOR}".\n` +
        'Expected either "party::1220..." or "<32-hex-namespace>::<64-hex-fingerprint>".',
    );
  }
  return trimmed;
}

export function validatePrivateKey(key: string): string {
  const trimmed = requireNonEmpty('Private key', key);
  if (trimmed.startsWith('-----BEGIN')) {
    return trimmed; // PEM ED25519 private key
  }
  const hex = trimmed.startsWith('0x') ? trimmed.slice(2) : trimmed;
  if (!/^[0-9a-fA-F]+$/.test(hex)) {
    throw new Error('Private key must be hex-encoded Ed25519 or a PEM block.');
  }
  if (!HEX_PRIVATE_KEY_LENGTHS.includes(hex.length as 64 | 128)) {
    const allowed = HEX_PRIVATE_KEY_LENGTHS.join(' or ');
    throw new Error(
      `Hex private key must be ${allowed} chars (32 or 64 bytes); got ${hex.length}.`,
    );
  }
  return hex;
}