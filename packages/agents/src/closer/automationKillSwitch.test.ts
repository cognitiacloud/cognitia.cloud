import { describe, it, expect } from 'vitest';
import {
  ACTION_TYPES,
  AutomationKillSwitch,
  assessRollbackReadiness,
  authorizeControlledLive,
  createKillSwitchState,
  evaluateKillSwitch,
  type ControlledLiveRequest,
  type KillSwitchState,
  type RollbackPlan,
} from './automationKillSwitch.js';
import type { ReleaseConditions } from '../security/releaseGate.js';

/** Release conditions that, on their own, would open the controlled-live gate. */
const ALL_LIVE_EXCEPT_ROLLBACK: ReleaseConditions = {
  signedCustomerScope: true,
  counselSignoff: true,
  founderSignoff: true,
  monitoringEnabled: true,
  secretsConfigured: true,
  connectorApproval: true,
  // rollbackReady intentionally omitted — derived from the plan.
};

/** A fully-ready rollback plan for the email action in the sandbox workspace. */
function readyRollbackPlan(): RollbackPlan {
  return {
    id: 'rb-001',
    workspaceId: 'budget_wheels_demo',
    actionType: 'email',
    owner: 'operator@budget-wheels.example',
    steps: [
      { id: 's1', description: 'recall queued dry-run drafts', automated: true },
      { id: 's2', description: 'notify operator to review timeline', automated: false },
    ],
    tested: true,
  };
}

function readyRequest(overrides: Partial<ControlledLiveRequest> = {}): ControlledLiveRequest {
  return {
    killSwitch: createKillSwitchState(),
    query: { workspaceId: 'budget_wheels_demo', actionType: 'email' },
    rollbackPlan: readyRollbackPlan(),
    releaseConditions: ALL_LIVE_EXCEPT_ROLLBACK,
    ...overrides,
  };
}

describe('createKillSwitchState', () => {
  it('starts all-clear (nothing halted by the switch)', () => {
    const s = createKillSwitchState();
    expect(s.global).toBe(false);
    expect(s.workspaces.size).toBe(0);
    expect(s.actionTypes.size).toBe(0);
  });
});

describe('evaluateKillSwitch: global', () => {
  it('blocks every action when engaged', () => {
    const s: KillSwitchState = { ...createKillSwitchState(), global: true };
    const d = evaluateKillSwitch(s, { workspaceId: 'budget_wheels_demo', actionType: 'email' });
    expect(d.blocked).toBe(true);
    expect(d.scope).toBe('global');
  });
});

describe('evaluateKillSwitch: workspace', () => {
  it('blocks the named workspace only', () => {
    const s: KillSwitchState = {
      ...createKillSwitchState(),
      workspaces: new Set(['budget_wheels_demo']),
    };
    expect(
      evaluateKillSwitch(s, { workspaceId: 'budget_wheels_demo', actionType: 'email' }).blocked,
    ).toBe(true);
    expect(evaluateKillSwitch(s, { workspaceId: 'other_demo', actionType: 'email' }).blocked).toBe(
      false,
    );
  });

  it('fails closed on a missing workspaceId', () => {
    const d = evaluateKillSwitch(createKillSwitchState(), {
      workspaceId: '  ',
      actionType: 'email',
    });
    expect(d.blocked).toBe(true);
    expect(d.scope).toBe('workspace');
  });
});

describe('evaluateKillSwitch: action type', () => {
  it('blocks the named action type across workspaces', () => {
    const s: KillSwitchState = {
      ...createKillSwitchState(),
      actionTypes: new Set(['sms' as const]),
    };
    expect(
      evaluateKillSwitch(s, { workspaceId: 'budget_wheels_demo', actionType: 'sms' }).blocked,
    ).toBe(true);
    expect(
      evaluateKillSwitch(s, { workspaceId: 'budget_wheels_demo', actionType: 'email' }).blocked,
    ).toBe(false);
  });

  it('fails closed on an unknown action type', () => {
    const d = evaluateKillSwitch(createKillSwitchState(), {
      workspaceId: 'budget_wheels_demo',
      actionType: 'carrier_pigeon',
    });
    expect(d.blocked).toBe(true);
    expect(d.scope).toBe('action_type');
  });
});

describe('evaluateKillSwitch: precedence', () => {
  it('global wins over workspace and action type', () => {
    const s: KillSwitchState = {
      global: true,
      workspaces: new Set(['budget_wheels_demo']),
      actionTypes: new Set(['email' as const]),
    };
    expect(
      evaluateKillSwitch(s, { workspaceId: 'budget_wheels_demo', actionType: 'email' }).scope,
    ).toBe('global');
  });
});

describe('AutomationKillSwitch manager', () => {
  it('engages and disengages each scope', () => {
    const ks = new AutomationKillSwitch();
    const q = { workspaceId: 'budget_wheels_demo', actionType: 'email' };

    expect(ks.evaluate(q).blocked).toBe(false);

    ks.engageWorkspace('budget_wheels_demo');
    expect(ks.evaluate(q).scope).toBe('workspace');
    ks.disengageWorkspace('budget_wheels_demo');
    expect(ks.evaluate(q).blocked).toBe(false);

    ks.engageActionType('email');
    expect(ks.evaluate(q).scope).toBe('action_type');
    ks.disengageActionType('email');
    expect(ks.evaluate(q).blocked).toBe(false);

    ks.engageGlobal();
    expect(ks.evaluate(q).scope).toBe('global');
    ks.disengageGlobal();
    expect(ks.evaluate(q).blocked).toBe(false);
  });

  it('ignores unknown action types when engaging', () => {
    const ks = new AutomationKillSwitch();
    ks.engageActionType('carrier_pigeon');
    expect(ks.snapshot().actionTypes.size).toBe(0);
  });
});

