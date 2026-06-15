import { describe, it, expect } from 'vitest';
import type { AgentPassportRow, ScopeGrantRow } from '@cognitia/db';
import { checkPassport } from './passportPolicy.js';

/**
 * PASS-1 — pure policy matrix. Every deny path of identity-first execution is
 * pinned here; the ledger integration (audited denials, chokepoint placement)
 * is covered in apps/api/src/passports.test.ts.
 */

const TENANT = '11111111-1111-1111-1111-111111111111';
const NOW = new Date('2026-06-12T00:00:00.000Z');
const ts = '2026-06-01T00:00:00.000Z';

function passport(over: Partial<AgentPassportRow> = {}): AgentPassportRow {
  return {
    id: 'pp-1',
    tenant_id: TENANT,
    agent_id: 'mira',
    owner_ref: 'user:owner',
    status: 'active',
    key_ref: null,
    created_at: ts,
    updated_at: ts,
    ...over,
  };
}

function grant(over: Partial<ScopeGrantRow> = {}): ScopeGrantRow {
  return {
    id: 'gr-1',
    tenant_id: TENANT,
    passport_id: 'pp-1',
    action_type: 'crm.task.create',
    integration: 'hubspot',
    risk_max: 'medium',
    status: 'active',
    approved_by: 'user:owner',
    approved_at: ts,
    expires_at: '2099-01-01T00:00:00.000Z',
    revoked_at: null,
    revoked_by: null,
    created_at: ts,
    updated_at: ts,
    ...over,
  };
}

const base = {
  actionType: 'crm.task.create',
  integration: 'hubspot',
  riskLevel: 'low',
  now: NOW,
};

describe('checkPassport — identity-first execution policy (PASS-1)', () => {
  it('allows with an active passport and a live matching grant', () => {
    const r = checkPassport({ ...base, passport: passport(), grants: [grant()] });
    expect(r).toMatchObject({ allowed: true, passport_id: 'pp-1', grant_id: 'gr-1' });
  });

  it('denies when the passport is missing', () => {
    const r = checkPassport({ ...base, passport: null, grants: [grant()] });
    expect(r).toMatchObject({ allowed: false, denial: 'passport_missing' });
  });

  it('denies a revoked or suspended passport', () => {
    expect(
      checkPassport({ ...base, passport: passport({ status: 'revoked' }), grants: [grant()] }),
    ).toMatchObject({ allowed: false, denial: 'passport_revoked' });
    expect(
      checkPassport({ ...base, passport: passport({ status: 'suspended' }), grants: [grant()] }),
    ).toMatchObject({ allowed: false, denial: 'passport_suspended' });
  });

  it('denies when there is no grant at all', () => {
    const r = checkPassport({ ...base, passport: passport(), grants: [] });
    expect(r).toMatchObject({ allowed: false, denial: 'grant_missing' });
  });

  it('denies a grant for a different action type', () => {
    const r = checkPassport({
      ...base,
      passport: passport(),
      grants: [grant({ action_type: 'crm.note.create' })],
    });
    expect(r).toMatchObject({ allowed: false, denial: 'grant_missing' });
  });

  it('denies a grant for a different integration', () => {
    const r = checkPassport({
      ...base,
      passport: passport(),
      grants: [grant({ integration: 'salesforce' })],
    });
    expect(r).toMatchObject({ allowed: false, denial: 'grant_missing' });
  });

  it('denies a grant belonging to a different passport', () => {
    const r = checkPassport({
      ...base,
      passport: passport(),
      grants: [grant({ passport_id: 'pp-other' })],
    });
    expect(r).toMatchObject({ allowed: false, denial: 'grant_missing' });
  });

  it('denies when the action risk exceeds the grant ceiling', () => {
    const r = checkPassport({
      ...base,
      riskLevel: 'high',
      passport: passport(),
      grants: [grant({ risk_max: 'medium' })],
    });
    expect(r).toMatchObject({ allowed: false, denial: 'grant_insufficient_risk' });
  });

  it('allows when risk equals the ceiling', () => {
    const r = checkPassport({
      ...base,
      riskLevel: 'medium',
      passport: passport(),
      grants: [grant({ risk_max: 'medium' })],
    });
    expect(r.allowed).toBe(true);
  });

  it('denies an expired grant', () => {
    const r = checkPassport({
      ...base,
      passport: passport(),
      grants: [grant({ expires_at: '2026-06-11T23:59:59.000Z' })], // before NOW
    });
    expect(r).toMatchObject({ allowed: false, denial: 'grant_expired' });
  });

  it('denies a revoked grant, and revocation outranks expiry in the reason', () => {
    const r = checkPassport({
      ...base,
      passport: passport(),
      grants: [
        grant({ id: 'gr-expired', expires_at: '2026-01-01T00:00:00.000Z' }),
        grant({ id: 'gr-revoked', status: 'revoked' }),
      ],
    });
    expect(r).toMatchObject({ allowed: false, denial: 'grant_revoked', grant_id: 'gr-revoked' });
  });

  it('fails closed on unknown risk strings (never silently allows)', () => {
    // Unknown action risk requires more than any known ceiling…
    expect(
      checkPassport({ ...base, riskLevel: 'catastrophic', passport: passport(), grants: [grant()] })
        .allowed,
    ).toBe(false);
    // …and an unknown grant ceiling authorizes nothing.
    expect(
      checkPassport({
        ...base,
        passport: passport(),
        grants: [grant({ risk_max: 'everything' })],
      }).allowed,
    ).toBe(false);
  });

  it('one live sufficient grant among dead ones is enough', () => {
    const r = checkPassport({
      ...base,
      passport: passport(),
      grants: [
        grant({ id: 'gr-dead', status: 'revoked' }),
        grant({ id: 'gr-live', risk_max: 'high' }),
      ],
    });
    expect(r).toMatchObject({ allowed: true, grant_id: 'gr-live' });
  });
});
