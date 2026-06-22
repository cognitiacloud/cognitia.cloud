import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  evaluateReleaseGate,
  requirementsFor,
  EVIDENCE_REQUIREMENTS,
  type EvidenceItem,
} from './releaseGate.ts';

function allPassing(ids: readonly string[]): EvidenceItem[] {
  return ids.map((id) => ({ id, state: 'pass' as const }));
}

test('mock-staging promotes when its evidence passes', () => {
  const ids = requirementsFor('mock-staging').map((r) => r.id);
  const d = evaluateReleaseGate('mock-staging', allPassing(ids));
  assert.equal(d.promote, true);
});

test('missing evidence blocks (fail-closed)', () => {
  const d = evaluateReleaseGate('mock-staging', []);
  assert.equal(d.promote, false);
  assert.ok(d.promote === false && d.blockers.every((b) => b.startsWith('missing_evidence')));
});

test('unknown evidence is treated as failure', () => {
  const ids = requirementsFor('mock-staging').map((r) => r.id);
  const items = allPassing(ids);
  items[0] = { id: items[0]!.id, state: 'unknown' };
  const d = evaluateReleaseGate('mock-staging', items);
  assert.equal(d.promote, false);
  assert.ok(d.promote === false && d.blockers.some((b) => b.includes(':unknown')));
});

test('live promotion is always blocked in mock-safe mode, even fully evidenced', () => {
  const ids = EVIDENCE_REQUIREMENTS.map((r) => r.id);
  const d = evaluateReleaseGate('live', allPassing(ids), { mockSafe: true });
  assert.equal(d.promote, false);
  assert.ok(d.promote === false && d.blockers.includes('live_promotion_blocked_in_mock_safe'));
});

test('requirements accumulate with stage order', () => {
  assert.ok(requirementsFor('mock-staging').length < requirementsFor('live').length);
});
