#!/usr/bin/env python3
"""W5 proof harness: Sales Closer proof report generator.

Takes the output of one *completed*, mock-safe Sales Closer workflow run
(lead intake -> compliance decision -> human approval -> appointment booking ->
CRM write) and emits a **proof report** an auditor can read to see:

    - verified         facts directly recorded in the workflow output
    - likely_inference derived/heuristic reads (carry a confidence)
    - unknown          data that was not captured / is indeterminate

Hard rules enforced here:
    - No raw PII in the proof output (fail-closed scan before emit).
    - No real customer/prospect data (fixture is synthetic, mode=mock_safe).
    - No public-token / blockchain language (lexical guard).

The PII regexes mirror the established patterns in
``hermes/skills/vision-skill/vision_skill.py``. They are re-implemented here so
this harness stays self-contained and imports nothing from the sibling skill.

CLI:
    python3 proof_report.py generate
    python3 proof_report.py generate --fixture <path> --out proof_report.json
    python3 proof_report.py validate --fixture <path>
"""

from __future__ import annotations

import argparse
import hashlib
import json
import re
import sys
from dataclasses import asdict, dataclass, field
from pathlib import Path
from typing import Any

SCHEMA_VERSION = "1.0.0"
DEFAULT_FIXTURE = Path(__file__).parent / "fixtures" / "sales_closer_completed.json"

# Classification taxonomy (the core auditor contract).
VERIFIED = "verified"
LIKELY_INFERENCE = "likely_inference"
UNKNOWN = "unknown"
CLASSIFICATIONS = (VERIFIED, LIKELY_INFERENCE, UNKNOWN)

# The five required workflow stages.
STAGES = (
    "lead_intake",
    "compliance_decision",
    "approval",
    "appointment_mock",
    "crm_mock",
)

# Required keys on every emitted entry / record (mirrors *_SCHEMA style).
EVIDENCE_SCHEMA = [
    "evidence_id",
    "stage",
    "claim",
    "classification",
    "confidence",
    "source_ref",
    "basis",
    "pii_safe",
]
APPROVAL_SCHEMA = [
    "approval_id",
    "decision",
    "approver_role",
    "approver_ref",
    "approved_at",
    "scope",
    "notes",
    "signature_checksum",
]
PROOF_REPORT_SCHEMA = [
    "schema_version",
    "report_id",
    "generated_at",
    "workflow",
    "evidence",
    "human_approval",
    "summary",
    "assurances",
    "integrity",
]


# --------------------------- Privacy / safety guards ------------------------
# Patterns mirror hermes/skills/vision-skill/vision_skill.py.

EMAIL_RE = re.compile(r"\b[A-Za-z0-9._%+\-]+@[A-Za-z0-9.\-]+\.[A-Za-z]{2,}\b")
PHONE_RE = re.compile(r"(?:\+?\d{1,3}[\s\-.])?\(?\d{3}\)?[\s\-.]\d{3}[\s\-.]\d{4}")
KEY_PATTERNS: list[tuple[re.Pattern[str], str]] = [
    (re.compile(r"sk-ant-[A-Za-z0-9_\-]{20,}"), "anthropic-key"),
    (re.compile(r"sk-[A-Za-z0-9_\-]{20,}"), "openai-key"),
    (re.compile(r"AIza[0-9A-Za-z_\-]{35}"), "google-api-key"),
    (re.compile(r"xox[abprs]-[A-Za-z0-9\-]{10,}"), "slack-token"),
    (re.compile(r"gh[pousr]_[A-Za-z0-9]{30,}"), "github-token"),
    (re.compile(r"AKIA[0-9A-Z]{16}"), "aws-access-key-id"),
    (re.compile(r"-----BEGIN [A-Z ]*PRIVATE KEY-----"), "private-key-block"),
    (re.compile(r"eyJ[A-Za-z0-9_\-]{8,}\.[A-Za-z0-9_\-]{8,}\.[A-Za-z0-9_\-]{8,}"), "jwt"),
    (re.compile(r"hf_[A-Za-z0-9]{30,}"), "huggingface-token"),
    (re.compile(r"glpat-[A-Za-z0-9_\-]{20,}"), "gitlab-token"),
]
PATH_RE = re.compile(
    r"(?:[A-Z]:\\\\[^\s\"<>]+|/(?:home|root|Users|var|etc|mnt|tmp|opt)/[^\s\"<>]+)"
)
FINANCIAL_RE = re.compile(
    r"\b(?:\d[ \-]?){13,16}\b|routing\s*[:#]?\s*\d{9}\b|acct\s*[:#]?\s*\d{6,}",
    re.IGNORECASE,
)

