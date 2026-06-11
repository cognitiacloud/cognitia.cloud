import { describe, expect, it } from 'vitest';
import {
  evidenceTag,
  proofCreate,
  canApplyReputationDelta,
  creditsTransfer,
  walletBindingCreate,
  leadOutcomeCreate,
} from './trust.js';

const TENANT = '11111111-1111-1111-1111-111111111111';
const SUBJECT = 'c0a00000-0000-0000-0000-000000000001';

describe('evidenceTag', () => {
  it('accepts exactly the three doctrine values', () => {
    expect(evidenceTag.parse('verified_fact')).toBe('verified_fact');
    expect(evidenceTag.parse('likely_inference')).toBe('likely_inference');
    expect(evidenceTag.parse('unknown')).toBe('unknown');
    expect(() => evidenceTag.parse('confirmed')).toThrow();
    expect(() => evidenceTag.parse('')).toThrow();
  });
});

describe('proofCreate', () => {
  const base = {
    tenant_id: TENANT,
    kind: 'system' as const,
    subject_type: 'agent',
    subject_id: SUBJECT,
  };

  it('requires an evidence_tag', () => {
    expect(() => proofCreate.parse(base)).toThrow();
  });

  it('verified_fact requires evidence_ref and verifier_ref', () => {
    expect(() => proofCreate.parse({ ...base, evidence_tag: 'verified_fact' })).toThrow(
      /evidence_ref|verifier_ref/,
    );
    expect(() =>
      proofCreate.parse({ ...base, evidence_tag: 'verified_fact', evidence_ref: 'log:1' }),
    ).toThrow(/verifier_ref/);
    expect(
      proofCreate.parse({
        ...base,
        evidence_tag: 'verified_fact',
        evidence_ref: 'log:1',
        verifier_ref: 'user:' + TENANT,
      }).evidence_tag,
    ).toBe('verified_fact');
  });

  it('likely_inference and unknown do not require refs', () => {
    expect(proofCreate.parse({ ...base, evidence_tag: 'likely_inference' }).evidence_tag).toBe(
      'likely_inference',
    );
    expect(proofCreate.parse({ ...base, evidence_tag: 'unknown' }).evidence_tag).toBe('unknown');
  });
});

describe('canApplyReputationDelta (only verified_fact may add reputation)', () => {
  it('positive delta requires verified_fact', () => {
    expect(canApplyReputationDelta(1, 'verified_fact')).toBe(true);
    expect(canApplyReputationDelta(1, 'likely_inference')).toBe(false);
    expect(canApplyReputationDelta(0.001, 'unknown')).toBe(false);
  });

  it('zero and negative deltas are admissible under any tag', () => {
    expect(canApplyReputationDelta(0, 'unknown')).toBe(true);
    expect(canApplyReputationDelta(-5, 'likely_inference')).toBe(true);
    expect(canApplyReputationDelta(-5, 'verified_fact')).toBe(true);
  });
});

describe('creditsTransfer', () => {
  const base = {
    tenant_id: TENANT,
    from_account_id: TENANT,
    to_account_id: SUBJECT,
    amount: 10,
    reason_code: 'grant',
    idempotency_key: 'k1',
  };

  it('defaults to the internal_credits rail', () => {
    expect(creditsTransfer.parse(base).rail).toBe('internal_credits');
  });

  it('rejects non-positive amounts and self-transfers', () => {
    expect(() => creditsTransfer.parse({ ...base, amount: 0 })).toThrow();
    expect(() => creditsTransfer.parse({ ...base, amount: -1 })).toThrow();
    expect(() => creditsTransfer.parse({ ...base, to_account_id: base.from_account_id })).toThrow(
      /distinct/,
    );
  });
});

describe('walletBindingCreate (Lane C placeholders only)', () => {
  it('defaults to chain none + status placeholder', () => {
    const parsed = walletBindingCreate.parse({
      tenant_id: TENANT,
      owner_type: 'agent',
      owner_id: SUBJECT,
    });
    expect(parsed.chain).toBe('none');
    expect(parsed.status).toBe('placeholder');
  });

  it('rejects any non-placeholder status', () => {
    expect(() =>
      walletBindingCreate.parse({
        tenant_id: TENANT,
        owner_type: 'agent',
        owner_id: SUBJECT,
        status: 'active',
      }),
    ).toThrow();
  });
});

describe('leadOutcomeCreate', () => {
  it('requires an evidence tag and rejects negative values', () => {
    const base = { tenant_id: TENANT, lead_intake_id: SUBJECT, outcome: 'rescued' as const };
    expect(() => leadOutcomeCreate.parse(base)).toThrow();
    expect(leadOutcomeCreate.parse({ ...base, evidence_tag: 'likely_inference' }).currency).toBe(
      'CAD',
    );
    expect(() =>
      leadOutcomeCreate.parse({
        ...base,
        evidence_tag: 'verified_fact',
        booking_value_cents: -100,
      }),
    ).toThrow();
  });
});
