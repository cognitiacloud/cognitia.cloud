#!/usr/bin/env python3
"""Shared foundation for the Tenant Zero proof spine.

Pure standard library. Holds the things every station needs:

* canonical JSON serialisation (byte-stable, so runs replay identically)
* SHA-256 helpers and the hash-chain used by the proof receipt
* `mask()` for PII and `find_unmasked_pii()` for the hard-rule guard
* the run-state manifest reader/writer
* module-level ``*_SCHEMA`` key lists (output validation, no pydantic)
* the deterministic "mock" provider selector

Nothing here reads an API key on the default path and nothing here opens
a network socket. That is deliberate: the hard rules of the proof spine
are enforced by the absence of those capabilities, not by configuration.
"""

from __future__ import annotations

import hashlib
import json
import os
import re
from pathlib import Path
from typing import Any, Iterable


# --------------------------------------------------------------------------
# Errors
# --------------------------------------------------------------------------
class ProofRuleViolation(Exception):
    """Raised when a hard rule would be broken (e.g. unmasked PII in an
    emitted artifact, or a policy-blocked lead reaching a downstream
    station). The pipeline fails closed rather than emitting the artifact."""


# --------------------------------------------------------------------------
# Station registry — the canonical ordered pipeline
# --------------------------------------------------------------------------
STATIONS: list[tuple[int, str, str]] = [
    (0, "intake", "00_intake.json"),
    (1, "site_audit", "01_site_audit.json"),
    (2, "competitors", "02_competitors.json"),
    (3, "lead_registry", "03_leads.json"),
    (4, "policy_gate", "04_policy.json"),
    (5, "approval_queue", "05_approval_queue.json"),
    (6, "approvals", "06_approvals.json"),
    (7, "closer_handoff", "07_closer_brief.json"),
    (8, "crm_writeback", "08_crm_writeback.json"),
    (9, "receipt", "09_receipt.json"),
]

# Stations whose artifacts are folded into the proof receipt hash chain.
# (The receipt itself, index 9, seals the chain and is not a leaf of it.)
HASHED_STATIONS = [s for s in STATIONS if s[0] != 9]


# --------------------------------------------------------------------------
# Output schemas (presence-checked, mirrors vision-skill's *_SCHEMA lists)
# --------------------------------------------------------------------------
INTAKE_SCHEMA = [
    "tenant", "run_id", "clock", "seed", "business", "icp", "offer",
    "eligible_channels", "quiet_hours", "consent_posture",
]
SITE_AUDIT_SCHEMA = [
    "tenant", "site_url", "overall_score", "scores", "findings",
    "fix_list", "provider",
]
COMPETITORS_SCHEMA = [
    "tenant", "competitors", "positioning_deltas", "ranked", "provider",
]
LEADS_SCHEMA = [
    "tenant", "lead_count", "leads", "sources", "provider",
]
POLICY_SCHEMA = [
    "tenant", "evaluated", "allowed", "blocked", "decisions", "rules_applied",
]
APPROVAL_QUEUE_SCHEMA = [
    "tenant", "pending", "items",
]
APPROVALS_SCHEMA = [
    "tenant", "decided", "approved", "rejected", "decisions",
]
CLOSER_BRIEF_SCHEMA = [
    "tenant", "brief_count", "briefs",
]
CRM_WRITEBACK_SCHEMA = [
    "tenant", "store", "rows_written", "rows", "idempotency_keys",
]
RECEIPT_SCHEMA = [
    "tenant", "run_id", "clock", "station_hashes", "decisions",
    "receipt_root", "attestations",
]


# --------------------------------------------------------------------------
# Canonical JSON + hashing
# --------------------------------------------------------------------------
def canonical_str(obj: Any) -> str:
    """Deterministic JSON text: sorted keys, stable spacing, trailing
    newline. Identical inputs always produce identical bytes, which is
    what makes the receipt hash chain reproducible across replays."""
    return json.dumps(obj, sort_keys=True, indent=2, ensure_ascii=False) + "\n"


def sha256_hex(data: str | bytes) -> str:
    if isinstance(data, str):
        data = data.encode("utf-8")
    return hashlib.sha256(data).hexdigest()


def sha256_obj(obj: Any) -> str:
    """SHA-256 over the canonical serialisation of an object."""
    return sha256_hex(canonical_str(obj))


def hash_chain(leaves: Iterable[str]) -> str:
    """Fold an ordered list of leaf hashes into a single root.

    h_0 = sha256(leaf_0); h_i = sha256(h_{i-1} + leaf_i). Order-sensitive
    and tamper-evident: changing any leaf changes the root."""
    acc = ""
    for leaf in leaves:
        acc = sha256_hex(acc + leaf)
    return acc


# --------------------------------------------------------------------------
# JSON artifact IO
# --------------------------------------------------------------------------
def write_json(path: str | Path, obj: Any) -> str:
    """Write an artifact in canonical form and return the exact text
    written (so the caller can hash the same bytes that hit disk)."""
    text = canonical_str(obj)
    p = Path(path)
    p.parent.mkdir(parents=True, exist_ok=True)
    p.write_text(text, encoding="utf-8")
    return text


def read_json(path: str | Path) -> Any:
    return json.loads(Path(path).read_text(encoding="utf-8"))


# --------------------------------------------------------------------------
# PII masking + detection
# --------------------------------------------------------------------------
# Patterns that must NEVER appear unmasked in an emitted run artifact.
_EMAIL_RE = re.compile(r"[A-Za-z0-9.+\-]+@[A-Za-z0-9\-]+\.[A-Za-z0-9.\-]+")
_PHONE_RE = re.compile(r"(?<!\d)(?:\+?\d[\s\-.]?)?(?:\(?\d{3}\)?[\s\-.]?)\d{3}[\s\-.]?\d{4}(?!\d)")
_SSN_RE = re.compile(r"(?<!\d)\d{3}-\d{2}-\d{4}(?!\d)")

