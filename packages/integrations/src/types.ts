import type { ActionProvenance, ApprovedAgentAction } from '@cognitia/core';

/** Provider categories (mirrors the integration taxonomy). */
export type ProviderKind = 'crm' | 'comms' | 'calendar' | 'ads' | 'voice' | 'notify';

export interface AdapterResult {
  ok: boolean;
  /** Stable external id of the produced side effect, when applicable. */
  external_ref?: string;
  /** True when this was a no-op replay collapsed by idempotency_key. */
  idempotent_replay?: boolean;
  detail?: string;
}

/**
 * Every external side effect goes through an adapter. Adapters do NOT decide
 * policy/approval — that is the agents PolicyGate/ActionLedger. As defense in
 * depth, an adapter still refuses an action whose approval_status !== approved
 * (enforced by requiring the ApprovedAgentAction type + a runtime assertion).
 */
export interface IntegrationAdapter {
  readonly system: string;
  readonly kind: ProviderKind;
  /** Action types this adapter can execute. */
  handles(actionType: string): boolean;
  /**
   * CGD-001: true when execute()/rollback() would talk to a live vendor
   * client (not the in-memory fake). Fixture adapters return false/omit.
   */
  isLiveOutbound?(): boolean;
  /**
   * Execute the side-effect. `provenance` (PROV-1) is optional execution lineage
   * the ledger resolves and adapters may stamp onto the produced object; adapters
   * that don't support provenance ignore it. It never affects approval/idempotency.
   */
  execute(action: ApprovedAgentAction, provenance?: ActionProvenance): Promise<AdapterResult>;
  /**
   * UNDO-1: undo a previously executed side effect identified by the
   * external_ref recorded on the action's result. Optional — adapters whose
   * effects are irreversible simply don't implement it, and the ledger
   * refuses the rollback with that as the reason. `tenantId` scopes
   * credentials (e.g. the OAuth token provider).
   */
  rollback?(tenantId: string, externalRef: string): Promise<AdapterResult>;
}

/** Thrown when an adapter is asked to execute an unapproved action. */
export class UnapprovedActionError extends Error {
  constructor(actionId: string) {
    super(`adapter refused: agent_action ${actionId} is not approved`);
    this.name = 'UnapprovedActionError';
  }
}

/** Runtime guard so callers cannot bypass approval even by casting types. */
export function assertApproved(action: { id: string; approval_status: string }): void {
  if (action.approval_status !== 'approved') {
    throw new UnapprovedActionError(action.id);
  }
}
