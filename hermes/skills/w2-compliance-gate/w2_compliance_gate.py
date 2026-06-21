#!/usr/bin/env python3
"""Hermes W2 compliance gate.

Runtime compliance / approval gate for the Cognitia "Client Zero" pipeline.
The W1 Sales Closer workflow MUST route every outbound action (message send,
appointment booking, CRM writeback) through ``evaluate()`` before it executes.
The W4 operator console renders the resulting hold packet so a human can
release or reject held actions via ``apply_operator_decision()``.

Decisions:
    ALLOW             -> safe to proceed automatically.
    REQUIRE_APPROVAL  -> hard-stop; a human must approve before proceeding.
    BLOCK             -> hard-stop; cannot proceed (and cannot be approved away).

Hard rules enforced (fail-closed):
    * No live channels        -> only sandbox/simulated channels may proceed.
    * No legal conclusions     -> content asserting legal conclusions is blocked.
    * No raw PII               -> all outputs/logs are redacted.
    * Finance / trade-in / APR / payment / approval claims -> human approval.
    * Appointment / CRM writeback -> human approval per policy.

Detectors are regex-based advisory hard-stops, not a bypass-proof guarantee.
Any internal error converts to a BLOCK (fail-closed). The gate never raises on
a policy outcome -- it returns a decision.

Tools:
    evaluate  -> w2_evaluate_request
    resolve   -> w2_apply_operator_decision

Read-only policy engine. No network. No external uploads. No file deletion.
"""

from __future__ import annotations

import argparse
import copy
import datetime as _dt
import json
import logging
import re
import sys
import uuid
from dataclasses import asdict, dataclass, field
from enum import Enum
from typing import Any

SKILL_NAME = "hermes-w2-compliance-gate"
SKILL_VERSION = "0.1.0"

LOG = logging.getLogger("hermes.w2")


# --------------------------- Logging ----------------------------------------

class _RedactingFilter(logging.Filter):
    def filter(self, record: logging.LogRecord) -> bool:
        try:
            record.msg = _redact(str(record.msg))
        except Exception:
            pass
        return True


def _configure_logging(level: int = logging.INFO) -> None:
    handler = logging.StreamHandler(sys.stderr)
    handler.addFilter(_RedactingFilter())
    handler.setFormatter(logging.Formatter("%(asctime)s [%(levelname)s] %(name)s: %(message)s"))
    root = logging.getLogger()
    root.handlers.clear()
    root.addHandler(handler)
    root.setLevel(level)


# --------------------------- PII regex / redaction --------------------------
# Mirrors the shapes used by the sibling hermes-vision skill so redaction is
# consistent across the pipeline.

EMAIL_RE = re.compile(r"\b[A-Za-z0-9._%+\-]+@[A-Za-z0-9.\-]+\.[A-Za-z]{2,}\b")
PHONE_RE = re.compile(
    r"(?:\+?\d{1,3}[\s\-.])?\(?\d{3}\)?[\s\-.]\d{3}[\s\-.]\d{4}"
)
SSN_RE = re.compile(r"\b\d{3}-\d{2}-\d{4}\b")
FINANCIAL_RE = re.compile(
    r"\b(?:\d[ \-]?){13,16}\b|routing\s*[:#]?\s*\d{9}\b|acct\s*[:#]?\s*\d{6,}",
    re.IGNORECASE,
)
# Lead-record keys that carry PII and are masked when echoed back.
PII_LEAD_KEYS = ("name", "full_name", "first_name", "last_name",
                 "phone", "phone_number", "email", "address", "ssn")


def _redact(text: str) -> str:
    """Scrub PII tokens from a string. Always safe to call on any output."""
    if not text:
        return text
    text = EMAIL_RE.sub("[EMAIL_REDACTED]", text)
    text = SSN_RE.sub("[SSN_REDACTED]", text)
    text = PHONE_RE.sub("[PHONE_REDACTED]", text)
    text = FINANCIAL_RE.sub("[FIN_REDACTED]", text)
    return text


