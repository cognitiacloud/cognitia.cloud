#!/usr/bin/env python3
"""Hermes CRM / appointment mock skill (pipeline role: W3).

Mock-only appointment booking and CRM writeback adapters for the
Cognitia / Demandara "Client Zero" pipeline. This stage (W3) sits between
an upstream workflow (W1, which submits booking / writeback requests) and a
downstream proof harness (W5, which verifies that side effects only happened
when they were allowed to).

Tools:
    book      -> book_appointment
    writeback -> crm_writeback
    get       -> get_record
    proof     -> get_proof_ledger

Hard rules (enforced by construction):
    - MOCK ONLY. No real CRM, calendar, email, SMS, phone calls, vendor API,
      or network access of any kind.
    - No real credentials are read or required.
    - All effects are writes to a local JSON mock store (the skill's own
      state dir); nothing leaves the machine.
    - Idempotent: a repeated idempotency key never creates a duplicate
      appointment / CRM record.
    - A writeback only happens AFTER compliance passes AND approval is
      granted; otherwise it is refused and recorded as blocked.

Output is proof-reportable: every call appends to an append-only, schema'd
event ledger that W5 consumes via get_proof_ledger().
"""

from __future__ import annotations

import argparse
import contextlib
import hashlib
import json
import logging
import os
import re
import sys
import threading
import uuid
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

SKILL_NAME = "hermes-crm-appointment"
SKILL_VERSION = "0.1.0"

LOG = logging.getLogger("hermes.crm")


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


# --------------------------- Privacy regex ----------------------------------
# Reused from the Hermes vision skill so that contact PII and any leaked
# credentials are scrubbed from logs and from the proof ledger.

EMAIL_RE = re.compile(r"\b[A-Za-z0-9._%+\-]+@[A-Za-z0-9.\-]+\.[A-Za-z]{2,}\b")
PHONE_RE = re.compile(
    r"(?:\+?\d{1,3}[\s\-.])?\(?\d{3}\)?[\s\-.]\d{3}[\s\-.]\d{4}"
)
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
FINANCIAL_RE = re.compile(
    r"\b(?:\d[ \-]?){13,16}\b|routing\s*[:#]?\s*\d{9}\b|acct\s*[:#]?\s*\d{6,}",
    re.IGNORECASE,
)


def _redact(text: str) -> str:
    text = EMAIL_RE.sub("[EMAIL_REDACTED]", text)
    for pat, _ in KEY_PATTERNS:
        text = pat.sub("[KEY_REDACTED]", text)
    text = FINANCIAL_RE.sub("[FIN_REDACTED]", text)
    return text


def _scan_pii_in_request(request: dict[str, Any]) -> list[str]:
    """Return labels for any real-looking credentials embedded in a request.

    Only credential / token leakage forces a compliance failure; contact
    emails and phone numbers are expected business data and are not flagged
    here (they are redacted from logs/proof instead).
    """
    blob = " ".join(
        str(request.get(k, "")) for k in ("notes",)
    )
    # Also scan nested string values defensively (e.g. a key pasted into a name).
    for v in _iter_str_values(request):
        blob += " " + v
    found: list[str] = []
    for pat, label in KEY_PATTERNS:
        if pat.search(blob):
            found.append(label)
    return sorted(set(found))


def _iter_str_values(obj: Any) -> list[str]:
    out: list[str] = []
    if isinstance(obj, str):
        out.append(obj)
    elif isinstance(obj, dict):
        for v in obj.values():
            out.extend(_iter_str_values(v))
    elif isinstance(obj, (list, tuple)):
        for v in obj:
            out.extend(_iter_str_values(v))
    return out


# --------------------------- Time (patchable for tests) ---------------------

def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


# --------------------------- Schemas ----------------------------------------

APPOINTMENT_REQUEST_SCHEMA = [
    "idempotency_key", "request_type", "client_id", "contact",
    "requested_slot", "duration_minutes", "channel", "notes",
    "compliance_status", "approval_status", "source_workflow", "submitted_at",
]

APPOINTMENT_RECORD_SCHEMA = [
    "record_id", "idempotency_key", "status", "client_id", "contact",
    "scheduled_slot", "duration_minutes", "channel", "notes",
    "created_at", "source_workflow", "block_reason",
]

