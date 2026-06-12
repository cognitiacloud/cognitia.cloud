# Cognitia — V1 Operating Plan (Launch)

> Status: **authoritative scope decision.** Supersedes looser roadmap notes. Branch
> `claude/gtm-platform-mvp-setup-vYLBG`. Read before changing V1 scope.

---

## 0. SCOPE FENCE (non-negotiable)

These constraints are **hard**. Do not relax them without an explicit, written
decision that replaces this section.

1. **V1 channel = CRM write-back only** (HubSpot tasks/notes; stage-update behind approval).
2. **Email is a day-60+ capability only.** Not in V1. Not in any V1 exit criterion.
3. **`/webhooks/email` stays disabled in V1** (return 404; no unauthenticated inbound email surface).
4. **No V1 exit criterion may depend on** sending, inboxes, replies, deliverability, or suppression.
5. **The only V1 success loop is:**
   `HubSpot sync → Mira proposes action → human approves → HubSpot task/note executes → audit trail.`

If a ticket, demo, metric, or exit gate requires email/voice/replies to be "done,"
it is **out of V1 by definition** and must move to a later phase.

### 0a. FORBIDDEN THESIS PIVOTS (out of scope unless explicitly re-authorized)

The product thesis is fixed: **a CRM-first, approval-gated, governed GTM action
system.** The following adjacent product lines are **out of scope** and must not
shape the repo (no code, no migrations, no packages, no merged docs beyond a
clearly-labeled `spec` PR) unless the human **explicitly re-authorizes** them by
name in a written instruction:

- **Agent economy / marketplace** — agent registry, agent passport, skill
  registry, proof registry, reputation systems.
- **Token / crypto** — any token, token landing page, on-chain settlement,
  wallets, smart contracts.
- **Credits / escrow** as a product (even "simulated") outside the CRM action loop.
- **"Cognitia OS"** as a platform thesis distinct from the CRM-GTM action system.

