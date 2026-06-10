# Evals

> Evals make agent quality measurable and regression-resistant. They run out of
> the request path (worker/CI), never inline.

## 1. Goals

- Score agent outputs (research summaries, sequence drafts, reply
  classification) against rubrics.
- Track quality across prompt/model/policy changes via experiments.
- Feed human feedback labels back into datasets.

## 2. Structure

```
packages/evals/
  datasets/   versioned input sets (refs + expected signals, no raw PII)
  rubrics/    scoring rubrics (e.g. evidence coverage, spamminess, tone)
  scripts/    runners (TS; Python allowed for analysis only)
```

Backed by tables: `experiments`, `eval_runs`, `eval_items`, `feedback_labels`
(migration `0007`).

## 3. MVP rubrics

| Rubric              | Measures                                                           |
| ------------------- | ------------------------------------------------------------------ |
| `evidence_coverage` | Every personalization claim maps to ≥1 evidence ref.               |
| `spamminess`        | Spam-trigger phrasing, over-personalization, link density.         |
| `brand_voice`       | Adherence to tenant brand voice (placeholder rubric in MVP).       |
| `compliance`        | Required disclosures / suppression respect (placeholder).          |
| `reply_accuracy`    | Reply classifier vs. labeled set (incl. unsubscribe/wrong-person). |

## 3a. Decision labels (FLY-1 — live on the alpha path)

Every operator approve/reject in the approval console (and API) **requires a
structured reason** and is persisted to `feedback_labels`:

- `subject_ref` = `agent_action:<id>`, `label` = `approved | rejected`
- `detail` = `{ reason_code, note, approver_ref, action_type, risk_level, target_ref }`
  — a self-contained snapshot, so labels can be segmented without joining back
  to `agent_actions`.
- Reason codes are **closed enums** in `@cognitia/core` (`approveReasonCode`,
  `rejectReasonCode`); `other` requires a free-text note. Queryable via
  `GET /decisions` and `GET /agent-actions/:id/decisions`.

How these labels feed the flywheel:

1. **Golden datasets (EVAL-1):** approvals (`accurate_and_relevant`,
   `meets_playbook`) become positive exemplars; rejections become labeled
   negatives with `reason_code` as the failure class (wrong target, factually
   wrong, tone, policy).
2. **Per-segment scorecards (MET-1):** approval rate and rejection-reason mix
   per `action_type` × `risk_level` — the trust metric a design partner can
   audit.
3. **Earned autonomy (later, gated):** autonomy policy may only ever widen for
   segments whose label history clears a threshold (e.g. sustained approval
   rate with zero `policy_or_risk` rejections). Labels are the evidence; no
   label history ⇒ no autonomy. Recorded here as the intended consumer —
   **no autonomy behavior exists in V1.**

## 4. Run model

1. An `experiment` pins a config (prompt/model/policy versions).
2. An `eval_run` executes the agent over a dataset.
3. Per-item results land in `eval_items` with rubric scores.
4. `feedback_labels` capture human judgments and real outcomes (replies,
   meetings) for continuous improvement.
5. `eval.run.completed.v1` is emitted with summary metrics.

## 5. Language policy

- Runners and rubric logic that must be tested: TypeScript.
- Python permitted only for `/labs` exploration and `packages/evals/scripts`
  analysis (no production invariants).
