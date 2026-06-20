# Spec — Goal-Loop Harness MVP

**Status:** SPEC (design only — not implementation)
**Owner:** Harness workstream
**Date:** 2026-06-20
**Sprint:** sprint-2026-06-20
**Related:** `../04-economy/agent-economy-proof-harness-spec.md`, `../04-economy/internal-token-sandbox-memo.md`

---

## Executive Summary

The goal-loop harness is the **meta-system that runs sprints like this one**: it takes a goal, decomposes and plans it, dispatches agent work (in parallel where safe), measures results against the goal, reports on a fixed cadence, and replans until the goal is met or a stop condition fires. This spec defines the loop stages, a built-in **every-6-hours reporting cadence**, guardrails (forbidden-action enforcement, scope-creep detection, human-approval gates), the state and data models, observability, failure modes, and an MVP build scope with explicitly deferred features.

It is a **specification**, not implementation. The harness produces work; the **proof harness** measures whether that work created value.

---

## 1. The Loop

```
            ┌──────────────────────────────────────────────────────────┐
            │                                                          │
            ▼                                                          │
   ┌──────────────┐   ┌──────────┐   ┌──────┐   ┌──────────────────┐   │
   │ 1. Goal       │──▶│2.Decom-  │──▶│3.Plan│──▶│4.Dispatch /      │   │
   │   Intake      │   │  pose    │   │      │   │  Parallelize     │   │
   └──────────────┘   └──────────┘   └──────┘   └────────┬─────────┘   │
                                                          ▼             │
   ┌──────────────┐   ┌──────────┐   ┌─────────────┐   ┌──────────┐    │
   │ 8. Replan    │◀──│7. Report  │◀──│6. Measure   │◀──│5.Execute │    │
   │  or STOP     │   │ (6h cadence)│  │ vs. goal    │   │          │    │
   └──────┬───────┘   └──────────┘   └─────────────┘   └──────────┘    │
          │                                                            │
          └──────────────── loop until done / stop ───────────────────┘
                 (every transition passes through Guardrails §3)
```

| # | Stage | Responsibility |
|---|-------|----------------|
| 1 | **Goal intake** | Capture goal, success criteria, constraints, forbidden actions, approval requirements. |
| 2 | **Decompose** | Break goal into tasks/subgoals with dependencies and acceptance criteria. |
| 3 | **Plan** | Order tasks, identify parallelizable sets, estimate cost (credits), set checkpoints. |
| 4 | **Dispatch / parallelize** | Assign tasks to agents; fan out independent tasks concurrently. |
| 5 | **Execute** | Agents do the work; emit telemetry; produce artifacts. |
| 6 | **Measure** | Score outputs vs. goal/acceptance criteria using proof-harness rubrics + ledger reads. |
| 7 | **Report** | Emit status on the **6-hour cadence** and at milestones. |
| 8 | **Replan or stop** | Decide: iterate, adjust plan, escalate to human, or terminate. |

---

## 2. Reporting Cadence (Every 6 Hours)

Built into the loop, not bolted on.

- A **report tick** fires every 6 hours of wall-clock and at major state transitions.
- Each report contains: goal + progress %, tasks done/in-flight/blocked, measured value/cost from the ledger, guardrail events, scope-creep flags, pending approval gates, next planned actions, and any stop recommendations.
- Reports are **append-only** and timestamped, forming the sprint audit trail.
- A missed report tick is itself a monitored failure (watchdog escalates).

---

## 3. Guardrails

Every stage transition passes through guardrail checks. Violations halt or escalate.

### 3.1 Forbidden-action enforcement
- A **forbidden-action list** is loaded at goal intake and checked **before every dispatch and execution**. Examples for this program: no public token launch, no real-money/redemption flows, no handling raw PII, no production-code commits where a spec was requested, no irreversible external actions.
- A forbidden action is **blocked and logged**, not merely warned. Repeated attempts escalate to a human gate.

### 3.2 Scope-creep detection
- Each task is checked against the decomposition that traces back to the **original goal**. Tasks with no lineage to an approved subgoal are flagged as scope creep and **parked** pending human confirmation.
- Budget guard: cumulative credit cost vs. plan estimate; overrun beyond a threshold triggers replan + report.

### 3.3 Human-approval gates
- Gate types: **irreversible action**, **forbidden-list near-miss**, **budget overrun**, **externalization** (anything leaving the sandbox), **low-confidence measurement**.
- At a gate the loop **pauses** that branch and surfaces an approval request in the next report (or immediately for high severity). No bypass.

---

## 4. State Model

