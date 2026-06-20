---
title: Sales Closer — Compliance Layer Build Notes
status: Draft
date: 2026-06-20
---

# Sales Closer — Compliance Layer Build Notes

This is the **compliance / channel layer** for the Cognitia Sales Closer. It sits
on top of the Demandara GTM prospecting scaffold (#97) and adds per-channel
outreach gating, human-approval gates, evidence/provenance, an append-only
compliance log, and demo proof surfaces. **Demandara** owns growth/GTM;
**Cognitia** owns compliance, proof, approval, agent governance, and the action
ledger.

## Sources of record

- **PR #91 — data-source strategy** (`docs/sales-closer/data-source-strategy.md`):
  the data-source matrix. Seeds `apps/web/src/lib/dataSources.ts`.
- **PR #92 — compliance system spec** (`docs/compliance/compliance-system-spec.md`):
  the CASL / CRTC / PIPEDA / Apify-AUP policy. Drives the channel gating + gates.
- **PR #97 — Demandara GTM scaffold** (`@cognitia/core`): the **PII-safe**
  `GtmProspect` / `DataSource` / `SourceRisk` / `ContactBasis` / `ConsentStatus`
  primitives and the GTM guardrail helpers. This layer **consumes** them.
- **PR #93 — canonical platform-native Sales Closer foundation** (landed): the
  closer data layer — zod schemas (`@cognitia/core` `schemas/closer.ts`:
  `closerSourceRisk`, `closerTier`, `closerScoreDimensions`, `closerClaim`,
  `closerBriefStructured`, `closerSourceCreate`) and the `@cognitia/db` closer
  persistence (sources / runs / profiles / briefs, Postgres/RLS). This is the
  **canonical** Sales Closer foundation; it owns the closer domain/persistence
  types. This demo compliance/channel layer sits **above** it and must not
  introduce a parallel shared-core surface.

## Relationship to #97 and #93 (no duplication, no parallel core surface)

This layer **does not redefine** any shared type. It imports the canonical #97
GTM primitives — `GtmProspect`, `DataSource`, `SourceRisk`, `ContactBasis`,
`ConsentStatus` — type-only from `@cognitia/core`, and it does **not** add any
compliance/channel types to shared core.

The per-channel **view models** (`Channel`, `ChannelStatus`, `ChannelEligibility`,
`ComplianceLog`, `CompliancePolicy`, `ComplianceDecision`, `EvidenceField`,
`ComplianceCheckResult`) are **web-local** demo presentation types in
`apps/web/src/lib/complianceTypes.ts` — deliberately not in shared core, to avoid
a second compliance surface competing with the #93 canonical foundation. They
reuse the #97 unions (`SourceRisk`, `ContactBasis`, `ConsentStatus`) rather than
redefining them. The #93 closer schemas (sources / runs / profiles / briefs /
scoring) live at the DB/domain altitude and have no view-model consumer in this
demo governance layer, so they are consumed where they fit (the canonical
foundation in the base) and left untouched here.

Helper overlap is reconciled by name: core owns the prospect-level
`canContactProspect` / `requiresHumanReviewForOutreach`; the channel-aware
helpers here are `checkChannelCompliance` / `requiresHumanReviewForChannel`. The
local `isSourceUsable` mirrors core `canUseSourceForProspecting` and a test
asserts parity. Compliance helpers import core **types only** (erased at runtime)
so the web bundle never pulls core's runtime (zod / node:crypto) — no new
dependency or lockfile change.

## PII doctrine (matches #97)

No raw `contactEmail` / `contactPhone` anywhere — the shared `GtmProspect` carries
only `contactEmailHash` / `contactPhoneHash` / `contactEmailMasked` /
`contactPhoneMasked` / `contactDomain`. The demo fixtures and evidence values
carry **business facts only** (company, role, source URL), never raw contact PII;
tests assert no raw email/phone serializes from the fixtures or the log entries.

## GTM prospects vs. car-shopper leads

This layer handles **Demandara dealership GTM prospects** (B2B records used to
sell to dealerships) — **not** consumer car-shopper leads. The two are never
mixed: `GtmProspect` is distinct, and no `leads` / `lead_intakes` / MoverOS code
is touched.

## Pipeline enforced

Data Source → Source Risk Classification → Prospect Normalization → Consent /
Contact Basis Check → Channel Eligibility Check → Human Approval Gate → Agent
Draft → Compliance Log → Action Ledger → Proof Event.

## Channel posture

- **Email, phone:** enabled but always behind human review.
- **SMS, WhatsApp, AI voice:** gated off by default until explicitly approved.
- **LinkedIn:** manual / human-review only — no automation.
- **AI drafts:** allowed, but human approval is required before sending.

## Demo surfaces (server components, seeded, read-only)

`/portal/settings`, `/portal/settings/data-sources`, `/portal/agent-economy`,
`/portal/proof`, `/discovery`.

## Local-first / demo limitations

- No live scraping, no enrichment API calls, no outreach sending.
- Stateless: pure functions over seeded fixtures; no persistence, no
  `localStorage`, no server actions, no new dependencies, no DB migrations.
- Suppression supremacy: unsubscribed / DNC / DNCL / do-not-contact block on all
  channels and override every other signal.

## Next production steps

1. Map demo fixtures onto the #93 canonical closer data layer (sources / runs /
   profiles / briefs in `@cognitia/db`) and, if a compliance/channel surface ever
   needs to be shared, add it to the #93 foundation (zod schemas) rather than
   re-introducing a parallel set of types in shared core.
2. Wire the human approval queue + action ledger writes via the existing
   `/approvals` surface rather than the demo pages.
3. Keep SMS/WhatsApp/AI-voice gated until each channel's legal pre-conditions and
   sign-off are met.

> Compliance checks support human review and auditability. They do not replace
> legal review.
