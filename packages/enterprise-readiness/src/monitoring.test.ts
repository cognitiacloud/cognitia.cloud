import { test } from 'node:test';
import assert from 'node:assert/strict';
import { evaluateRule, evaluateAll, MONITORING_RULES } from './monitoring.ts';
import type { AuditEvent, AuditEventName } from './audit.ts';

function ev(event_name: AuditEventName, occurred_at: string): AuditEvent {
  return {
    id: '11111111-1111-1111-1111-111111111111',
    tenant_id: '22222222-2222-2222-2222-222222222222',
    event_name,
    entity_type: 'x',
    entity_id: '33333333-3333-3333-3333-333333333333',
    actor_ref: 'system',
    source: 'test',
    occurred_at,
    trace_id: 't',
    payload: {},
  };
}

const liveRule = MONITORING_RULES.find((r) => r.id === 'live-action-attempt')!;

test('single live-action attempt pages immediately', () => {
  const alert = evaluateRule(liveRule, [ev('action.live.blocked.v1', '2026-06-22T16:00:00Z')]);
  assert.ok(alert);
  assert.equal(alert!.severity, 'critical');
});

test('no alert when no matching events', () => {
  const alert = evaluateRule(liveRule, [ev('authz.access.denied.v1', '2026-06-22T16:00:00Z')]);
  assert.equal(alert, null);
});

test('denial spike trips only inside the window', () => {
  const spikeRule = MONITORING_RULES.find((r) => r.id === 'authz-denial-spike')!;
  const within = Array.from({ length: spikeRule.threshold }, (_, i) =>
    ev('authz.access.denied.v1', new Date(Date.UTC(2026, 5, 22, 16, 0, i)).toISOString()),
  );
  assert.ok(evaluateRule(spikeRule, within));

  const spread = Array.from({ length: spikeRule.threshold }, (_, i) =>
    ev('authz.access.denied.v1', new Date(Date.UTC(2026, 5, 22, 16, i * 2, 0)).toISOString()),
  );
  assert.equal(evaluateRule(spikeRule, spread), null);
});

test('evaluateAll returns one alert per fired rule', () => {
  const alerts = evaluateAll([
    ev('action.live.blocked.v1', '2026-06-22T16:00:00Z'),
    ev('incident.declared.v1', '2026-06-22T16:00:01Z'),
  ]);
  const ids = alerts.map((a) => a.ruleId).sort();
  assert.deepEqual(ids, ['incident-declared', 'live-action-attempt']);
});
