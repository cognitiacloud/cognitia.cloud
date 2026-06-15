# Authorization surface audit (Item 3)

Enumeration of every API route's authz gate, with the negative-test that proves
the forbidden case. Drift-proof: `authzMatrix.ts` is the manifest of privileged
handlers; `securityInvariants.guard.test.ts` fails CI if a directly role-gated
handler is missing from it, and `security.regression.test.ts` tests every entry.

## Privileged — explicit negative tests (security.regression.test.ts authz matrix)

### Owner-only (requireOwner) — operator AND viewer → 403 [9]

accessReview, anchorAudit, createPassport, dsarErase, dsarExport, issueGrant,
resumeIntegration, revokeGrant, revokePassport.

### Mutating (requireMutatingRole) — viewer → 403 [11]

approveAction, batchApprove, batchReject (via batchDecide), executeAction,
exportContactAudit, pauseIntegration, preflightMira, rejectAction, rollbackAction,
runMira, stageReview.

## Read-only (requireTenant — viewer-allowed)

listAccounts/Opportunities/Campaigns/SyncRuns/AgentActions/Passports/RunPlans,
getAccountContext/AgentRun, governance, auditTrail, auditRetention, verifyAudit,
verifyAuditAnchor, trustPacket, metrics\*, opsOverview, previewAction,
actionRationale, listActionDecisions, regressionCandidate, integrationStatus/
Readiness, createCampaign. Negative case = unauthenticated → 401 (covered).

## Unauthenticated (own auth / liveness)

/health (liveness), /webhooks/hubspot (HMAC-signature gated), /webhooks/inbound-lead

- /jobs/crm-sync (501 n8n seams). Allowlisted in the structural guard.

## Cross-tenant

Handler-level: DSAR export/erase of another tenant's contact → 404 (tested).
Data layer: RLS under the non-superuser app_user role blocks cross-tenant read/
write incl. audit/passport/grant tables (`kysely.rls.pglite.test.ts`).

## Result

No privileged path lacks explicit authz coverage. The guard prevents future
drift (a new requireOwner/requireMutatingRole handler without a manifest entry
fails the build).