def _content_has_pii(text: str) -> list[str]:
    """Return the kinds of PII authored into a free-text string."""
    kinds: list[str] = []
    if EMAIL_RE.search(text):
        kinds.append("email")
    if SSN_RE.search(text):
        kinds.append("ssn")
    if PHONE_RE.search(text):
        kinds.append("phone")
    if FINANCIAL_RE.search(text):
        kinds.append("financial_number")
    return kinds


def _redact_lead(lead: dict[str, Any]) -> dict[str, Any]:
    """Return a copy of a lead record with PII fields masked."""
    masked: dict[str, Any] = {}
    for key, value in (lead or {}).items():
        if key.lower() in PII_LEAD_KEYS:
            masked[key] = "[PII_REDACTED]"
        elif isinstance(value, str):
            masked[key] = _redact(value)
        else:
            masked[key] = value
    return masked


# --------------------------- Taxonomy ---------------------------------------

class Decision(str, Enum):
    ALLOW = "ALLOW"
    REQUIRE_APPROVAL = "REQUIRE_APPROVAL"
    BLOCK = "BLOCK"


class ReasonCode(str, Enum):
    # --- hard BLOCK codes ---
    CONSENT_MISSING = "CONSENT_MISSING"
    LIVE_CHANNEL = "LIVE_CHANNEL"
    UNKNOWN_CHANNEL = "UNKNOWN_CHANNEL"
    LEGAL_CONCLUSION = "LEGAL_CONCLUSION"
    MISSING_FIELD = "MISSING_FIELD"
    INTERNAL_ERROR = "INTERNAL_ERROR"
    # --- REQUIRE_APPROVAL codes ---
    FINANCE_CLAIM = "FINANCE_CLAIM"
    TRADE_IN_CLAIM = "TRADE_IN_CLAIM"
    APR_PAYMENT_CLAIM = "APR_PAYMENT_CLAIM"
    APPROVAL_CLAIM = "APPROVAL_CLAIM"
    APPOINTMENT_WRITE_NEEDS_APPROVAL = "APPOINTMENT_WRITE_NEEDS_APPROVAL"
    CRM_WRITEBACK_NEEDS_APPROVAL = "CRM_WRITEBACK_NEEDS_APPROVAL"
    POLICY_OVERRIDE = "POLICY_OVERRIDE"
    # --- special ---
    RAW_PII = "RAW_PII"  # always redacted; approval governed by policy


# Single source of truth for verdict precedence.
BLOCKING_CODES = frozenset({
    ReasonCode.CONSENT_MISSING,
    ReasonCode.LIVE_CHANNEL,
    ReasonCode.UNKNOWN_CHANNEL,
    ReasonCode.LEGAL_CONCLUSION,
    ReasonCode.MISSING_FIELD,
    ReasonCode.INTERNAL_ERROR,
})

APPROVAL_CODES = frozenset({
    ReasonCode.FINANCE_CLAIM,
    ReasonCode.TRADE_IN_CLAIM,
    ReasonCode.APR_PAYMENT_CLAIM,
    ReasonCode.APPROVAL_CLAIM,
    ReasonCode.APPOINTMENT_WRITE_NEEDS_APPROVAL,
    ReasonCode.CRM_WRITEBACK_NEEDS_APPROVAL,
    ReasonCode.POLICY_OVERRIDE,
    ReasonCode.RAW_PII,
})


# --------------------------- Channel allowlist ------------------------------

SANDBOX_CHANNELS = frozenset({
    "sandbox", "simulator", "simulated", "sandbox_sms", "sandbox_email",
    "sandbox_voice", "dry_run", "test", "console",
})
LIVE_CHANNELS = frozenset({
    "sms", "email", "voice", "whatsapp", "telephony", "phone", "call",
})


def _normalize_channel(channel: str) -> str:
    return (channel or "").strip().lower()


def _channel_family(channel: str) -> str:
    """Map a channel to its consent family (sms/email/voice/...)."""
    c = _normalize_channel(channel)
    for fam in ("sms", "email", "voice", "whatsapp", "phone", "call"):
        if fam in c:
            return "voice" if fam in ("phone", "call") else fam
    return c or "unknown"


