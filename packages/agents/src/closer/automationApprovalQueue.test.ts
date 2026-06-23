import { describe, it, expect } from 'vitest';
import { planDryRunAction } from '../channels/dryRunChannels.js';
import {
  buildApprovalQueueItem,
  buildApprovalQueue,
  evaluateExecutability,
  deriveRiskLevel,
  executableItems,
  type AutomationApprovalQueueItemInput,
  type ProofPreview,
  type ApprovalState,
} from './automationApprovalQueue.js';
import type { ReleaseConditions } from '../security/releaseGate.js';

/** A fully-satisfied controlled-live condition set (all 7 true). */
const GATE_OPEN: ReleaseConditions = {
  signedCustomerScope: true,
  counselSignoff: true,
  founderSignoff: true,
  monitoringEnabled: true,
  rollbackReady: true,
  secretsConfigured: true,
  connectorApproval: true,
};

const PROOF: ProofPreview = {
  kind: 'dry_run_plan',
  summary: 'planned email to lead@buyer.example (redacted)',
  redactedRef: 'proof:budget_wheels_demo/sandbox-0001',
};

function makeInput(
  overrides: Partial<AutomationApprovalQueueItemInput> = {},
): AutomationApprovalQueueItemInput {
  return {
    workspaceId: 'budget_wheels_demo',
    approval: 'pending',
    consentBasis: 'express',
    action: planDryRunAction('email', {
      workspaceId: 'budget_wheels_demo',
      prospectId: 'prospect-1',
    }),
    proofPreview: PROOF,
    ...overrides,
  };
}

describe('buildApprovalQueueItem: shape', () => {
  it('projects every required read-model field', () => {
    const item = buildApprovalQueueItem(makeInput());
    expect(item.workspaceId).toBe('budget_wheels_demo');
    expect(typeof item.actionSummary).toBe('string');
    expect(item.consentBasis).toBe('express');
    expect(item.riskLevel).toBe('low');
    expect(item.proofPreview).toEqual(PROOF);
    expect(item.dryRunAction.sent).toBe(false);
    expect(item.dryRunAction.mode).toBe('dry_run');
    expect(Array.isArray(item.missingLiveConditions)).toBe(true);
  });

  it('requires a non-empty workspaceId', () => {
    expect(() => buildApprovalQueueItem(makeInput({ workspaceId: '  ' }))).toThrow(/workspaceId/);
  });

  it('refuses to project a forged "sent" action (tripwire)', () => {
    const forged = {
      ...planDryRunAction('email', {
        workspaceId: 'budget_wheels_demo',
        prospectId: 'prospect-1',
      }),
      sent: true as unknown as false,
    };
    expect(() => buildApprovalQueueItem(makeInput({ action: forged }))).toThrow(
      /live channels disabled/,
    );
  });

  it('derives risk from consent basis when not given explicitly', () => {
    expect(deriveRiskLevel('express')).toBe('low');
    expect(deriveRiskLevel('implied_possible')).toBe('medium');
    expect(deriveRiskLevel('not_established')).toBe('high');
    expect(deriveRiskLevel('unsubscribed')).toBe('high');
    expect(deriveRiskLevel('do_not_contact')).toBe('high');
  });

  it('surfaces the missing live conditions for an ungated item', () => {
    const item = buildApprovalQueueItem(makeInput({ approval: 'approved' }));
    expect(item.missingLiveConditions.length).toBe(7);
  });
});

describe('evaluateExecutability: pending cannot execute', () => {
  it('blocks a pending item even when the gate would be open', () => {
    const d = evaluateExecutability('pending', GATE_OPEN);
    expect(d.canExecute).toBe(false);
    expect(d.blockedBy.some((r) => r.startsWith('approval_pending'))).toBe(true);
  });

  it('blocks a pending item with no conditions', () => {
    expect(evaluateExecutability('pending').canExecute).toBe(false);
  });
});

describe('evaluateExecutability: rejected cannot execute', () => {
  it('blocks a rejected item even when the gate would be open', () => {
    const d = evaluateExecutability('rejected', GATE_OPEN);
    expect(d.canExecute).toBe(false);
    expect(d.blockedBy.some((r) => r.startsWith('approval_rejected'))).toBe(true);
  });
});

