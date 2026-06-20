# Sales Closer — Vendor-Readiness Platform Port

**Status:** Docs-only extraction memo. No code, no dependency/lockfile changes, no
API calls, no credential testing. It ports the reusable vendor-readiness _doctrine_
from the prototype work (PR #95, stacked on the greenfield PR #94) onto the
**canonical platform** (PR #93, which extends the real `main`) so it can later be
implemented natively. It implements nothing.

> **Auto Growth OS is outside this branch/scope and remains untouched** (see §7).

---

## 1. Executive decision

- **PR #93 is canonical.** It extends the real `main` platform (the existing
  Cognitia GTM monorepo: `apps/{api,web,worker}`,
  `packages/{agents,core,db,evals,integrations,workflows}`) and adds the closer data
  layer (migrations `0020`/`0021`, `packages/core/src/schemas/closer.ts`,
  repository/RLS/guard tests). All future Sales Closer work targets this.
- **PR #94 and PR #95 are reference / prototype branches.** #94 bootstrapped a
  parallel greenfield monorepo (cut from a stale commit) and will not be merged;
  #95 (this thinking's origin) sits on #94 and **remains draft — it should not merge
  as-is.**
- **No real credential testing yet.** No outbound or live vendor behavior of any
  kind. Mock / simulation-by-default everywhere.

---

## 2. What from #95 is reusable as doctrine

Vendor-agnostic principles that port directly onto the platform:

- **Vendor usage models** — Apify is **sourcing only**; the voice/closer vendor is a
  downstream handoff with a defined data-in / data-out contract.
- **Mock / simulation-by-default** — nothing real runs without explicit opt-in.
- **Dual-boundary consent / DNC checks** — suppression verified both when a vendor
  action is _proposed_ and again before it is _executed_.
- **HMAC webhook verification** — reject unsigned/forged callbacks before any state
  change.
- **Idempotent webhook writes** — duplicate deliveries are no-ops.
- **Append-only compliance / audit logging** — every vendor action is recorded
  immutably.
- **DNC-on-inbound** — an inbound do-not-contact signal immediately suppresses the
  contact.
- **Apify result cap** — a hard max-results / cost ceiling on every dataset fetch.
- **Adapter-seam principle** — one stable interface; adding a vendor is one new
  implementation, no call-site churn.
- **Production launch checklist** — legal, privacy, DPA, keys, scripts, opt-out,
  webhook secret, monitoring, rollback.

---

## 3. What must be dropped / replaced

From the #94/#95 greenfield spike:

- **Parallel pnpm / Turborepo bootstrap** — duplicates `main`'s monorepo. Drop.
- **Greenfield Drizzle tables** (`prospect_accounts`, `prospect_contacts`,
  `scrape_runs`, `vendor_sync_events`, …) — replace with `accounts`, `contacts`,
  `agent_actions`, `events`/`audit_events`, and the #93 `closer_*` tables.
- **Raw phone / email columns** — the platform mandates **hashed PII only**
  (`contacts.email_hash`, `contacts.phone_hash`). Raw PII is a hard no.
- **Global `MOCK_MODE` env singleton** (and `VENDOR_NAME`) — replace with the
  platform's dependency-injection + simulation conventions (`createGtmServices`
  wires fakes by default; `agent_actions.simulation` defaults true for gated
  channels).
- **Custom `VoiceVendorAdapter` as the final interface** — conform to the platform's
  `IntegrationAdapter` instead.
- **Next.js `apps/sales-closer` API routes / admin screens** — fold into `apps/api`
  - reuse `apps/web` `/approvals`; do **not** create a new Sales Closer app.
- **Direct `createVendorLead` / `scheduleCall` POST model** — replace with
  propose → guardrails → human approval → execute via `agent_actions`.

---

## 4. Platform-native target homes

Each reusable concept mapped to its real home/pattern.

### Apify sourcing

- `packages/integrations/src/apify`.
- Follow the **`IntegrationAdapter`** pattern (mirror
  `packages/integrations/src/hubspot`: `client.ts` seam, `httpClient.ts`,
  `tokenProvider.ts`).
- **Fake client by default**; real token only after approval.
- Ingestion runs as a **worker `Job`** (`apps/worker`, `crmSync.ts` reference).
- Source-risk / legal-review classification per actor/source.
- **Result cap as adapter config** (not a global env).

### Voice / closer vendors

- `packages/integrations/src/<vendor>`.
- `IntegrationAdapter` with `kind: 'voice'`, registered in **`AdapterRegistry`**.
- **`tokenProvider` / encrypted per-tenant credentials** (AES-GCM, like HubSpot
  OAuth).
- **Webhook verification** pattern (`verifyHubspotSignatureV3` reference).
- **Fake client first**; real client only behind approval + simulation-off.

### Consent / DNC

- Reuse `contacts.is_suppressed`.
- Reuse the **BLOCKING** `suppressionCheck` guardrail
  (`packages/agents/src/guardrails`).
- Reuse `lead_intakes.consent_captured`.
- Add a **per-call consent guardrail**.
- **No new consent enum** unless separately approved.

### Execution

- **propose → guardrails → human approval → execute.**
- Vendor actions are `ApprovedAgentAction`s.
- Idempotency via `agent_actions.idempotency_key`
  (`unique(tenant_id, idempotency_key)`).
- `simulation` defaults true for gated channels.

### Audit / proof

- `audit_events` (append-only).
- `events` (append-only).
- `proofs`.
- Immutable compliance trail end-to-end.

### UI

- Reuse `apps/web` `/approvals` (token session, guardrail display,
  approve/reject/execute/rollback).
- **Do not create a new Sales Closer app** in this extraction.

