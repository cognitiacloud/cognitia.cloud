# Spec — Agent Economy Proof Harness

**Status:** SPEC (design only — not implementation)
**Owner:** Economy workstream
**Date:** 2026-06-20
**Sprint:** sprint-2026-06-20
**Depends on:** `internal-token-sandbox-memo.md` (credit ledger)
**Related:** `../05-harness/goal-loop-harness-mvp-spec.md`

---

## Executive Summary

The proof harness is the instrument that answers our central question: **do autonomous agents create measurable value, and at what cost?** It frames testable hypotheses, runs controlled agent-vs-baseline experiments, measures task success and value-vs-cost using the internal **credit ledger** as the unit of account, applies independent quality control, defends against agents gaming their own scores, and emits a verdict against explicit acceptance criteria.

This document is a **specification**: components, data flow, rubrics, and acceptance criteria. It is not implementation, and it makes **no guaranteed-ROI claims** — it defines how we would *measure* value, not assert it.

---

## 1. Hypotheses to Test

Stated so each is falsifiable.

| ID | Hypothesis | Falsified if… |
|----|-----------|---------------|
| **H1 — Capability** | Agents complete a defined class of tasks at acceptable quality. | Success rate below threshold (§6). |
| **H2 — Net value** | Credited value of agent output exceeds metered cost (value/cost > 1). | Value/cost ≤ 1 across the task class. |
| **H3 — Baseline parity+** | Agent output is at least comparable to a human baseline on quality, faster or cheaper. | Agent quality materially below baseline with no cost/speed advantage. |
| **H4 — Durability** | Value holds under independent QC and adversarial re-grading (not just self-report). | QC overturns a material share of self-reported successes. |
| **H5 — Scalability** | Parallelizing agents preserves per-task value/cost (no collapse under fan-out). | Value/cost degrades sharply with concurrency. |

"Proof" = H1, H2, H4 met with statistical confidence, and H3 met or favorable. H5 is supporting evidence.

---

## 2. Measurement Framework

Four orthogonal axes; a task is "valuable" only when it clears all four.

### 2.1 Task success
Binary or graded completion against a **pre-registered task definition** with machine-checkable acceptance criteria where possible (tests pass, schema validates, target metric hit). Criteria are fixed *before* the run to prevent moving goalposts.

### 2.2 Value created vs. cost
- **Cost** = metered inputs (compute, tokens, tool calls, wall-clock) expressed in **credits** via the ledger (`meter_cost` transactions).
- **Value** = credited worth of accepted output (`credit_value` transactions), set by a **pre-registered value model** (e.g., "a task of class X accepted at quality Q is worth N credits"), where N is calibrated to the human-baseline cost of the same task — *internal accounting only, never money*.
- **Net** = `value − cost`; **ratio** = `value / cost`. Credits never imply currency.

### 2.3 Human-baseline comparison
Same task definition handed to a human-baseline path (or a documented prior estimate). Compare quality, latency, and cost. The baseline is the yardstick for H3.

### 2.4 Quality QC
Independent grading (automated checks + LLM-judge + human spot-audit) **separate from the executing agent**. QC can overturn a self-reported success. Only QC-confirmed outputs count toward value.

---

## 3. Ledger Integration

Credits come from the internal ledger in `internal-token-sandbox-memo.md`. Constraints carry over: **play-money, internal-only, non-redeemable, no PII.**

```
Experiment run
   │  meter_cost  ── DR experiment_acct / CR SYSTEM_TREASURY   (record cost)
   │  credit_value── DR SYSTEM_MINT     / CR experiment_acct   (record QC-confirmed value)
   ▼
Ledger (double-entry, auditable)
   ▼
Proof harness reads:  cost = Σ meter_cost ,  value = Σ credit_value (QC-passed only)
```

- Value is posted **only after QC confirmation** (§2.4) — defends against agents minting their own value.
- Each experiment gets its own ledger account for clean attribution and reset.
- The harness is a **read-only** consumer of balances; the ledger service owns writes.

---

## 4. Experiment Design

### 4.1 Arms
- **Control:** human-baseline path (or pre-registered baseline estimate).
- **Treatment:** agent path.
- **A/B / variants:** agent configurations (model, planning depth, tool access) as additional treatment arms.

