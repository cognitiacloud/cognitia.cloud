import { describe, it, expect } from 'vitest';
import { redactLog, piiHash, sanitizeText, sanitizeErrorText } from './logging.js';

describe('log redaction (no raw PII)', () => {
  it('drops forbidden PII/secret keys', () => {
    const out = redactLog({
      level: 'info',
      message: 'action.proposed',
      tenant_id: 't',
      email: 'person@acme.com',
      phone: '+15551234',
      transcript: 'hello there',
      oauth_token: 'secret',
      message_body: 'Dear ...',
    });
    expect(out).not.toHaveProperty('email');
    expect(out).not.toHaveProperty('phone');
    expect(out).not.toHaveProperty('transcript');
    expect(out).not.toHaveProperty('oauth_token');
    expect(out).not.toHaveProperty('message_body');
    expect(out.tenant_id).toBe('t');
    expect(out.message).toBe('action.proposed');
  });

  it('drops unknown keys and keeps the allowed shape', () => {
    const out = redactLog({
      level: 'warn',
      message: 'x',
      entity_ref: 'account:abc',
      something_random: 1,
    });
    expect(out).not.toHaveProperty('something_random');
    expect(out.entity_ref).toBe('account:abc');
  });

  it('piiHash is stable and case/space-insensitive', () => {
    expect(piiHash(' Person@Acme.com ')).toBe(piiHash('person@acme.com'));
  });

  it('scrubs PII/secret values out of allowed free-text fields', () => {
    const out = redactLog({
      level: 'info',
      message: 'failed for person@acme.com with Bearer abc123.def456',
      entity_ref: 'account:abc',
    });
    expect(out.message).not.toContain('person@acme.com');
    expect(out.message).toContain('[redacted-email]');
    expect(out.message).toContain('Bearer [redacted]');
    expect(out.entity_ref).toBe('account:abc'); // ordinary refs untouched
  });

  it('sanitizeText redacts emails, bearer tokens, and long opaque blobs', () => {
    expect(sanitizeText('x@y.com')).toBe('[redacted-email]');
    expect(sanitizeText('Bearer ' + 'a'.repeat(20))).toBe('Bearer [redacted]');
    expect(sanitizeText('key=' + 'A1b2'.repeat(12))).toContain('[redacted]');
    expect(sanitizeText('a normal message')).toBe('a normal message');
  });

  it('sanitizeErrorText bounds and scrubs an error for safe storage', () => {
    const long = new Error('boom ' + 'z'.repeat(1000) + ' user@acme.com');
    const out = sanitizeErrorText(long);
    expect(out.length).toBeLessThanOrEqual(500);
    expect(out).not.toContain('user@acme.com');
  });
});
