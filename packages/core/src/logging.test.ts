import { describe, it, expect } from 'vitest';
import { redactLog, piiHash } from './logging.js';

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
});
