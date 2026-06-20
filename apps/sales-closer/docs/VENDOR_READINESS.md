# Vendor Readiness — Apify & SalesCloser.ai

Readiness memo and **adapter contract** for the two external vendors the Sales
Closer Engine depends on: **Apify** (prospect sourcing) and **SalesCloser.ai**
(voice/closer handoff). It is the single source of truth for what each vendor is
used for, what data may and may not flow to them, the stable internal interface,
the safety defaults that are enforced in code, and the checklist that must clear
before any real credentials are switched on.

> **Status:** the engine runs **mock-by-default** (`MOCK_MODE=true`). No real
> Apify or SalesCloser calls happen until `MOCK_MODE=false` **and** a vendor is
> explicitly selected **and** keys are present. This memo describes what that
> switch turns on and what must be true first.

Related: [`apps/sales-closer/README.md`](../README.md) (architecture, env, run),
adapter code in [`packages/adapters`](../../../packages/adapters) and
[`packages/apify`](../../../packages/apify).

---

## A. Apify usage model

**What Apify is used for.** Apify runs hosted "actors" (scrapers) that produce a
**dataset** of company/contact rows. The engine starts an actor
(`startScrapeRun`), then imports the resulting dataset
(`importScrapeRun` → `fetchDataset` → `normalizeDataset`) into
`prospect_accounts` / `prospect_contacts`. Apify is **sourcing only** — it never
contacts anyone.

**Demo-safe actors / sources.**

- The bundled fixtures (`packages/apify/fixtures/companies.json`) via the mock
  client — **always safe**, no network, used in `MOCK_MODE` and tests.
- Public company directories and first-party / owned lists where Cognitia or the
  client holds the data rights and the source's ToS permits automated access.

**Sources requiring legal review before use.**

- LinkedIn and other gated social platforms (ToS generally prohibit scraping).
- Any actor that requires logging in, bypasses rate limits, or accesses
  member-only / paywalled areas.
- Aggregators that resell personal data (lawful-basis and DPA questions).

**Must never be scraped.**

- Personal/sensitive data (health, financial, government-ID, protected-class).
- Content behind authentication, paywalls, or CAPTCHAs (no bypassing controls).
- Anything explicitly disallowed by `robots.txt` / ToS once legal has flagged it.
- Children's data or any data from sources aimed at minors.

**Dataset import flow.**

1. `POST /api/scrape-runs` → `startScrapeRun(source, actorInput, requestedBy)`
   records a `scrape_runs` row (`actorRunId`, `apifyDatasetId`).
2. `POST /api/scrape-runs/:id/import` → `importScrapeRun(runId)` calls
   `fetchDataset(datasetId, MAX_SCRAPE_RESULTS)` and `normalizeDataset`
   (domain canonicalization + dedupe) into accounts/contacts; run `stats` record
   item/created/matched counts.

**Cost controls.**

- `MAX_SCRAPE_RESULTS` (default **500**) caps rows per import. Enforced in
  `RealApifyClient.fetchDataset` (passes `&limit=` to the API **and** slices the
  response) and at the import boundary in `importScrapeRun`. Set it per actor's
  expected volume; treat large bumps as a cost decision.
- Actor input should bound the run (page/result limits) at the source too.

**Max results.** `MAX_SCRAPE_RESULTS` is the hard ceiling for a single import.
There is no implicit "fetch everything" path — every call passes the cap.

**Retention policy.**

- Raw dataset rows are **not** persisted verbatim; they are normalized into
  accounts/contacts and discarded. Apify-side dataset retention follows the
  vendor's plan settings.
- Prospect records should carry a review/purge cadence (recommend: purge or
  re-confirm prospects with no engagement after a defined window; honor
  deletion requests immediately via the compliance flow).

**Evidence / source-URL handling.** Persist the originating source URL with the
account/contact/signal so every record is auditable back to where it came from.
Source provenance is part of the compliance story — never strip it.

---

## B. SalesCloser.ai usage model

**What SalesCloser.ai is used for.** The downstream **voice/closer** vendor.
After a prospect is scored, briefed, and a draft is **human-approved**,
SalesCloser receives a **lead** and a **scheduled call**, then reports
**outcomes** back over signed webhooks. SalesCloser is today's implementation of
the `VoiceVendorAdapter` seam; Vapi/Retell/Twilio are stubs behind the same
interface.

**What Cognitia owns internally (never delegated to the vendor).**

- The prospect database, dedupe/normalization, scoring, and the closer brief.
- The **approval gate** (`outreach_drafts.status` must be `approved`).
- The **compliance log** (append-only `compliance_logs`) and consent state
  (`prospect_contacts.consent_status`).