describe('assessRollbackReadiness', () => {
  it('is ready for a complete, tested plan', () => {
    const r = assessRollbackReadiness(readyRollbackPlan());
    expect(r.ready).toBe(true);
    expect(r.missing).toEqual([]);
  });

  it('fails closed when the plan is missing', () => {
    expect(assessRollbackReadiness(null).ready).toBe(false);
    expect(assessRollbackReadiness(undefined).ready).toBe(false);
  });

  it('is not ready without an owner', () => {
    const r = assessRollbackReadiness({ ...readyRollbackPlan(), owner: '  ' });
    expect(r.ready).toBe(false);
    expect(r.missing).toContain('rollback owner');
  });

  it('is not ready without steps', () => {
    const r = assessRollbackReadiness({ ...readyRollbackPlan(), steps: [] });
    expect(r.ready).toBe(false);
    expect(r.missing).toContain('at least one rollback step');
  });

  it('is not ready when untested', () => {
    const r = assessRollbackReadiness({ ...readyRollbackPlan(), tested: false });
    expect(r.ready).toBe(false);
    expect(r.missing).toContain('rollback rehearsal (tested)');
  });
});

describe('authorizeControlledLive', () => {
  it('authorizes when kill switch clear, rollback ready, and gate passes', () => {
    const d = authorizeControlledLive(readyRequest());
    expect(d.authorized).toBe(true);
    expect(d.reasons).toEqual([]);
  });

  it('kill switch blocks even if every other condition passes', () => {
    const d = authorizeControlledLive(
      readyRequest({ killSwitch: { ...createKillSwitchState(), global: true } }),
    );
    expect(d.authorized).toBe(false);
    expect(d.killSwitch.blocked).toBe(true);
    // Rollback and the release gate are fully satisfied — only the switch blocks.
    expect(d.rollback.ready).toBe(true);
    expect(d.releaseGate.passed).toBe(true);
    expect(d.reasons.some((r) => r.includes('GLOBAL kill switch'))).toBe(true);
  });

  it('workspace kill switch blocks an otherwise-ready request', () => {
    const d = authorizeControlledLive(
      readyRequest({
        killSwitch: { ...createKillSwitchState(), workspaces: new Set(['budget_wheels_demo']) },
      }),
    );
    expect(d.authorized).toBe(false);
    expect(d.killSwitch.scope).toBe('workspace');
  });

  it('action-type kill switch blocks an otherwise-ready request', () => {
    const d = authorizeControlledLive(
      readyRequest({
        killSwitch: { ...createKillSwitchState(), actionTypes: new Set(['email' as const]) },
      }),
    );
    expect(d.authorized).toBe(false);
    expect(d.killSwitch.scope).toBe('action_type');
  });

  it('rollback missing blocks controlled-live', () => {
    const d = authorizeControlledLive(readyRequest({ rollbackPlan: null }));
    expect(d.authorized).toBe(false);
    expect(d.rollback.ready).toBe(false);
    expect(d.releaseGate.passed).toBe(false);
    expect(d.releaseGate.missingKeys).toContain('rollbackReady');
  });

  it('untested rollback blocks controlled-live even with full release conditions', () => {
    const d = authorizeControlledLive(
      readyRequest({ rollbackPlan: { ...readyRollbackPlan(), tested: false } }),
    );
    expect(d.authorized).toBe(false);
    expect(d.rollback.ready).toBe(false);
  });

  it('ignores a caller-supplied rollbackReady flag (derives it from the plan)', () => {
    const d = authorizeControlledLive(
      readyRequest({
        rollbackPlan: null,
        releaseConditions: { ...ALL_LIVE_EXCEPT_ROLLBACK, rollbackReady: true },
      }),
    );
    expect(d.authorized).toBe(false);
    expect(d.releaseGate.missingKeys).toContain('rollbackReady');
  });

  it('is not authorized when other release conditions are missing', () => {
    const d = authorizeControlledLive(readyRequest({ releaseConditions: {} }));
    expect(d.authorized).toBe(false);
    expect(d.killSwitch.blocked).toBe(false);
    expect(d.rollback.ready).toBe(true);
    expect(d.releaseGate.passed).toBe(false);
  });
});

describe('mock/sandbox safety invariants', () => {
  it('every kill-switch decision is dry-run and not sent', () => {
    const d = evaluateKillSwitch(createKillSwitchState(), {
      workspaceId: 'budget_wheels_demo',
      actionType: 'email',
    });
    expect(d.mode).toBe('dry_run');
    expect(d.sent).toBe(false);
  });

  it('every controlled-live decision is dry-run and not sent (even when authorized)', () => {
    const d = authorizeControlledLive(readyRequest());
    expect(d.authorized).toBe(true);
    expect(d.mode).toBe('dry_run');
    expect(d.sent).toBe(false);
  });

  it('exposes the known action-type set', () => {
    expect(ACTION_TYPES).toContain('email');
    expect(ACTION_TYPES).toContain('crm_writeback');
  });
});