def classify_channel(channel: str) -> ReasonCode | None:
    """Return a blocking ReasonCode for a channel, or None if it is allowed.

    Fail-closed: a channel that is neither a known sandbox nor a known live
    token is UNKNOWN_CHANNEL, never allowed.
    """
    c = _normalize_channel(channel)
    if c in SANDBOX_CHANNELS or c.startswith("sandbox_") or c.startswith("sim_"):
        return None
    if c in LIVE_CHANNELS:
        return ReasonCode.LIVE_CHANNEL
    return ReasonCode.UNKNOWN_CHANNEL


# --------------------------- Content detectors ------------------------------
# (regex, ReasonCode, approval requirement type). All advisory hard-stops.

DETECTORS: list[tuple[re.Pattern[str], ReasonCode, str]] = [
    (re.compile(r"\b(financ\w+|loan|credit|interest\s+rate|down\s?payment|lease|lender)\b", re.I),
     ReasonCode.FINANCE_CLAIM, "FINANCE"),
    (re.compile(r"\btrade[\-\s]?in\b|\bappraisal\b|\byour\s+trade\b", re.I),
     ReasonCode.TRADE_IN_CLAIM, "TRADE_IN"),
    (re.compile(r"\bAPR\b|\bannual\s+percentage\s+rate\b|\bmonthly\s+payment\b"
                r"|\$\s?\d[\d,]*\s*(?:/|per)\s*(?:mo|month)\b", re.I),
     ReasonCode.APR_PAYMENT_CLAIM, "APR_PAYMENT"),
    (re.compile(r"\b(pre[\-\s]?approv\w+|approved\s+for|you(?:'re|\s+are)\s+approved"
                r"|guaranteed\s+approval|qualif\w+)\b", re.I),
     ReasonCode.APPROVAL_CLAIM, "APPROVAL_CLAIM"),
    (re.compile(r"\b(legally\s+binding|you\s+are\s+liable|constitutes?\s+a\s+contract"
                r"|legally\s+(?:obligated|required)|in\s+violation\s+of|lawsuit"
                r"|warrant\w*\s+that)\b", re.I),
     ReasonCode.LEGAL_CONCLUSION, "LEGAL"),
]

REQUIREMENT_TYPE_BY_CODE = {code: req for _, code, req in DETECTORS}


# --------------------------- Data model -------------------------------------

@dataclass
class ComplianceRequest:
    request_id: str = ""
    workflow: str = "W1"
    channel: str = ""
    intent: str = ""
    content: str = ""
    lead: dict[str, Any] = field(default_factory=dict)
    consent: dict[str, Any] = field(default_factory=dict)
    metadata: dict[str, Any] = field(default_factory=dict)
    policy: dict[str, Any] = field(default_factory=dict)

    @classmethod
    def from_dict(cls, data: dict[str, Any] | "ComplianceRequest") -> "ComplianceRequest":
        if isinstance(data, ComplianceRequest):
            return data
        data = data or {}
        return cls(
            request_id=str(data.get("request_id", "") or ""),
            workflow=str(data.get("workflow", "W1") or "W1"),
            channel=str(data.get("channel", "") or ""),
            intent=str(data.get("intent", "") or ""),
            content=str(data.get("content", "") or ""),
            lead=dict(data.get("lead", {}) or {}),
            consent=dict(data.get("consent", {}) or {}),
            metadata=dict(data.get("metadata", {}) or {}),
            policy=dict(data.get("policy", {}) or {}),
        )


@dataclass
class ApprovalRequirement:
    type: str
    reason: str
    blocking: bool
    code: ReasonCode

    def to_dict(self) -> dict[str, Any]:
        d = asdict(self)
        d["code"] = self.code.value
        return d


@dataclass
class Finding:
    code: ReasonCode
    detail: str
    span: str | None = None

    def to_dict(self) -> dict[str, Any]:
        return {"code": self.code.value, "detail": self.detail, "span": self.span}


