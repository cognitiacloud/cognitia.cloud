import { describe, it, expect } from 'vitest';
import {
  CLIENT_ZERO_GATE_POLICY_VERSION,
  type ClientZeroWorkflowAction,
  clientZeroDecisionToLog,
  clientZeroDecisionToProof,
  evaluateClientZeroGate,
  isHumanApprovalGranted,
} from './clientZeroComplianceGate.js';
import { DEMO_PROSPECTS, DEMO_PROSPECTS_BY_ID } from './complianceFixtures.js';

const rec = (id: string) => {
  const record = DEMO_PROSPECTS_BY_ID[id];
  if (!record) throw new Error(`missing fixture ${id}`);
  return record;
};

const grantedApproval = {
  required: true,
  status: 'approved' as const,
  approverType: 'human' as const,
  approverId: 'user:compliance-owner@example.test',
  approvedAt: '2026-06-10T12:00:00.000Z',
};

/** Build an action from a demo fixture (prospect + its evidence). */
function action(
  id: string,
  over: Partial<ClientZeroWorkflowAction> = {},
): ClientZeroWorkflowAction {
  const r = rec(id);
  return {
    surface: 'general_outreach',
    actionKind: 'send',
    channel: 'email',
    prospect: r.prospect,
    evidence: r.evidence,
    ...over,
  };
}

describe('consent missing → blocked', () => {
  it('blocks a send when consent/contact basis is not established', () => {
    // coast-cars: consentStatus 'not_established', no evidence.
    const decision = evaluateClientZeroGate(action('prospect:coast-cars', { actionKind: 'send' }));
    expect(decision.outcome).toBe('blocked');
    expect(decision.reasonCodes).toContain('CZ_CONSENT_MISSING');
    expect(decision.requiresHumanApproval).toBe(true);
  });

  it('downgrades missing consent to approval_required for a draft (never a send)', () => {
    const decision = evaluateClientZeroGate(
      action('prospect:coast-cars', { actionKind: 'draft', approval: grantedApproval }),
    );
    // A draft with missing consent may be prepared for a human, but evidence is
    // also incomplete here, so it still needs approval — never proceed/blocked.
    expect(decision.outcome).toBe('approval_required');
    expect(decision.reasonCodes).toContain('CZ_CONSENT_MISSING');
  });
});

describe('finance / trade-in surface → handoff/approval required', () => {
  it('routes a finance-surface action to human handoff', () => {
    const decision = evaluateClientZeroGate(
      action('prospect:northshore-auto', { surface: 'finance', actionKind: 'draft' }),
    );
    expect(decision.outcome).toBe('handoff_required');
    expect(decision.reasonCodes).toContain('CZ_FINANCE_HANDOFF_REQUIRED');
    expect(decision.requiresHumanApproval).toBe(true);
  });

  it('routes a trade-in-surface action to human handoff even with approval granted', () => {
    const decision = evaluateClientZeroGate(
      action('prospect:northshore-auto', {
        surface: 'trade_in',
        actionKind: 'draft',
        approval: grantedApproval,
      }),
    );
    // A generic approval never clears a regulated-surface handoff.
    expect(decision.outcome).toBe('handoff_required');
    expect(decision.reasonCodes).toContain('CZ_TRADE_IN_HANDOFF_REQUIRED');
  });

  it('marks pricing as approval-required (quotes are never firm without sign-off)', () => {
    const decision = evaluateClientZeroGate(
      action('prospect:northshore-auto', { surface: 'pricing', approval: grantedApproval }),
    );
    expect(decision.outcome).toBe('approval_required');
    expect(decision.reasonCodes).toContain('CZ_PRICING_APPROVAL_REQUIRED');
  });
});

describe('approved consent → workflow may proceed', () => {
  it('proceeds for a clean, consented prospect with granted human approval', () => {
    // northshore-auto: implied_possible consent, complete evidence, low-risk source.
    const decision = evaluateClientZeroGate(
      action('prospect:northshore-auto', {
        surface: 'general_outreach',
        actionKind: 'send',
        approval: grantedApproval,
      }),
    );
    expect(decision.outcome).toBe('proceed');
    expect(decision.reasonCodes).toEqual([]);
    expect(decision.requiresHumanApproval).toBe(false);
  });

  it('does NOT proceed without human approval (approval is always required)', () => {
    const decision = evaluateClientZeroGate(action('prospect:northshore-auto'));
    expect(decision.outcome).toBe('approval_required');
    expect(decision.reasonCodes).toContain('CZ_HUMAN_APPROVAL_REQUIRED');
  });

  it('does NOT proceed when an agent tries to self-approve', () => {
    expect(
      isHumanApprovalGranted({ required: true, status: 'approved', approverType: 'agent' }),
    ).toBe(false);
  });
});

