# Eval scripts

Offline analysis runners. **Python is allowed here only** (and in `/labs`) for
exploration and heavier scoring. Production-invariant logic stays in TypeScript
(`../src`). Scripts read datasets, call evaluators, and write summaries that the
worker can persist into `eval_runs` / `eval_items`.