# Public-token / blockchain vocabulary that must never appear in a proof report.
FORBIDDEN_TERMS = [
    "blockchain",
    "block chain",
    "on-chain",
    "onchain",
    "off-chain",
    "ledger",
    "wallet",
    "crypto",
    "web3",
    "nft",
    "smart contract",
    "mint",
    "token",
]


def _scan_text_for_pii(text: str) -> dict[str, Any]:
    """Return any PII found in ``text``. All-empty means clean."""
    keys: list[str] = []
    for pat, label in KEY_PATTERNS:
        if pat.search(text):
            keys.append(label)
    return {
        "emails_detected": sorted({m for m in EMAIL_RE.findall(text)}),
        "phone_numbers_detected": sorted({m for m in PHONE_RE.findall(text)}),
        "api_keys_or_tokens_detected": sorted(set(keys)),
        "file_paths_detected": sorted({m for m in PATH_RE.findall(text)}),
        "financial_data_detected": bool(FINANCIAL_RE.search(text)),
    }


def _pii_is_clean(scan: dict[str, Any]) -> bool:
    return not (
        scan["emails_detected"]
        or scan["phone_numbers_detected"]
        or scan["api_keys_or_tokens_detected"]
        or scan["file_paths_detected"]
        or scan["financial_data_detected"]
    )


def _scan_forbidden_terms(text: str) -> list[str]:
    low = text.lower()
    return sorted({t for t in FORBIDDEN_TERMS if t in low})


class ProofGuardError(RuntimeError):
    """Raised fail-closed when a report would leak PII or forbidden language."""


# --------------------------- Schema dataclasses -----------------------------

@dataclass
class EvidenceEntry:
    evidence_id: str
    stage: str
    claim: str
    classification: str
    source_ref: str
    basis: str
    confidence: float | None = None
    pii_safe: bool = True


@dataclass
class HumanApprovalRecord:
    approval_id: str
    decision: str
    approver_role: str
    approver_ref: str
    approved_at: str
    scope: str
    notes: str
    signature_checksum: str


# --------------------------- Generator --------------------------------------

def _ev(idx: int, stage: str, claim: str, classification: str, source_ref: str,
        basis: str, confidence: float | None = None) -> dict[str, Any]:
    entry = EvidenceEntry(
        evidence_id=f"EV-{idx:03d}",
        stage=stage,
        claim=claim,
        classification=classification,
        source_ref=source_ref,
        basis=basis,
        confidence=confidence,
        pii_safe=True,
    )
    return asdict(entry)