@dataclass
class ComplianceDecision:
    request_id: str
    decision: Decision
    reasons: list[ReasonCode] = field(default_factory=list)
    findings: list[Finding] = field(default_factory=list)
    approvals_required: list[ApprovalRequirement] = field(default_factory=list)
    redacted_content: str = ""
    redacted_lead: dict[str, Any] = field(default_factory=dict)
    safe_to_send: bool = False
    hold_token: str | None = None
    audit: list[dict[str, Any]] = field(default_factory=list)
    schema_version: str = SKILL_VERSION

    def to_dict(self) -> dict[str, Any]:
        return {
            "request_id": self.request_id,
            "decision": self.decision.value,
            "reasons": [r.value for r in self.reasons],
            "findings": [f.to_dict() for f in self.findings],
            "approvals_required": [a.to_dict() for a in self.approvals_required],
            "redacted_content": self.redacted_content,
            "redacted_lead": self.redacted_lead,
            "safe_to_send": self.safe_to_send,
            "hold_token": self.hold_token,
            "audit": self.audit,
            "schema_version": self.schema_version,
        }


# Keys present in every decision payload (schema contract for W1/W4).
DECISION_SCHEMA = [
    "request_id", "decision", "reasons", "findings", "approvals_required",
    "redacted_content", "redacted_lead", "safe_to_send", "hold_token",
    "audit", "schema_version",
]


# --------------------------- Hold store -------------------------------------
# In-memory for v0.1; isolated behind two functions so it can be swapped for a
# durable backend (sqlite/file) without touching the decision logic.

_HOLD_STORE: dict[str, dict[str, Any]] = {}


def _store_hold(token: str, request: ComplianceRequest, decision: ComplianceDecision) -> None:
    _HOLD_STORE[token] = {
        "request": request,
        "decision": decision,
        "resolved": None,  # set to a resolved ComplianceDecision once an operator acts
        "operator_id": None,
    }


def _load_hold(token: str) -> dict[str, Any] | None:
    return _HOLD_STORE.get(token)


def reset_hold_store() -> None:
    """Test helper: clear the in-memory hold store."""
    _HOLD_STORE.clear()


# --------------------------- Policy defaults --------------------------------

def _policy(request: ComplianceRequest, key: str, default: bool) -> bool:
    val = request.policy.get(key)
    return default if val is None else bool(val)


# Intents that imply an outbound message send to the lead.
SEND_INTENTS = frozenset({"send_message", "send", "outbound_message", "reply"})


def _required_fields_for(intent: str) -> list[str]:
    """Intent-aware required-field matrix (request_id is always required)."""
    if intent in SEND_INTENTS:
        return ["channel", "content"]
    if intent in ("book_appointment", "crm_writeback"):
        return ["intent"]
    return ["intent"]


# --------------------------- Core evaluation --------------------------------

def evaluate(request: ComplianceRequest | dict[str, Any]) -> ComplianceDecision:
    """Evaluate a proposed W1 action against compliance policy.

    Collects ALL findings (no short-circuit) so the W4 operator sees the full
    picture, then resolves the verdict by precedence BLOCK > REQUIRE_APPROVAL >
    ALLOW. Never raises: any internal error becomes a fail-closed BLOCK.
    """
    try:
        req = ComplianceRequest.from_dict(request)
        return _evaluate(req)
    except Exception as exc:  # fail-closed
        LOG.error("evaluate failed: %s", exc)
        rid = ""
        try:
            rid = ComplianceRequest.from_dict(request).request_id
        except Exception:
            pass
        return ComplianceDecision(
            request_id=rid,
            decision=Decision.BLOCK,
            reasons=[ReasonCode.INTERNAL_ERROR],
            findings=[Finding(ReasonCode.INTERNAL_ERROR, "internal error during evaluation")],
            redacted_content="",
            redacted_lead={},
            safe_to_send=False,
        )


# Public alias documenting the must-call-before-send semantics for W1.
guard_send = evaluate


