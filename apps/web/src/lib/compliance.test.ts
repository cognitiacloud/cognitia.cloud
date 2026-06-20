import { describe, it, expect } from 'vitest';
import { canContactProspect as coreCanContactProspect } from '@cognitia/core';
import {
  agentCanApproveAction,
  agentCanSendOutreach,
  blockIfUnsubscribedOrDnc,
  checkChannelCompliance,
  createComplianceLogEntry,
  createComplianceProofEvent,
  evaluateChannelEligibility,
  explainComplianceDecision,
  getDefaultChannelPolicy,
  requiresHumanReviewForChannel,
} from './compliance.js';
import { DEMO_PROSPECTS, DEMO_PROSPECTS_BY_ID } from './complianceFixtures.js';

const rec = (id: string) => {
  const record = DEMO_PROSPECTS_BY_ID[id];
  if (!record) throw new Error(`missing fixture ${id}`);
  return record;
};
const p = (id: string) => rec(id).prospect;
const ev = (id: string) => rec(id).evidence;

describe('default channel policy', () => {
  it('gates SMS, WhatsApp, and AI voice off by default', () => {
    const policy = getDefaultChannelPolicy();
    expect(policy.channels.sms).toBe('gated_off');
    expect(policy.channels.whatsapp).toBe('gated_off');
    expect(policy.channels.ai_voice).toBe('gated_off');
  });

  it('enables email and phone, and keeps LinkedIn manual/human-review only', () => {
    const policy = getDefaultChannelPolicy();
    expect(policy.channels.email).toBe('enabled');
    expect(policy.channels.phone).toBe('enabled');
    expect(policy.channels.linkedin).toBe('human_review_required');
    expect(policy.aiDraftsRequireHumanApproval).toBe(true);
  });
});

describe('suppression blocks (consistent with @cognitia/core canContactProspect)', () => {
  it('blocks an unsubscribed prospect on email', () => {
    expect(
      checkChannelCompliance(p('prospect:fraser-motors'), 'email', ev('prospect:fraser-motors'))
        .decision,
    ).toBe('blocked');
  });

  it('blocks a do-not-contact prospect on phone', () => {
    expect(
      checkChannelCompliance(p('prospect:peak-auto'), 'phone', ev('prospect:peak-auto')).decision,
    ).toBe('blocked');
  });

  it('local suppression matches the core helper for every demo prospect', () => {
    for (const { prospect } of DEMO_PROSPECTS) {
      const localBlocked = blockIfUnsubscribedOrDnc(prospect) !== null;
      expect(localBlocked).toBe(!coreCanContactProspect(prospect));
    }
  });
});

describe('source risk', () => {
  it('blocks a blocked-risk source (uses the prospect sourceRisk from #97)', () => {
    const blocked = { ...p('prospect:metro-imports'), sourceRisk: 'blocked' as const };
    expect(checkChannelCompliance(blocked, 'email', ev('prospect:metro-imports')).decision).toBe(
      'blocked',
    );
  });

  it('requires human review for a high-risk source', () => {
    const result = checkChannelCompliance(
      p('prospect:metro-imports'),
      'email',
      ev('prospect:metro-imports'),
    );
    expect(result.decision).toBe('human_review_required');
    expect(result.reasons.join(' ')).toMatch(/high-risk/i);
  });
});

describe('consent + evidence', () => {
  it('requires human review when consent is not established', () => {
    const result = checkChannelCompliance(
      p('prospect:coast-cars'),
      'email',
      ev('prospect:coast-cars'),
    );
    expect(result.decision).toBe('human_review_required');
    expect(result.reasons.join(' ')).toMatch(/not established/i);
  });

  it('flags missing required evidence as human review', () => {
    const result = checkChannelCompliance(
      p('prospect:coast-cars'),
      'email',
      ev('prospect:coast-cars'),
    );
    expect(result.evidenceComplete).toBe(false);
    expect(result.reasons.join(' ')).toMatch(/evidence/i);
  });
});

describe('gated channels', () => {
  it.each(['sms', 'whatsapp', 'ai_voice'] as const)(
    'keeps %s gated off (blocked even for a clean prospect)',
    (channel) => {
      const elig = evaluateChannelEligibility(
        p('prospect:northshore-auto'),
        channel,
        ev('prospect:northshore-auto'),
      );
      expect(elig.status).toBe('gated_off');
      expect(elig.decision).toBe('blocked');
    },
  );
});

