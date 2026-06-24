# Tenant Zero Proof Spine — Budget Wheels

A deterministic, replayable, **offline** lead-to-closer pipeline for Cognitia's
first tenant, the (synthetic) used-car dealership **Budget Wheels**
(`budget_wheels_demo`). It runs twelve stations — intake → website audit →
competitor intel → lead registry → policy gate → human approval → sales-closer
handoff → mock CRM → proof receipt → operator console → demo artifacts → tests —
and seals the whole run with a tamper-evident **SHA-256 proof receipt**.

The point of the spine is to be **provably safe by construction**, not by
configuration. The hard rules below are enforced by the *absence* of dangerous
capabilities and by guards that fail the run closed:

| Hard rule | How it is enforced |
|---|---|
| **No live outreach** | No transport/network module exists. The closer station emits a *brief artifact* only — there is nothing to send. |
| **No real CRM writes** | Station 8 writes only to a local `crm.sqlite` opened by relative path under `run/`. No CRM SDK or credential is imported anywhere. |
| **No raw PII** | Identities are masked at the registry boundary (station 4). Every emitted artifact is scanned (`assert_no_unmasked_pii`); the policy gate blocks any lead whose record still contains unmasked PII. |
| **No real provider calls** | All data are deterministic fixtures. The provider defaults to `mock`; no real provider implementation ships. |
| **No production keys** | The default path reads no `*_API_KEY`. The receipt seal is a keyless SHA-256 hash chain. |

This skill **is** writable (it creates a local `run/` directory and a local
`crm.sqlite`), so `safety.read_only` is `false` — unlike the read-only
vision-skill. It still never posts, never uploads, and never touches a file it
did not create.

## Run it

No install is required — standard library only.

```bash
python3 fixtures/generate_fixtures.py              # synthesize Budget Wheels fixtures
python3 spine.py run --tenant budget_wheels_demo   # produce run/<run_id>/ with all artifacts
python3 spine.py verify  --run budget_wheels_demo-golden-0001   # recompute the hash chain
python3 spine.py replay  --run budget_wheels_demo-golden-0001   # assert byte-identical re-run
python3 spine.py console --run budget_wheels_demo-golden-0001   # render + print the console
python3 demo.py                                    # golden run + DEMO_ONEPAGER.md + console
python3 test_spine.py                              # full unittest suite, offline, no keys
```

The operator console is written to
`run/<run_id>/console/index.html` (self-contained, open in any browser) and is
also available as a terminal view via `spine.py console`.

## Stations & artifacts

A run writes numbered JSON artifacts to `run/<run_id>/`:

```
00_intake.json        05_approval_queue.json   crm.sqlite
01_site_audit.json    06_approvals.json        run_state.json
02_competitors.json   07_closer_brief.json     console/index.html
03_leads.json         08_crm_writeback.json
04_policy.json        09_receipt.json   <- the proof receipt (hash-chain root)
```

* **`run_state.json`** is a growing manifest: per station, its artifact, input
  hash, output hash, decision, and summary.
* **`09_receipt.json`** chains `sha256(artifact_bytes)` for stations 0–8 into a
  single `receipt_root`, and records machine-checked attestations for each hard
  rule. Editing any artifact changes the root — that is what makes `verify` a
  real tamper check.

## Determinism / replay

Runs are byte-stable: the frozen `clock` and `seed` live in the intake fixture,
nothing hashed reads the wall clock or a random source, and all JSON is written
in a canonical form (sorted keys, stable spacing). `spine.py replay` re-runs the
pipeline into a throwaway directory and asserts every artifact — and the receipt
root — is identical.

## Policy gate

The gate (station 5) is the hard-rule chokepoint. Each lead must pass five
deterministic rules — `consent`, `suppression`, `channel`, `quiet_hours`,
`pii_masking` — or it is blocked with a reason. Blocked leads cannot reach the
approval queue, the closer, or the CRM, and downstream stations re-assert this
(`assert_allowed`) so the pipeline fails closed if a blocked id ever slips
through. In the golden run, 4 of 7 leads are allowed and 3 are blocked (no
consent / suppressed / ineligible channel).

## Human approval

Nothing reaches the closer or CRM without an approval record. The golden run
uses a deterministic auto-approval for reproducibility; the real operator gate
is `spine.py approve --run <id> --item <item> --decision approve|reject
--reason "…"`, which upserts the decision and re-seals stations 7–9. Rejecting a
previously approved lead removes it from the mock CRM (the writeback mirrors the
approved set).

## MCP server

The same entrypoint exposes an MCP stdio server with the five tools above:

```bash
python3 spine.py --mcp    # requires the optional `mcp` SDK
```

Register it via `.mcp.json` (in this folder) or your Hermes loader.

## Safety constraints (recap)

- No outreach transport exists anywhere in the skill.
- The only writable store is a local SQLite file inside `run/`.
- No raw PII is ever emitted; masked values are scanned on every artifact.
- No real provider is called and no `*_API_KEY` is read on the default path.
- The proof receipt is a keyless, tamper-evident SHA-256 hash chain.