Rule for handling such requests: if asked to _spec_ one, produce a clearly-labeled
**spec-only** artifact on its own branch and **do not merge it into base**; if
asked to _build_ one, treat it as a **product-direction fork** and confirm the
pivot in writing before any code lands. A 2026-06-10 agent-economy spec
(PR #18, branch `claude/agent-economy-2week-spec`) was an accidental pivot and
was reverted/closed without merging; base was never contaminated.

#### 0a-bis. RECORDED RE-AUTHORIZATION (2026-06-12) — Agent Economy Lab

On 2026-06-12 the owner **explicitly re-authorized, in writing**, an internal
**Agent Economy Lab** as a deliberate product-direction line (the rule above
requires this be recorded — this is that record, not an accidental pivot). The
re-authorization is **scoped and conditional**:

- **Internal only.** Visibility is internal/tenant/private; there is **no public
  marketplace, no public token/coin page, no DEX/liquidity/staking/yield, no
  price or return language, no exchange-listing or launch material.**
- **No real economic effect.** Internal credits only (Escrow Simulation); **no
  real payments, no token transfers, no production deploys, no production
  migrations.** Token status remains **disabled** and all token gates remain
  **NOT PASSED** (`docs/cognitia/crypto/TOKEN_GATES.md`).
- **Trust-gated.** Listings/matches move no credits or reputation by themselves;
  only completed, `verified_fact`-proven work does. Matches are `likely_inference`.

This carve-out covers AGENT-ECONOMY-001..004 (work orders, escrow simulation,
dispute resolution, agent-driven proposals, marketplace listings + matching),
built on the `claude/agent-economy-*` stack. It does **not** re-authorize a
public token, a public marketplace, or any on-chain settlement — those remain
forbidden until separately re-authorized with their own written record. The
CRM-first GTM action system remains the primary line; this lab is an explicitly
authorized parallel track, not a replacement.

---

## 1. Executive decision

- We build a **governed, auditable HubSpot action layer**: sync + score → propose →
  human-approve → execute CRM write-back → full audit trail.
- **V1 channel is CRM write-back, not email** — the only action shippable in ~30 days
  that is real, safe, and legal (no CAN-SPAM/deliverability surface).
- **Auth-derived tenancy is a hard gate before any customer data** (no trusted client headers).
- **Security is the wedge**: we _prove_ tenant isolation + zero-duplication in CI and
  publish it; competitors assert security, we demonstrate it.
- **SOC 2 program starts day 1**; Type 1 readiness is a paying-customer gate (Type 2
  window only _starts_ within 90 days — it cannot complete).
- **Target ICP:** B2B teams on HubSpot (MoverOS lead-gen as first design partner).

---

## 2. Out of Scope for V1

Explicitly **not** built, demoed, or sold in V1 (revisit per phase):

- **Email send / reply loop** (day-60+).
- **Voice / inbound calling** (TCPA legal project; deferred).
- **LinkedIn automation** (ToS / account-ban liability; deferred).
- **Paid ads** (Google/Meta; deferred).
- **Salesforce** (HubSpot-only V1).
- **Enrichment marketplace / third-party signal feeds.**
- **Autopilot execution** (human-in-the-loop is mandatory in V1; no auto-execute).

> **DNS/DKIM/DMARC + domain warmup:** noted only as **optional future pre-provisioning**
> for a possible day-60 email capability. It is **not V1 scope**, ships nothing
> user-facing, and carries **zero weight in V1 exit criteria**. May be deferred entirely.

---

## 3. V1 launch scope (first ~90 days)

- **Channel:** CRM write-back only (HubSpot tasks/notes; approval-gated stage update).
- **CRM:** HubSpot only.
- **Approval model:** human-in-the-loop mandatory for every side effect; the action
  ledger is the audit unit. No autopilot.
- **Auth:** OIDC/magic-link day 1 with **auth-derived tenant + RBAC**; SAML/SCIM pre-GA.
- **API surface:** existing endpoints on Kysely (Mira run, approval queue,
  approve/reject/execute, accounts/context, metrics, HubSpot ingest webhook).
  **`/webhooks/email` disabled.**
- **Observability:** PII-safe structured logs, `*.failed.v1` + sync_run dashboards,
  worker heartbeat, `/health` DB ping, audit-trail export.
- **Compliance boundary:** SOC 2 program engaged; DPA template; HubSpot data only;
  no consumer-PII enrichment; secrets in KMS; tenant isolation proven in CI.

---

## 4. Critical path & go-live gates

**Gate 0 — before ANY customer data:** auth-derived tenant + Kysely (API-1); RLS +
idempotency tests as CI release gates; secrets in KMS; audit log on; backups/PITR tested; DPA template.

**Gate 1 — V1 go-live (first CRM action):** real HubSpot side-effect adapter +
worker secret injection (CRM-1); approval console (UI-1); observability (OBS-1);
least-priv DB role; HubSpot idempotency property created in portal; kill switch
(`integration_connections.status='paused'`).

**Gate 2 — before first OUTBOUND EMAIL (day 60+, NOT V1):** ESP + SPF/DKIM/DMARC +
warmed domain; reply/bounce webhooks + signature verify (fail closed); suppression/consent + List-Unsubscribe.

**Gate 3 — before first paying customer:** SSO; audit export + retention; SOC 2
Type 1 readiness / audit engaged; incident runbook; published pricing.

Parallelizable: UI-1 ∥ CRM-1 (after API-1); compliance ∥ all eng.

---

## 5. Engineering backlog (true build sequence)

| #   | Ticket                                                                      | Owner fn                  | Deps                     | Acceptance                                                                                                                 | Risk | Effort |
| --- | --------------------------------------------------------------------------- | ------------------------- | ------------------------ | -------------------------------------------------------------------------------------------------------------------------- | ---- | ------ |
| 1   | **API-1** Prod API on Kysely + auth-derived tenant + RBAC                   | ENG-platform              | —                        | Forged `x-tenant-id` can't change scope; RLS+predicate enforced; `/health` pings DB; isolation test gates CI               | H    | 3d     |
| 2   | **CRM-1** HubSpot side-effect adapter wired + worker secret/token injection | ENG-integrations          | API-1; KMS; HubSpot prop | Approved task/note → exactly one HubSpot object (idempotent); emits `crm.task.created.v1`; worker syncs active connections | H    | 3d     |
| 3   | **UI-1** Approval-queue Next.js console                                     | ENG-web                   | API-1                    | Run Mira → review evidence → approve → execute (disabled until approved; 409 surfaced) drivable from screen                | M    | 5d     |
| 4   | **OBS-1** Observability + audit dashboards                                  | ENG-platform              | API-1                    | `*.failed.v1`/sync_run dashboards; worker heartbeat; PII-safe log assertion in CI                                          | M    | 2d     |
| 5   | **SEC-2** Audit-trail export + retention                                    | ENG-platform + COMPLIANCE | API-1                    | One-click full action/approval chain export per contact; retention enforced                                                | M    | 3d     |
| 6   | **CRM-2** Push rules + write-back depth (stage update, approval-gated)      | ENG-integrations          | CRM-1                    | Signal → proposed stage-update (approval required) → one idempotent write; `crm.*` events; `crm.push.failed.v1` on error   | M    | 4d     |
| 7   | **AUTH-2** SSO/SAML + SCIM (pre-GA)                                         | ENG-platform + SEC        | API-1                    | SAML login + role-gated actions + access-review export                                                                     | M    | 5d     |

**Day-60+ (NOT V1):** MAIL-1 (ESP send), MAIL-2 (reply/bounce webhooks + sig verify),
SUPP-1 (suppression/consent). **Stretch/pre-GA:** LEARN-1 (outcome capture → eval scorecards; needs labeled data).

---

## 6. SOC 2-ready control plan

- **Day 1:** auth-derived tenant + RBAC; RLS isolation proven in CI; secrets in KMS
  (rotation <90d, per-tenant refs); immutable audit log; TLS + at-rest encryption;
  PR review + CI gates; tested backups. _Evidence: policies, CI runs, KMS config, restore record._
- **Pre-beta:** SSO (OIDC min) + MFA; logging/alerting; sub-processor register + DPAs;
  incident runbook; retention + DSAR/deletion. _Evidence: configs, register, drill record._
- **Pre-GA:** SAML/SCIM + access reviews; pen test; SOC 2 **Type 1** + Type 2 window
  _started_; risk assessment; training records. _Evidence: auditor letter, pen-test report._
- **Evidence automation:** onboard Vanta/Drata day 1; wire CI + cloud + KMS + GitHub.

---

## 7. Product differentiation (publish-ready only)

| Publishable claim                              | Metric                                | Proof artifact                         |
| ---------------------------------------------- | ------------------------------------- | -------------------------------------- |
| Provable tenant isolation — tested every build | 0 cross-tenant reads                  | CI run of non-superuser RLS test       |
| Every action is auditable end to end           | 100% actions have full approval chain | one-click per-contact audit export     |
| Zero-duplication guarantee                     | 0 duplicate writes under replay       | idempotency test in CI                 |
| Human-approved by default                      | 100% side-effects approval-gated      | ledger policy + 409-on-unapproved test |
| Transparent pricing                            | published price                       | pricing page                           |

**Cut from launch claims** (unbacked / email-dependent): "no-hallucination outreach,"
reply-accuracy %, time-to-first-send, deliverability dashboard. Revisit when email exists.

---

## 8. 30/60/90 execution

- **Days 0–30 — Governed CRM action layer (private alpha, 1 partner).** Ship API-1,
  CRM-1, UI-1, OBS-1; compliance day-1 controls + Vanta. **Exit:** partner runs Mira →
  approves → HubSpot task created; isolation + idempotency green in CI; audit export works.
  _No send in exit criteria._
- **Days 31–60 — Trust + CRM depth (limited beta, 3–5 partners).** Ship SEC-2, CRM-2,
  AUTH-2 start; publish differentiation claims + pricing. **Exit:** stage-update loop
  (approval-gated) works; SSO for a partner; audit export GA.
- **Days 61–90 — Launch-ready + (optional) email kickoff.** SOC 2 Type 1 complete +
  Type 2 window started; pen test booked; first paying customer on the CRM-action loop.
  Email (MAIL-\*) may _begin_ here as a **separate** track behind Gate 2 — never a V1 dependency.

---

## 9. Current branch reality (as of HEAD 116a2c4)

What already exists (so the fence is grounded, not aspirational):

- Postgres/Kysely repository (PGlite-contract-tested) + RLS proven under a non-superuser role.
- HubSpot **read sync** (companies/contacts/deals) + per-tenant OAuth token provider + encrypted secret store.
- HubSpot **side-effect adapter delegates to a client** but defaults to an in-memory fake — **CRM-1 wires the real client + worker secrets** (the V1 product action).
- Mira v1 propose loop + action ledger + approval endpoints + policy gate (human-in-the-loop).
- Approval queue exists as **API client + view-model only** — **UI-1 mounts the Next.js page.**
- HubSpot ingest webhook is signature-verified and fails closed. **No email webhook exists** — consistent with the fence (keep it absent/disabled).
- API still composes the in-memory repo via `buildHandlers()` — **API-1 swaps to Kysely + auth-derived tenant.**

No conflicts with the fence: nothing in the branch sends email, exposes an email
webhook, or auto-executes without approval.
