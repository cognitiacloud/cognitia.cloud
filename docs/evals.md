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
