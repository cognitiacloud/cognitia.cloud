# 12-Month Moat Roadmap

**Status legend:** REAL · SANDBOX · PLANNED · MOCK · PARKED.

**Repo reality check (2026-06-22):** Greenfield (`hermes/` only). This is a **PLANNED** R&D roadmap. Dates are relative quarters (Q1 = first quarter of execution), not commitments. Nothing here is built. No payments, identity, wallet, token, or chain work appears in build scope — those remain **PARKED** per `agent-commerce-readiness.md`. No production-readiness is claimed.

**Moat tags:** each deliverable notes which moat it deepens — **[Proof]**, **[Consent]**, **[Reputation]**, **[Replay]** (see `future-proofing-rd-map.md` §3).

**Build-mode tags:** **(build-now)** small verifiable code in sandbox · **(spec)** docs/design only · **(parked)** deferred behind a gate.

---

## Roadmap at a glance

| Quarter | Theme | Primary moat |
|---|---|---|
| Q1 | Foundations: receipts + consent gate | Proof, Consent |
| Q2 | Replay + disputability | Replay, Proof |
| Q3 | TrustOps analytics + reputation seed | Reputation, Consent |
| Q4 | Vertical replication + enterprise posture | All four; sets up gated unpark decision |

---

## Q1 — Foundations: proof receipts & consent gates

**Theme:** Make every sandboxed action provable and authorized. This is the bedrock the other three quarters stand on.

**Deliverables**
- **Proof receipt schema v0** — (build-now) **[Proof]** — schema + local validator over MOCK/`.example` data. No external signer, no chain.
- **Consent gate primitive** — (build-now) **[Consent]** — pre-action check against a sandbox authorization record; decision logged.
- **TrustOps event log v0** — (build-now) **[Proof][Consent]** — structured local log of actions and gate outcomes. No PII; synthetic data only.
- **Authorization-protocol landscape survey** — (spec) **[Consent]** — describe categories; draft the neutral *verification interface* shape.
- **Boundary/PARKED contract ratified** — (spec) — confirm banned scope and hype language from `agent-commerce-readiness.md` §4.

**Gate to exit Q1**
- Receipt schema validates ≥3 distinct sandbox action types end-to-end.
- Consent gate blocks an out-of-scope action in a test and logs the decision.
- Bet B1 (buyers value receipts) has at least one passing cheap validation (mockup interview).

**Dependencies**
- None upstream. Q1 unblocks everything.

**Kill / park criteria**
- If B1 and B3 both fail (no one values receipts or consent), **pause** the build track and revert to spec-only re-evaluation before Q2.

---

## Q2 — Replay & disputability

**Theme:** Turn recorded actions into deterministically re-runnable evidence, and package disputes as portable artifacts.

**Deliverables**
- **Replay harness v0** — (build-now) **[Replay]** — re-execute a recorded run against captured fixtures; assert same outcome. Sandbox data only; no live third-party re-execution.
- **Inputs digest + capture** — (build-now) **[Replay][Proof]** — receipts reference an inputs digest sufficient for replay.
- **Dispute/replay pack exporter** — (build-now) **[Replay][Proof]** — bundle receipt + inputs + replay script into a portable, offline-inspectable artifact.
- **Replay fidelity report** — (spec) **[Replay]** — document how fidelity is measured and what breaks determinism.
- **Compliance-native workflow template (vertical A, draft)** — (spec) **[Consent]** — disclosure/retention/consent mapping for one target vertical.

**Gate to exit Q2**
- A recorded run replays to an identical outcome against fixtures (fidelity demonstrated).
- A dispute/replay pack can be exported and re-inspected without the original system.
- Bet B2 (replay reduces dispute cost) passes a tabletop exercise.

**Dependencies**
- Requires Q1 receipt schema and event log.

**Kill / park criteria**
- If replay cannot achieve deterministic fidelity on realistic sandbox workflows, **descope** replay to "evidence capture only" and flag for redesign rather than expanding scope.

---

## Q3 — TrustOps analytics & reputation seed

**Theme:** Make the accumulated evidence legible (analytics) and lay the *design* for reputation derived from proven, consented, undisputed actions.