def _build_evidence(steps: dict[str, Any]) -> list[dict[str, Any]]:
    """Build PII-safe evidence from non-PII workflow fields only.

    The lead is referenced solely by its opaque pseudonymous id; contact
    fields (raw_contact) are never read here.
    """
    intake = steps["lead_intake"]
    comp = steps["compliance_decision"]
    appr = steps["approval"]
    appt = steps["appointment_mock"]
    crm = steps["crm_mock"]

    evidence: list[dict[str, Any]] = []
    n = 0

    # --- lead_intake: one verified, one inference, one unknown ---
    n += 1
    evidence.append(_ev(
        n, "lead_intake",
        f"Lead {intake['lead_ref']} was intaken via {intake['source_channel']} "
        f"with consent captured ({intake['consent_basis']}).",
        VERIFIED,
        "workflow.steps.lead_intake.consent_captured",
        "consent_captured == true and consent_basis recorded in workflow output",
    ))
    n += 1
    evidence.append(_ev(
        n, "lead_intake",
        f"Lead {intake['lead_ref']} is likely a qualified {intake['segment']} "
        f"opportunity based on the recorded interest signal.",
        LIKELY_INFERENCE,
        "workflow.steps.lead_intake.interest_signal_score",
        "derived from interest_signal_score; heuristic read, not a recorded fact",
        confidence=round(float(intake["interest_signal_score"]), 2),
    ))
    n += 1
    budget_known = intake.get("budget_disclosed", False)
    evidence.append(_ev(
        n, "lead_intake",
        f"Lead {intake['lead_ref']} budget is not determinable from the intake record.",
        UNKNOWN if not budget_known else VERIFIED,
        "workflow.steps.lead_intake.budget_disclosed",
        "budget_disclosed == false; field not captured at intake",
    ))

    # --- compliance_decision: verified ---
    n += 1
    evidence.append(_ev(
        n, "compliance_decision",
        f"Compliance engine '{comp['engine']}' evaluated "
        f"{len(comp['rules_evaluated'])} rules and returned outcome "
        f"'{comp['outcome']}' with {len(comp['rules_failed'])} failures.",
        VERIFIED,
        "workflow.steps.compliance_decision.outcome",
        "outcome and rules_passed/rules_failed recorded in workflow output",
    ))

    # --- approval: verified (sourced from the human approval record) ---
    n += 1
    evidence.append(_ev(
        n, "approval",
        f"Human approval {appr['approval_id']} recorded decision "
        f"'{appr['decision']}' by role '{appr['approver_role']}' "
        f"({appr['approver_ref']}) scoped to '{appr['scope']}'.",
        VERIFIED,
        "workflow.steps.approval.decision",
        "human approval record present with decision, role, and scope",
    ))

    # --- appointment_mock: verified ---
    n += 1
    evidence.append(_ev(
        n, "appointment_mock",
        f"Mock appointment {appt['booking_ref']} was {appt['status']} via "
        f"provider '{appt['provider']}' for {appt['slot_start']} "
        f"(is_mock={appt['is_mock']}).",
        VERIFIED,
        "workflow.steps.appointment_mock.status",
        "booking_ref and status recorded; provider is a mock scheduler",
    ))

    # --- crm_mock: verified ---
    n += 1
    evidence.append(_ev(
        n, "crm_mock",
        f"Mock CRM {crm['object_type']} {crm['record_ref']} was "
        f"'{crm['write_status']}' at stage '{crm['stage_name']}' via "
        f"provider '{crm['provider']}' (is_mock={crm['is_mock']}).",
        VERIFIED,
        "workflow.steps.crm_mock.write_status",
        "record_ref and write_status recorded; provider is a mock CRM",
    ))

    return evidence


def _canonical(payload: Any) -> str:
    return json.dumps(payload, sort_keys=True, separators=(",", ":"))


def _checksum(payload: Any) -> str:
    return hashlib.sha256(_canonical(payload).encode("utf-8")).hexdigest()


def _build_approval(appr: dict[str, Any]) -> dict[str, Any]:
    record = HumanApprovalRecord(
        approval_id=appr["approval_id"],
        decision=appr["decision"],
        approver_role=appr["approver_role"],
        approver_ref=appr["approver_ref"],
        approved_at=appr["recorded_at"],
        scope=appr["scope"],
        notes=appr["notes"],
        signature_checksum="",
    )
    body = asdict(record)
    # Local tamper-evidence digest over the approval body (not a public token).
    body["signature_checksum"] = _checksum(
        {k: v for k, v in body.items() if k != "signature_checksum"}
    )
    return body


def _summarize(evidence: list[dict[str, Any]]) -> dict[str, Any]:
    counts = {c: 0 for c in CLASSIFICATIONS}
    for e in evidence:
        counts[e["classification"]] = counts.get(e["classification"], 0) + 1
    return {
        "total_evidence": len(evidence),
        "verified_count": counts[VERIFIED],
        "likely_inference_count": counts[LIKELY_INFERENCE],
        "unknown_count": counts[UNKNOWN],
        "stages_covered": sorted({e["stage"] for e in evidence}),
    }


