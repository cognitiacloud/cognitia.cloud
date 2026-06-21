# Client Zero — Build / Moat Reconciliation

**Doc type:** Reconciliation map (planning only — **NOT a build session**, no product code, no PR-state changes).
**Owner:** Worker 0 / Controller
**Compiled:** 2026-06-21
**Branch (this doc):** `claude/client-zero-build-reconciliation-4jfg14`
**`main` HEAD at compile:** `d3d198e` (the #96 compliance-layer-scaffold merge).
**Repo:** `cognitiacloud/cognitia.cloud`

## Purpose

Map the **new moat specs** (the Alta + Kite competitor matrix and the "Beat Alta
10x" dossier) onto the **already-ratified Client Zero build wave** (the 7-worker
W0–W7 spine), **without expanding scope**. This answers six questions:

1. Exact worker order.
2. File ownership.
3. Which moat specs are **docs-only** now.
4. Which moat specs **must be in the first happy path**.
5. Which moat specs **wait until after the pilot**.
6. Acceptance criteria for **"better than Alta/Kite"** that hold on the existing
   mock-only wave with **no new lanes**.

This doc **reconciles**; it does not redesign. Where it overlaps the companion
docs it **defers** to them and never contradicts them:

| Companion doc | Status | Authority over |
| --- | --- | --- |
| `docs/execution/client-zero-build-coordination.md` (#122) | in-flight branch | W1–W5 activation plan, ownership, reuse contracts, integration order |
| `docs/execution/client-zero-build-wave-control.md` (#134) | in-flight branch | the full 7-lane control surface (adds W6/W7), collision matrix, gates |
| `docs/execution/BOARD.md` / `WORKER-OWNERSHIP.md` (#117) | in-flight branch | verified PR ledger, parked/killed register, file-ownership principle |
| `docs/strategy/competitor-moat-matrix-alta-kite.md` (#130) | in-flight branch | the moat thesis (match / differ / surpass / no-go) |
| `docs/strategy/beat-alta-10x.md` | on `main` | the three compounding moats + HITL/flywheel research |
| `docs/reviews/pr-106-client-zero-review.md` (#115) | in-flight branch | #106 disposition + recommended pilot offer |
| `docs/reviews/global-execution-status-audit.md` (#118) | in-flight branch | what is done / pending; founder gates |

**Source tags:** `VERIFIED` = confirmed on `main` (`d3d198e`) or via GitHub API this
session · `INFERRED` = derived from the companion docs above · `RECOMMENDED` =
controller recommendation, pending manager ratification.

---

## 0. Scope guards inherited (do not relax) `INFERRED`

This reconciliation lives or dies by **not** turning a strategy dossier into a
scope balloon. The following are restated from #130 §6, #134 §11, and #117/DECISIONS:

- **One workflow, proven deeply, before any breadth.** Client Zero = the Sales
  Closer lead→booking loop. No second vertical, no MoverOS, no agent suite.
- **Mock-only wave.** No live outreach (SMS/calls/WhatsApp/LinkedIn/ads/vendor),
  no real prospect data, no live CRM/calendar writes. CRM writeback is mock-backed.
  #99 Apify stays **QUEUED**; ingestion runs on synthetic fixtures only.
- **No-go list is binding** (#130 §6): no token, no payment rail, no CRM clone, no
  avatar/video pivot, no enterprise-trust theater, no broad multi-agent suite.
- **Cognitia = trust / control / proof plane.** Hermes Vision is one supporting
  publish-safety artifact, frozen this wave.
- **Parked stays parked:** Agent-Economy, token-lab, crypto-visibility get no worker.
- **Enforcement gap is real** (#115): #106 asserts control-plane enforcement in
  prose; this wave is where it becomes **code-enforced**, not where it is re-asserted.

> The whole point of the moat is **focus**. Every "pull it forward" temptation
> below is answered against this list first.

---

## 1. The moat-spec register `INFERRED`

Stable IDs extracted from #130 (Alta/Kite matrix) and `beat-alta-10x.md`. Each is
classified **Match** (table-stakes), **Differ** (deliberate divergence), or
**Surpass** (the wedge neither incumbent owns end-to-end).

| ID | Moat spec | Class | Source |
| --- | --- | --- | --- |
| **MS-1** | Proof-first execution — every action emits verifiable evidence of *what was done, under whose authority, with what result*, as a default property of the action | Differ | #130 §4–5 |
| **MS-2** | **The wedge:** one linked, verifiable artifact binding **authorization → execution → outcome** on a real revenue workflow | Surpass | #130 §5 |
| **MS-3** | Permissioned agent authority as a reusable control plane (scoped, bounded delegation) | Differ / Match | #130 §3–4 |
| **MS-4** | Receipts / native audit trail on every action (not a bolt-on log) | Match | #130 §3 |
| **MS-5** | Approval-decision flywheel — every approve/reject/edit + **mandatory reason** captured as labeled data | Differ | beat-alta L-B |
| **MS-6** | Earned / graduated autonomy (`manual → batch-approve → notify-only`, threshold-gated, never default) | Differ | beat-alta L-B |
| **MS-7** | Evidence-or-block proposals — no ungrounded claim can persist (`verified_fact ⇒ evidence_ref`) | Differ | beat-alta L-B; #93/#97 |
| **MS-8** | Decision provenance in-CRM — run-id, evidence summary, approval-chain link stamped on the record | Differ | beat-alta L-G |
| **MS-9** | Published trust benchmarks / customer-visible trust dashboard backed by eval records | Surpass | beat-alta L-B/C |
| **MS-10** | Anti-rubber-stamping — required reasons, canary injections, tiered review SLAs, batch review | Match+ | beat-alta L-C |
| **MS-11** | Multi-channel execution surface (channels as pluggable targets the proof plane wraps) | Match | #130 §3 |
| **MS-12** | RevOps signal & routing (consumed/emitted as evidence in the proof loop) | Match | #130 §3 |
| **MS-13** | Enterprise-grade posture **earned by proof**, never trust theater (RLS, redaction, ledger, no-PII) | Match | #130 §3,6 |

**No-go (NG):** token, payment rail, CRM clone, avatar/video, trust theater, broad
multi-agent suite. These are **constraints**, not specs to build (#130 §6).

---

## 2. Question 1 — Exact worker order `RECOMMENDED`

**Unchanged from #134 §8.** The moat specs add **no new lanes** and do **not**
reorder the wave; they are carried *inside* the existing W0–W7 lanes. The order
below is the canonical build order, annotated with the moat each step realizes.

```
 lead in ─▶ consent/compliance ─▶ human approval ─▶ booking + mock CRM ─▶ proof report
    W1            W2 (Gate A)         W3 (Gate B)        W4 (mock only)         W5
                                   [authorization]      [execution]        [outcome + proof]

 W6 Signal Bus / Action Ledger — immutable event + ledger entry per transition (proof substrate)
 W7 Enterprise Hardening       — RLS, redaction, secrets, closer-lane CI guards (active throughout)
```

| Step | Lane | Stage | Moat specs carried |
| --- | --- | --- | --- |
| **0a** | **W7** | Guard scaffold lands first — closer-lane CI so every later PR is checked | MS-13, MS-7 (evidence/PII guards) |
| **0b** | **W6** | Substrate lands next — register closer event schemas + append-only ledger read-model | **MS-1, MS-4** (proof-first + receipts substrate); MS-12 (signal) |
| **1** | **W1** | Lead intake (schemas + synthetic fixtures) | MS-7 (PII-safe normalization) |
| **2** | **W2** | Consent / compliance gate (Gate A → `compliance_log`) | MS-13, MS-3 (authority precondition) |
| **3** | **W3** | Human approval (Gate B) | **MS-5** (capture decision+reason), MS-3 (authority binding) |
| **4** | **W4** | Booking + **mock** CRM writeback | **MS-8** (provenance stamp, mock), MS-11 (single channel only) |
| **5** | **W5** | Proof report (evidence-tagged; reads W6 ledger) | **MS-1, MS-2, MS-7** (the linked proof artifact) |
| **6** | **W7** | Hardening pass — closer-scoped RLS/guard tests across the assembled spine | MS-13 |
| **7** | **W0** | Integration — append the five new schema modules to the barrel in landing order; full guard suite; open `claude/cz-wave-integration` draft PR | MS-2 (end-to-end linkage proven) |

**Gates before step 0a (from #134 §8, unchanged):** (a) review-gate clear,
(b) named legal/compliance sign-off owner [#117 B3 — still open], (c) canonical
lead-detail lane ratified [#117 B4/T4], (d) explicit manager "go". The moat work
does **not** unblock any of these; they remain founder/manager decisions (#118 §9).

---

## 3. Question 2 — File ownership `RECOMMENDED`

**Unchanged from #134 §6.** The moat specs introduce **no new files or prefixes**;
each is carried by the lane that already owns the relevant prefix. Reproduced here
with the moat each lane is accountable for. **Principle (inherited):** the merged
spine is read-only to all workers; extend only via new files; one worker owns one
prefix; no two workers write the same file; the barrel is W0-only.

| Path prefix (writer-owned) | Writer | Moat spec(s) this lane owns |
| --- | --- | --- |
| `apps/api/src/closer/intake/**`, `schemas/closerLead.ts` | **W1** | MS-7 |
| `apps/api/src/closer/compliance/**`, `schemas/complianceLog.ts` | **W2** | MS-13, MS-3 (consent precondition) |
| `apps/api/src/closer/approval/**`, `apps/web/src/app/(closer)/approvals/**` | **W3** | **MS-5**, MS-3 (authority), MS-10 (required-reason only) |
| `apps/api/src/closer/booking/**`, `closer/crm/mockWriteback.ts`, `schemas/closerAppointment.ts` | **W4** | **MS-8** (mock), MS-11 (one channel) |
| `apps/api/src/closer/proof/**`, `apps/web/src/app/(closer)/proof/**`, `schemas/closerProof.ts` | **W5** | **MS-1, MS-2, MS-7** |
| `apps/api/src/closer/signal/**`, `schemas/closerSignal.ts` | **W6** | **MS-1, MS-4**, MS-12 |
| `.github/workflows/closer-guards.yml`, `scripts/closer/**`, closer `*.rls.test.ts`/`*.guard.test.ts` | **W7** | MS-13, MS-7 (enforcement) |
| `packages/core/src/schemas/index.ts` (barrel) | **W0 only** | MS-2 (linkage at integration) |
| **Landed spine** (`closer.ts`, `types/index.ts`, `events/**`, `ActionLedger`, `crmNote.ts`/`crmExecute.ts`, RLS, redaction, migrations) | **nobody** | reuse by import only |
| `hermes/**` | **nobody this wave** | reference only |

**Reuse, do not re-implement (the moat is built on landed primitives, not new ones):**

- **MS-1/MS-4 (proof + receipts)** reuse the landed immutable `events` +
  `ActionLedger` + `audit_events`. W6 adds **only** a closer-scoped projection; it
  must not mutate any landed event schema or migration. `VERIFIED` these exist on
  `main`.
- **MS-7 (evidence-or-block)** reuses `evidenceTag` / `closerClaim` (`schemas/trust.ts`)
  and the `verified_fact ⇒ evidence_ref` rule already in #93. No new doctrine.
- **MS-3/MS-5 (authority + approval capture)** reuse `ApprovalStatus` /
  `agent_actions` / `/approvals` (#93) and the operator queue (#78). W3 adds the
  rationale field on top; it does not build a new approvals system.
- **MS-8 (provenance)** reuses the HubSpot adapter **interface** (#77) but
  **mock-backed** — the provenance fields are stamped on the mock record only.
- **MS-13 (posture)** reuses landed RLS `withTenant`/`SET LOCAL`, the redaction
  helper, `SecretStore`. W7 adds closer-scoped tests + CI; it does not fork them.

> Net: zero new lanes, zero new owned prefixes, zero spine rewrites. The moat is a
> **framing and an acceptance bar** over the wave already ratified in #122/#134.

---

## 4. Question 3 — Docs-only now `RECOMMENDED`

These moat specs are **kept as written policy / strategy only** this wave. They are
not built now — either because they are customer-facing (and #130 §6 forbids trust
theater ahead of real proof), or because they are explicit post-pilot horizons in
#130 §8, or because implementing them now would expand scope.

| Spec | Why docs-only now | Where it lives now |
| --- | --- | --- |
| **MS-6** Graduated autonomy ladder | Pilot is **manual-approval-only** (human-in-the-loop default). The ladder needs accumulated flywheel data; turning it on now both expands scope and contradicts the "earned, never default" principle. Define the ladder + thresholds in docs; ship none of it. | `beat-alta-10x.md` L-B |
| **MS-9** Published trust dashboard | Customer-visible benchmarks ahead of real proof = the exact "trust theater" #130 §6 bans. The metrics (approval rate, evidence coverage, zero-duplication, reviewer latency) are **specified** now; the **internal** proof record (W5) is the only proof surface built this wave. | beat-alta L-B/C; #130 §6 |
| **MS-10** Canary / batch / tiered review console | The required-reason slice is in the first happy path (via MS-5). Canary injections, batch review, and tiered SLAs are **console depth** = post-UI work, not the lead→booking spine. Patterns documented; not built. | beat-alta L-C |
| **MS-11** Multi-channel surface | The pilot is a **single channel** (after-hours AI intake / one-inbox, per #115 §7). "Channels as pluggable proof-wrapped targets" is the design stance; live multi-channel is post-pilot. | #130 §3; #115 §7 |
| **MS-3** *Reusable* scoped-session control layer | The first happy path captures authority via existing approval/`agent_actions` (W3/W6). Generalizing it into a reusable permissioned-authority **product** is the explicit 12-month horizon. | #130 §8 (12-mo) |
| **Both strategy docs themselves** (#130, beat-alta) | Strategy artifacts, not implementation specs. They inform sequencing; they ship nothing. | as-is |
| **All NG items** | token / payment rail / CRM clone / avatar-video / trust theater / agent suite — **never built**; documented as constraints. | #130 §6 |

---

## 5. Question 4 — Must be in the first happy path `RECOMMENDED`

These moat specs are **non-negotiable for the wave to count as a moat** rather than
a generic closer. Each is achievable inside an existing lane's existing acceptance
(#134 §9) — i.e. **no scope expansion**, only sharpened framing.

| Spec | Lane | What "in the happy path" concretely means (mock-only) |
| --- | --- | --- |
| **MS-1** Proof-first execution | W6 + W5 | Every stage transition (W1→W5) emits exactly one immutable event + ledger entry **before** the next stage runs — proof is a *default property*, not an after-report. |
| **MS-2** The linked artifact (auth→exec→outcome) | W5 (reads W6) | The single proof record references, as one linked chain: the **authorization** (W3 approval id + approver + rationale), the **execution** (W4 booking + mock-CRM id), and the **outcome** (booking result). Reconstructable from the W6 ledger alone. **This is the wedge — it is the reason to do the wave at all.** |
| **MS-4** Native receipts | W6 | Append-only ledger entry per transition; order preserved; refs/hashes only. Reused from landed `ActionLedger`, not new. |
| **MS-5** Decision capture (flywheel substrate) | W3 | Every Gate-B approve/reject records **decision + mandatory reason at approval time** as structured data (#134 W3 acceptance already requires rationale-at-approval-time). The *learning loop* waits (MS-6); the **capture** ships now so the dataset compounds from day one. |
| **MS-7** Evidence-or-block | W5 + W7 | Every `verified_fact` in the proof record carries an `evidence_ref`; W7 CI fails the build on a fabricated/ungrounded claim. Directly answers the 11x-style fabrication failure mode. |
| **MS-8** Provenance stamp (mock) | W4 | The **mock** CRM writeback record carries run-id + evidence summary + approval-chain link. Live HubSpot property mapping waits; the *shape* ships now so it is provable. |
| **MS-12** Signal substrate | W6 | Stage transitions are emitted as taxonomy-named events (`signal.closer.*.v1`) — the RevOps-signal substrate. The routing/orchestration *product* waits. |
| **MS-13** Earned posture | W7 | RLS/tenant isolation, no-PII-in-logs redaction, secrets-via-SecretStore, closer-lane CI guards — all green. Posture is **enforced**, closing the #115 "asserted-not-proven" gap. |

> Read: the first happy path is exactly the #134 wave-exit criterion — *one
> synthetic lead flows lead-in → Gate A → Gate B → mock booking + mock CRM → proof
> report, every transition in the append-only ledger, zero egress* — **plus** the
> requirement that the proof report be the **single linked auth→exec→outcome
> artifact** (MS-2). That single addition is what makes it a moat, and it costs no
> new lane.

---

## 6. Question 5 — Wait until after the pilot `RECOMMENDED`

Deferred to a later, explicitly-authorized wave (most map to #130 §8's 12-/24-month
horizons). Deferring these is **how scope stays honest**.

| Spec | Deferred because | Earliest horizon |
| --- | --- | --- |
| **MS-6** Graduated autonomy (`manual→batch→notify-only`) | Needs accumulated MS-5 flywheel data + per-segment scorecards; pilot must stay manual-only. | post-pilot (12-mo) |
| **MS-9** Published / customer-visible trust dashboard | Requires real accumulated eval records; shipping earlier = trust theater (#130 §6). | post-pilot |
| **MS-10** Canary injections, batch review, tiered SLAs | Console depth beyond the lead→booking spine; not part of the proof loop. | post-pilot (console) |
| **MS-11** Live multi-channel execution | Pilot is one channel; live channels need the named legal owner + real consent (#118 §9). | post-pilot (12-mo) |
| **MS-3** Reusable permissioned-authority control layer | First happy path proves authority on **one** workflow; generalizing it is the 12-mo goal. | 12-mo (#130 §8) |
| **MS-8** *Live* CRM provenance write | Mock provenance ships now; live HubSpot property write needs legal owner + real account. | post-pilot |
| **MS-12** RevOps routing/orchestration product | Signal substrate ships now; routing as a product is parity work for 12-mo. | 12-mo (#130 §8) |
| **"Proof plane others plug into"** | The 24-mo network position; depends entirely on the accumulated single-workflow track record proving out first. | 24-mo (#130 §8) |

**Hard gates that must clear before any of the above** (from #118 §9 / #117 §5):
named legal/compliance sign-off owner (B3), confirmed real consenting dealership +
pilot offer/price (B5), ratified file ownership. None are unblocked by this doc.

---

## 7. Question 6 — Acceptance criteria for "better than Alta/Kite" `RECOMMENDED`

The bar is deliberately **provable on the existing mock-only 7-worker wave** — no
new lanes, no live surface, no scope expansion. Each criterion names the incumbent
weakness it beats and the lane + evidence that proves it. All are checkable at
wave-exit with synthetic fixtures and zero network egress.

| ID | "Better than" criterion | Beats | Lane | Proof (mock-only) |
| --- | --- | --- | --- | --- |
| **AK-1** | Every closer action produces a receipt **bound to a revenue-workflow outcome** (a booking), not merely a session/transaction. | **Kite** — receipts tied to sessions/payments, not revenue outcomes | W5←W6 | Proof record links the W4 booking outcome to its receipt; reconstructable from the ledger alone. |
| **AK-2** | Authorization context **and** outcome are bound to the action in **one artifact**, not scattered across a CRM and a separate trust page. | **Alta** — action logging with trust as a separate enterprise-assurance posture | W5 | One proof record carries authorization ref (W3 approval id + approver + rationale) + execution ref (W4) + outcome — a single linked chain. |
| **AK-3** | Proof is a **default property** of every action — emitted on every transition, never an optional report. | both — logging/receipts as bolt-ons | W6 + W7 | No stage transition can occur without a W6 event + ledger entry; W7 CI guard fails the build otherwise. |
| **AK-4** | **No ungrounded claim can persist** — every verified fact carries machine-checked evidence. | the category's fabrication failures (e.g. 11x) | W5 + W7 | `verified_fact ⇒ evidence_ref` enforced; W7 guard rejects a fabricated claim in CI. |
| **AK-5** | Decision provenance is **visible where the buyer works** (run-id + evidence summary + approval-chain link on the CRM record). | **Alta** + HubSpot Breeze black box | W4 (mock) | Mock CRM writeback record carries the provenance fields; shape is proven now, live write deferred. |
| **AK-6** | Human judgment is **captured as structured labeled data from day one** (decision + mandatory reason), seeding a flywheel autopilot-first tools don't harvest. | **Alta / 11x** autopilot-forward architecture | W3 | Every Gate-B decision persists decision + reason; dataset accrues even though the learning loop (MS-6) is deferred. |
| **AK-7** | Enterprise posture is **enforced by CI**, not asserted by a badge. | enterprise-trust theater | W7 | RLS/tenant-isolation + no-PII redaction + secrets + banned-term/live-adapter/fixture-PII guards all green; closes the #115 "asserted-not-proven" gap. |

**Wave-exit "better-than" gate (all must hold, with zero network egress, fixtures only):**

> One synthetic lead flows **lead-in → Gate A → Gate B → mock booking + mock CRM
> write → proof report**, and the resulting **single proof record links
> authorization → execution → outcome** (AK-2), is **reconstructable from the
> append-only ledger alone** (AK-1/AK-3), contains **no claim without an
> evidence_ref** (AK-4), carries **provenance fields on the mock CRM record**
> (AK-5), with **every approval decision + reason captured** (AK-6) and **all W7
> posture guards green** (AK-7).

**Why this is "better than" without expanding scope:** every criterion is a
*sharper acceptance bar on a worker the wave already has*, not a new capability.
Alta owns the actions surface; Kite owns the authority/receipts surface; **neither
binds authorization + execution + revenue outcome into one verifiable artifact on a
real workflow** (#130 §5). AK-1…AK-7 prove exactly that binding — on a mock-only
Sales Closer loop — which is the single wedge the matrix says compounds and no late
entrant can backfill. Breadth (channels, agents, autonomy, dashboards) is
explicitly **not** the bar and stays in §4/§6.

---

## 8. One-line reconciliation summary

> The moat specs **change no worker, no order, and no file ownership** in the
> ratified W0–W7 wave. They add exactly one binding requirement to the first happy
> path — **the proof record must be the single linked authorization→execution→
> outcome artifact (MS-2)** — and seven sharpened acceptance bars (AK-1…AK-7) that
> are all provable mock-only. Everything else in the dossier (graduated autonomy,
> published dashboards, multi-channel, reusable authority layer, RevOps routing) is
> **docs-only now or post-pilot**, and the no-go list (token, rail, CRM clone,
> media, theater, agent suite) is **never built**.

---

## 9. Change log

| Date | Author | Change |
| --- | --- | --- |
| 2026-06-21 | W0 / Controller | Initial reconciliation. Maps the #130 Alta/Kite matrix + `beat-alta-10x` moats onto the ratified W0–W7 wave (#122/#134): worker order and file ownership **unchanged**; classifies each MS as docs-only / first-happy-path / post-pilot; defines AK-1…AK-7 "better-than" acceptance on the mock-only wave. Docs-only; no product code; no PR-state changes. Branch fast-forwarded to `main` (`d3d198e`) for accurate paths. |