CRM_WRITEBACK_REQUEST_SCHEMA = [
    "idempotency_key", "request_type", "client_id", "object_type",
    "contact", "deal", "compliance_status", "approval_status",
    "source_workflow", "submitted_at",
]

CRM_RECORD_SCHEMA = [
    "record_id", "idempotency_key", "status", "client_id", "object_type",
    "contact", "deal", "created_at", "source_workflow", "block_reason",
]

LEDGER_EVENT_SCHEMA = [
    "event_id", "event_seq", "event_type", "idempotency_key",
    "record_id", "record_kind", "status", "outcome", "reason",
    "source_workflow", "timestamp", "skill", "skill_version",
]

# Enumerated values (documented; validated where it matters).
CHANNELS = {"video", "phone", "in_person"}
CRM_OBJECT_TYPES = {"contact", "deal"}
COMPLIANCE_STATES = {"pass", "fail", "pending"}
APPROVAL_STATES = {"approved", "rejected", "pending"}


# --------------------------- Errors -----------------------------------------

class ValidationError(ValueError):
    """Raised for a malformed request (missing/invalid required fields)."""


class ComplianceError(Exception):
    """Raised internally when the compliance + approval gate denies a write."""

    def __init__(self, block_reason_code: str, reason: str) -> None:
        super().__init__(reason)
        self.block_reason_code = block_reason_code
        self.reason = reason


# --------------------------- Mock store -------------------------------------

_EMPTY_STORE: dict[str, Any] = {
    "version": 1,
    "index": {},
    "appointments": {},
    "crm_records": {},
    "ledger": [],
    "event_seq": 0,
}


class MockStore:
    """A local JSON-backed mock store. No network, no external systems.

    State dir resolution:
        1. explicit `state_dir` constructor argument
        2. env var HERMES_CRM_STATE_DIR
        3. default <skill dir>/state
    Pass state_dir=":memory:" to disable all file writes (used by tests).
    """

    MEMORY = ":memory:"

    def __init__(self, state_dir: str | os.PathLike[str] | None = None) -> None:
        resolved = (
            str(state_dir)
            if state_dir is not None
            else os.environ.get("HERMES_CRM_STATE_DIR", "").strip()
            or str(Path(__file__).resolve().parent / "state")
        )
        self._memory = resolved == self.MEMORY
        self._lock = threading.Lock()
        if self._memory:
            self.state_dir = None
            self.store_path = None
            self._data = json.loads(json.dumps(_EMPTY_STORE))
        else:
            self.state_dir = Path(resolved).expanduser()
            self.store_path = self.state_dir / "store.json"
            self._data = self._load()

    # -- persistence --
    def _load(self) -> dict[str, Any]:
        if self.store_path and self.store_path.exists():
            try:
                data = json.loads(self.store_path.read_text())
            except Exception as e:  # noqa: BLE001
                LOG.warning("could not read store %s: %s; starting fresh", self.store_path, e)
                return json.loads(json.dumps(_EMPTY_STORE))
            # Backfill any missing top-level keys for forward-compat.
            for k, v in _EMPTY_STORE.items():
                data.setdefault(k, json.loads(json.dumps(v)))
            return data
        return json.loads(json.dumps(_EMPTY_STORE))

    def flush(self) -> None:
        if self._memory or not self.store_path:
            return
        self.state_dir.mkdir(parents=True, exist_ok=True)
        tmp = self.store_path.with_suffix(".json.tmp")
        tmp.write_text(json.dumps(self._data, indent=2, ensure_ascii=False))
        os.replace(tmp, self.store_path)  # atomic on POSIX

    # -- reads --
    def get_by_key(self, idempotency_key: str) -> dict[str, Any] | None:
        ref = self._data["index"].get(idempotency_key)
        if not ref:
            return None
        bucket = "appointments" if ref["record_kind"] == "appointment" else "crm_records"
        return self._data[bucket].get(ref["record_id"])

    def counts(self) -> dict[str, int]:
        return {
            "appointments": len(self._data["appointments"]),
            "crm_records": len(self._data["crm_records"]),
            "ledger_events": len(self._data["ledger"]),
        }

    def ledger(self, since_seq: int = 0) -> list[dict[str, Any]]:
        return [e for e in self._data["ledger"] if e["event_seq"] > since_seq]

    # -- writes --
    def put_record(self, record_kind: str, record: dict[str, Any]) -> None:
        bucket = "appointments" if record_kind == "appointment" else "crm_records"
        self._data[bucket][record["record_id"]] = record
        self._data["index"][record["idempotency_key"]] = {
            "record_id": record["record_id"],
            "record_kind": record_kind,
        }

    def append_event(self, event: dict[str, Any]) -> dict[str, Any]:
        self._data["event_seq"] += 1
        event = dict(event)
        event["event_seq"] = self._data["event_seq"]
        event.setdefault("event_id", f"evt_{uuid.uuid4().hex}")
        self._data["ledger"].append(event)
        return event

    @contextlib.contextmanager
    def transaction(self):
        with self._lock:
            yield
            self.flush()