```
INTAKE → PLANNING → DISPATCHING → EXECUTING → MEASURING → REPORTING → REPLANNING
                                                                  │
                  ┌───────────────────────────────────────────────┤
                  ▼                 ▼                ▼              ▼
              AWAITING_APPROVAL   BLOCKED         DONE          ABORTED
              (gate, §3.3)     (dependency/    (goal met)   (stop condition/
                                guardrail)                   forbidden action)
```

- **Run state:** `INTAKE, PLANNING, DISPATCHING, EXECUTING, MEASURING, REPORTING, REPLANNING, AWAITING_APPROVAL, BLOCKED, DONE, ABORTED`.
- **Task state:** `PENDING, READY, RUNNING, BLOCKED, MEASURED, ACCEPTED, REJECTED, PARKED`.
- Transitions are logged; `AWAITING_APPROVAL` and `ABORTED` are terminal-ish until human/stop resolution.

---

## 5. Minimal Data Model

```
goals
  goal_id (PK) · statement · success_criteria · constraints
  forbidden_actions[] · approval_rules · created_at

tasks
  task_id (PK) · goal_id (FK) · parent_task_id · description
  acceptance_criteria · state · assigned_agent_ref · cost_estimate_credits

runs
  run_id (PK) · goal_id (FK) · state · started_at · last_report_at

reports
  report_id (PK) · run_id (FK) · tick_at · progress · value_cost_summary
  guardrail_events[] · scope_flags[] · pending_gates[]   (append-only)

guardrail_events
  event_id (PK) · run_id (FK) · type {forbidden|scope_creep|budget|gate}
  severity · detail · action_taken · resolved_by   (no PII)

measurements
  measurement_id (PK) · task_id (FK) · rubric_scores · ledger_txn_refs · verdict
```

No raw PII anywhere — internal identifiers only.

---

## 6. Observability

- **Structured logs** per stage transition (run_id, task_id, state from→to, actor).
- **Metrics:** tasks by state, parallelism, value/cost (from ledger), guardrail-event rate, scope-creep count, gate latency, report-tick punctuality.
- **Traces:** a goal → tasks → agent calls → measurements → ledger txns chain, end to end.
- **Audit trail:** append-only reports + guardrail events = full reconstruction of what the harness did and why.
- **Watchdog:** alerts on missed report tick, stuck state, runaway cost, or repeated guardrail hits.

---

## 7. Failure Modes

| Failure | Detection | Response |
|---------|-----------|----------|
| Agent loops / no progress | No state advance within window | Watchdog → BLOCKED → replan/escalate. |
| Forbidden action attempted | Guardrail §3.1 | Block + log + gate. |
| Scope creep | Lineage check §3.2 | PARK task + flag in report. |
| Budget overrun | Cost vs. estimate | Replan + report + possible gate. |
| Measurement low-confidence | Proof-harness QC variance | Approval gate; don't accept value. |
| Missed report tick | Cadence watchdog | Alert + escalate. |
| Deadlock (mutual task deps) | Dependency cycle check at plan | Reject plan; replan. |
| Partial agent failure under fan-out | Per-task status | Retry/reassign; isolate failure. |

---

## 8. Relationship to the Proof Harness

- The **measure** stage (§1.6) is delegated to the **agent-economy proof harness**: it supplies rubrics, QC, and the value/cost reads from the internal **credit ledger**.
- The goal-loop **produces** work and the proof harness **judges** it. The goal-loop never self-certifies value — value comes from independent QC, mirroring the anti-gaming stance of the proof spec.
- Shared substrate: telemetry store and the internal ledger (`../04-economy/`).

---

## 9. MVP Build Scope vs. Deferred

### 9.1 In scope (MVP)
- Single goal, single run at a time.
- Stages 1–8 with a basic decompose/plan.
- Bounded parallel dispatch (small fixed concurrency).
- 6-hour reporting cadence + milestone reports.
- Guardrails: forbidden-action enforcement, scope-creep flagging, human-approval gates.
- State + data model (§4–5), structured logs, watchdog on report ticks.
- Read-only integration with proof harness + ledger for the measure stage.

### 9.2 Explicitly deferred / parked
- Multi-goal concurrency and cross-goal scheduling.
- Auto-tuned/dynamic concurrency and load balancing.
- Self-modifying plans without human gate (autonomy expansion).
- Sophisticated cost-optimization / incentive routing (depends on ledger Phase 2).
- Any externalization of reports, credits, or actions (blocked until the legal gate in the token memo).
- Rich UI/dashboards beyond append-only reports + metrics.

### 9.3 Hard rules carried into MVP
- Specs, not production code, where a spec is requested.
- No public token, no real-money value, no PII.
- Every guardrail in §3 enforced, not advisory.