- Campaign/sequence logic — see "campaign draft" below.

**What data is sent to SalesCloser** (`createLead`):
`fullName`, `phone`, `email`, the **brief summary** (`notes`), and
`accountId`/`contactId` as opaque `metadata`. Calls send only `lead_id` +
`scheduled_for`.

**What must NOT be sent.**

- Raw scraped PII beyond the single approved contact.
- Internal-only fields (numeric fit scores, private notes, signal internals) not
  intended for the vendor or the call.
- Any contact that is `opted_out` / `dnc` — blocked **before** the vendor call
  (see Safety defaults).

**Lead creation flow.** `POST /api/vendor/leads` → `createVendorLead(draftId)`:
loads the draft (must be `approved`), loads the contact, **asserts the contact is
callable** (`assertContactCallable`), calls `adapter.createLead`, records a
`vendor_sync_events` row (idempotent on `lead-<vendor>-<externalId>`), and writes
a `vendor_lead_created` compliance entry.

**Call scheduling flow.** `POST /api/vendor/calls/schedule` →
`scheduleVendorCall(...)`: when a `contactId` is supplied it **re-checks consent**
(a contact may have opted out after the lead was created), calls
`adapter.scheduleCall`, and records an idempotent `call_scheduled` event
(`call-<vendor>-<externalId>`).

**Campaign draft flow.** There is **no** vendor-side campaign object today.
"Campaigns" are modeled internally as `outreach_drafts` that pass through human
approval; only an approved single draft becomes a single vendor lead. A
`createCampaignDraft` adapter method is **proposed, not implemented** (see C) — do
not assume bulk/sequence sends exist.

**Webhook outcome flow.** `POST /api/vendor/webhooks/:vendor` →
`handleVendorWebhook`: `verifySignature` (HMAC-SHA256 over the raw body,
`x-salescloser-signature`) → `parseWebhook` (maps SalesCloser event/outcome names
to the internal `VendorEventType` / `CallOutcome`) → insert idempotently. A
`dnc_requested` / `dnc` outcome flips the contact to `dnc` and logs it.

**Failure handling.** Non-2xx vendor responses throw with status + body and
surface to the caller (the route returns an error). Invalid webhook signatures
throw before any state change. Nothing is partially committed.

**Idempotency handling.** Every vendor event carries an `idempotencyKey` and is
inserted with `onConflictDoNothing`. Duplicate webhook deliveries are no-ops
(`{ processed: false, duplicate: true }`). Outbound lead/call events are keyed on
the vendor `externalId`.

**Required env vars.**

| Var                          | Purpose                                                                               |
| ---------------------------- | ------------------------------------------------------------------------------------- |
| `MOCK_MODE`                  | `false` to enable any real vendor (default `true`)                                    |
| `VENDOR_NAME`                | `salescloser` to select this vendor                                                   |
| `SALESCLOSER_API_KEY`        | bearer auth for lead/call REST calls                                                  |
| `SALESCLOSER_BASE_URL`       | API base (default `https://api.salescloser.ai`)                                       |
| `SALESCLOSER_WEBHOOK_SECRET` | HMAC secret; **without it `verifySignature` returns false** and webhooks are rejected |

**Required approval gates.** Draft `status === 'approved'`; contact consent not
`opted_out`/`dnc` (enforced at **both** lead creation and call scheduling); valid
webhook signature for any inbound event.

---

## C. Adapter interface

The stable seam is `VoiceVendorAdapter`
([`packages/adapters/src/types.ts`](../../../packages/adapters/src/types.ts)).
Swapping vendors means writing one implementation — **no route or UI changes**.

### Implemented today

```ts
interface VoiceVendorAdapter {
  readonly name: VendorName; // 'salescloser' | 'vapi' | 'retell' | 'twilio' | 'mock'
  createLead(input: CreateLeadInput): Promise<VendorLead>;
  scheduleCall(input: ScheduleCallInput): Promise<VendorCall>;
  getCall(externalId: string): Promise<VendorCall>;
  verifySignature(req: WebhookRequest): boolean;
  parseWebhook(req: WebhookRequest): Promise<VendorEvent>; // returns a normalized VendorEvent
}
```

Mapping the task's requested contract to what exists:

