/**
 * Authoritative manifest of PRIVILEGED handler operations (Item 3 — authz
 * surface audit). Every entry must have an explicit negative test proving the
 * forbidden role is rejected (see security.regression.test.ts), and
 * securityInvariants.guard.test.ts fails CI if a directly role-gated handler in
 * handlers.ts is missing here — so a new privileged route cannot ship without
 * authz coverage.
 *
 * Read-only (viewer-allowed, requireTenant) handlers are intentionally NOT here:
 * their only negative case is unauthenticated → 401, covered globally.
 */

/** requireOwner — operator AND viewer must be rejected (403). */
export const OWNER_ONLY_HANDLERS = [
  'accessReview',
  'anchorAudit',
  'createPassport',
  'dsarErase',
  'dsarExport',
  'issueGrant',
  'resumeIntegration',
  'revokeGrant',
  'revokePassport',
] as const;

/** requireMutatingRole — viewer must be rejected (403). Includes batch* (gated via batchDecide). */
export const MUTATING_HANDLERS = [
  'approveAction',
  'batchApprove',
  'batchReject',
  'executeAction',
  'exportContactAudit',
  'pauseIntegration',
  'preflightMira',
  'rejectAction',
  'rollbackAction',
  'runMira',
  'stageReview',
] as const;

export type PrivilegedHandler =
  | (typeof OWNER_ONLY_HANDLERS)[number]
  | (typeof MUTATING_HANDLERS)[number];