def _default_store() -> MockStore:
    return MockStore()


# --------------------------- Gate -------------------------------------------

@dataclass
class GateResult:
    allowed: bool
    reason: str | None = None
    block_reason_code: str | None = None


def _evaluate_gate(request: dict[str, Any]) -> GateResult:
    """A write is allowed only when compliance passes AND approval is granted.

    A leaked credential in the request forces a compliance failure regardless
    of the declared compliance_status.
    """
    leaked = _scan_pii_in_request(request)
    if leaked:
        return GateResult(
            False,
            f"compliance_failed: credential-like value detected ({', '.join(leaked)})",
            "compliance_failed",
        )

    compliance = str(request.get("compliance_status", "")).strip().lower()
    approval = str(request.get("approval_status", "")).strip().lower()

    if compliance != "pass":
        code = "compliance_pending" if compliance in ("", "pending") else "compliance_failed"
        return GateResult(False, f"{code}: compliance_status={compliance or 'missing'}", code)
    if approval != "approved":
        code = "approval_pending" if approval in ("", "pending") else "approval_not_granted"
        return GateResult(False, f"{code}: approval_status={approval or 'missing'}", code)
    return GateResult(True)


# --------------------------- Validation -------------------------------------

def _require(request: dict[str, Any], field: str) -> Any:
    value = request.get(field)
    if value in (None, ""):
        raise ValidationError(f"missing required field: {field}")
    return value


def _validate_common(request: dict[str, Any], expected_type: str) -> None:
    if not isinstance(request, dict):
        raise ValidationError("request must be a JSON object")
    _require(request, "idempotency_key")
    request_type = str(request.get("request_type", "")).strip()
    if request_type != expected_type:
        raise ValidationError(
            f"request_type must be '{expected_type}', got '{request_type or 'missing'}'"
        )


def _validate_appointment(request: dict[str, Any]) -> None:
    _validate_common(request, "appointment")
    _require(request, "requested_slot")
    channel = str(request.get("channel", "video")).strip().lower()
    if channel not in CHANNELS:
        raise ValidationError(f"channel must be one of {sorted(CHANNELS)}, got '{channel}'")


def _validate_crm(request: dict[str, Any]) -> None:
    _validate_common(request, "crm_writeback")
    object_type = str(request.get("object_type", "")).strip().lower()
    if object_type not in CRM_OBJECT_TYPES:
        raise ValidationError(
            f"object_type must be one of {sorted(CRM_OBJECT_TYPES)}, got '{object_type or 'missing'}'"
        )
    if object_type == "deal" and not request.get("deal"):
        raise ValidationError("object_type 'deal' requires a 'deal' payload")
    if object_type == "contact" and not request.get("contact"):
        raise ValidationError("object_type 'contact' requires a 'contact' payload")


# --------------------------- Record ids -------------------------------------

def _record_id(prefix: str, request_type: str, idempotency_key: str) -> str:
    digest = hashlib.sha256(f"{request_type}:{idempotency_key}".encode()).hexdigest()[:12]
    return f"{prefix}_{digest}"


# --------------------------- Event emission ---------------------------------

def _emit_event(
    store: MockStore,
    *,
    event_type: str,
    idempotency_key: str,
    record_id: str | None,
    record_kind: str | None,
    status: str,
    outcome: str,
    reason: str | None,
    source_workflow: str | None,
) -> dict[str, Any]:
    event = {
        "event_type": event_type,
        "idempotency_key": idempotency_key,
        "record_id": record_id,
        "record_kind": record_kind,
        "status": status,
        "outcome": outcome,
        "reason": _redact(reason) if reason else None,
        "source_workflow": source_workflow,
        "timestamp": _now(),
        "skill": SKILL_NAME,
        "skill_version": SKILL_VERSION,
    }
    return store.append_event(event)