def _evaluate(req: ComplianceRequest) -> ComplianceDecision:
    reasons: list[ReasonCode] = []
    findings: list[Finding] = []
    approvals: list[ApprovalRequirement] = []

    # Redaction always runs, regardless of verdict, so no raw PII ever leaves.
    redacted_content = _redact(req.content)
    redacted_lead = _redact_lead(req.lead)

    def add(code: ReasonCode, detail: str, span: str | None = None) -> None:
        if code not in reasons:
            reasons.append(code)
        findings.append(Finding(code, detail, span))

    def add_approval(code: ReasonCode, reason: str, req_type: str) -> None:
        approvals.append(ApprovalRequirement(type=req_type, reason=reason, blocking=True, code=code))

    # 1. Structural validation (intent-aware).
    if not req.request_id:
        add(ReasonCode.MISSING_FIELD, "request_id is required")
    for fname in _required_fields_for(req.intent):
        if not getattr(req, fname, ""):
            add(ReasonCode.MISSING_FIELD, f"{fname} is required for intent '{req.intent or '(none)'}'")

    # 2. Channel check (fail-closed).
    chan_code = classify_channel(req.channel)
    if chan_code is not None:
        label = "live" if chan_code is ReasonCode.LIVE_CHANNEL else "unknown"
        add(chan_code, f"{label} channel not permitted: {_normalize_channel(req.channel) or '(empty)'}")

    # 3. Consent check (sandbox sends still require the flag by default).
    consent_required_in_sandbox = _policy(req, "consent_required_in_sandbox", True)
    implies_send = req.intent in SEND_INTENTS
    is_sandbox = chan_code is None
    if implies_send and (consent_required_in_sandbox or not is_sandbox):
        family = _channel_family(req.channel)
        if not bool(req.consent.get(family)):
            add(ReasonCode.CONSENT_MISSING, f"no consent on record for channel family '{family}'")

    # 4-6. Content detectors over content + string metadata values.
    scan_text = " ".join(
        [req.content] + [str(v) for v in req.metadata.values() if isinstance(v, str)]
    )
    for pattern, code, req_type in DETECTORS:
        m = pattern.search(scan_text)
        if m:
            span = _redact(m.group(0))
            add(code, f"{req_type.lower()} language detected", span)
            if code in APPROVAL_CODES:
                add_approval(code, f"{req_type} claim requires human review: '{span}'", req_type)

    # 5. PII authored into outbound content -> redact (already done) + approval.
    pii_in_content = _content_has_pii(req.content)
    if pii_in_content:
        if _policy(req, "pii_in_content_requires_approval", True):
            add(ReasonCode.RAW_PII, f"PII authored into outbound content: {sorted(set(pii_in_content))}")
            add_approval(ReasonCode.RAW_PII, "outbound content contains PII; confirm intended", "PII")

    # 7. Intent-based approval (appointment / CRM writeback).
    if req.intent == "book_appointment" and _policy(req, "require_approval_for_appointment", True):
        add(ReasonCode.APPOINTMENT_WRITE_NEEDS_APPROVAL, "appointment booking requires human approval")
        add_approval(ReasonCode.APPOINTMENT_WRITE_NEEDS_APPROVAL,
                     "appointment writeback requires human approval", "APPOINTMENT")
    if req.intent == "crm_writeback" and _policy(req, "require_approval_for_crm_writeback", True):
        add(ReasonCode.CRM_WRITEBACK_NEEDS_APPROVAL, "CRM writeback requires human approval")
        add_approval(ReasonCode.CRM_WRITEBACK_NEEDS_APPROVAL,
                     "CRM writeback requires human approval", "CRM_WRITEBACK")

    # Verdict resolution: BLOCK > REQUIRE_APPROVAL > ALLOW.
    decision = _resolve(reasons)

    hold_token: str | None = None
    out = ComplianceDecision(
        request_id=req.request_id,
        decision=decision,
        reasons=reasons,
        findings=findings,
        approvals_required=approvals,
        redacted_content=redacted_content,
        redacted_lead=redacted_lead,
        safe_to_send=(decision is Decision.ALLOW),
        hold_token=None,
    )
    if decision is Decision.REQUIRE_APPROVAL:
        hold_token = uuid.uuid4().hex
        out.hold_token = hold_token
        _store_hold(hold_token, req, out)
    return out


def _resolve(reasons: list[ReasonCode]) -> Decision:
    if any(r in BLOCKING_CODES for r in reasons):
        return Decision.BLOCK
    if any(r in APPROVAL_CODES for r in reasons):
        return Decision.REQUIRE_APPROVAL
    return Decision.ALLOW


