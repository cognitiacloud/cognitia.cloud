import { test } from 'node:test';
import assert from 'node:assert/strict';
import { assertDarkMode, assertDryRun, dryRun, type ConnectorPosture } from './darkMode.ts';

test('a dark connector with a placeholder credential passes', () => {
  const posture: ConnectorPosture = {
    connector: 'hubspot',
    mode: 'dark',
    credentialRef: 'env:HUBSPOT_TOKEN_PLACEHOLDER',
  };
  assert.deepEqual(assertDarkMode(posture), { ok: true, violations: [] });
});

test('a live connector fails closed in mock-safe mode', () => {
  const r = assertDarkMode({ connector: 'gmail', mode: 'live', credentialRef: 'env:X' });
  assert.equal(r.ok, false);
  assert.ok(r.violations.some((v) => v.startsWith('connector_not_dark')));
});

test('a real-looking secret is rejected', () => {
  const r = assertDarkMode({
    connector: 'slack',
    mode: 'dark',
    credentialRef: 'xoxb-MOCK-PLACEHOLDER-NOT-REAL',
  });
  assert.equal(r.ok, false);
  assert.ok(r.violations.some((v) => v.startsWith('real_secret_detected')));
});

test('a non-placeholder credential ref is rejected', () => {
  const r = assertDarkMode({ connector: 'apify', mode: 'dark', credentialRef: 'apify_api_live' });
  assert.equal(r.ok, false);
  assert.ok(r.violations.some((v) => v.startsWith('credential_ref_not_placeholder')));
});

test('dryRun forces sent:false', () => {
  const a = dryRun('crm-generic', 'create_contact', 'contact:sha256:abc');
  assert.equal(a.sent, false);
});

test('assertDryRun rejects sent:true at the boundary', () => {
  const r = assertDryRun({ sent: true });
  assert.equal(r.ok, false);
  assert.deepEqual(r.violations, ['action_sent_must_be_false_in_mock_safe']);
});
