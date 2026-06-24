#!/usr/bin/env python3
"""Station 10 — Operator console.

Two read-only views rendered purely from a run's artifacts:

* ``render(run_dir)``  -> writes a self-contained ``console/index.html``
  (no server, no JS deps) suitable for the investor demo and screenshots.
* ``cli_view(run_dir)`` -> returns a plain-text timeline + queue + receipt
  summary for operating and testing the run in a terminal.

Neither view mutates state; both surface the policy blocks, the approval
queue, the per-station hashes and the receipt root so the proof is visible.
"""

from __future__ import annotations

import html
from pathlib import Path
from typing import Any

import spine_common as sc


def _load(run_dir: Path) -> dict[str, Any]:
    out: dict[str, Any] = {}
    for _, name, artifact in sc.STATIONS:
        p = run_dir / artifact
        if p.exists():
            out[name] = sc.read_json(p)
    rs = run_dir / "run_state.json"
    if rs.exists():
        out["run_state"] = sc.read_json(rs)
    return out


# --------------------------------------------------------------------------
# CLI view
# --------------------------------------------------------------------------
def cli_view(run_dir: str | Path) -> str:
    run_dir = Path(run_dir)
    d = _load(run_dir)
    if "receipt" not in d:
        return f"no sealed run found in {run_dir}"

    receipt = d["receipt"]
    policy = d.get("policy_gate", {})
    approvals = d.get("approvals", {})
    crm = d.get("crm_writeback", {})

    lines: list[str] = []
    lines.append(f"TENANT ZERO PROOF SPINE — {receipt['tenant']}")
    lines.append(f"run_id: {receipt['run_id']}   clock: {receipt['clock']}")
    lines.append("=" * 60)
    lines.append("STATION TIMELINE")
    for s in receipt["station_hashes"]:
        lines.append(f"  [{s['index']}] {s['name']:<16} {s['decision']:<22} {s['sha256'][:12]}")
    lines.append("-" * 60)
    lines.append("POLICY GATE")
    for dec in policy.get("decisions", []):
        mark = "ALLOW" if dec["decision"] == "allow" else "BLOCK"
        why = "" if dec["decision"] == "allow" else "  <- " + "; ".join(dec["reasons"])
        lines.append(f"  {mark}  {dec['lead_id']}{why}")
    lines.append("-" * 60)
    lines.append(
        f"APPROVALS: {approvals.get('approved', 0)} approved, "
        f"{approvals.get('rejected', 0)} rejected"
    )
    lines.append(f"CRM ROWS:  {crm.get('rows_written', 0)} (store: {crm.get('store', 'n/a')})")
    lines.append("-" * 60)
    lines.append("ATTESTATIONS")
    for k, v in receipt["attestations"].items():
        lines.append(f"  {'PASS' if v else 'FAIL'}  {k}")
    lines.append("-" * 60)
    lines.append(f"RECEIPT ROOT: {receipt['receipt_root']}")
    return "\n".join(lines)


# --------------------------------------------------------------------------
# HTML view
# --------------------------------------------------------------------------
def _esc(v: Any) -> str:
    return html.escape(str(v))