# --------------------------- W4 operator contract ---------------------------

@dataclass
class OperatorPacket:
    hold_token: str
    request_id: str
    decision: Decision
    reasons: list[ReasonCode]
    approvals_required: list[ApprovalRequirement]
    redacted_content: str
    redacted_lead: dict[str, Any]
    created_at: str

    def to_dict(self) -> dict[str, Any]:
        return {
            "hold_token": self.hold_token,
            "request_id": self.request_id,
            "decision": self.decision.value,
            "reasons": [r.value for r in self.reasons],
            "approvals_required": [a.to_dict() for a in self.approvals_required],
            "redacted_content": self.redacted_content,
            "redacted_lead": self.redacted_lead,
            "created_at": self.created_at,
        }


def to_operator_packet(decision: ComplianceDecision) -> OperatorPacket:
    """Build the redacted packet W4 renders for a held decision."""
    return OperatorPacket(
        hold_token=decision.hold_token or "",
        request_id=decision.request_id,
        decision=decision.decision,
        reasons=list(decision.reasons),
        approvals_required=list(decision.approvals_required),
        redacted_content=decision.redacted_content,
        redacted_lead=decision.redacted_lead,
        created_at=_dt.datetime.now(_dt.timezone.utc).isoformat(),
    )


@dataclass
class OperatorDecision:
    hold_token: str
    operator_id: str
    action: str  # "approve" | "reject"
    note: str = ""


def apply_operator_decision(op: OperatorDecision | dict[str, Any]) -> ComplianceDecision:
    """Resolve a held action from the W4 operator console.

    Safety invariants:
      * Only REQUIRE_APPROVAL holds can be released. If the original request
        also tripped any hard-blocking code, approval is refused and the
        verdict stays BLOCK -- operators can never bypass a hard block.
      * Approval re-validates the blocking layer at release time so a hold
        cannot be approved into a state that has since become unsafe.
      * Idempotent: replaying the same operator's decision returns the stored
        resolved decision; a conflicting operator on a resolved hold is
        refused. Unknown token -> fail-closed BLOCK.
    """
    if isinstance(op, dict):
        op = OperatorDecision(
            hold_token=str(op.get("hold_token", "") or ""),
            operator_id=str(op.get("operator_id", "") or ""),
            action=str(op.get("action", "") or ""),
            note=str(op.get("note", "") or ""),
        )

    entry = _load_hold(op.hold_token)
    if entry is None:
        LOG.warning("operator decision on unknown hold token")
        return ComplianceDecision(
            request_id="",
            decision=Decision.BLOCK,
            reasons=[ReasonCode.MISSING_FIELD],
            findings=[Finding(ReasonCode.MISSING_FIELD, "unknown or expired hold token")],
            safe_to_send=False,
        )

    request: ComplianceRequest = entry["request"]
    original: ComplianceDecision = entry["decision"]
    redacted_note = _redact(op.note)

    # Idempotency: a hold already resolved.
    if entry["resolved"] is not None:
        if entry["operator_id"] == op.operator_id:
            return entry["resolved"]
        LOG.warning("conflicting operator decision on already-resolved hold; refused")
        return entry["resolved"]

    # Re-validate the blocking layer against the stored snapshot.
    fresh = _evaluate(copy.deepcopy(request))
    hard_blockers = [r for r in fresh.reasons if r in BLOCKING_CODES]

    if op.action == "approve":
        if hard_blockers:
            resolved = ComplianceDecision(
                request_id=request.request_id,
                decision=Decision.BLOCK,
                reasons=fresh.reasons,
                findings=fresh.findings,
                approvals_required=original.approvals_required,
                redacted_content=original.redacted_content,
                redacted_lead=original.redacted_lead,
                safe_to_send=False,
                audit=[{
                    "operator_id": op.operator_id,
                    "action": "approve_refused_hard_block",
                    "note": redacted_note,
                    "at": _dt.datetime.now(_dt.timezone.utc).isoformat(),
                }],
            )
        else:
            resolved = ComplianceDecision(
                request_id=request.request_id,
                decision=Decision.ALLOW,
                reasons=original.reasons,
                findings=original.findings,
                approvals_required=original.approvals_required,
                redacted_content=original.redacted_content,
                redacted_lead=original.redacted_lead,
                safe_to_send=True,
                hold_token=op.hold_token,
                audit=[{
                    "operator_id": op.operator_id,
                    "action": "approved",
                    "note": redacted_note,
                    "at": _dt.datetime.now(_dt.timezone.utc).isoformat(),
                }],
            )
    elif op.action == "reject":
        resolved = ComplianceDecision(
            request_id=request.request_id,
            decision=Decision.BLOCK,
            reasons=list(original.reasons) + [ReasonCode.POLICY_OVERRIDE],
            findings=original.findings,
            approvals_required=original.approvals_required,
            redacted_content=original.redacted_content,
            redacted_lead=original.redacted_lead,
            safe_to_send=False,
            hold_token=op.hold_token,
            audit=[{
                "operator_id": op.operator_id,
                "action": "rejected",
                "note": redacted_note,
                "at": _dt.datetime.now(_dt.timezone.utc).isoformat(),
            }],
        )
    else:
        return ComplianceDecision(
            request_id=request.request_id,
            decision=Decision.BLOCK,
            reasons=[ReasonCode.MISSING_FIELD],
            findings=[Finding(ReasonCode.MISSING_FIELD, f"invalid operator action: {op.action!r}")],
            safe_to_send=False,
        )

    entry["resolved"] = resolved
    entry["operator_id"] = op.operator_id
    return resolved


