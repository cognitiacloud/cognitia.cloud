/**
 * Mock-safe enterprise-readiness primitive: a LOCAL permission model.
 *
 * STATUS: MOCK / SANDBOX. This is a pure, deterministic, in-memory model used
 * for tests and demos only. It is NOT an auth provider, NOT production RBAC,
 * and issues NO security claims. There is no identity, no session, no token,
 * and no network call here. Wiring this to a real identity provider, real
 * tenant claims, or any live enforcement path remains PLANNED and blocked.
 *
 * Fail-closed: unknown roles and unknown permissions deny by default.
 */

/** The closed set of permissions this local model recognises. */
export const PERMISSIONS = [
  'view_lead',
  'approve_action',
  'reject_action',
  'view_proof',
  'configure_live_connector',
] as const;

export type Permission = (typeof PERMISSIONS)[number];

/** The closed set of roles this local model recognises. */
export const ROLES = ['viewer', 'operator', 'approver', 'admin'] as const;

export type Role = (typeof ROLES)[number];

/**
 * Role -> permission set. Least-privilege by design.
 *
 * - viewer:   read-only access to leads and proof.
 * - operator: viewer + may propose/reject (but not approve) actions.
 * - approver: operator + may approve actions.
 * - admin:    all of the above + may configure a live connector (still gated
 *             downstream by the release gate; this permission alone is NOT
 *             sufficient to go live).
 */
const ROLE_PERMISSIONS: Readonly<Record<Role, ReadonlySet<Permission>>> = {
  viewer: new Set<Permission>(['view_lead', 'view_proof']),
  operator: new Set<Permission>(['view_lead', 'view_proof', 'reject_action']),
  approver: new Set<Permission>([
    'view_lead',
    'view_proof',
    'reject_action',
    'approve_action',
  ]),
  admin: new Set<Permission>([
    'view_lead',
    'view_proof',
    'reject_action',
    'approve_action',
    'configure_live_connector',
  ]),
};

function isRole(value: string): value is Role {
  return (ROLES as readonly string[]).includes(value);
}

function isPermission(value: string): value is Permission {
  return (PERMISSIONS as readonly string[]).includes(value);
}

/**
 * Pure check: does `role` hold `permission`?
 *
 * Fails closed: an unknown role or unknown permission returns false. No
 * exceptions are thrown for the negative case — use {@link assertCan} when a
 * thrown denial is required.
 */
export function can(role: string, permission: string): boolean {
  if (!isRole(role) || !isPermission(permission)) return false;
  return ROLE_PERMISSIONS[role].has(permission);
}

/** Error thrown by {@link assertCan} when a role lacks a permission. */
export class PermissionDeniedError extends Error {
  constructor(
    readonly role: string,
    readonly permission: string,
  ) {
    super(`permission denied: role "${role}" lacks "${permission}"`);
    this.name = 'PermissionDeniedError';
  }
}

/**
 * Enforcing variant of {@link can}. Throws {@link PermissionDeniedError} when
 * the role does not hold the permission (including unknown role/permission).
 */
export function assertCan(role: string, permission: string): void {
  if (!can(role, permission)) {
    throw new PermissionDeniedError(role, permission);
  }
}

/** Returns the (frozen) set of permissions for a known role, else empty. */
export function permissionsForRole(role: string): ReadonlySet<Permission> {
  if (!isRole(role)) return new Set<Permission>();
  return ROLE_PERMISSIONS[role];
}