describe('suppression + channel gating (engine rules stay supreme)', () => {
  it('blocks an unsubscribed prospect', () => {
    const decision = evaluateClientZeroGate(
      action('prospect:fraser-motors', { approval: grantedApproval }),
    );
    expect(decision.outcome).toBe('blocked');
    expect(decision.reasonCodes).toContain('CZ_UNSUBSCRIBED');
  });

  it('blocks a do-not-contact prospect even with approval granted', () => {
    const decision = evaluateClientZeroGate(
      action('prospect:peak-auto', { approval: grantedApproval }),
    );
    expect(decision.outcome).toBe('blocked');
    expect(decision.reasonCodes).toContain('CZ_DO_NOT_CONTACT');
  });

  it('blocks a gated channel (sms) by default', () => {
    const decision = evaluateClientZeroGate(
      action('prospect:northshore-auto', { channel: 'sms', approval: grantedApproval }),
    );
    expect(decision.outcome).toBe('blocked');
    expect(decision.reasonCodes).toContain('CZ_CHANNEL_GATED_OFF');
  });

  it('flags a high-risk source for human review', () => {
    const decision = evaluateClientZeroGate(
      action('prospect:metro-imports', { approval: grantedApproval }),
    );
    expect(decision.reasonCodes).toContain('CZ_SOURCE_HIGH_RISK');
    expect(decision.outcome).toBe('approval_required');
  });
});

describe('audit / proof shape', () => {
  it('stamps the policy version and maps outcomes to engine decisions', () => {
    const a = action('prospect:peak-auto');
    const decision = evaluateClientZeroGate(a);
    const log = clientZeroDecisionToLog(decision, a);
    const proof = clientZeroDecisionToProof(decision);

    expect(decision.policyVersion).toBe(CLIENT_ZERO_GATE_POLICY_VERSION);
    expect(log.decision).toBe('blocked');
    expect(log.humanApprovalRequired).toBe(true);
    expect(log.prospectId).toBe('prospect:peak-auto');
    expect(log.reason).toContain('CZ_DO_NOT_CONTACT');
    expect(proof.type).toBe('do_not_contact_recorded');
    expect(proof.prospectId).toBe('prospect:peak-auto');
  });
});

describe('no raw PII emitted in logs / fixtures', () => {
  // Raw contact email (masked `s***@…` has `*` in the local part, so it never
  // matches) and raw NANP phone (masked `***-***-0100` has no 3-3-4 digit run).
  const RAW_EMAIL = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/;
  const RAW_PHONE = /\b\d{3}[-\s.]?\d{3}[-\s.]?\d{4}\b/;

  it('emits no raw contact email or phone across every demo decision', () => {
    const surfaces = ['general_outreach', 'finance', 'trade_in', 'pricing'] as const;
    const payloads: string[] = [];
    for (const { prospect } of DEMO_PROSPECTS) {
      for (const surface of surfaces) {
        const a = action(prospect.id, { surface, approval: grantedApproval });
        const decision = evaluateClientZeroGate(a);
        payloads.push(
          JSON.stringify(decision),
          JSON.stringify(clientZeroDecisionToLog(decision, a)),
          JSON.stringify(clientZeroDecisionToProof(decision)),
        );
      }
    }
    const blob = payloads.join('\n');
    expect(RAW_EMAIL.test(blob)).toBe(false);
    expect(RAW_PHONE.test(blob)).toBe(false);
  });

  it('demo fixtures themselves carry no raw contact email or phone', () => {
    const blob = JSON.stringify(DEMO_PROSPECTS);
    expect(RAW_EMAIL.test(blob)).toBe(false);
    expect(RAW_PHONE.test(blob)).toBe(false);
  });
});