# --------------------------- Output helpers ---------------------------------

def _write_output(result: dict[str, Any], output_json_path: str | None) -> None:
    if not output_json_path:
        return
    p = Path(output_json_path)
    p.parent.mkdir(parents=True, exist_ok=True)
    p.write_text(json.dumps(result, indent=2, ensure_ascii=False))


# --------------------------- Tool 1: book_appointment -----------------------

def book_appointment(
    request: dict[str, Any],
    *,
    store: MockStore | None = None,
    output_json_path: str | None = None,
) -> dict[str, Any]:
    """Mock-book an appointment. No real calendar/SMS/call is ever placed."""
    store = store or _default_store()
    idempotency_key = (request or {}).get("idempotency_key", "")
    source_workflow = (request or {}).get("source_workflow")

    with store.transaction():
        # 1) Validate.
        try:
            _validate_appointment(request)
        except ValidationError as e:
            record = _failed_record("appointment", request, str(e))
            _emit_event(
                store, event_type="request_failed", idempotency_key=idempotency_key,
                record_id=None, record_kind="appointment", status="failed",
                outcome="error", reason=str(e), source_workflow=source_workflow,
            )
            _write_output(record, output_json_path)
            return record

        # 2) Idempotency: a known key never creates a second record.
        existing = store.get_by_key(idempotency_key)
        if existing is not None:
            result = dict(existing, deduplicated=True)
            _emit_event(
                store, event_type="appointment_deduplicated",
                idempotency_key=idempotency_key, record_id=existing["record_id"],
                record_kind="appointment", status=existing["status"],
                outcome="duplicate_noop", reason=None, source_workflow=source_workflow,
            )
            _write_output(result, output_json_path)
            return result

        # 3) Compliance + approval gate (write only when both pass).
        gate = _evaluate_gate(request)
        record_id = _record_id("appt", "appointment", idempotency_key)
        if not gate.allowed:
            record = _blocked_appointment(record_id, request, gate.block_reason_code)
            store.put_record("appointment", record)
            _emit_event(
                store, event_type="appointment_blocked", idempotency_key=idempotency_key,
                record_id=record_id, record_kind="appointment", status="blocked",
                outcome="blocked", reason=gate.reason, source_workflow=source_workflow,
            )
            _write_output(record, output_json_path)
            return record

        # 4) Booked (mock).
        record = _booked_appointment(record_id, request)
        store.put_record("appointment", record)
        _emit_event(
            store, event_type="appointment_booked", idempotency_key=idempotency_key,
            record_id=record_id, record_kind="appointment", status="booked",
            outcome="created", reason=None, source_workflow=source_workflow,
        )
        _write_output(record, output_json_path)
        return record


def _booked_appointment(record_id: str, request: dict[str, Any]) -> dict[str, Any]:
    return {
        "record_id": record_id,
        "idempotency_key": request["idempotency_key"],
        "status": "booked",
        "client_id": request.get("client_id"),
        "contact": request.get("contact"),
        "scheduled_slot": request.get("requested_slot"),
        "duration_minutes": request.get("duration_minutes", 30),
        "channel": str(request.get("channel", "video")).strip().lower(),
        "notes": request.get("notes"),
        "created_at": _now(),
        "source_workflow": request.get("source_workflow"),
        "block_reason": None,
    }


def _blocked_appointment(record_id: str, request: dict[str, Any], code: str | None) -> dict[str, Any]:
    record = _booked_appointment(record_id, request)
    record["status"] = "blocked"
    record["scheduled_slot"] = None  # no booking side effect when blocked
    record["block_reason"] = code
    return record


# --------------------------- Tool 2: crm_writeback --------------------------

