#!/usr/bin/env python3
"""Station 11 — Investor demo artifacts.

Drives the end-to-end golden run and emits a one-pager plus talking points,
with every number pulled from the run's artifacts (never hand-typed) so the
deck cannot drift from the proof. Outputs:

    run/<run_id>/console/index.html   (via the console station)
    DEMO_ONEPAGER.md                  (next to this file)

    python3 demo.py
"""

from __future__ import annotations

import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))

import spine  # noqa: E402
import spine_common as sc  # noqa: E402

ONEPAGER = HERE / "DEMO_ONEPAGER.md"


def build_onepager(run_id: str) -> str:
    run_dir = spine.DEFAULT_OUT / run_id
    receipt = sc.read_json(run_dir / "09_receipt.json")
    policy = sc.read_json(run_dir / "04_policy.json")
    audit = sc.read_json(run_dir / "01_site_audit.json")
    crm = sc.read_json(run_dir / "08_crm_writeback.json")
    dec = receipt["decisions"]

    blocks = [d for d in policy["decisions"] if d["decision"] == "block"]
    block_lines = "\n".join(
        f"- `{b['lead_id']}` blocked — {', '.join(b['reasons'])}" for b in blocks
    )
    attest_lines = "\n".join(
        f"- {'✅' if v else '❌'} **{k.replace('_', ' ')}**"
        for k, v in receipt["attestations"].items()
    )

    return f"""# Budget Wheels — Tenant Zero Proof Run

**Tenant:** `{receipt['tenant']}`  ·  **Run:** `{receipt['run_id']}`  ·  **Clock:** {receipt['clock']}

## What this proves
Cognitia can take a lead from intake → website audit → competitor intel →
policy gate → human approval → sales-closer handoff → CRM, and emit a
**tamper-evident proof receipt** for the entire run — while being
*architecturally incapable* of doing anything harmful in a demo.

## The golden run, in numbers
| Stage | Result |
|---|---|
| Leads registered (masked at the boundary) | **{dec['leads_registered']}** |
| Site audit score | **{audit['overall_score']}/100** |
| Policy-allowed | **{dec['policy_allowed']}** |
| Policy-blocked | **{dec['policy_blocked']}** |
| Operator-approved | **{dec['approved']}** |
| Mock-CRM rows written | **{crm['rows_written']}** |

## What the policy gate stopped
{block_lines}

## Hard-rule attestations (machine-checked from artifacts)
{attest_lines}

## Proof receipt root (SHA-256 hash chain)
```
{receipt['receipt_root']}
```
Re-runnable: `python3 spine.py replay --run {receipt['run_id']}` reproduces
this root byte-for-byte. `python3 spine.py verify --run {receipt['run_id']}`
fails if any artifact is altered.

## Talking points
1. **Nothing ships without a human.** {dec['policy_allowed']} leads cleared
   policy; only operator-approved ones reached the closer and CRM.
2. **The gate is the product.** {dec['policy_blocked']} leads were blocked for
   consent, suppression, and channel-eligibility reasons — visibly, with cause.
3. **No raw PII ever lands.** Identities are masked at registration and every
   emitted artifact is scanned; the receipt attests `no_raw_pii`.
4. **It's provable, not assertable.** The receipt is a hash chain over every
   station's bytes — replayable and tamper-evident.
5. **Safe by construction.** No transport, no real CRM SDK, no real provider,
   no production keys exist on the default path.
"""


def main() -> int:
    res = spine.run_pipeline("budget_wheels_demo")
    run_id = "budget_wheels_demo-golden-0001"
    text = build_onepager(run_id)
    ONEPAGER.write_text(text, encoding="utf-8")
    console_path = spine.DEFAULT_OUT / run_id / "console" / "index.html"
    print(f"golden run sealed: ok={res['ok']} root={res['receipt_root'][:12]}…")
    print(f"one-pager: {ONEPAGER}")
    print(f"console:   {console_path}")
    return 0 if res["ok"] else 1


if __name__ == "__main__":
    raise SystemExit(main())
