# WHAT IS LEFT TO BUILD — AUDIT-BOOKLET-001

Each item: why · dependency · risk · owner · acceptance.

## Immediate — founder-gated (no engineering until decided)

| Item                                       | Why                                | Dependency                                   | Acceptance                                                |
| ------------------------------------------ | ---------------------------------- | -------------------------------------------- | --------------------------------------------------------- |
| Dev `DATABASE_URL` → V-6 managed-RLS       | closes the top technical gap       | safe throwaway dev DB                        | RLS holds under `nosuperuser`; cross-tenant denial proven |
| Default branch → `main`                    | researchers see current code first | GitHub setting                               | default = main                                            |
| `security@cognitia.cloud` forwarding       | SECURITY.md intake must resolve    | founder mailbox                              | email delivers                                            |
| `COGNITIA_PUBLIC_TENANT_ID` (publish feed) | makes `/trust/live` real           | V-6 + redaction-checked tenant + edge limits | non-empty, reproducible feed                              |
| Team page identity                         | anonymity is the top trust gap     | founder identity decision                    | page drafted/published                                    |
| Video transcript paste                     | reconcile the LOOP-1 framework     | founder paste                                | reconciled                                                |
| Counsel / token legal decision             | unblocks any token modeling        | counsel engagement                           | written opinion                                           |

## Immediate — safe engineering (no gate)

- Merge open PR #69 (LEGEND-001 fabric simulation lab) after review.
- Keep doc indexes + guards green; add reproducibility notes if any drift.

## High-value product

Tenant Zero pilot proof · Demandara pilot proof · SEC-2/audit-export onto
mainline · marketplace detail pages · work-order templates · matching-explanation
panel · proof-explorer redaction workflow · researcher-visible proof pack ·
API/SDK reference. (Each: build + tests; founder-gated where it needs a tenant.)

## Infrastructure / security

Managed-Postgres RLS verification (V-6) · edge WAF/rate limit · external security
audit · branch protection · secrets management/KMS · incident response runbook ·
audit export/retention · durable audit anchoring (EAS, design-only).

## Agent Fabric (gated; design → simulation → gated stages)

Node registry + router + simulated receipts = **built in PR #69 (simulation
only)**. Still design-only/gated: Tailscale/WireGuard connector, local/cloud model
router, policy-gated real execution, signed node attestation, node reputation,
fabric marketplace, zero-trust sandboxing. **No real remote execution without a
deliberate migration + security sign-off.**

## Crypto / protocol future (heavily gated)

Stablecoin settlement sandbox (after legal gate) · verifier/arbiter roles ·
assurance-bond simulation with **credits** (no token) · EAS/ERC-8004 compatibility
spike (design/sandbox) · x402 adapter (sandbox) · TOKEN-LAB-003 local-only sandbox
(only if explicitly authorized). **No mainnet until all gates pass.**
