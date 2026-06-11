import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';
import { log } from '@cognitia/core';

/**
 * App-layer encryption for lead PII (COG-006). Doctrine (Architecture Lock
 * §6): raw customer PII lives ONLY in lead_intakes `*_enc` columns, encrypted
 * at rest, purgeable (PIPEDA / BC PIPA). Hashes (`contact_phone_hash`) are the
 * only lookup keys outside this module.
 *
 * Key source: `COGNITIA_PII_KEY_BASE64` (32 bytes, base64) — same injection
 * pattern as CREDENTIAL_SECRET_KEY_BASE64. Without it (dev/tests) an
 * ephemeral process key is generated and a warning logged: data encrypted
 * under it is unreadable after restart, which is acceptable only outside
 * production.
 *
 * Format: `enc:v1:<iv_b64>.<tag_b64>.<ciphertext_b64>` (AES-256-GCM).
 */

let cachedKey: Buffer | null = null;

function key(): Buffer {
  if (cachedKey) return cachedKey;
  const fromEnv = process.env.COGNITIA_PII_KEY_BASE64;
  if (fromEnv) {
    const parsed = Buffer.from(fromEnv, 'base64');
    if (parsed.length !== 32) {
      throw new Error('COGNITIA_PII_KEY_BASE64 must decode to exactly 32 bytes');
    }
    cachedKey = parsed;
    return cachedKey;
  }
  cachedKey = randomBytes(32);
  log({
    level: 'warn',
    message: 'frontdesk.pii.ephemeral_key', // COGNITIA_PII_KEY_BASE64 missing — dev-only key
  });
  return cachedKey;
}

export function encryptPii(plaintext: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key(), iv);
  const data = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `enc:v1:${iv.toString('base64')}.${tag.toString('base64')}.${data.toString('base64')}`;
}

export function decryptPii(value: string): string {
  const match = /^enc:v1:([^.]+)\.([^.]+)\.(.+)$/.exec(value);
  if (!match) throw new Error('not an enc:v1 value');
  const decipher = createDecipheriv('aes-256-gcm', key(), Buffer.from(match[1]!, 'base64'));
  decipher.setAuthTag(Buffer.from(match[2]!, 'base64'));
  return Buffer.concat([
    decipher.update(Buffer.from(match[3]!, 'base64')),
    decipher.final(),
  ]).toString('utf8');
}

/** Stable lookup hash, mirroring the contacts.phone_hash pattern. */
export function hashPhone(phone: string): string {
  const normalized = phone.replace(/[^\d+]/g, '');
  return `sha256:${createHash('sha256').update(normalized).digest('hex')}`;
}

/** Display mask: last two digits only (operator list views). */
export function maskPhone(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  return digits.length >= 2 ? `•••${digits.slice(-2)}` : '•••';
}
