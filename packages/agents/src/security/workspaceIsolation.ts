/**
 * Mock-safe enterprise-readiness primitive: LOCAL workspace-isolation assertions.
 *
 * STATUS: MOCK / SANDBOX. These are pure, deterministic guards used in tests and
 * demos to model tenant/workspace isolation. They are NOT a substitute for
 * database row-level security, NOT production tenant enforcement, and issue NO
 * security claim. There is no identity, no session, no connection here — only a
 * value check over in-memory objects. Real isolation (RLS, scoped credentials,
 * per-tenant keys) remains PLANNED and lives outside this module.
 *
 * Fail-closed: a missing, blank, or mismatched workspace id denies by throwing.
 * A non-sandbox workspace is rejected — this code is for the Budget Wheels demo
 * (Tenant Zero) sandbox only and must never operate over a real tenant.
 */

/** The Budget Wheels demo / Tenant Zero sandbox workspace id. */
export const SANDBOX_WORKSPACE_ID = 'budget_wheels_demo';

/** Minimal workspace reference. Kept local so the security lane stays self-contained. */
export interface WorkspaceRef {
  workspaceId: string;
  /** True only for the sandbox / Tenant Zero. Anything carrying real data is false. */
  sandbox: boolean;
}

/** Error thrown when a workspace-isolation invariant is violated. */
export class WorkspaceIsolationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'WorkspaceIsolationError';
  }
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

/**
 * Assert a value is a usable {@link WorkspaceRef}. Fails closed on a missing
 * object, a missing/blank id, or a non-boolean sandbox flag.
 */
export function assertWorkspaceRef(
  value: unknown,
  label = 'workspace',
): asserts value is WorkspaceRef {
  if (value === null || typeof value !== 'object') {
    throw new WorkspaceIsolationError(`${label}: expected a workspace object`);
  }
  const ref = value as Record<string, unknown>;
  if (!isNonEmptyString(ref.workspaceId)) {
    throw new WorkspaceIsolationError(`${label}: missing or blank workspaceId`);
  }
  if (typeof ref.sandbox !== 'boolean') {
    throw new WorkspaceIsolationError(`${label}: missing sandbox flag`);
  }
}

/**
 * Assert a workspace is the sandbox. Fails closed when `sandbox !== true` or the
 * id is not {@link SANDBOX_WORKSPACE_ID}. Belt-and-braces: a workspace that
 * claims `sandbox: true` but carries a non-sandbox id is still rejected.
 */
export function assertSandboxWorkspace(
  value: unknown,
  label = 'workspace',
): asserts value is WorkspaceRef {
  assertWorkspaceRef(value, label);
  const ref = value as WorkspaceRef;
  if (ref.sandbox !== true) {
    throw new WorkspaceIsolationError(
      `${label}: refusing non-sandbox workspace "${ref.workspaceId}"`,
    );
  }
  if (ref.workspaceId !== SANDBOX_WORKSPACE_ID) {
    throw new WorkspaceIsolationError(
      `${label}: sandbox flag set but id "${ref.workspaceId}" is not the sandbox tenant`,
    );
  }
}

/**
 * Assert two workspace references identify the same tenant. Fails closed on any
 * mismatch — this is the core cross-tenant guard: an operation scoped to
 * workspace A must never touch a resource owned by workspace B.
 */
export function assertSameWorkspace(expected: unknown, actual: unknown, label = 'workspace'): void {
  assertWorkspaceRef(expected, `${label} (expected)`);
  assertWorkspaceRef(actual, `${label} (actual)`);
  const e = expected as WorkspaceRef;
  const a = actual as WorkspaceRef;
  if (e.workspaceId !== a.workspaceId) {
    throw new WorkspaceIsolationError(
      `${label}: cross-tenant access denied — expected "${e.workspaceId}", got "${a.workspaceId}"`,
    );
  }
}

/** A resource that is owned by exactly one workspace. */
export interface WorkspaceOwned {
  workspaceId: string;
}

/**
 * Assert every resource in a collection belongs to `expected`. Fails closed if
 * any item is missing an id or belongs to a different workspace. Returns the
 * resources unchanged so it can wrap a query result inline.
 */
export function assertWorkspaceScoped<T extends WorkspaceOwned>(
  expected: unknown,
  resources: readonly T[],
  label = 'resource',
): readonly T[] {
  assertWorkspaceRef(expected, `${label} workspace`);
  const e = expected as WorkspaceRef;
  resources.forEach((resource, index) => {
    if (!isNonEmptyString(resource?.workspaceId)) {
      throw new WorkspaceIsolationError(`${label}[${index}]: missing workspaceId`);
    }
    if (resource.workspaceId !== e.workspaceId) {
      throw new WorkspaceIsolationError(
        `${label}[${index}]: belongs to "${resource.workspaceId}", not scoped workspace "${e.workspaceId}"`,
      );
    }
  });
  return resources;
}