describe('email + phone human-review requirements', () => {
  it('email requires unsubscribe support (human review, not auto-send)', () => {
    const result = checkChannelCompliance(
      p('prospect:northshore-auto'),
      'email',
      ev('prospect:northshore-auto'),
    );
    expect(result.decision).toBe('human_review_required');
    expect(result.requiresHumanApproval).toBe(true);
    expect(result.reasons.join(' ')).toMatch(/unsubscribe/i);
  });

  it('phone requires DNC/DNCL/internal-DNC representation and caller identification', () => {
    const result = checkChannelCompliance(
      p('prospect:northshore-auto'),
      'phone',
      ev('prospect:northshore-auto'),
    );
    expect(result.decision).toBe('human_review_required');
    expect(result.reasons.join(' ')).toMatch(/caller identification|DNCL|DNC/i);
  });

  it('never returns "allowed" for an outreach channel (no autonomous send)', () => {
    expect(
      requiresHumanReviewForChannel(
        p('prospect:northshore-auto'),
        'email',
        ev('prospect:northshore-auto'),
      ),
    ).toBe(true);
    expect(
      requiresHumanReviewForChannel(
        p('prospect:northshore-auto'),
        'phone',
        ev('prospect:northshore-auto'),
      ),
    ).toBe(true);
  });

  it('LinkedIn is manual / human-review only', () => {
    const elig = evaluateChannelEligibility(
      p('prospect:northshore-auto'),
      'linkedin',
      ev('prospect:northshore-auto'),
    );
    expect(elig.decision).toBe('human_review_required');
    expect(elig.reasons.join(' ')).toMatch(/manual/i);
  });
});

describe('AI drafts + agent guardrails', () => {
  it('an AI outreach draft always requires human approval before sending', () => {
    expect(agentCanSendOutreach({ requiresHumanApproval: true, approvalStatus: 'proposed' })).toBe(
      false,
    );
    expect(agentCanSendOutreach({ requiresHumanApproval: true, approvalStatus: 'approved' })).toBe(
      true,
    );
  });

  it('a Demandara GTM agent cannot send autonomous outreach', () => {
    expect(agentCanSendOutreach({ requiresHumanApproval: true, approvalStatus: 'proposed' })).toBe(
      false,
    );
  });

  it('a Compliance Guardrail agent cannot approve its own risky action', () => {
    expect(
      agentCanApproveAction({
        proposerActorId: 'agent:guardrail',
        approverActorId: 'agent:guardrail',
        approverType: 'agent',
        riskLevel: 'high',
      }),
    ).toBe(false);
    expect(
      agentCanApproveAction({
        proposerActorId: 'agent:guardrail',
        approverActorId: 'human:op',
        approverType: 'human',
        riskLevel: 'high',
      }),
    ).toBe(true);
  });
});

describe('logs + proof events', () => {
  it('a compliance log entry carries the supplied evidence fields (no raw PII)', () => {
    const record = rec('prospect:northshore-auto');
    const entry = createComplianceLogEntry({
      prospect: record.prospect,
      actorType: 'system',
      actorId: 'system:compliance',
      actionType: 'channel_eligibility_checked',
      channel: 'email',
      decision: 'human_review_required',
      reason: 'Email requires human approval.',
      evidenceFields: record.evidence,
    });
    expect(entry.evidenceFields.length).toBeGreaterThan(0);
    expect(entry.evidenceFields[0]!.sourceUrl).not.toBe('');
    expect(entry.consentStatus).toBe('implied_possible');
    expect(entry.humanApprovalRequired).toBe(true);
    // no raw contact PII in the serialized entry
    expect(JSON.stringify(entry)).not.toMatch(/@[a-z0-9.-]+\.[a-z]{2,}/i);
  });

  it('creates a proof event for a compliance decision', () => {
    const event = createComplianceProofEvent({
      type: 'compliance_decision_logged',
      prospectId: 'prospect:northshore-auto',
      channel: 'email',
      decision: 'human_review_required',
      summary: 'Email outreach routed to human review.',
    });
    expect(event.type).toBe('compliance_decision_logged');
    expect(event.decision).toBe('human_review_required');
  });
});

describe('explainComplianceDecision', () => {
  it('renders a human-readable line', () => {
    const result = checkChannelCompliance(
      p('prospect:fraser-motors'),
      'email',
      ev('prospect:fraser-motors'),
    );
    expect(explainComplianceDecision(result)).toMatch(/Blocked on email/);
  });
});

describe('PII doctrine — fixtures carry no raw contact PII', () => {
  it('no demo prospect exposes raw contactEmail / contactPhone keys', () => {
    for (const { prospect } of DEMO_PROSPECTS) {
      expect('contactEmail' in prospect).toBe(false);
      expect('contactPhone' in prospect).toBe(false);
    }
  });

  it('no fixture serializes a raw email address or 10-digit phone', () => {
    const blob = JSON.stringify(DEMO_PROSPECTS);
    // masked values like "s***@domain" are allowed; a full local-part is not
    expect(blob).not.toMatch(/[a-z0-9._%+-]{2,}@[a-z0-9.-]+\.[a-z]{2,}/i);
    expect(blob).not.toMatch(/\d{10}/);
  });
});
