# WHAT IS LEFT TO BUILD — AUDIT-BOOKLET-001

Each item: why · dependency · risk · owner · acceptance.

## Immediate — founder-gated (no engineering until decided)

| Item                                       | Why                                                                                              | Dependency                                   | Acceptance                                                                                          |
| ------------------------------------------ | ------------------------------------------------------------------------------------------------ | -------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| Hosted dev `DATABASE_URL` → hosted V-6 RLS | closes the remaining RLS gap (restricted-role RLS already verified on a real local PG16 in V-6A) | safe hosted/managed dev DB (e.g. Supabase)   | RLS holds under the hosted provider's restricted role through PgBouncer; cross-tenant denial proven |
| Default branch → `main`                    | researchers see current code first                                                               | GitHub setting                               | default = main                                                                                      |
| `security@cognitia.cloud` forwarding       | SECURITY.md intake must resolve                                                                  | founder mailbox                              | email delivers                                                                                      |
| `COGNITIA_PUBLIC_TENANT_ID` (publish feed) | makes `/trust/live` real                                                                         | V-6 + redaction-checked tenant + edge limits | non-empty, reproducible feed                                                                        |
| Team page identity                         | anonymity is the top trust gap                                                                   | founder identity decision                    | page drafted/published                                                                              |
| Video transcript paste                     | reconcile the LOOP-1 framework                                                                   | founder paste                                | reconciled                                                                                          |
| Counsel / token legal decision             | unblocks any token modeling                                                                      | counsel engagement                           | written opinion                                                                                     |

## Immediate — safe engineering (no gate)

- ~~Merge open PR #69 (LEGEND-001 fabric simulation lab)~~ **DONE** — merged to
  main (migration 0019; simulation-only; operator-authed). Docs reconciled in
  AUDIT-BOOKLET-001B.
- Keep doc indexes + guards green; add reproducibility notes if any drift.

## High-value product

Tenant Zero pilot proof · Demandara pilot proof · SEC-2/audit-export onto
mainline · marketplace detail pages · work-order templates · matching-explanation
panel · proof-explorer redaction workflow · researcher-visible proof pack ·
API/SDK reference. (Each: build + tests; founder-gated where it needs a tenant.)

## Infrastructure / security

Hosted/managed-provider RLS verification (hosted V-6; restricted-role RLS already
verified on a real local PG16 in V-6A) · edge WAF/rate limit · external security
audit · branch protection · secrets management/KMS · incident response runbook ·
audit export/retention · durable audit anchoring (EAS, design-only).

## Agent Fabric (gated; design → simulation → gated stages)

Node registry + router + capability matching + quarantine + simulated receipts =
**built in PR #69 (simulation-only, internal/operator-only, on main)**. Still
**future** and gated:

- **Tailscale/WireGuard connector** — remains future (no integration today).
- **Real remote execution** — remains future and **security-gated** (a deliberate
  migration + security sign-off required; the containment guard blocks it today).
- **Node attestation** (signed) — remains future.
- **Node reputation** — remains future.
- **Fabric marketplace** — remains future.
- **Local/cloud model routing** beyond simulation — remains future.
- **Production fabric deployment** — remains future (nothing is deployed).
- **Restricted-role RLS** for `fabric_nodes` (and all tables) — **verified on a
  real local PostgreSQL 16** under a `nosuperuser` `app_user` (V-6A); the PGlite
  smoke alone runs as a superuser that bypasses RLS. **Hosted/managed-provider**
  RLS (e.g. Supabase via PgBouncer) remains **unverified** (hosted V-6).

## Crypto / protocol future (heavily gated)

Stablecoin settlement sandbox (after legal gate) · verifier/arbiter roles ·
assurance-bond simulation with **credits** (no token) · EAS/ERC-8004 compatibility
spike (design/sandbox) · x402 adapter (sandbox) · TOKEN-LAB-003 local-only sandbox
(only if explicitly authorized). **No mainnet until all gates pass.**
