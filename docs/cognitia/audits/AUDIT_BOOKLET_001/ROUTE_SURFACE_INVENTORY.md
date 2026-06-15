# ROUTE / SURFACE INVENTORY — AUDIT-BOOKLET-001

From `apps/api/src/server.ts` and `apps/web/src/app/` on main `313a82d`.

> **Reconciliation update (AUDIT-BOOKLET-001B, 2026-06-15):** PR #69 merged after
> this inventory was written, adding **6 operator-authed** `/agent-fabric/*`
> routes (listed in the operator section below). There is **no public/unauth
> fabric route**; the two unauth reads (`/health`, `/public/trust-feed`) are
> unchanged. The "forbidden surfaces" table below still holds — no token/payment/
> real-execution route exists.

## Public web pages (static/read-only)

| Path          | Auth | Data risk              | Notes                                            |
| ------------- | ---- | ---------------------- | ------------------------------------------------ |
| `/trust`      | none | none (static)          | Trust/Proof Explorer; guarded by `trust.test.ts` |
| `/trust/live` | none | none (GET-only client) | reads `/public/trust-feed`; `trust-live.test.ts` |

Operator console pages (client; call authed API with a pasted session token):
`/agent-economy`, `/agents`, `/agents/[id]`, `/approvals`, `/cognitia`,
`/cognitia/crypto-readiness`, `/credits`, `/proofs`, `/skills`, `/moveros`,
`/moveros/front-desk`. These render gated/internal status (e.g. crypto-readiness
shows "placeholders only"; credits shows "no purchase path, no pricing").

## Unauthenticated API (the only two reads)

| Method | Route                | Tenant             | R/W  | Data risk                                           | Guard                      |
| ------ | -------------------- | ------------------ | ---- | --------------------------------------------------- | -------------------------- |
| GET    | `/health`            | n/a                | read | none                                                | —                          |
| GET    | `/public/trust-feed` | server-config only | read | public projection + aggregate only; deny-by-default | `publicTrustFeed*.test.ts` |

## Webhook / own-auth API

| Method | Route                    | Auth               | Notes                      |
| ------ | ------------------------ | ------------------ | -------------------------- |
| POST   | `/webhooks/hubspot`      | HMAC v3 sig        | raw-body captured          |
| POST   | `/webhooks/inbound-lead` | signature/own-auth | tenant from signed context |
| POST   | `/jobs/crm-sync`         | own-auth           | sync trigger               |

## Operator API (session-authed; tenant from principal; `x-tenant-id` never trusted)

**96 routes** across: CRM action lifecycle (`/agent-actions/*`, `/agent-runs/*`,
`/accounts/:id/context`), Proof Registry (`/proofs*`), ATC/agents/permissions
(`/agents/:id/permissions`, `/atc/:id/*`), SkillProof (`/skills*`), Agent Economy
(`/agent-economy/*` — work orders, agent-driven propose-_, marketplace),
leads/front-desk (`/leads/:id/_`, `/front-desk/_`), metrics/reports/integrations
(`/metrics/_`, `/reports/trust-packet`, `/integrations/\*` incl. ENF-1 kill switch),
command summary (`/cognitia/command/summary`). Full enumeration in
`docs/cognitia/public/API_AND_SURFACES.md`.

**Agent Fabric Lab (PR #69; +6 operator-authed routes, `sendAuthed`, internal,
simulation-only):** `GET /agent-fabric/nodes`, `POST /agent-fabric/nodes`,
`GET /agent-fabric/route`, `POST /agent-fabric/simulate-execute` (records a
`verified_fact` receipt proof + delivers; escrow still released only by the human
owner `verify`), `POST /agent-fabric/nodes/:id/quarantine`,
`POST /agent-fabric/nodes/:id/restore`. No remote execution, no network call, no
public route.

## Forbidden surfaces — CONFIRMED ABSENT

Scanned `apps/api/src/server.ts` + `apps/web/src/app/` dir names:
| Surface | Present? | Evidence |
| ------- | -------- | -------- |
| token purchase route | **NO** | no `/buy`/`/token`/`/checkout` route |
| public sale route | **NO** | none |
| DEX / liquidity route | **NO** | none |
| staking / yield route | **NO** | none |
| real payment route | **NO** | none; credits-only |
| token transfer route | **NO** | none |
| public marketplace transaction route | **NO** | marketplace is authed `/agent-economy/` only, internal-visibility |
| private proof body public route | **NO** | `/public/trust-feed` serves the 6-field projection only |
| PII public route | **NO** | redaction-gated; PII never on public surfaces |
| real remote-execution route (fabric) | **NO** | `/agent-fabric/simulate-execute` is simulation-only; containment guard forbids process/network primitives |
| public fabric route | **NO** | all `/agent-fabric/*` routes are operator-authed (`sendAuthed`) |

Enforcement: `packages/core/src/doctrine.guard.test.ts` fails the build if a
token/coin/staking/pre-sale/air-drop route segment or banned marketing literal
appears in `apps/web`.
