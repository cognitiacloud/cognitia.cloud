import { describe, it, expect } from 'vitest';
import { validateEvent, makeEvent, isKnownEventName } from './index.js';

const TENANT = '11111111-1111-1111-1111-111111111111';
const ENTITY = '22222222-2222-2222-2222-222222222222';

const base = {
  tenant_id: TENANT,
  entity_type: 'agent_action',
  entity_id: ENTITY,
  source: 'agent:mira',
  trace_id: 'trace-1',
};

describe('event schema validation', () => {
  it('accepts a well-formed known event', () => {
    const event = makeEvent({
      ...base,
      event_name: 'agent.action.proposed.v1',
      payload: { action_type: 'email.draft.send', risk_level: 'high', evidence_refs: ['e1'] },
    });
    const result = validateEvent(event);
    expect(result.ok).toBe(true);
  });

  it('rejects an unknown event_name', () => {
    const result = validateEvent({
      id: TENANT,
      ...base,
      event_name: 'agent.action.teleported.v1',
      occurred_at: new Date().toISOString(),
      ingested_at: new Date().toISOString(),
      payload: {},
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain('unknown event_name');
  });

  it('rejects a malformed event_name shape', () => {
    const result = validateEvent({
      id: TENANT,
      ...base,
      event_name: 'NotValidName',
      occurred_at: new Date().toISOString(),
      ingested_at: new Date().toISOString(),
      payload: {},
    });
    expect(result.ok).toBe(false);
  });

  it('rejects a known event with an invalid payload', () => {
    const result = validateEvent({
      id: TENANT,
      ...base,
      event_name: 'agent.action.proposed.v1',
      occurred_at: new Date().toISOString(),
      ingested_at: new Date().toISOString(),
      payload: { action_type: 'email.draft.send' }, // missing required fields
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain('payload invalid');
  });

  it('makeEvent throws when tenant_id is missing', () => {
    expect(() =>
      makeEvent({
        // @ts-expect-error intentionally omitting tenant_id
        tenant_id: undefined,
        event_name: 'agent.run.created.v1',
        entity_type: 'agent_run',
        entity_id: ENTITY,
        source: 'agent:mira',
        trace_id: 't',
        payload: { agent: 'mira', objective: 'x' },
      }),
    ).toThrow();
  });

  it('isKnownEventName narrows correctly', () => {
    expect(isKnownEventName('agent.run.created.v1')).toBe(true);
    expect(isKnownEventName('nope')).toBe(false);
  });
});