# --------------------------- MCP tool wrappers ------------------------------

def w2_evaluate_request(request: dict[str, Any]) -> dict[str, Any]:
    """MCP/JSON entrypoint: evaluate a proposed W1 action -> decision dict."""
    return evaluate(request).to_dict()


def w2_apply_operator_decision(operator_decision: dict[str, Any]) -> dict[str, Any]:
    """MCP/JSON entrypoint: resolve a held action -> decision dict."""
    return apply_operator_decision(operator_decision).to_dict()


# --------------------------- CLI --------------------------------------------

def _read_json_arg(value: str) -> dict[str, Any]:
    if value == "-":
        return json.loads(sys.stdin.read())
    return json.loads(value)


def main(argv: list[str] | None = None) -> int:
    _configure_logging()
    parser = argparse.ArgumentParser(prog="w2_compliance_gate", description=SKILL_NAME)
    parser.add_argument("--mcp", action="store_true", help="run as an MCP stdio server")
    sub = parser.add_subparsers(dest="command")

    p_eval = sub.add_parser("evaluate", help="evaluate a proposed W1 action")
    p_eval.add_argument("--json", required=True, help="request JSON ('-' for stdin)")

    p_resolve = sub.add_parser("resolve", help="apply a W4 operator decision")
    p_resolve.add_argument("--json", required=True, help="operator decision JSON ('-' for stdin)")

    args = parser.parse_args(argv)

    if args.mcp:
        return _run_mcp()

    if args.command == "evaluate":
        out = w2_evaluate_request(_read_json_arg(args.json))
        print(json.dumps(out, indent=2))
        return 0
    if args.command == "resolve":
        out = w2_apply_operator_decision(_read_json_arg(args.json))
        print(json.dumps(out, indent=2))
        return 0

    parser.print_help()
    return 0


def _run_mcp() -> int:
    try:
        from mcp.server.fastmcp import FastMCP
    except Exception as exc:  # pragma: no cover - optional dependency
        LOG.error("mcp package not installed: %s", exc)
        return 1

    server = FastMCP(SKILL_NAME)

    @server.tool()
    def w2_evaluate(request: dict) -> dict:
        """Evaluate a proposed W1 Sales Closer action against compliance policy."""
        return w2_evaluate_request(request)

    @server.tool()
    def w2_resolve(operator_decision: dict) -> dict:
        """Apply a W4 operator approve/reject decision to a held action."""
        return w2_apply_operator_decision(operator_decision)

    server.run()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
