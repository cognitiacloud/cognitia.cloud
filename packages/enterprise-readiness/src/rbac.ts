/**
 * Auth / RBAC route-guard model (mock-safe, dependency-free).
 *
 * This is the typed contract a route guard enforces. It is intentionally pure:
 * no I/O, no network, no session store. Wiring it into the live app (middleware,
 * server actions, edge handlers) is an existing-pattern integration task — this
 * module is the policy core those guards call.
 *
 * Doctrine mirrored from the canonical GTM platform:
 *   - tenant scoping is mandatory: there is no implicit/global access;
 *   - deny-by-default: an unknown route or missing capability is a DENY;
 *   - live/destructive capabilities require an explicit role AND fail closed.
 */

/** Coarse roles, ordered least → most privileged for documentation only. */
export const ROLES = ['viewer', 'operator', 'approver', 'admin', 'owner'] as const;
export type Role = (typeof ROLES)[number];

/**
 * Capabilities are the unit of authorization. Routes require capabilities;
 * roles grant capabilities. `*.live` and `*.write` capabilities are
 * privilege-sensitive and gated separately from read capabilities.
 */
export const CAPABILITIES = [
  'dashboard.read',
  'closer.read',
  'closer.brief.draft',
  'approvals.read',
  'approvals.decide',
  'audit.read',
  'connectors.read',
  'connectors.configure',
  'release.gate.read',
  'release.gate.override',
  'action.dryrun',
  'action.live', // privilege-sensitive: real vendor/CRM write — dark in mock-safe
] as const;
export type Capability = (typeof CAPABILITIES)[number];

/** Capabilities that move real-world state. Never granted in mock-safe mode. */
export const LIVE_CAPABILITIES: ReadonlySet<Capability> = new Set<Capability>([
  'action.live',
  'connectors.configure',
  'release.gate.override',
]);

/** Static role → capability grants. Additive; higher roles inherit explicitly. */
const ROLE_GRANTS: Record<Role, ReadonlySet<Capability>> = {
  viewer: new Set(['dashboard.read', 'closer.read', 'approvals.read', 'audit.read']),
  operator: new Set([
    'dashboard.read',
    'closer.read',
    'closer.brief.draft',
    'approvals.read',
    'audit.read',
    'connectors.read',
    'release.gate.read',
    'action.dryrun',
  ]),
  approver: new Set([
    'dashboard.read',
    'closer.read',
    'closer.brief.draft',
    'approvals.read',
    'approvals.decide',
    'audit.read',
    'connectors.read',
    'release.gate.read',
    'action.dryrun',
  ]),
  admin: new Set([
    'dashboard.read',
    'closer.read',
    'closer.brief.draft',
    'approvals.read',
    'approvals.decide',
    'audit.read',
    'connectors.read',
    'connectors.configure',
    'release.gate.read',
    'release.gate.override',
    'action.dryrun',
  ]),
  owner: new Set(CAPABILITIES), // owner is granted every capability in the registry
};

/** A protected route and the capability it requires. */
export interface RouteGuard {
  /** Path pattern, e.g. "/app/approvals" or "/api/closer/brief". */
  readonly path: string;
  readonly requires: Capability;
  /** True for routes that initiate live/destructive effects. */
  readonly live?: boolean;
}

/** The route guard table. Deny-by-default: anything not listed is denied. */
export const ROUTE_GUARDS: readonly RouteGuard[] = [
  { path: '/app', requires: 'dashboard.read' },
  { path: '/app/closer', requires: 'closer.read' },
  { path: '/app/closer/brief', requires: 'closer.brief.draft' },
  { path: '/app/approvals', requires: 'approvals.read' },
  { path: '/api/approvals/decide', requires: 'approvals.decide' },
  { path: '/app/audit', requires: 'audit.read' },
  { path: '/app/connectors', requires: 'connectors.read' },
  { path: '/api/connectors/configure', requires: 'connectors.configure' },
  { path: '/app/release-gates', requires: 'release.gate.read' },
  { path: '/api/release-gates/override', requires: 'release.gate.override', live: true },
  { path: '/api/actions/dryrun', requires: 'action.dryrun' },
  { path: '/api/actions/live', requires: 'action.live', live: true },
];

export interface Principal {
  readonly tenant_id: string;
  readonly role: Role;
}

export interface AccessRequest {
  readonly principal: Principal;
  /** Tenant the requested resource belongs to. */
  readonly resource_tenant_id: string;
  readonly path: string;
}

export type AccessDecision =
  | { readonly allow: true; readonly capability: Capability }
  | { readonly allow: false; readonly reason: string };

/** True if the role statically grants the capability. */
export function roleHasCapability(role: Role, capability: Capability): boolean {
  return ROLE_GRANTS[role].has(capability);
}

/**
 * Core guard decision. Deny-by-default and fail-closed:
 *   - cross-tenant access is denied;
 *   - unknown routes are denied;
 *   - live capabilities additionally require mock-safe mode to be OFF (which it
 *     never is here) — see {@link liveCapabilityIsDark}.
 */
export function evaluateAccess(req: AccessRequest, opts?: { mockSafe?: boolean }): AccessDecision {
  const mockSafe = opts?.mockSafe ?? true;

  if (req.principal.tenant_id !== req.resource_tenant_id) {
    return { allow: false, reason: 'cross_tenant_denied' };
  }

  const guard = ROUTE_GUARDS.find((g) => g.path === req.path);
  if (!guard) {
    return { allow: false, reason: 'route_not_registered' }; // deny-by-default
  }

  if (!roleHasCapability(req.principal.role, guard.requires)) {
    return { allow: false, reason: `missing_capability:${guard.requires}` };
  }

  if (mockSafe && LIVE_CAPABILITIES.has(guard.requires)) {
    // Fail closed: even an authorized principal cannot exercise a live
    // capability while the platform is in mock-safe mode.
    return { allow: false, reason: `live_capability_dark:${guard.requires}` };
  }

  return { allow: true, capability: guard.requires };
}

/** A live capability is "dark" whenever mock-safe mode is on. */
export function liveCapabilityIsDark(capability: Capability, mockSafe = true): boolean {
  return mockSafe && LIVE_CAPABILITIES.has(capability);
}
