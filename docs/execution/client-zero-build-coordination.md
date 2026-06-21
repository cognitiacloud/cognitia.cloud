# CLIENT ZERO BUILD COORDINATION — next controlled build wave

**Compiled:** 2026-06-21 · **Branch:** `claude/client-zero-build-coordination-q79oa8` ·
**Mode:** build controller (coordination doc only — **NOT a build session**). ·
**`main` HEAD at compile:** `d3d198e` (the #96 merge commit).

This document coordinates the **next** controlled build wave for the Client Zero Sales Closer
spine. It is the **activation companion** to `docs/execution/WORKER-OWNERSHIP.md` and
`docs/execution/BOARD.md`: the BOARD locks the *current* wave as review-only, and this doc
defines the build wave that follows once the review-gate clears.

**Target happy path:**

> lead in → consent/compliance gate → human approval → appointment booking / mock CRM writeback → proof report

## Hard rules (this wave inherits them; none are relaxed)

- **No PR-state actions:** no merge, undraft, close, retarget, archive, or delete — by the
  controller or any worker.
- **No live anything:** no live outreach, SMS, calls, WhatsApp, vendor calls, ads, or real
  prospect data. CRM writeback is **mock-only**.
- **No raw PII in fixtures.** Hash/mask/domain only (per `@cognitia/core` PII doctrine).
- **No public token / coin / liquidity / investment language**, anywhere.
- **Parked stays parked:** Agent-Economy, token-lab, crypto-visibility get no worker
  (DECISIONS §3–4; scope guardrail #19).
- **#99 Apify stays QUEUED** unless the manager explicitly approves. This wave runs on
  **synthetic fixtures** only.
- **Draft PRs only**, base `main`, each confined to its worker's path prefix.

## Posture — ASSIGNED BUT GATED (NOT active)

All five workers are **defined and assigned now**, but the wave **does not start** until **all**
of the following clear:

- **(a) Review-gate** (`BOARD.md` §8) is reviewed and the spine read-through is gap-free.
- **(b) Named legal/compliance sign-off owner** exists (blocker **B3**).
- **(c) Canonical lead-detail lane** ratified (blocker **B4** / task **T4** — picks one of
  #44/#45/#79/#46).
- **(d) Explicit manager "go".**

Until then this doc is a parked activation plan. Nothing here launches a build.

---

## 1. File ownership for the 5 build workers

**Ownership principle (inherited from `WORKER-OWNERSHIP.md`):** the merged spine is
**read-only to all workers**; extend only via **new files**; one worker owns one path prefix;
**no two workers write the same file**; a worker is "done" only when the full guard/doctrine
suite (PII, source-risk, evidence, Phase-1 containment) passes and its diff is confined to its
prefix. Cross-cutting changes route through the controller (W0).

| Worker | Happy-path stage | Writes ONLY (new files/prefixes) | Must NOT touch |
| --- | --- | --- | --- |
| **W1** | Lead intake (*lead in*) | `packages/core/src/schemas/closerLead.ts`; `apps/api/src/closer/intake/**`; synthetic fixtures `apps/api/src/closer/intake/__fixtures__/leads.synthetic.json` | `closer.ts`, `types/index.ts` unions, migrations `0020`/`0021` |
| **W2** | Consent / compliance gate | `packages/core/src/schemas/complianceLog.ts`; `apps/api/src/closer/compliance/**` | `apps/web/src/lib/complianceTypes.ts`, core unions, `closer.ts` |
| **W3** | Human approval | `apps/api/src/closer/approval/**`; `apps/web/src/app/(closer)/approvals/**` (new route group) | W2 files; existing `apps/web/src/app/approvals/**`; existing `apps/api/src/crm*.ts` |
| **W4** | Booking + mock CRM writeback | `packages/core/src/schemas/closerAppointment.ts`; `apps/api/src/closer/booking/**`; `apps/api/src/closer/crm/mockWriteback.ts` | live HubSpot creds/path; existing `apps/api/src/crmNote.ts` / `crmExecute.ts`; W3 files |
| **W5** | Proof report | `packages/core/src/schemas/closerProof.ts`; `apps/api/src/closer/proof/**`; `apps/web/src/app/(closer)/proof/**` (new route group) | finance/trade-in autonomy (handoff only, per #106); existing `apps/web/src/app/proofs/**` |

> **Note on existing surfaces.** `apps/web/src/app/` already ships `approvals/`, `proofs/`, and
> `discovery/`; `apps/api/src/` already ships `crmNote.ts` / `crmExecute.ts` (the governed CRM
> path). W3/W5 add a **new `(closer)` route group** and W4 a **new `closer/` API subtree** — they
> **reuse** these existing surfaces by import and **must not edit or fork** them.

**One shared file — controller-mediated.** The schema barrel
`packages/core/src/schemas/index.ts` (currently exports `common`/`event`/`agent`/`trust`/
`economy`/`closer`) must re-export the four new schema modules (`closerLead`, `complianceLog`,
`closerAppointment`, `closerProof`). To avoid a collision, **W0 (controller)** makes that single
edit, appending exports in **W1 → W5 order** as each worker lands.

---

## 2. Existing code / contracts each worker must reuse (do not re-implement)

The merged spine on `main` already provides the primitives. Workers **import and extend**; they
never re-implement or rewrite landed contracts.

- **W1 — Lead intake:** `normalizeGtmProspect`, `GtmProspect`, `RawGtmProspectInput`,
  `DataSource` (`packages/core/src/types/index.ts`, `packages/core/src/gtm/index.ts`);
  `closerSourceCreate`, `closerSourceRisk` (`packages/core/src/schemas/closer.ts`). **PII
  doctrine:** raw email/phone may transit `RawGtmProspectInput` only, are hashed/masked, and are
  **dropped** — never persisted; normalized output carries hash/mask/domain only.
- **W2 — Consent / compliance gate:** `canContactProspect`, `requiresHumanReviewForOutreach`,
  `GTM_OUTREACH_REQUIRES_HUMAN_APPROVAL` (`packages/core/src/gtm/index.ts`); `ConsentStatus` /
  `ContactBasis` unions (`types/index.ts`); `docs/compliance/compliance-system-spec.md`
  (`consent_basis`, append-only `compliance_log` shape, **Gate A** consent adjudication,
  channel rules — SMS/WhatsApp/AI-voice blocked at launch); **type-only** import of
  `apps/web/src/lib/complianceTypes.ts`.
- **W3 — Human approval:** `ApprovalStatus` / `ExecutionStatus` / `RiskLevel` (`types/index.ts`);
  `agent_actions` + `/approvals` primitives and RLS (#93); the operator **Approval Queue**
  surface (#78, Lane B); decision-rationale-at-approval-time (#23, WHY-1). Implements **Gate B**
  (a human promotes a draft to "approved to send").
- **W4 — Booking + mock CRM writeback:** meeting-skill booking (#75, Lane E); the governed
  `crm.note` path (`apps/api/src/crmNote.ts`, #26/#86); the HubSpot adapter **interface** (#77)
  but **mock-backed** (`crm/mockWriteback.ts`); the `EventDomain` taxonomy (`crm` / `calendar`)
  for append-only `events`.
- **W5 — Proof report:** proof registry + redaction scanner (#33); `evidenceTag` +
  `closerClaim` (a `verified_fact` claim **requires** `evidence_ref` — no fabricated facts) from
  `packages/core/src/schemas/trust.ts` and `closer.ts`; Trust/Proof Explorer surfaces
  (#59–#63); `hermes` `vision_privacy_scan` for publish-safety of any proof asset.

---

## 3. Conflicts / missing files

1. **Missing appointment & proof-report schemas.** `closer.ts` is Phase-1 only (sources, briefs,
   claims, scoring). There is **no booking or proof-report contract** yet. W4 and W5 must **add
   new schema files** (`closerAppointment.ts`, `closerProof.ts`) — append-only — and must **not**
   extend or rewrite `closer.ts`.
2. **Consent-vocabulary mismatch (real, must be adapted).** The compliance spec's `consent_basis`
   (`express_consent`, `implied_existing_business_relationship`,
   `implied_conspicuous_publication`, `business_to_business_relationship`,
   `manual_review_required`, `do_not_contact`) does **not** match the core `ConsentStatus`
   (`express`, `implied_possible`, `not_established`, `unsubscribed`, `do_not_contact`) or
   `ContactBasis`. **W2 owns a deterministic adapter map** between the two vocabularies and
   **rewrites neither** the merged unions nor the spec.
3. **Shared barrel collision.** `packages/core/src/schemas/index.ts` is the one file four workers
   would otherwise touch. **Controller-sequenced** (see §1); workers never edit it directly.
4. **#99 Apify Phase-2 stays QUEUED.** It is stacked on a merged base (blocker **B2**) and falls
   under the hard rule. **No Apify worker is in this wave**; ingestion is **synthetic fixtures**
   only (W1). Re-activating #99 requires explicit manager + named-legal sign-off (separate from
   this wave).
5. **Duplicate lead-detail lanes unresolved** (#44 / #45 / #79 / #46; blocker **B4** / task
   **T4**). W1 and W3 must **reconcile to the one canonical lane** the manager ratifies — they
   must **not** fork a new lead-detail console.
6. **Legal/compliance sign-off owner unnamed** (blocker **B3**). Until named, **all five workers
   stay simulated/mock** — no live channel, outreach, vendor call, or real CRM write — regardless
   of build progress.
7. **Client Zero consent unknown** (blocker **B5**). **Synthetic fixtures only**; no real
   dealership/prospect data and **no raw PII in fixtures**.
8. **Companion-doc consistency.** This wave must stay aligned with `WORKER-OWNERSHIP.md` (#117):
   spine read-only, new-file ownership, and **W6 goal-loop (#105) and W7 Apify (#99) parked**.
   Agent-Economy / token-lab / crypto-visibility remain parked (DECISIONS §3–4; scope
   guardrail #19).

---

## 4. Final branch / PR naming per worker

All PRs are **draft only**, base `main`, and confined to the worker's path prefix.

| Worker | Branch | Draft PR title |
| --- | --- | --- |
| **W1** | `claude/cz-w1-lead-intake` | `feat(closer): W1 lead intake — synthetic ingestion + normalization` |
| **W2** | `claude/cz-w2-consent-gate` | `feat(closer): W2 consent & compliance gate (CASL/PIPEDA, append-only log)` |
| **W3** | `claude/cz-w3-human-approval` | `feat(closer): W3 human approval gate (operator queue for closer briefs)` |
| **W4** | `claude/cz-w4-booking-crm-mock` | `feat(closer): W4 appointment booking + mock CRM writeback (no live vendor)` |
| **W5** | `claude/cz-w5-proof-report` | `feat(closer): W5 Client Zero proof report (evidence-tagged, redaction-scanned)` |
| **W0** | `claude/cz-wave-integration` | `chore(core): Client Zero wave barrel exports + integration` |

---

## 5. Integration order (after workers finish)

Sequential, mirroring the data flow and the existing activation order (W1 → W2 → W3 → W4).
**Each step lands only on green guard/doctrine CI.**

1. **W1 — lead intake** (schemas + synthetic fixtures). Foundation: nothing downstream exists
   without a normalized, PII-safe lead.
2. **W2 — consent/compliance gate.** Consumes the W1 lead shape; only compliant leads pass
   **Gate A**, with every decision written to the append-only `compliance_log`.
3. **W3 — human approval.** Consumes W2 output; **Gate B** lets a human promote a draft to
   approved. Nothing proceeds autonomously.
4. **W4 — booking + mock CRM writeback.** Runs **only** on W3-approved items; books via
   meeting-skill and writes to the **mock** CRM (never a live vendor).
5. **W5 — proof report.** Aggregates the W1–W4 run into an **evidence-tagged,
   redaction-scanned** proof record (`verified_fact` ⇒ `evidence_ref`).
6. **W0 — controller integration.** Appends the four new modules to
   `packages/core/src/schemas/index.ts` in W1 → W5 order, runs the full guard suite, and opens the
   `claude/cz-wave-integration` draft PR.

**Reminder:** steps 1–6 begin only after the §Posture gates (a)–(d) clear. #99 Apify remains
queued throughout.

---

### Appendix — verification basis (read-only, this session)

- Merged spine confirmed on `main` (`d3d198e`) via GitHub + local read-through: `closer.ts`,
  `types/index.ts`, `gtm/index.ts` (helper names verified), `schemas/trust.ts`,
  `schemas/index.ts` barrel, `apps/api/`, `apps/web/src/lib/complianceTypes.ts`,
  `docs/compliance/compliance-system-spec.md`.
- Existing web surfaces (`apps/web/src/app/approvals|proofs|discovery`) and API CRM path
  (`apps/api/src/crmNote.ts` / `crmExecute.ts`) confirmed present — reused, not forked.
- Cross-checked against `BOARD.md` (§5 blockers, §8 review-gate) and `WORKER-OWNERSHIP.md`
  (lane boundaries, parked lanes). No parked lane reactivated; #99 queued; draft-PR-only.
