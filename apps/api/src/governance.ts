import { actionType, type ActionType } from '@cognitia/core';
import { PolicyGate } from '@cognitia/agents';
import type { AdapterRegistry } from '@cognitia/integrations';

/**
 * ENF-1 — the governance matrix: what this deployment can do, per action
 * type, DERIVED FROM CODE — the policy gate, the adapter registry, and the
 * fence composition — never hand-written. If the runtime changes, this
 * surface changes with it (and a test asserts the derivation, so the matrix
 * cannot drift into marketing).
 */

export interface ActionGovernance {
  action_type: ActionType;
  /** Deterministic risk classification (PolicyGate / core policies). */
  risk_level: string;
  /** Always true in V1 — no autonomy exists; shown explicitly, per type. */
  requires_human_approval: boolean;
  /** Policy verdict for a suppressed target (with the gate's own reason). */
  blocked_when_suppressed: boolean;
  suppression_reason: string;
  /** Whether THIS deployment composition can execute the type at all. */
  executable_in_deployment: boolean;
  /** Whether an executed write of this type can be undone (UNDO-1). */
  rollback_supported: boolean;
}

export interface GovernanceMatrix {
  derived_from_code: true;
  description: string;
  action_types: ActionGovernance[];
  roles: Array<{ role: string; can: string[] }>;
  kill_switch: {
    enforced: boolean;
    semantics: string;
  };
}

export function buildGovernanceMatrix(adapters: AdapterRegistry): GovernanceMatrix {
  const gate = new PolicyGate();
  const rows: ActionGovernance[] = actionType.options.map((t) => {
    const normal = gate.evaluate({ actionType: t, isSuppressed: false });
    const suppressed = gate.evaluate({ actionType: t, isSuppressed: true });
    const adapter = adapters.find(t);
    return {
      action_type: t,
      risk_level: normal.riskLevel,
      requires_human_approval: true, // V1 invariant: the ledger refuses unapproved execution
      blocked_when_suppressed: suppressed.blocked,
      suppression_reason: suppressed.reason,
      executable_in_deployment: adapter !== undefined,
      rollback_supported: adapter?.rollback !== undefined,
    };
  });
  return {
    derived_from_code: true,
    description:
      'Per-action-type governance derived live from the policy gate and adapter registry of this deployment. requires_human_approval is enforced by the action ledger (unapproved execution is refused and audited).',
    action_types: rows,
    roles: [
      { role: 'viewer', can: ['read queue/metrics/audit/governance', 'preview writes'] },
      {
        role: 'operator',
        can: [
          'everything viewer can',
          'approve/reject with mandatory reason',
          'execute approved actions',
          'roll back executed writes with mandatory reason',
          'run/preflight the agent',
          'PAUSE the integration (emergency stop)',
        ],
      },
      {
        role: 'owner',
        can: ['everything operator can', 'RESUME a paused integration (restricted on purpose)'],
      },
    ],
    kill_switch: {
      enforced: true,
      semantics:
        "Any non-'active' connection status halts execution AND rollback for the tenant; halts are refused with 409 and audited as execution_denied/rollback_denied. Any operator may pause (pulling the cord is cheap); only the owner may resume (recovery is deliberate).",
    },
  };
}
