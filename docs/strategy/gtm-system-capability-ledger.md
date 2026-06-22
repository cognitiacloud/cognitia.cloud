# GTM System Capability Ledger

> **Status banner:** **GREENFIELD BLUEPRINT / SPEC.** As of 2026-06-22 the repo contains
> only `hermes/skills/`. This ledger records, per capability, the Alta-class bar, the
> Cognitia differentiator, the **honest current status**, what would prove it, and the
> blocker. Because the repo is nearly empty, **almost every status is `PLANNED`**. Nothing
> here is a production-readiness claim, and nothing authorizes a live action.
>
> **Status legend:** `REAL` = exists & verifiable today · `SANDBOX` = exists only in the
> `budget_wheels_demo` / Tenant Zero sandbox · `PLANNED` = designed, not built ·
> `MOCK` = fixture/stub only.
>
> **Guardrails:** No live channels, outreach, CRM sync, or vendor APIs. Synthetic data
> only (`.example` / `.test` / `.invalid`, `555-01xx`). Only tenant: `budget_wheels_demo`.

See the narrative in [`alta-superiority-system.md`](./alta-superiority-system.md) and the
sequencing in [`gtm-system-90-day-build-map.md`](./gtm-system-90-day-build-map.md).

---

## A. Alta-class core capabilities

| Capability | Alta-class expectation | Cognitia differentiator | Current status | What proves it | Blocker |
|---|---|---|---|---|---|
| Outbound agent — list building | Autonomous target-list construction from data sources | Consent-gated list build; every contact carries a consent record before it can enter a sequence | `PLANNED` | Sandbox run over synthetic contacts producing a list where each entry has a consent-basis field and a ledger entry | B2 |
| Outbound agent — research/personalization | Auto-research accounts/contacts, draft personalized copy | Every personalization claim carries source + retrieval-time provenance; unsupported claims blocked | `PLANNED` | Draft artifact whose every claim links to a provenance record; claims without sources are flagged | — |
| Outbound agent — sequencing | Multi-step branching sequences with auto follow-ups | Sequences are dry-run only; each step emits a draft + ledger entry, never a live send | `PLANNED` | Dry-run sequence trace in ledger; no network egress to channels | B5 |
| Outbound agent — sending | Autonomous multi-channel send | **Deliberately not built**; send is legal-gated and requires human approval per artifact | `PLANNED` (intentionally unbuilt) | Absence of any send path in code + approval-required gate test | B1, B3, B5 |
| Inbound agent — triage | Always-on reply/form/chat triage & qualification | Triage decisions logged with provenance; routing to human on exception is the default, not the fallback | `PLANNED` | Sandbox inbound fixture triaged with a logged decision + reason | B2 |
| Inbound agent — meeting booking | Auto-books meetings on qualified intent | Booking proposed as an approved action with a proof receipt; no calendar write without approval | `PLANNED` | Dry-run booking proposal artifact + approval record | B3, B5 |
| Revenue intelligence — scoring | Pipeline/deal scoring & risk signals | Scores are trust-weighted: only consented, proven activity contributes | `PLANNED` | Score computed over sandbox data showing verified vs unverified contribution split | B4 |
| Revenue intelligence — next best action | Recommends rep next actions | Recommendations carry provenance and route through the approval/consent gates | `PLANNED` | NBA recommendation artifact with provenance + gate references | — |
| Workflows | Branching trigger→condition→action automations | Every workflow node emits a ledger entry; channel-bound nodes are dry-run/approval-gated | `PLANNED` | Sandbox workflow execution trace with per-node ledger entries | B5 |
| CRM sync | Bi-directional near-real-time CRM sync | One-way **MOCK** CRM read in sandbox; writes are dry-run proposals with receipts, never live | `MOCK` | MOCK CRM fixture loaded; proposed writes shown as receipts, not applied | B4 |
| Data sources / enrichment | Built-in contact/firmographic/intent enrichment | Enrichment results tagged with source + freshness; no real vendor API calls | `PLANNED` | Enrichment over synthetic contacts using MOCK provider with provenance tags | — |
| Analytics | Sequence/reply/meeting dashboards & attribution | Trust-weighted analytics separating verified from unverified performance | `PLANNED` | Sandbox dashboard rendering verified/unverified segmentation | — |
| Enterprise controls — auth | SSO + RBAC | RBAC scoped so approval rights are a distinct, audited role | `PLANNED` | Role model doc + sandbox enforcement test on approval action | — |
| Enterprise controls — audit | Audit logging | Append-only, hash-chained action ledger (stronger than activity log) | `PLANNED` | Ledger with verifiable hash chain over a sandbox session | — |
| Enterprise controls — data governance | Residency, retention, suppression/opt-out | Consent gate + retention policy enforced at the action precondition | `PLANNED` | Retention/consent policy config enforced in sandbox dry-run | B1 |
| Enterprise controls — deliverability | Sending-domain & opt-out management | Not applicable until live; opt-out modeled as a consent-revocation event | `PLANNED` | Consent-revocation event blocks a previously-allowed sandbox action | B1, B5 |