def crm_writeback(
    request: dict[str, Any],
    *,
    store: MockStore | None = None,
    output_json_path: str | None = None,
) -> dict[str, Any]:
    """Mock CRM writeback (contact/deal). No real CRM is ever contacted."""
    store = store or _default_store()
    idempotency_key = (request or {}).get("idempotency_key", "")
    source_workflow = (request or {}).get("source_workflow")

    with store.transaction():
        try:
            _validate_crm(request)
        except ValidationError as e:
            record = _failed_record("crm", request, str(e))
            _emit_event(
                store, event_type="request_failed", idempotency_key=idempotency_key,
                record_id=None, record_kind="crm", status="failed",
                outcome="error", reason=str(e), source_workflow=source_workflow,
            )
            _write_output(record, output_json_path)
            return record

        existing = store.get_by_key(idempotency_key)
        if existing is not None:
            result = dict(existing, deduplicated=True)
            _emit_event(
                store, event_type="crm_deduplicated", idempotency_key=idempotency_key,
                record_id=existing["record_id"], record_kind="crm",
                status=existing["status"], outcome="duplicate_noop",
                reason=None, source_workflow=source_workflow,
            )
            _write_output(result, output_json_path)
            return result

        gate = _evaluate_gate(request)
        record_id = _record_id("crm", "crm_writeback", idempotency_key)
        if not gate.allowed:
            record = _blocked_crm(record_id, request, gate.block_reason_code)
            store.put_record("crm", record)
            _emit_event(
                store, event_type="crm_blocked", idempotency_key=idempotency_key,
                record_id=record_id, record_kind="crm", status="blocked",
                outcome="blocked", reason=gate.reason, source_workflow=source_workflow,
            )
            _write_output(record, output_json_path)
            return record

        record = _written_crm(record_id, request)
        store.put_record("crm", record)
        _emit_event(
            store, event_type="crm_written", idempotency_key=idempotency_key,
            record_id=record_id, record_kind="crm", status="written",
            outcome="created", reason=None, source_workflow=source_workflow,
        )
        _write_output(record, output_json_path)
        return record


def _written_crm(record_id: str, request: dict[str, Any]) -> dict[str, Any]:
    return {
        "record_id": record_id,
        "idempotency_key": request["idempotency_key"],
        "status": "written",
        "client_id": request.get("client_id"),
        "object_type": str(request.get("object_type", "")).strip().lower(),
        "contact": request.get("contact"),
        "deal": request.get("deal"),
        "created_at": _now(),
        "source_workflow": request.get("source_workflow"),
        "block_reason": None,
    }


def _blocked_crm(record_id: str, request: dict[str, Any], code: str | None) -> dict[str, Any]:
    record = _written_crm(record_id, request)
    record["status"] = "blocked"
    record["block_reason"] = code
    return record


# --------------------------- Failed record ----------------------------------

def _failed_record(record_kind: str, request: dict[str, Any], reason: str) -> dict[str, Any]:
    return {
        "record_id": None,
        "idempotency_key": (request or {}).get("idempotency_key"),
        "status": "failed",
        "record_kind": record_kind,
        "block_reason": "validation_error",
        "error": _redact(reason),
        "source_workflow": (request or {}).get("source_workflow"),
    }


# --------------------------- Tool 3: get_record -----------------------------

def get_record(
    idempotency_key: str,
    *,
    store: MockStore | None = None,
) -> dict[str, Any]:
    """Read-only lookup of a stored record by idempotency key."""
    store = store or _default_store()
    record = store.get_by_key(idempotency_key)
    if record is None:
        return {"found": False, "idempotency_key": idempotency_key}
    return dict(record, found=True)


# --------------------------- Tool 4: get_proof_ledger -----------------------

def get_proof_ledger(
    *,
    since_seq: int = 0,
    store: MockStore | None = None,
    output_json_path: str | None = None,
) -> dict[str, Any]:
    """Return the append-only proof event ledger (the W5 feed)."""
    store = store or _default_store()
    events = store.ledger(since_seq=since_seq)
    result = {
        "skill": SKILL_NAME,
        "skill_version": SKILL_VERSION,
        "since_seq": since_seq,
        "event_count": len(events),
        "events": events,
    }
    _write_output(result, output_json_path)
    return result


# --------------------------- CLI --------------------------------------------

def _print_json(obj: dict[str, Any]) -> None:
    print(json.dumps(obj, indent=2, ensure_ascii=False))


def _load_request(args: argparse.Namespace) -> dict[str, Any]:
    if getattr(args, "request_file", None):
        text = Path(args.request_file).expanduser().read_text()
    else:
        text = args.request_json
    parsed = _safe_json(text)
    if not parsed:
        raise ValidationError("could not parse request JSON")
    return parsed