### 4.2 Protocol
1. **Pre-registration:** task set, acceptance criteria, value model, sample size, and success thresholds are frozen and hashed *before* any run.
2. **Randomized assignment** of tasks across arms; blind QC where feasible (graders don't know which arm produced an output).
3. **Hold-out tasks** the agent has never seen, drawn from a rotating pool, to prevent overfitting/memorization.
4. **Replication:** runs repeated to estimate variance; report confidence intervals, not single numbers.

### 4.3 Reporting
Per-arm: success rate, value, cost, value/cost (with CI), latency, QC-overturn rate. Verdict against §6.

---

## 5. Instrumentation, Telemetry & Architecture

### 5.1 Telemetry captured per task
`task_id`, `experiment_id`, `arm`, pre-registration hash, every tool/model call (cost inputs), wall-clock, raw outputs (artifact refs), automated-check results, QC verdicts, ledger txn refs. **No raw PII** — internal identifiers only; redact any PII before storage.

### 5.2 Minimal architecture

```
            ┌──────────────────────────────────────────────┐
            │         Proof Harness Control Plane           │
            │  (pre-registration store · run orchestrator)  │
            └───────┬───────────────────────────┬───────────┘
                    │ dispatch                   │ verdict
        ┌───────────▼─────────┐        ┌─────────▼──────────┐
        │   Execution Layer   │        │   Evaluation Layer │
        │  control arm │ agent│        │ auto-checks·LLM-   │
        │  arm(s)             │        │ judge·human audit  │
        └───────┬─────────────┘        └─────────┬──────────┘
                │ telemetry                       │ QC verdicts
        ┌───────▼─────────────────────────────────▼──────────┐
        │            Telemetry / Metrics Store                │
        │   (tasks, calls, artifacts refs, QC, PII-redacted)  │
        └───────┬─────────────────────────────────────────────┘
                │ meter_cost / credit_value (QC-gated)
        ┌───────▼─────────────┐
        │  Internal Ledger    │  (Artifact 1 — read for value/cost)
        └─────────────────────┘
```

### 5.3 Components
- **Control plane:** holds frozen pre-registrations, orchestrates runs, computes verdicts.
- **Execution layer:** runs control and agent arms in isolation.
- **Evaluation layer:** independent QC; the only component allowed to confirm value.
- **Telemetry store:** immutable record of what happened.
- **Ledger:** unit-of-account substrate.

### 5.4 Data flow
Pre-register → dispatch arms → execute → emit telemetry → independent QC → (on pass) post `credit_value` → harness reads ledger + telemetry → verdict.

---

## 6. Evaluation Rubric & Acceptance Criteria

### 6.1 Per-task quality rubric (graded 0–3 per dimension)
| Dimension | 0 | 3 |
|-----------|---|---|
| Correctness | Wrong/incomplete | Meets all acceptance criteria |
| Usefulness | No value to goal | Directly advances goal |
| Reliability | Non-reproducible | Reproducible result |
| Cost efficiency | Far above baseline cost | At/below baseline cost |

### 6.2 Acceptance criteria for "PROOF"
Declared proven for a task class only when, on pre-registered hold-out tasks with statistical confidence:
1. **H1:** task success ≥ pre-registered threshold.
2. **H2:** QC-confirmed value/cost > 1 (CI lower bound > 1).
3. **H4:** QC-overturn rate ≤ pre-registered ceiling (self-report is trustworthy).
4. **H3:** agent quality ≥ baseline, OR clearly cheaper/faster at comparable quality.
5. Results **replicated** across ≥ N independent runs.

If any fail → **not proven**; report findings and iterate. No "directional" hand-waving counts as proof.

---

## 7. Anti-Gaming Safeguards

Agents must not be able to fake success. Threats and defenses:

| Threat | Defense |
|--------|---------|
| Agent self-reports success | Value posted **only** on independent QC confirmation; executor cannot mint value. |
| Agent mints its own credits | Mint authority is system-only (ledger governance); harness is read-only. |
| Goalpost moving | Acceptance criteria & value model **pre-registered and hashed** before runs. |
| Overfitting/memorization | Rotating **hold-out** tasks the agent hasn't seen. |
| Gaming the judge | Mix automated checks + LLM-judge + **human spot-audit**; blind grading; periodic judge calibration. |
| Cherry-picking runs | **Pre-registered sample size**; all runs reported, no dropping. |
| Reward hacking the metric | Multi-axis rubric (§6.1) — can't win on one axis while failing others; adversarial re-grading (H4). |
| Telemetry tampering | Append-only, immutable telemetry + ledger; executor has no write access. |

---

## 8. Relationship to the Goal-Loop Harness

The goal-loop harness (`../05-harness/goal-loop-harness-mvp-spec.md`) is the **orchestration loop** that runs work; the proof harness is the **measurement instrument** that judges whether that work created value. The goal-loop's `measure` stage consumes proof-harness rubrics and ledger reads; the proof harness depends on the goal-loop to dispatch experiment arms. They share the telemetry store and the ledger.

---

## 9. Scope Notes

- **In scope:** measurement design, rubrics, anti-gaming, ledger integration, acceptance criteria.
- **Out of scope:** implementation/production code; any real-money value; any guaranteed-ROI claim. This spec measures value; it does not promise it.