---

## B. Cognitia superiority layer (the moat)

| Capability | Alta-class expectation | Cognitia differentiator | Current status | What proves it | Blocker |
|---|---|---|---|---|---|
| Consent gate | Suppression list / opt-out checkbox | Hard precondition: no consent record → action cannot leave draft state | `PLANNED` | Sandbox test where a no-consent synthetic contact cannot be advanced past draft | B2 |
| Human approval | Optional review step (often bypassed) | Mandatory, logged approval per channel-bound artifact; auto-send unbuildable | `PLANNED` | Approval record (approver, time, exact artifact) gating a sandbox dry-run | — |
| Action ledger | Activity timeline | Append-only, hash-chained, tamper-evident event log | `PLANNED` | Hash-chain verification passing; injected tamper detected | — |
| Proof receipt | Per-message status | Self-contained receipt: what/whom/consent/approver/artifacts/ledger anchor | `PLANNED` | Receipt generated for a sandbox action and independently re-verified | — |
| Dispute / replay pack | Support ticket + screenshots | Ordered ledger slice + artifacts + deterministic re-run of decision logic | `PLANNED` | Replay pack for a sandbox action reproducing the same decision output | — |
| Claim provenance | Trust the model | Every claim tagged with source + retrieval time; unsupported claims blocked | `PLANNED` | Draft where each claim resolves to a source; a fabricated claim is rejected | — |
| Trust-weighted analytics | Volume/rate dashboards | Metrics weighted by trust state; verified vs unverified segregated | `PLANNED` | Dashboard showing a metric split by trust state over sandbox data | — |

---

## C. Foundational / platform capabilities (enable everything above)

| Capability | Alta-class expectation | Cognitia differentiator | Current status | What proves it | Blocker |
|---|---|---|---|---|---|
| Tenant model | Multi-tenant SaaS | Single sandbox tenant `budget_wheels_demo` (Tenant Zero) until governance clears | `SANDBOX` (planned) | Tenant Zero config present; no second tenant | B1, B3 |
| Synthetic data fixtures | Real data from day one | Synthetic-only fixtures (`.example`, `555-01xx`) gate real PII out by construction | `PLANNED` | Fixture set loads; a real-domain contact is rejected by validation | — |
| Dry-run execution engine | Live execution | Execution that produces artifacts + ledger entries with zero channel egress | `PLANNED` | Dry-run produces full trace; network egress to channels is absent/blocked | B5 |
| Existing repo asset (`hermes/skills/`) | — | Pre-existing skills scaffold in repo | `REAL` | Directory exists at `hermes/skills/` | — |

---

## D. Ledger summary

| Status | Count (this ledger) | Meaning |
|---|---|---|
| `REAL` | 1 | Only the pre-existing `hermes/skills/` directory |
| `SANDBOX` | 1 | Tenant Zero model (planned config, sandbox-only) |
| `MOCK` | 1 | CRM sync via MOCK fixtures, dry-run writes only |
| `PLANNED` | 23 | Everything else — designed, not built |

**Honest read:** the platform is overwhelmingly `PLANNED`. This is why the parity score is
**34/100**, not higher. The build map converts this ledger into a sequenced path to 80+.
