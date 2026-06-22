# Enterprise Readiness — Mock-Safe Infrastructure

**Owner:** Enterprise-readiness engineering
**Status:** Mock-safe (dark). No live outreach, no vendor API execution, no real CRM writes.
**Last updated:** 2026-06-22

This package raises enterprise readiness for Cognitia (trust/proof/control layer)
and Demandara (GTM/operator brand) **without asserting that actual-live operation
is approved.** Everything here is fail-closed and dark by default.

## What is here

| # | Concern | Artifact |
|---|---------|----------|
| 1 | Auth / RBAC route guard | `01-AUTH-RBAC-ROUTE-GUARD.md` + `packages/enterprise-readiness/src/rbac.ts` |
| 2 | Audit event schema | `02-AUDIT-EVENT-SCHEMA.md` + `src/audit.ts` |
| 3 | Release-gate evidence | `03-RELEASE-GATE-EVIDENCE.md` + `src/releaseGate.ts` |
| 4 | Monitoring rules | `04-MONITORING-RULES.md` + `src/monitoring.ts` |
| 5 | Incident response runbook | `05-INCIDENT-RESPONSE-RUNBOOK.md` |
| 6 | Rollback runbook | `06-ROLLBACK-RUNBOOK.md` |
| 7 | Deployment checklist | `07-DEPLOYMENT-CHECKLIST.md` |
| 8 | Secrets / connector dark-mode policy | `08-SECRETS-DARK-MODE-POLICY.md` + `src/darkMode.ts` |
| 9 | Founder approval checklist | `09-FOUNDER-APPROVAL-CHECKLIST.md` |
| 10 | Legal / client approval checklist | `10-LEGAL-CLIENT-APPROVAL-CHECKLIST.md` |

## Doctrine (hard rules, enforced in code)

- **No live outreach / no vendor API execution / no real CRM writes.** Live
  capabilities are *dark* (`rbac.ts` → `LIVE_CAPABILITIES`, `evaluateAccess`).
- **Dry-run actions are always `sent: false`.** Encoded as a literal type and a
  runtime guard (`darkMode.ts` → `DryRunAction`, `assertDryRun`).
- **No raw PII.** Audit payloads carry refs/hashes only; `assertNoRawPii` rejects
  emails, phones, and forbidden keys.
- **No production secrets.** Connectors hold placeholder credential refs only;
  `assertDarkMode` and `scripts/safety-scan.mjs` fail closed on real secrets.
- **Live gates fail closed.** Missing/unknown evidence blocks promotion; `live`
  promotion is unconditionally blocked while mock-safe is on
  (`releaseGate.ts` → `evaluateReleaseGate`).
- **No state change without founder approval.** Going live requires the founder
  (#9) and legal/client (#10) checklists — automation can never grant them.

## Verification (no installs, no network)

```bash
pnpm run check        # tsc --noEmit + node --test + safety scan
pnpm run safety-scan  # no live egress, no secrets, no live sends
```

The typed models are dependency-free, so they type-check with the global
TypeScript compiler and run under Node's native test runner — no `pnpm install`
and no outbound network are required.

## Relationship to the canonical platform

These models mirror the conventions of the canonical GTM platform on
`overnight/gtm-implementation` (event envelope `domain.entity.action.vN`,
tenant scoping, evidence-tagged claims, mock-safe guard tests). When folded into
`packages/core`, prefer the zod schemas there and keep these as the
reference contracts and the enterprise event/rule registries. Until then they
stand alone and are independently verifiable.