def _safe_json(text: str) -> dict[str, Any]:
    text = (text or "").strip()
    if text.startswith("```"):
        text = re.sub(r"^```(?:json)?", "", text).rstrip("`").strip()
    try:
        return json.loads(text)
    except Exception:
        m = re.search(r"\{[\s\S]*\}", text)
        if m:
            try:
                return json.loads(m.group(0))
            except Exception:
                return {}
        return {}


def _cli(argv: list[str] | None = None) -> int:
    _configure_logging()
    p = argparse.ArgumentParser(prog="crm_appointment_skill", description=__doc__)
    p.add_argument("--mcp", action="store_true", help="run as MCP stdio server")
    sub = p.add_subparsers(dest="cmd")

    def add_request_args(parser: argparse.ArgumentParser) -> None:
        g = parser.add_mutually_exclusive_group(required=True)
        g.add_argument("--request-json", default=None, help="request envelope as JSON")
        g.add_argument("--request-file", default=None, help="path to a request JSON file")
        parser.add_argument("--state-dir", default=None, help="mock store dir (':memory:' for none)")
        parser.add_argument("--output-json-path", default=None)

    add_request_args(sub.add_parser("book"))
    add_request_args(sub.add_parser("writeback"))

    g = sub.add_parser("get")
    g.add_argument("--idempotency-key", required=True)
    g.add_argument("--state-dir", default=None)

    pr = sub.add_parser("proof")
    pr.add_argument("--since-seq", type=int, default=0)
    pr.add_argument("--state-dir", default=None)
    pr.add_argument("--output-json-path", default=None)

    st = sub.add_parser("state")  # diagnostics
    st.add_argument("--state-dir", default=None)

    args = p.parse_args(argv)

    if args.mcp:
        return _run_mcp_server()

    if args.cmd in ("book", "writeback"):
        store = MockStore(args.state_dir)
        try:
            request = _load_request(args)
        except ValidationError as e:
            _print_json({"status": "failed", "error": str(e)})
            return 1
        fn = book_appointment if args.cmd == "book" else crm_writeback
        _print_json(fn(request, store=store, output_json_path=args.output_json_path))
        return 0
    if args.cmd == "get":
        _print_json(get_record(args.idempotency_key, store=MockStore(args.state_dir)))
        return 0
    if args.cmd == "proof":
        _print_json(get_proof_ledger(
            since_seq=args.since_seq, store=MockStore(args.state_dir),
            output_json_path=args.output_json_path,
        ))
        return 0
    if args.cmd == "state":
        store = MockStore(args.state_dir)
        _print_json({
            "skill": SKILL_NAME,
            "skill_version": SKILL_VERSION,
            "state_dir": str(store.state_dir) if store.state_dir else ":memory:",
            "counts": store.counts(),
        })
        return 0
    p.print_help()
    return 2


# --------------------------- MCP server -------------------------------------

def _run_mcp_server() -> int:
    try:
        from mcp.server.fastmcp import FastMCP
    except Exception as e:  # noqa: BLE001
        LOG.error("MCP SDK not installed: %s. Install with: pip install mcp", e)
        return 1
    app = FastMCP(SKILL_NAME)

    @app.tool()
    def book(request: dict[str, Any], output_json_path: str | None = None) -> dict[str, Any]:
        """Mock-book an appointment from a W1 request envelope."""
        return book_appointment(request, output_json_path=output_json_path)

    @app.tool()
    def writeback(request: dict[str, Any], output_json_path: str | None = None) -> dict[str, Any]:
        """Mock CRM writeback (contact/deal) from a W1 request envelope."""
        return crm_writeback(request, output_json_path=output_json_path)

    @app.tool()
    def get(idempotency_key: str) -> dict[str, Any]:
        """Look up a stored record by idempotency key."""
        return get_record(idempotency_key)

    @app.tool()
    def proof(since_seq: int = 0, output_json_path: str | None = None) -> dict[str, Any]:
        """Return the append-only proof event ledger (the W5 feed)."""
        return get_proof_ledger(since_seq=since_seq, output_json_path=output_json_path)

    app.run()
    return 0


if __name__ == "__main__":
    sys.exit(_cli())
