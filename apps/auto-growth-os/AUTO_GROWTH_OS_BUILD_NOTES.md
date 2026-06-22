# Auto Growth OS — Build Notes (Release 1)

**Demandara Dealership Growth OS, powered by Cognitia** — the first verticalized Client OS /
agent-economy application. One Next.js app, three connected layers, built on a mocked/local demo
stack (no DB, no real auth, no external integrations).

## Positioning

- **Demandara** = growth operator (sells and operates the system; GTM, content, fulfillment).
- **Cognitia** = infrastructure (CRM-lite, agent economy, proof registry, action ledger, approval gates).
- **Auto Growth OS** = the dealership operating system (the product).
- **Client Zero** = BudgetWheels, a used-car dealership.
- **Car buyers** use the public website/forms only. The **dealership team / Demandara / Cognitia** use the portal.

## Routes (three chrome contexts via App Router route groups)

| Group      | Chrome                         | Routes                                                                                                                                                                                                                                                                                                                                                  |
| ---------- | ------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `(public)` | Dealership header + footer     | `/`, `/inventory`, `/inventory/[slug]`, `/finance`, `/trade-in`, `/book-test-drive`, `/contact`, `/faq`, `/city/[city]`, `/category/[category]`                                                                                                                                                                                                         |
| `(sales)`  | Demandara × Cognitia header    | `/dealership-growth-os`, `/discovery`, `/powered-by-cognitia`, `/proposal-preview`, `/meeting`, `/intake`, `/modules`, `/system-map`                                                                                                                                                                                                                    |
| `(portal)` | Portal sidebar + role switcher | `/portal/dashboard`, `/portal/leads`, `/portal/leads/[id]`, `/portal/customers`, `/portal/customers/[id]`, `/portal/inventory`, `/portal/inventory/new`, `/portal/inventory/[id]`, `/portal/appointments`, `/portal/ai-approvals`, `/portal/content`, `/portal/social`, `/portal/proof`, `/portal/reports`, `/portal/settings`, `/portal/agent-economy` |

Legacy URLs `/dashboard` → `/portal/dashboard` and `/customer-mapper` → `/portal/customers`
(app-level redirects in `next.config.mjs`).

## How data flows (the spine)

1. A car buyer submits a public form (`PublicInquiryForm`: finance / trade-in / test-drive / contact / general / vehicle-detail).
2. `addLead()` builds a scored `Lead` **and** emits a `ProofEvent` (lead captured + response time) and `ActionLedgerEntry` records.
3. The lead appears in `/portal/leads` and the dashboard; open it in `/portal/leads/[id]`.
4. The **Sales Draft Agent** drafts a reply via `generateDraftFor()` → text is scanned by **guardrails** → high/medium-risk drafts create an `Approval{pending}` and route to `/portal/ai-approvals`.
5. A human **approves / edits / rejects** (`decideApproval`). Approve → simulated send + `ProofEvent` + ledger entries. **Nothing sends without a human decision.**
6. Inventory: `/portal/inventory/[id]` edits a vehicle; **sensitive fields require attestation** and a listing can only be **published** when `sensitiveFieldsConfirmed && approvalStatus==='approved'` (`publishVehicle`). Publishing logs proof + ledger.
7. Content/social drafts carry guardrail risk and are approval-gated before "publish".
8. Everything meaningful is visible in `/portal/proof` (proof feed + action ledger) and summarized in `/portal/reports`. Agents, permissions, and activity are mapped in `/portal/agent-economy`.

## Architecture

- **State:** one client store, `lib/store/AppStateProvider.tsx` (React Context + `localStorage` key `cognitia.demo.v2`), seeded from `src/data/*.json`. Server components read seed JSON directly; only interactive pages use the store. IDs/timestamps are created inside actions only (SSR-safe).
- **Pure lib (tested):** `guardrails` (claim-risk classifier + safe rewrite), `agents` (9-agent roster, deny-by-default `canAgentPerform`), `ai-drafts` (deterministic generators, scanned by guardrails), `proof` (event/ledger factories), `discovery` (12-section schema, readiness/complexity scoring, package recommendation, 16-section proposal output), `customers` (lead→customer linking + consent events), `pipeline` (stage advance + sold guards), `proposals` (discovery→proposal/GTM-prospect), `normalize` (localStorage hydration merge), `seo` (JSON-LD), `inventory`, `routes`, `copy` (centralized disclaimers).
- **Types:** one source of truth — `src/types/index.ts` (extended `Vehicle`; Tenant, User, Agent, AIDraft, Approval, ActionLedgerEntry, ProofEvent, Appointment, ContentDraft, SocialPostDraft, Customer, ConsentEvent, GTMProspect, DiscoverySession, Proposal, IntegrationStatus, …). `AgentAction` is an alias of `ActionLedgerEntry`.
- **No new dependencies.** Tables, forms, JSON-LD, and the calculator are built from existing UI primitives + inline SVG.

## Demo vs production-ready

| Area             | This build (demo)                                                     | Production path                                                                                   |
| ---------------- | --------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| Persistence      | In-memory seed + `localStorage`                                       | Real DB behind the same repository/adapter shapes                                                 |
| Auth / roles     | `DemoRoleSwitcher` (labeled demo)                                     | Real authn/authz; the role drives ledger `actorId` today                                          |
| AI drafts        | Deterministic generators                                              | Swap for a real model behind the same `DraftBase` shape + the same approval gate                  |
| Integrations     | Simulated adapters (`lib/adapters/*` return `{ simulated: true }`)    | WhatsApp/CRM/DMS/SMS/email/Ads after approved access at scope lock                                |
| Public inventory | Server-rendered from the **seed** published set                       | Portal `publishVehicle` updates the store now; wiring the public list to live data is a follow-up |
| SEO              | Foundations only (metadata, FAQ/vehicle JSON-LD, city/category pages) | No ranking/visibility is promised anywhere                                                        |

## Safety / guardrails

- `ClaimType` ∈ {finance, trade_in, warranty, accident_history, promotion, compliance, complaint, price, availability}; `RiskLevel` ∈ {low, medium, high}.
- Any sensitive claim ⇒ `requiresHumanApproval = true`. Agents are **deny-by-default** and universally forbidden from `send_without_approval`, `commit_price/financing/trade_value/warranty`, and `override_human_approval`.
- Centralized disclaimers (`lib/copy.ts`) are reused across the public site, portal, and proposals. No guarantee/auto-sell/ranking language exists in UI copy (the only "guarantee" strings are negations, disclaimers, a forbidden agent action, or guardrail detection patterns).
- Two lead universes are kept separate: **dealer customer leads** (`Lead`) vs **Demandara GTM prospects** (`GTMProspect`).

## Run & verify

```bash
pnpm install --frozen-lockfile
pnpm run format:check
pnpm run typecheck
pnpm test
pnpm --filter @cognitia/auto-growth-os run build
pnpm --filter @cognitia/auto-growth-os start   # http://localhost:3002
```

Tests: pure-lib only (Vitest node env), co-located `src/lib/*.test.ts` — guardrails, agents, ai-drafts, proof, discovery, seo (plus existing scoring).

## Next PR recommendations

1. Wire the public inventory list to live store state (publish → public page) and add `/portal/customers` ↔ lead linkage.
2. Real persistence (DB) behind the repository/adapter seams; real auth/roles.
3. Real model integration for AI drafts (kept behind the existing approval gate).
4. Approved external integrations (WhatsApp/CRM/DMS/Ads) after scope lock; UTM/source + call tracking.
5. Deepen content/social calendar and reporting exports.