### API

- `apps/api` Fastify routes for propose / approve / execute / webhook
  (`runMira`, `approveAction`, `executeAction`, HMAC webhook route).

### Worker

- `apps/worker` `Job`s for ingestion / enrichment / sync.

### Agents

- `packages/agents` closer pipeline extending the existing `MiraAgent` (propose-only)
  / `guardrails` / `contextBuilder` / scoring.
- **Fake LLM by default** where applicable (`packages/agents/src/llm`, Anthropic +
  Fake).

---

## 5. Vendor safety gates

### Apify

- **Allowed use:** prospect/company **sourcing only** from production-safe sources
  (owned/first-party data, public registries/directories where ToS permits).
- **Forbidden use:** contacting anyone; scraping personal/sensitive data, paywalled
  or auth-walled content, or sources behind CAPTCHA / anti-bot; anything legal has
  flagged.
- **Required proof/evidence:** persist the source URL / provenance for every record;
  store **hashed PII only**.
- **Required consent/DNC checks:** N/A at fetch (no contact made), but imported
  contacts inherit suppression/consent state before any downstream outreach.
- **Webhook/security:** API token stored server-side / encrypted; no token in logs.
- **Simulation default:** Fake client by default; real token only after approval.
- **Launch blockers:** per-actor source-legality classification; result/cost cap
  configured; retention/purge policy; robots.txt / Apify AUP compliance.

### SalesCloser.ai

- **Allowed use:** downstream voice/closer handoff for an **approved** contact, via
  the propose→approve→execute flow.
- **Forbidden use:** any real call by default; mass calling; auto-send; sending raw
  or unnecessary PII to the vendor.
- **Required proof/evidence:** approved `agent_action` + brief evidence refs; append
  to `audit_events`/`events`; transcript/outcome retained per policy.
- **Required consent/DNC checks:** suppression/consent verified **before propose and
  before execute**; inbound DNC immediately suppresses.
- **Webhook/security:** HMAC signature verification; idempotent webhook writes;
  per-tenant encrypted credentials.
- **Simulation default:** simulation/fake mode on; real calls only behind explicit
  opt-in + approval.
- **Launch blockers:** legal/privacy review; DPA; webhook secret; test tenant +
  internal-owned number; human approval gate active.

### Vapi

- **Allowed use:** **future candidate only** — not implemented, no launch.
- **Forbidden use:** any real or simulated calling until built behind the platform
  flow and legal review.
- **Required proof/evidence:** recorded-consent proof; call-recording disclosure.
- **Required consent/DNC checks:** TCPA / CASL / CRTC National DNCL per-call consent.
- **Webhook/security:** signature verification; encrypted per-tenant credentials.
- **Simulation default:** simulation-first; SMS / WhatsApp / AI-voice gated off.
- **Launch blockers:** legal/privacy review; rate/volume caps; consent-proof
  pipeline.

### Retell

- **Allowed use:** **future candidate only** — not implemented, no launch.
- **Forbidden use:** any real or simulated calling until built + legal review.
- **Required proof/evidence:** recorded-consent proof; call-recording disclosure.
- **Required consent/DNC checks:** TCPA / CASL / CRTC National DNCL per-call consent.
- **Webhook/security:** signature verification; encrypted per-tenant credentials.
- **Simulation default:** simulation-first; SMS / WhatsApp / AI-voice gated off.
- **Launch blockers:** legal/privacy review; rate/volume caps; consent-proof
  pipeline.

### Twilio

- **Allowed use:** **future candidate only** — not implemented, no launch.
- **Forbidden use:** any real SMS/voice until built + legal review; no outbound
  sending in this scope.
- **Required proof/evidence:** recorded-consent proof; message/call-recording
  disclosure.
- **Required consent/DNC checks:** TCPA / CASL / CRTC National DNCL per-message /
  per-call consent.
- **Webhook/security:** Twilio signature verification; encrypted per-tenant
  credentials.
- **Simulation default:** simulation-first; SMS / WhatsApp / AI-voice gated off.
- **Launch blockers:** legal/privacy review; carrier/10DLC registration; rate caps;
  consent-proof pipeline.

---

## 6. Credential-testing boundary

No real credentials are used until **all** of the following hold:

- The #93 platform-native closer implementation is approved.
- Legal / privacy review clears.
- A test tenant exists.
- Test credentials exist.
- The webhook secret is configured.
- An **internal-owned** test phone number is used (only).
- No real prospects are contacted.
- The human approval gate is active.
- Simulation is disabled **only** for one controlled test.
- Logs / audit events are reviewed after the test.
- A rollback plan exists (flip back to simulation/fake immediately).

Until then: stubs stay stubs, no real API calls by default, no outbound sending, no
autonomous outreach, and SMS / WhatsApp / AI-voice stay gated off.

---

## 7. Relationship to Auto Growth OS

- **Auto Growth OS exists separately in PR #90** as _Demandara Dealership Growth OS_.
- **This memo does not change it** — Auto Growth OS is outside this branch/scope and
  remains untouched.
- **Future integration** should connect Demandara GTM prospect qualification to
  Auto Growth OS _Discovery_ — but **not** in this docs-only extraction.

---

## 8. Recommended next PR sequence

1. **Merge / approve PR #91** — data-source strategy.
2. **Merge / approve PR #92** — compliance spec.
3. **Review / merge PR #93** — canonical schema / platform foundation.
4. **Close or archive PR #94** as prototype/reference, after extracting any useful
   docs.
5. **Keep PR #95 draft** — do not merge as-is.
6. **Create a future implementation PR** for a platform-native vendor-adapter
   scaffold **only after #93 is stable**.
