/**
 * Normalize an Ed25519 private key from user input into the format the
 * Canton Wallet SDK's `prepared.sign(...)` expects: a base64-encoded
 * 64-byte secret key (32-byte seed + 32-byte public key, the "expanded"
 * form that tweetnacl/nacl's `nacl.sign.detached` requires).
 *
 * Supported inputs:
 *   - 64 hex chars  (32 bytes)  = raw seed
 *   - 128 hex chars (64 bytes)  = seed + public key (expanded form)
 *   - 44 base64 chars (32 bytes) = raw seed
 *   - 88 base64 chars (64 bytes) = expanded form
 *   - Anything starting with `-----BEGIN` is currently rejected with
 *     a clear message — Canton wallet CLI usually exports hex, and
 *     supporting PKCS#8 parsing here would add a non-trivial ASN.1
 *     dependency for an input format the faucet user is unlikely to
 *     paste.
 */
import nacl from 'tweetnacl';

/**
 * Heuristic: is this string plausibly base64? Tweetnacl/nacl keys are
 * raw bytes, so base64 of those bytes is the alphabet `[A-Za-z0-9+/]`
 * with `=` padding. We accept it iff it round-trips to the expected
 * decoded length.
 */
function tryDecodeBase64(s: string): Buffer | null {
  if (!/^[A-Za-z0-9+/]+=*$/.test(s)) return null;
  const buf = Buffer.from(s, 'base64');
  // Round-trip: re-encoding must yield the same string (no non-canonical
  // padding) and the decoded length must be plausible for a key.
  if (buf.toString('base64').replace(/=+$/, '') !== s.replace(/=+$/, '')) {
    return null;
  }
  if (buf.length !== 32 && buf.length !== 64) return null;
  return buf;
}

export function privateKeyToBase64(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) throw new Error('Private key cannot be empty.');

  if (trimmed.startsWith('-----BEGIN')) {
    throw new Error(
      'PEM-encoded Ed25519 private keys are not yet supported by this script. ' +
        'Export the key as hex (32 or 64 bytes) from your wallet CLI instead.',
    );
  }

  // Hex path
  const hex = trimmed.startsWith('0x') ? trimmed.slice(2) : trimmed;
  if (/^[0-9a-fA-F]+$/.test(hex)) {
    if (hex.length === 64) {
      return expandSeed(Buffer.from(hex, 'hex'));
    }
    if (hex.length === 128) {
      return Buffer.from(hex, 'hex').toString('base64');
    }
    throw new Error(
      `Hex private key must be 64 or 128 chars (32 or 64 bytes); got ${hex.length}.`,
    );
  }

  // Base64 path
  const decoded = tryDecodeBase64(trimmed);
  if (decoded) {
    if (decoded.length === 32) return expandSeed(decoded);
    return decoded.toString('base64');
  }

  throw new Error(
    'Private key must be hex-encoded (64 or 128 chars) or base64-encoded Ed25519.',
  );
}

/** Expand a 32-byte Ed25519 seed to a 64-byte secret key, base64-encoded. */
function expandSeed(seed: Buffer): string {
  const keyPair = nacl.sign.keyPair.fromSecretKey(new Uint8Array(seed));
  return Buffer.from(keyPair.secretKey).toString('base64');
}