**Deliverables**
- **TrustOps analytics layer v0** — (build-now) **[Consent][Proof]** — dashboards over the event log: gate pass rates, dispute frequency, replay success rate. Sandbox metrics only.
- **Reputation model spec** — (spec) **[Reputation]** — how a track-record signal would be *derived from* receipts + consent + dispute outcomes. Design only; no scoring shipped that implies real-world standing.
- **Authorization verification interface (spec → prototype stub)** — (spec, optionally build-now stub) **[Consent]** — check validity/scope of a delegated grant. Verification only; **no issuance, no holding** (PARKED boundary upheld).
- **Vertical SaaS replication playbook (draft)** — (spec) — how vertical A's templates become a starting point for vertical B.

**Gate to exit Q3**
- Analytics surface the three core metrics over a multi-run sandbox dataset.
- Reputation spec passes review against bet B5 (is track-record a credible buying signal?).
- Verification-interface conformance matrix (bet B7) shows a common shape across ≥2 landscape protocol categories — or is explicitly shelved if not.

**Dependencies**
- Requires Q1 (event log) and Q2 (dispute outcomes feed reputation/analytics).

**Kill / park criteria**
- If B5 fails (buyers ignore track record), **keep reputation as spec only**; do not build a scoring system.
- If B7 finds no common shape, **shelve** the verification interface; keep landscape survey as living docs.

---

## Q4 — Vertical replication & enterprise posture

**Theme:** Prove the playbook transfers to a second vertical and assemble the payment-free enterprise-readiness story. Set up — but do not cross — the gated unpark decision.

**Deliverables**
- **Vertical B dry-run** — (spec, with sandbox config) — apply vertical A templates to vertical B on paper/sandbox (bet B6).
- **Enterprise-readiness brief** — (spec) **[Proof][Consent]** — auditability, consent coverage, replay fidelity, data minimization, least-privilege — all payment-free (see `agent-commerce-readiness.md` §5).
- **Data minimization & residency posture doc** — (spec) — what real-data operation *would* require; no real data collected.
- **PARKED-scope decision memo** — (spec) — record whether the four unpark-gate conditions are met. **Default outcome: remain PARKED.** This memo *documents* the decision; it does not authorize building identity/wallet/payments.

**Gate to exit Q4 / close the year**
- Vertical B dry-run shows template transfer with modest edits (B6 passes) — or replication is re-scoped.
- Enterprise-readiness brief reviewed by ≥1 external domain reviewer.
- PARKED decision memo completed and signed; any unpark requires all four conditions from `agent-commerce-readiness.md` §4.2 — absent which, scope stays parked.

**Dependencies**
- Requires Q1–Q3 (templates, analytics, replay, reputation spec).

**Kill / park criteria**
- If B6 fails (no transfer), **stop** horizontal replication and double down on depth in vertical A.
- The unpark gate is **not** satisfied by roadmap completion alone; lacking pilots + external compliance review + owner sign-off + a separate re-scoped spec, **everything payment/identity/wallet/token/chain stays PARKED.**

---

## Dependency map (summary)

```
Q1 Receipts + Consent gate + Event log
        │
        ▼
Q2 Replay harness + Dispute packs  (needs receipts, event log)
        │
        ▼
Q3 TrustOps analytics + Reputation spec + Verification interface  (needs event log, dispute outcomes)
        │
        ▼
Q4 Vertical B replication + Enterprise brief + PARKED decision memo  (needs templates, analytics, replay, reputation spec)
```

---

## Standing constraints (apply every quarter)

- **Boundary:** no token, no chain, no payments, no wallet, no identity issuance, no public fundraising — in build scope, demos, or comms. PARKED only.
- **Data:** synthetic/sandbox only (`.example`/`.test`/`.invalid`, `555-01xx`); no raw PII; no live customer data; no live automation against third parties.
- **Honesty:** status-tag every material claim; never present PLANNED/PARKED as production-ready.
- **Validation-gated build:** no bet graduates to build-now without a passing cheap validation (see `future-proofing-rd-map.md` §4).
- **Sandbox-only experiments;** Budget Wheels (or equivalent) used strictly as a sandbox.

---

## Cross-references

- Moat thesis, build/spec/park split, research bets: `future-proofing-rd-map.md`.
- Proof/consent mapping, authorization landscape, PARKED contract & banned language, enterprise levers: `agent-commerce-readiness.md`.

---

*Research and planning only. Quarters are relative and non-binding. No production-readiness is claimed or implied.*