def render(run_dir: str | Path) -> Path:
    run_dir = Path(run_dir)
    d = _load(run_dir)
    receipt = d.get("receipt", {})
    policy = d.get("policy_gate", {})
    approvals = d.get("approvals", {})
    crm = d.get("crm_writeback", {})
    audit = d.get("site_audit", {})

    rows_timeline = "\n".join(
        f"<tr><td>{s['index']}</td><td>{_esc(s['name'])}</td>"
        f"<td>{_esc(s['decision'])}</td><td class='hash'>{_esc(s['sha256'][:16])}…</td></tr>"
        for s in receipt.get("station_hashes", [])
    )
    rows_policy = "\n".join(
        f"<tr class='{dec['decision']}'><td>{_esc(dec['lead_id'])}</td>"
        f"<td>{dec['decision'].upper()}</td>"
        f"<td>{_esc('; '.join(dec['reasons']) or '—')}</td></tr>"
        for dec in policy.get("decisions", [])
    )
    rows_attest = "\n".join(
        f"<li class='{'ok' if v else 'bad'}'>{'✓' if v else '✗'} {_esc(k)}</li>"
        for k, v in receipt.get("attestations", {}).items()
    )
    rows_crm = "\n".join(
        f"<tr><td>{_esc(r['lead_id'])}</td><td>{_esc(r['masked_name'])}</td>"
        f"<td>{_esc(r['source'])}</td><td class='hash'>{_esc(r['idempotency_key'][:16])}…</td></tr>"
        for r in crm.get("rows", [])
    )

    page = f"""<!doctype html>
<html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Tenant Zero Proof — {_esc(receipt.get('tenant', ''))}</title>
<style>
  :root {{ --bg:#0e1116; --card:#171c24; --line:#2a313c; --ok:#3fb950; --bad:#f85149; --mut:#8b949e; --fg:#e6edf3; --accent:#58a6ff; }}
  body {{ background:var(--bg); color:var(--fg); font:14px/1.5 system-ui,sans-serif; margin:0; padding:24px; }}
  h1 {{ font-size:20px; margin:0 0 4px; }}
  .sub {{ color:var(--mut); margin-bottom:20px; }}
  .grid {{ display:grid; grid-template-columns:repeat(auto-fit,minmax(320px,1fr)); gap:16px; }}
  .card {{ background:var(--card); border:1px solid var(--line); border-radius:10px; padding:16px; }}
  .card h2 {{ font-size:13px; text-transform:uppercase; letter-spacing:.05em; color:var(--mut); margin:0 0 12px; }}
  table {{ width:100%; border-collapse:collapse; }}
  th,td {{ text-align:left; padding:6px 8px; border-bottom:1px solid var(--line); }}
  th {{ color:var(--mut); font-weight:600; font-size:12px; }}
  tr.block td {{ color:var(--bad); }} tr.allow td:nth-child(2) {{ color:var(--ok); }}
  .hash {{ font-family:ui-monospace,monospace; color:var(--accent); }}
  ul.attest {{ list-style:none; padding:0; margin:0; }}
  ul.attest li.ok {{ color:var(--ok); }} ul.attest li.bad {{ color:var(--bad); }}
  .root {{ font-family:ui-monospace,monospace; word-break:break-all; color:var(--accent);
           background:#0b0e13; padding:10px; border-radius:8px; border:1px solid var(--line); }}
  .stat {{ display:inline-block; margin-right:20px; }}
  .stat b {{ font-size:22px; display:block; }}
  .banner {{ background:#0b2a13; border:1px solid var(--ok); color:var(--ok);
             padding:8px 12px; border-radius:8px; margin-bottom:16px; font-weight:600; }}
</style></head><body>
<h1>Tenant Zero Proof Spine</h1>
<div class="sub">{_esc(receipt.get('tenant',''))} · run {_esc(receipt.get('run_id',''))} · clock {_esc(receipt.get('clock',''))}</div>
<div class="banner">DEMO · no live outreach · no real CRM · no raw PII · no real provider · no production keys</div>

<div class="card" style="margin-bottom:16px">
  <span class="stat"><b>{_esc(receipt.get('decisions',{}).get('leads_registered',0))}</b>leads</span>
  <span class="stat"><b>{_esc(policy.get('allowed',0))}</b>policy-allowed</span>
  <span class="stat"><b>{_esc(policy.get('blocked',0))}</b>blocked</span>
  <span class="stat"><b>{_esc(approvals.get('approved',0))}</b>approved</span>
  <span class="stat"><b>{_esc(crm.get('rows_written',0))}</b>CRM rows</span>
  <span class="stat"><b>{_esc(audit.get('overall_score','—'))}</b>site score</span>
</div>

<div class="grid">
  <div class="card"><h2>Station timeline</h2>
    <table><tr><th>#</th><th>station</th><th>decision</th><th>sha-256</th></tr>{rows_timeline}</table></div>
  <div class="card"><h2>Policy gate</h2>
    <table><tr><th>lead</th><th>decision</th><th>reasons</th></tr>{rows_policy}</table></div>
  <div class="card"><h2>Hard-rule attestations</h2><ul class="attest">{rows_attest}</ul></div>
  <div class="card"><h2>Mock CRM (local sqlite)</h2>
    <table><tr><th>lead</th><th>name</th><th>source</th><th>idempotency</th></tr>{rows_crm}</table></div>
</div>

<div class="card" style="margin-top:16px"><h2>Proof receipt root (SHA-256 hash chain)</h2>
  <div class="root">{_esc(receipt.get('receipt_root','(unsealed)'))}</div></div>
</body></html>
"""
    out_dir = run_dir / "console"
    out_dir.mkdir(parents=True, exist_ok=True)
    out_path = out_dir / "index.html"
    out_path.write_text(page, encoding="utf-8")
    return out_path
