import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validateAuditEvent, assertNoRawPii, type AuditEvent } from './audit.ts';

const baseEvent: AuditEvent = {
  id: '11111111-1111-1111-1111-111111111111',
  tenant_id: '22222222-2222-2222-2222-222222222222',
  event_name: 'authz.access.denied.v1',
  entity_type: 'route',
  entity_id: '33333333-3333-3333-3333-333333333333',
  actor_ref: 'user:44444444-4444-4444-4444-444444444444',
  source: 'route-guard',
  occurred_at: '2026-06-22T16:37:00Z',
  trace_id: 'trace-abc',
  payload: { path: '/api/actions/live', reason: 'live_capability_dark' },
};

test('accepts a well-formed event', () => {
  assert.deepEqual(validateAuditEvent(baseEvent), { ok: true, errors: [] });
});

test('rejects an unregistered event_name', () => {
  const r = validateAuditEvent({ ...baseEvent, event_name: 'foo.bar.baz.v1' });
  assert.equal(r.ok, false);
  assert.ok(r.errors.some((e) => e.startsWith('event_name_not_registered')));
});

test('rejects a malformed event_name shape', () => {
  const r = validateAuditEvent({ ...baseEvent, event_name: 'NotAnEvent' });
  assert.equal(r.ok, false);
});

test('rejects raw email in payload', () => {
  const r = validateAuditEvent({
    ...baseEvent,
    payload: { contact: 'jane.doe@example.com' },
  });
  assert.equal(r.ok, false);
  assert.ok(r.errors.some((e) => e.startsWith('raw_email_at')));
});

test('rejects forbidden PII keys even with benign values', () => {
  const r = assertNoRawPii({ email: 'redacted', nested: { phone: 'x' } });
  assert.equal(r.ok, false);
  assert.equal(r.errors.length, 2);
});

test('allows hashed refs through', () => {
  const r = assertNoRawPii({ contact_hash: 'sha256:deadbeef', ref: 'contact:abc' });
  assert.deepEqual(r, { ok: true, errors: [] });
});

test('rejects a non-uuid id', () => {
  const r = validateAuditEvent({ ...baseEvent, id: 'not-a-uuid' });
  assert.equal(r.ok, false);
  assert.ok(r.errors.includes('id_must_be_uuid'));
});