describe('evaluateExecutability: approved still cannot execute unless gate passes', () => {
  it('blocks an approved item when no live conditions are satisfied', () => {
    const d = evaluateExecutability('approved', {});
    expect(d.canExecute).toBe(false);
    expect(d.blockedBy.some((r) => r.startsWith('release_gate_closed'))).toBe(true);
  });

  it('blocks an approved item when ANY single condition is missing', () => {
    for (const key of Object.keys(GATE_OPEN) as Array<keyof ReleaseConditions>) {
      const partial: ReleaseConditions = { ...GATE_OPEN, [key]: false };
      expect(evaluateExecutability('approved', partial).canExecute).toBe(false);
    }
  });

  it('is eligible only when approved AND the full gate passes', () => {
    const d = evaluateExecutability('approved', GATE_OPEN);
    expect(d.canExecute).toBe(true);
    expect(d.blockedBy).toEqual([]);
  });
});

describe('approval does not imply send', () => {
  it('never reports willSend, even when eligible', () => {
    const approved = evaluateExecutability('approved', GATE_OPEN);
    expect(approved.willSend).toBe(false);
    const pending = evaluateExecutability('pending');
    expect(pending.willSend).toBe(false);
  });

  it('keeps the embedded action a never-sent dry-run even when eligible', () => {
    const item = buildApprovalQueueItem(
      makeInput({ approval: 'approved', releaseConditions: GATE_OPEN }),
    );
    expect(item.execution.canExecute).toBe(true);
    // Eligibility is a read-model verdict, NOT a send.
    expect(item.execution.willSend).toBe(false);
    expect(item.dryRunAction.sent).toBe(false);
    expect(item.dryRunAction.mode).toBe('dry_run');
    expect(item.dryRunAction.wouldSendIfLive.liveStatus).toBe('BLOCKED');
  });

  it('an approved item with a closed gate exposes outstanding conditions, not a send', () => {
    const item = buildApprovalQueueItem(makeInput({ approval: 'approved' }));
    expect(item.execution.canExecute).toBe(false);
    expect(item.execution.willSend).toBe(false);
    expect(item.missingLiveConditions.length).toBeGreaterThan(0);
  });
});

describe('buildApprovalQueue: ordering and filtering', () => {
  const inputs: AutomationApprovalQueueItemInput[] = [
    makeInput({ consentBasis: 'express' }), // low
    makeInput({
      consentBasis: 'not_established', // high
      action: planDryRunAction('sms', {
        workspaceId: 'budget_wheels_demo',
        prospectId: 'prospect-2',
      }),
    }),
    makeInput({
      consentBasis: 'implied_possible', // medium
      action: planDryRunAction('call', {
        workspaceId: 'budget_wheels_demo',
        prospectId: 'prospect-3',
      }),
    }),
  ];

  it('orders highest risk first for operator triage', () => {
    const queue = buildApprovalQueue(inputs);
    expect(queue.map((i) => i.riskLevel)).toEqual(['high', 'medium', 'low']);
  });

  it('reports no executable items when nothing is approved + gated', () => {
    const queue = buildApprovalQueue(inputs);
    expect(executableItems(queue)).toEqual([]);
  });

  it('surfaces an eligible item only when approved + gate open', () => {
    const queue = buildApprovalQueue([
      ...inputs,
      makeInput({
        approval: 'approved',
        releaseConditions: GATE_OPEN,
        action: planDryRunAction('email', {
          workspaceId: 'budget_wheels_demo',
          prospectId: 'prospect-4',
        }),
      }),
    ]);
    const eligible = executableItems(queue);
    expect(eligible).toHaveLength(1);
    expect(eligible[0]!.execution.canExecute).toBe(true);
    expect(eligible[0]!.execution.willSend).toBe(false);
  });
});

describe('exhaustive approval states', () => {
  it('only approved + open gate is ever eligible', () => {
    const states: ApprovalState[] = ['pending', 'rejected', 'approved'];
    for (const state of states) {
      const closed = evaluateExecutability(state, {});
      expect(closed.canExecute).toBe(false);
      const open = evaluateExecutability(state, GATE_OPEN);
      expect(open.canExecute).toBe(state === 'approved');
    }
  });
});