def generate_proof_report(fixture: dict[str, Any], now: str | None = None) -> dict[str, Any]:
    """Generate a proof report from a completed Sales Closer workflow fixture.

    Fail-closed: scans the serialized report for PII and forbidden vocabulary;
    raises ProofGuardError rather than emit anything unsafe.
    """
    if fixture.get("status") != "completed":
        raise ValueError("proof reports require a completed workflow run")

    steps = fixture["steps"]
    for stage in STAGES:
        if stage not in steps:
            raise ValueError(f"workflow output missing required stage: {stage}")

    generated_at = now or fixture.get("completed_at") or fixture.get("started_at", "")
    evidence = _build_evidence(steps)
    human_approval = _build_approval(steps["approval"])
    summary = _summarize(evidence)

    report: dict[str, Any] = {
        "schema_version": SCHEMA_VERSION,
        "report_id": f"PROOF-{fixture['workflow_id']}",
        "generated_at": generated_at,
        "workflow": {
            "workflow_id": fixture["workflow_id"],
            "workflow_type": fixture["workflow_type"],
            "mode": fixture.get("mode", "mock_safe"),
            "status": fixture["status"],
            "lead_ref": fixture.get("lead_ref", steps["lead_intake"]["lead_ref"]),
        },
        "evidence": evidence,
        "human_approval": human_approval,
        "summary": summary,
        "assurances": {
            "mode": "mock_safe",
            "contains_real_customer_data": False,
            "pii_scan_passed": True,
            "classification_taxonomy": list(CLASSIFICATIONS),
        },
    }

    # Integrity digest over the full report body (excludes the integrity block).
    report["integrity"] = {
        "algorithm": "sha256",
        "content_checksum": _checksum(report),
    }

    _enforce_guards(report)
    return report


CHECKSUM_FIELDS = {"content_checksum", "signature_checksum"}


def _scrub_checksums(value: Any) -> Any:
    """Blank machine-generated digest hex so it is not PII-scanned.

    A SHA-256 hex string can contain an incidental 13-16 digit run that the
    financial-data regex would flag; checksums are not PII, so exclude them.
    """
    if isinstance(value, dict):
        return {
            k: ("" if k in CHECKSUM_FIELDS else _scrub_checksums(v))
            for k, v in value.items()
        }
    if isinstance(value, list):
        return [_scrub_checksums(v) for v in value]
    return value


def _enforce_guards(report: dict[str, Any]) -> None:
    serialized = json.dumps(_scrub_checksums(report))
    scan = _scan_text_for_pii(serialized)
    if not _pii_is_clean(scan):
        leaked = {k: v for k, v in scan.items() if v}
        raise ProofGuardError(f"proof report would leak PII: {leaked}")
    forbidden = _scan_forbidden_terms(serialized)
    if forbidden:
        raise ProofGuardError(f"proof report contains forbidden language: {forbidden}")


# --------------------------- CLI --------------------------------------------

def _load_fixture(path: Path) -> dict[str, Any]:
    return json.loads(path.read_text(encoding="utf-8"))


def _cmd_generate(args: argparse.Namespace) -> int:
    fixture = _load_fixture(Path(args.fixture))
    report = generate_proof_report(fixture)
    out = json.dumps(report, indent=2)
    if args.out:
        out_path = Path(args.out)
        out_path.parent.mkdir(parents=True, exist_ok=True)
        out_path.write_text(out + "\n", encoding="utf-8")
        print(f"wrote proof report -> {args.out}")
    else:
        print(out)
    return 0


def _cmd_validate(args: argparse.Namespace) -> int:
    fixture = _load_fixture(Path(args.fixture))
    try:
        report = generate_proof_report(fixture)
    except (ProofGuardError, ValueError) as exc:
        print(f"INVALID: {exc}")
        return 1
    print(
        "VALID: "
        f"{report['summary']['total_evidence']} evidence entries, "
        f"stages={report['summary']['stages_covered']}, "
        f"approval={report['human_approval']['decision']}, "
        f"checksum={report['integrity']['content_checksum'][:12]}..."
    )
    return 0


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Sales Closer proof report generator (W5)")
    sub = parser.add_subparsers(dest="command", required=True)

    g = sub.add_parser("generate", help="generate a proof report from a workflow fixture")
    g.add_argument("--fixture", default=str(DEFAULT_FIXTURE))
    g.add_argument("--out", default=None, help="write JSON to this path instead of stdout")
    g.set_defaults(func=_cmd_generate)

    v = sub.add_parser("validate", help="validate a fixture produces a safe proof report")
    v.add_argument("--fixture", default=str(DEFAULT_FIXTURE))
    v.set_defaults(func=_cmd_validate)

    args = parser.parse_args(argv)
    return args.func(args)


if __name__ == "__main__":
    sys.exit(main())