| Requested             | In code today                         | Notes                                                                                                               |
| --------------------- | ------------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| `createLead`          | ✅ `createLead`                       | implemented (SalesCloser + mock)                                                                                    |
| `scheduleCall`        | ✅ `scheduleCall`                     | implemented                                                                                                         |
| `receiveWebhook`      | ✅ `verifySignature` + `parseWebhook` | verification + normalization split into two methods                                                                 |
| `normalizeOutcome`    | ✅ inside `parseWebhook`              | `SC_EVENT_MAP` / `SC_OUTCOME_MAP` map vendor strings → internal `VendorEventType` / `CallOutcome`                   |
| `healthCheck`         | ⛔ not present                        | **proposed** — `healthCheck(): Promise<{ ok: boolean }>` (cheap auth-ping before going live)                        |
| `cancelCall`          | ⛔ not present                        | **proposed** — `cancelCall(externalId: string): Promise<VendorCall>` once the vendor API is confirmed to support it |
| `createCampaignDraft` | ⛔ not present                        | **proposed / may stay internal** — campaigns are `outreach_drafts` + human approval today                           |

> Proposed methods are intentionally **not implemented** — adding them is a
> deliberate interface change, not a stub to fill in silently. When added, every
> implementation (incl. the `Mock` and the throwing stubs) must satisfy them so
> the factory keeps compiling.

### Implementations

- `MockVoiceAgentAdapter` — network-free; `simulateOutcome` fabricates a webhook
  so the full lead → call → outcome loop runs without a vendor. Used in
  `MOCK_MODE` and tests.
- `SalesCloserAdapter` — real REST + HMAC-verified webhooks.
- `VapiAdapter` / `RetellAdapter` / `TwilioAdapter` — implement the interface but
  every method throws `"<vendor> adapter is not implemented yet"`. They prove the
  seam supports more vendors without touching call sites.

Resolution: `getVendorAdapter(name?)` returns the mock whenever `MOCK_MODE`,
otherwise the named vendor.

---

## D. Safety defaults

These are **enforced in code**, not just policy:

- **Mock mode by default.** `MOCK_MODE` defaults to `true`; `getVendorAdapter`
  and `getApifyClient` return mock clients under it — no keys, no network.
- **No real calls without explicit env + approval.** Real vendors require
  `MOCK_MODE=false` + `VENDOR_NAME` + the vendor key; a lead requires an
  **approved** draft.
- **No mass calling.** One approved draft → one lead → one scheduled call.
  There is no bulk-send path, and Apify imports are capped at
  `MAX_SCRAPE_RESULTS`.
- **No auto-send.** Human approval (`/api/drafts/:id/approve`) is a hard gate
  before anything reaches a vendor.
- **DNC & unsubscribe checks.** `assertContactCallable` blocks `opted_out` /
  `dnc` contacts at **both** lead creation and call scheduling; an inbound
  `dnc_requested` webhook immediately flips the contact to `dnc`.
- **Compliance log required.** State-changing vendor actions append to the
  append-only `compliance_logs` (`vendor_lead_created`, `dnc_applied`, …).

---

## E. Production launch checklist

Before flipping `MOCK_MODE=false` against real credentials:

- [ ] **Legal review** — every Apify actor/source approved; scraping ToS cleared.
- [ ] **Privacy review** — lawful basis, data minimization, retention/purge cadence.
- [ ] **API keys** provisioned & stored as secrets (`APIFY_TOKEN`,
      `SALESCLOSER_API_KEY`) — never committed.
- [ ] **Data Processing Agreement** signed with Apify and SalesCloser.ai (and the
      client, if their prospects are processed on their behalf).
- [ ] **Client approval** to begin live outreach for the campaign/segment.
- [ ] **Call scripts approved** by the client and legal.
- [ ] **Opt-out / unsubscribe process** verified end-to-end (DNC webhook flips
      consent; manual suppression path works).
- [ ] **Webhook secret configured** (`SALESCLOSER_WEBHOOK_SECRET`) and signature
      verification confirmed (unsigned/forged payloads rejected).
- [ ] **Monitoring / logging** — vendor errors alert; compliance log reviewed;
      `MAX_SCRAPE_RESULTS` set appropriately per actor.
- [ ] **Rollback plan** — flip `MOCK_MODE=true` (or `VENDOR_NAME=mock`) to halt
      all real vendor traffic instantly; revoke keys if needed.

---

## Verdict — ready for real-credential testing later?

**Yes, behind the gates above.** The adapter seam is stable and the safety
defaults (mock-by-default, approval gate, dual-boundary DNC/consent checks,
HMAC-verified idempotent webhooks, cost cap, compliance logging) are enforced in
code. Real-credential testing is appropriate **once** legal/privacy review clears
and the launch checklist is satisfied. Until then the engine stays in mock mode.

**Open risks to track:** Apify source legality is per-actor (not a one-time
sign-off); `healthCheck` / `cancelCall` are proposed but unimplemented (no
pre-flight ping or programmatic call cancellation yet); SalesCloser's real
request/response/webhook shapes are assumed from the integration and must be
confirmed against live API docs during credential testing.
