/**
 * Minimal tenant/workspace layer for internal demo tenants.
 *
 * This is a lightweight, typed, in-code tag used by the offline Sales Closer
 * mock runner so every mock run / approval / CRM-writeback / proof is
 * attributable to a workspace. It is deliberately NOT production multi-tenancy:
 * there is no RBAC, no auth, no provisioning, no DB, and no real customer data
 * here. The heavier RLS-isolated tenant model lives elsewhere
 * (see `docs/cognitia/TENANT_MAP.md` and `packages/db/migrations/0001_*`); this
 * file does not replace or claim parity with it.
 *
 * All metadata below is business-only — there are no emails, phones, or other
 * raw PII in this registry.
 */

/** The internal demo tenants this layer recognizes. */
export type WorkspaceId = 'demandara_internal' | 'cognitia_internal' | 'budget_wheels_demo';

/** Whether a workspace represents an internal venture or a synthetic sandbox. */
export type WorkspaceKind = 'internal' | 'sandbox';

/**
 * Consent posture for the workspace's data.
 *  - `internal_team`: internal dogfooding; the team is the data subject.
 *  - `synthetic_no_consent_required`: fabricated demo data, no real subject.
 */
export type WorkspaceConsent = 'internal_team' | 'synthetic_no_consent_required';

export interface Workspace {
  readonly id: WorkspaceId;
  /** Human-friendly display label. */
  readonly label: string;
  readonly kind: WorkspaceKind;
  /** True when all data is fabricated/sandbox and tied to no real party. */
  readonly synthetic: boolean;
  readonly consent: WorkspaceConsent;
  /** Operator-facing note; carries handling rules, never PII. */
  readonly notes: string;
}

/**
 * The workspace registry. Frozen so callers can treat it as a constant lookup.
 *
 * `budget_wheels_demo` is the "Tenant Zero sandbox": synthetic demo data only.
 * It must NOT be presented as a real customer ("Client Zero") until the founder
 * confirms real consent.
 */
export const WORKSPACES: Readonly<Record<WorkspaceId, Workspace>> = Object.freeze({
  demandara_internal: {
    id: 'demandara_internal',
    label: 'Demandara (internal)',
    kind: 'internal',
    synthetic: false,
    consent: 'internal_team',
    notes: 'Internal Demandara venture workspace for demo runs. No real customer PII.',
  },
  cognitia_internal: {
    id: 'cognitia_internal',
    label: 'Cognitia (internal)',
    kind: 'internal',
    synthetic: false,
    consent: 'internal_team',
    notes: 'Internal Cognitia venture workspace for demo runs. No real customer PII.',
  },
  budget_wheels_demo: {
    id: 'budget_wheels_demo',
    label: 'Tenant Zero sandbox',
    kind: 'sandbox',
    synthetic: true,
    consent: 'synthetic_no_consent_required',
    notes:
      'Tenant Zero sandbox — synthetic demo data only. Not a real customer; do ' +
      'not call this "Client Zero" or imply real consent until the founder ' +
      'confirms it.',
  },
});

/** All known workspace ids, in registry order. */
export const WORKSPACE_IDS = Object.keys(WORKSPACES) as WorkspaceId[];

/**
 * Default workspace for a run that does not specify one. Internal Cognitia
 * dogfooding is the safe default (never the synthetic sandbox).
 */
export const DEFAULT_WORKSPACE_ID: WorkspaceId = 'cognitia_internal';

/** Type guard: is `value` a known workspace id? */
export function isWorkspaceId(value: unknown): value is WorkspaceId {
  return typeof value === 'string' && Object.prototype.hasOwnProperty.call(WORKSPACES, value);
}

/** Narrow `value` to a `WorkspaceId` or throw — for boundary validation. */
export function assertWorkspaceId(value: unknown): WorkspaceId {
  if (!isWorkspaceId(value)) {
    throw new Error(`Unknown workspace id: ${String(value)}`);
  }
  return value;
}

/** Resolve a workspace record by id. */
export function getWorkspace(id: WorkspaceId): Workspace {
  return WORKSPACES[id];
}

/** Whether a workspace's data is synthetic (sandbox / no real party). */
export function isSyntheticWorkspace(id: WorkspaceId): boolean {
  return WORKSPACES[id].synthetic;
}
