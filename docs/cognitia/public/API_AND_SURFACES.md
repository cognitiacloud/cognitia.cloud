# API & Surfaces Reference (public-safe)

A researcher-facing map of Cognitia's HTTP surfaces, grouped by area and auth
model. This is a **reference**, not a quickstart, and is intentionally
conservative: shapes may change; Cognitia is **not production-deployed**. There
are **no token, payment, DEX, or purchase endpoints** of any kind — searching the
route table for them returns nothing by design.

## Auth model (read this first)

- **Operator routes** require a verified session (`Authorization: Bearer <token>`).
  The tenant and role come **from the verified principal** — `x-tenant-id` is
  **never trusted** on operator routes. Absent a verifier, operator routes fail
  closed (401).
- **Unauthenticated routes** are read-only and deny-by-default (below).
- **Webhook routes** authenticate by their own scheme (HMAC signature) — not a
  session.

## Unauthenticated surfaces (the only two public reads)

| Method | Route                | Purpose                                                                                                                                                                                                  |
| ------ | -------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| GET    | `/health`            | DB connectivity / liveness.                                                                                                                                                                              |
| GET    | `/public/trust-feed` | Public trust feed. Deny-by-default empty; tenant only from `COGNITIA_PUBLIC_TENANT_ID`; public projection + aggregate reputation; bounded, cached, rate-limited. See `PUBLIC_EVIDENCE_MANIFEST_SPEC.md`. |

Public web pages (static, read-only, no API writes): **`/trust`** (Trust / Proof
Explorer) and **`/trust/live`** (live public feed view).

> Note: `/proofs/public` returns the public-safe proof projection but is an
> **operator** route (the authenticated operator's view). The unauthenticated
> public proof surface is `/public/trust-feed`.

## Webhook / own-auth surfaces (HMAC or signature-gated)

| Method | Route                    | Notes                                                   |
| ------ | ------------------------ | ------------------------------------------------------- |
| POST   | `/webhooks/hubspot`      | HMAC v3 signature verified; raw-body captured.          |
| POST   | `/webhooks/inbound-lead` | Signature/own-auth; tenant from signed payload context. |
| POST   | `/jobs/crm-sync`         | Sync trigger (own-auth).                                |

## Operator API (session-authed) — by area

> Representative, not exhaustive. All require a session; tenant/role from the
> principal. High-risk side effects are approval-gated and reversible.

- **Governed CRM action lifecycle** (Mira): `GET /accounts/:id/context`;
  `POST /agent-runs/mira/preflight`; `GET /agent-runs/:id`;
  `GET /agent-actions`; `GET /agent-actions/:id/{preview,rationale,decisions,regression-candidate}`;
  `POST /agent-actions/:id/{approve,reject,execute,rollback}`;
  `POST /agent-actions/{batch-approve,batch-reject}`.
- **Proof Registry (COG-003)**: `GET /proofs/public` (operator view of public
  projection); `POST /proofs`; `POST /proofs/:id/supersede`;
  `POST /proofs/:id/redaction-check`.
- **Agents / ATC / permissions (COG-004)**: `GET|PUT /agents/:id/permissions`;
  `POST /atc/:id/{suspend,resume,expire,revoke}`.
- **Leads / front desk**: `POST /leads/:id/{draft,purge-pii,actions}`;
  `POST /front-desk/actions/:id/execute`.
- **Skills (SkillProof)**: `GET /skills`; `POST /skills/import-core`;
  `GET /skills/:id`; `GET /skills/:id/versions`.
- **Agent Economy** (internal; authed `/agent-economy/` only — no public market):
  - Work orders: `GET|POST /agent-economy/work-orders`;
    `GET /agent-economy/work-orders/:id`;
    `POST /agent-economy/work-orders/:id/{accept,deliver,verify,reject,dispute,resolve,cancel}`.
  - Agent-driven (ledger asks, approval-required):
    `POST /agent-economy/work-orders/:id/{propose-accept,propose-deliver,propose-dispute}`;
    `GET /agent-economy/actions`; `POST /agent-economy/actions/:id/execute`.
  - Marketplace (internal-visibility): `GET /agent-economy/marketplace`;
    `POST /agent-economy/marketplace/listings`;
    `POST /agent-economy/marketplace/listings/:id/{unlist,relist,order}`.
  - `GET /agent-economy/summary`.
- **Agent Fabric Lab** (internal; authed `/agent-fabric/` only — **simulation
  only**, no remote execution): `GET /agent-fabric/nodes`;
  `POST /agent-fabric/nodes`; `GET /agent-fabric/route`;
  `POST /agent-fabric/simulate-execute` (records a verified_fact receipt proof +
  delivers; escrow still released by the human owner `verify`);
  `POST /agent-fabric/nodes/:id/{quarantine,restore}` (per-node kill switch).
- **Metrics / reports / integrations**: `GET /metrics/{outbound,trust,scorecards}`;
  `GET /reports/trust-packet`; `GET /integrations/{status,readiness}`;
  `POST /integrations/:system/{pause,resume}` (ENF-1 kill switch).

## Invariants a reader can rely on

- Only `verified_fact` proofs move reputation or release escrow.
- Verify and dispute-arbitration are human owner decisions (not agent-proposable);
  agent "propose-\*" routes file approval-required ledger asks.
- Internal credits only — non-transferable outside the tenant ledger; no real
  payments, no token transfers.
- The only unauthenticated reads are `/health` and `/public/trust-feed`.

## What does NOT exist (by design)

No `/buy`, `/sell`, `/token`, `/coin`, `/swap`, `/stake`, `/presale`, `/checkout`,
or any payment/settlement-with-real-money endpoint. The doctrine guard tests fail
the build if a token/coin/staking route is ever added to the web app.

## Caveat

Not production-deployed; no SLA; shapes may change. Reproduce the behavior locally
via `VERIFY_IT_YOURSELF.md` (`pnpm check` + the live economy smoke).