_PII_PATTERNS: list[tuple[str, re.Pattern[str]]] = [
    ("email", _EMAIL_RE),
    ("phone", _PHONE_RE),
    ("ssn", _SSN_RE),
]


def mask(value: str, kind: str = "text") -> str:
    """Mask a synthetic PII value so it is safe to persist. Masked output
    contains '*' and so is, by construction, not matched by the unmasked
    detectors below (their character classes exclude '*')."""
    if value is None:
        return value
    value = str(value)
    if kind == "email" and "@" in value:
        local, _, domain = value.partition("@")
        dom_name, _, dom_tld = domain.rpartition(".")
        return f"{_keep_edge(local)}@{_keep_edge(dom_name)}.{dom_tld or 'xxx'}"
    if kind == "phone":
        digits = re.sub(r"\D", "", value)
        last4 = digits[-4:] if len(digits) >= 4 else "xxxx"
        return f"***-***-{last4}"
    if kind == "name":
        parts = [p for p in re.split(r"\s+", value.strip()) if p]
        return " ".join(_keep_edge(p) for p in parts) or "***"
    # generic text
    return _keep_edge(value)


def _keep_edge(token: str) -> str:
    """Keep the first character, replace the rest with '***'."""
    token = token.strip()
    if not token:
        return "***"
    if len(token) == 1:
        return f"{token}***"
    return f"{token[0]}***"


# Fields that legitimately hold SHA-256 / idempotency digests. Their long
# hex strings contain digit runs that would otherwise trip the phone/SSN
# detectors, so they are excluded from the PII scan (they are one-way
# hashes, not PII).
HASH_KEYS = frozenset(
    {
        "contact_hash", "sha256", "input_sha256", "output_sha256",
        "item_sha256", "brief_sha256", "idempotency_key", "idempotency_keys",
        "receipt_root", "recomputed_root", "replay_root", "seed",
    }
)


def _scan_text(text: str, hits: list[dict[str, str]]) -> None:
    for kind, pat in _PII_PATTERNS:
        for m in pat.findall(text):
            match = m if isinstance(m, str) else "".join(m)
            if match:
                hits.append({"kind": kind, "match": match})


def find_unmasked_pii(obj: Any) -> list[dict[str, str]]:
    """Walk an object and scan its string leaves for unmasked PII patterns,
    skipping fields known to hold one-way hashes. Returns a list of
    {kind, match} hits (empty == clean)."""
    hits: list[dict[str, str]] = []

    def walk(node: Any, key: str | None) -> None:
        if key in HASH_KEYS:
            return
        if isinstance(node, dict):
            for k, v in node.items():
                walk(v, k)
        elif isinstance(node, (list, tuple)):
            for v in node:
                walk(v, key)
        elif isinstance(node, str):
            _scan_text(node, hits)

    if isinstance(obj, str):
        _scan_text(obj, hits)
    else:
        walk(obj, None)
    return hits


def assert_no_unmasked_pii(obj: Any, where: str) -> None:
    """Hard-rule guard: fail closed if unmasked PII would be emitted."""
    hits = find_unmasked_pii(obj)
    if hits:
        kinds = ", ".join(sorted({h["kind"] for h in hits}))
        raise ProofRuleViolation(
            f"unmasked PII ({kinds}) detected in {where}; refusing to emit"
        )


def redact(text: str) -> str:
    """Log redaction — scrub PII before anything hits a log stream
    (mirrors vision_skill._redact)."""
    out = text
    for _kind, pat in _PII_PATTERNS:
        out = pat.sub("[REDACTED]", out)
    return out


# --------------------------------------------------------------------------
# Provider selection — mock by default, no keys read on the default path
# --------------------------------------------------------------------------
def select_provider() -> str:
    """Return the active data provider. Defaults to the deterministic
    'mock' provider. A real provider can only be requested explicitly via
    TENANT_ZERO_PROVIDER, and the spine intentionally ships no real
    provider implementation — so the default path never calls out."""
    return os.environ.get("TENANT_ZERO_PROVIDER", "mock") or "mock"


# --------------------------------------------------------------------------
# Run-state manifest
# --------------------------------------------------------------------------
def new_run_state(tenant: str, run_id: str, clock: str, seed: int) -> dict[str, Any]:
    return {
        "tenant": tenant,
        "run_id": run_id,
        "clock": clock,
        "seed": seed,
        "provider": select_provider(),
        "stations": [],
    }


def record_station(
    run_state: dict[str, Any],
    index: int,
    name: str,
    artifact: str,
    input_sha256: str | None,
    output_text: str,
    decision: str,
    summary: str,
) -> None:
    """Append a station record to the run-state manifest."""
    run_state["stations"].append(
        {
            "index": index,
            "name": name,
            "artifact": artifact,
            "input_sha256": input_sha256,
            "output_sha256": sha256_hex(output_text),
            "decision": decision,
            "summary": summary,
        }
    )


def schema_ok(obj: dict[str, Any], schema: list[str]) -> list[str]:
    """Return the list of schema keys missing from obj (empty == valid)."""
    return [k for k in schema if k not in obj]


def require_schema(obj: dict[str, Any], schema: list[str], where: str) -> None:
    missing = schema_ok(obj, schema)
    if missing:
        raise ProofRuleViolation(f"{where} missing schema keys: {missing}")


def fixtures_dir() -> Path:
    return Path(__file__).resolve().parent / "fixtures"
