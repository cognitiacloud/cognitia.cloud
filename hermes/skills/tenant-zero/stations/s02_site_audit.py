#!/usr/bin/env python3
"""Station 2 — Website audit mock.

Deterministic scored audit over a *fixture* site snapshot. No network
fetch happens: the score is a pure function of the snapshot's contents,
so the same snapshot always yields the same audit.
"""

from __future__ import annotations

from typing import Any

import spine_common as sc


def _score_seo(snap: dict[str, Any]) -> tuple[int, list[str]]:
    findings: list[str] = []
    score = 100
    missing_meta = [p["path"] for p in snap["pages"] if not p.get("meta_description")]
    if missing_meta:
        score -= 8 * len(missing_meta)
        findings.append(f"{len(missing_meta)} page(s) missing meta description")
    if not snap.get("schema_org_present"):
        score -= 15
        findings.append("no schema.org structured data")
    if snap.get("broken_links", 0):
        score -= 4 * snap["broken_links"]
        findings.append(f"{snap['broken_links']} broken link(s)")
    return max(score, 0), findings


def _score_perf(snap: dict[str, Any]) -> tuple[int, list[str]]:
    findings: list[str] = []
    speed = snap.get("page_speed_ms", 0)
    score = 100 if speed <= 2000 else max(100 - (speed - 2000) // 50, 0)
    if speed > 2500:
        findings.append(f"page load {speed}ms exceeds 2.5s budget")
    if not snap.get("mobile_friendly"):
        score -= 20
        findings.append("not mobile friendly")
    return max(score, 0), findings


def _score_trust(snap: dict[str, Any]) -> tuple[int, list[str]]:
    findings: list[str] = []
    score = 100
    if not snap.get("has_https"):
        score -= 40
        findings.append("site not served over HTTPS")
    if not snap.get("review_widget"):
        score -= 20
        findings.append("review widget not surfaced on site")
    return max(score, 0), findings


def _score_cta(snap: dict[str, Any]) -> tuple[int, list[str]]:
    findings: list[str] = []
    score = 100
    if snap.get("cta_count", 0) < 2:
        score -= 30
        findings.append("fewer than 2 calls-to-action across key pages")
    if not snap.get("financing_calculator"):
        score -= 20
        findings.append("no financing calculator (high-intent tool missing)")
    if not snap.get("online_booking"):
        score -= 20
        findings.append("no online test-drive booking")
    return max(score, 0), findings


def run(intake: dict[str, Any], snapshot: dict[str, Any]) -> dict[str, Any]:
    seo, seo_f = _score_seo(snapshot)
    perf, perf_f = _score_perf(snapshot)
    trust, trust_f = _score_trust(snapshot)
    cta, cta_f = _score_cta(snapshot)

    scores = {"seo": seo, "performance": perf, "trust": trust, "cta": cta}
    overall = round(sum(scores.values()) / len(scores))
    findings = seo_f + perf_f + trust_f + cta_f

    out = {
        "tenant": intake["tenant"],
        "site_url": snapshot["site_url"],
        "overall_score": overall,
        "scores": scores,
        "findings": findings,
        "fix_list": [
            "Add meta descriptions + schema.org to all pages",
            "Cut page load under 2.5s",
            "Embed review widget and a financing calculator",
            "Add online test-drive booking CTA",
        ],
        "provider": sc.select_provider(),
    }
    sc.require_schema(out, sc.SITE_AUDIT_SCHEMA, "site_audit")
    return out
