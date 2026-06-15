# Rubrics

Scoring rubrics for agent outputs. Each rubric maps to an `eval_items.rubric`
value (migration `0007`).

| Rubric              | Measures                                          |
| ------------------- | ------------------------------------------------- |
| `evidence_coverage` | Personalization claims backed by ≥1 evidence ref. |
| `spamminess`        | Spam-trigger phrasing / link density.             |
| `brand_voice`       | Tenant brand-voice adherence (placeholder).       |
| `compliance`        | Opt-out / suppression respect (placeholder).      |
| `reply_accuracy`    | Reply classifier vs labeled set.                  |
| `lead_scoring`      | Fit/timing score vs labeled outcome.              |

TypeScript evaluators live in `../src`. Offline/heavier scorers go in
`../scripts` (Python allowed there only).
