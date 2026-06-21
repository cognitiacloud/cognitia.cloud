#!/usr/bin/env python3
"""Hermes signal bus / action ledger (W6).

A minimal, append-only **event spine** for the Cognitia/Demandara pipeline.
It lets workflow stages emit durable, ordered, tamper-evident signals with
**no network, no DB, and no live external integrations** — just an
append-only JSONL file (or pure in-memory mode for tests/ephemeral use).

Tools / subcommands:
    emit    -> ActionLedger.emit
    read    -> ActionLedger.read
    verify  -> ActionLedger.verify
    report  -> ActionLedger.proof_report

Supported event types:
    lead.created
    compliance.checked
    approval.requested
    approval.granted
    approval.rejected
    appointment.mock_created
    crm.mock_written
    proof.generated

Guarantees (the W1/W5/W8 + Katie/Alex/Luna integration contract):
    * Append-only        — records are never updated, deleted, or rewritten.
    * Ordered            — every record carries a contiguous, monotonic `seq`.
    * Idempotent         — re-emitting the same `idempotency_key` is a no-op.
    * Tamper-evident     — each record links to the previous via a sha256
                           hash chain (`prev_hash` + `content_hash`).
    * No raw PII         — payloads are scanned and redacted before persisting;
                           `pii_redacted` flags affected records.
    * Proof-reportable   — `verify()` and `proof_report()` produce integrity
                           proofs with zero external dependencies.

Producers (e.g. W1 intake) call `emit(...)`. Consumers (e.g. W5/W8 reporting
and the Katie/Alex/Luna roadmap) call `read(...)`, `verify()`,
`proof_report()`. The API is role-agnostic; only `actor` labels differ.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import logging
import os
import re
import sys
import uuid
from datetime import datetime, timezone
from typing import Any

SKILL_NAME = "hermes-signal-bus"
SKILL_VERSION = "0.1.0"
SCHEMA_VERSION = 1
GENESIS = "GENESIS"

LOG = logging.getLogger("hermes.signal_bus")


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
# Mirrors the patterns/labels used by the hermes-vision skill so PII handling
# stays consistent across the toolchain. Skills are self-contained, so the set
# is reimplemented locally rather than imported.

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
FINANCIAL_RE = re.compile(
    r"\b(?:\d[ \-]?){13,16}\b|routing\s*[:#]?\s*\d{9}\b|acct\s*[:#]?\s*\d{6,}",
    re.IGNORECASE,
)


def _redact(text: str) -> str:
    """Replace raw PII in a string with stable placeholder tokens."""
    text = EMAIL_RE.sub("[EMAIL_REDACTED]", text)
    for pat, _ in KEY_PATTERNS:
        text = pat.sub("[KEY_REDACTED]", text)
    text = FINANCIAL_RE.sub("[FIN_REDACTED]", text)
    text = PHONE_RE.sub("[PHONE_REDACTED]", text)
    return text


def _scan_payload_for_pii(value: Any) -> tuple[Any, bool]:
    """Recursively redact a JSON-able value.

    Returns the redacted copy and whether any redaction happened. Only string
    leaves can contain PII; dict keys are left intact (they are field names).
    """
    if isinstance(value, str):
        redacted = _redact(value)
        return redacted, redacted != value
    if isinstance(value, dict):
        out: dict[str, Any] = {}
        changed = False
        for k, v in value.items():
            nv, c = _scan_payload_for_pii(v)
            out[str(k)] = nv
            changed = changed or c
        return out, changed
    if isinstance(value, (list, tuple)):
        out_list = []
        changed = False
        for v in value:
            nv, c = _scan_payload_for_pii(v)
            out_list.append(nv)
            changed = changed or c
        return out_list, changed
    # int / float / bool / None are not PII-bearing
    return value, False


# --------------------------- Event contract ---------------------------------

EVENT_TYPES: frozenset[str] = frozenset(
    {
        "lead.created",
        "compliance.checked",
        "approval.requested",
        "approval.granted",
        "approval.rejected",
        "appointment.mock_created",
        "crm.mock_written",
        "proof.generated",
    }
)

# Per-type required payload keys. Kept intentionally minimal — the spine
# validates shape, not business semantics.
EVENT_SCHEMAS: dict[str, tuple[str, ...]] = {
    "lead.created": ("subject_ref",),
    "compliance.checked": ("subject_ref", "result"),
    "approval.requested": ("request_ref",),
    "approval.granted": ("request_ref",),
    "approval.rejected": ("request_ref",),
    "appointment.mock_created": ("subject_ref",),
    "crm.mock_written": ("subject_ref",),
    "proof.generated": ("head_hash",),
}

# Fields excluded from a record before hashing (the hash protects everything
# else, including `seq` and `prev_hash`, so ordering is part of the proof).
_HASH_EXCLUDED = ("content_hash",)


def _utc_now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _sha256(text: str) -> str:
    return hashlib.sha256(text.encode("utf-8")).hexdigest()


def _canonical(record: dict[str, Any]) -> str:
    """Deterministic JSON for hashing (sorted keys, excluded fields removed)."""
    body = {k: v for k, v in record.items() if k not in _HASH_EXCLUDED}
    return json.dumps(body, sort_keys=True, separators=(",", ":"), ensure_ascii=True)


# --------------------------- Action ledger ----------------------------------

class ActionLedger:
    """Append-only, hash-chained event ledger.

    Pass ``path`` for a file-backed JSONL ledger, or omit it for a pure
    in-memory ledger. There are deliberately no update/delete methods.
    """

    def __init__(self, path: str | None = None) -> None:
        self.path = path
        self._events: list[dict[str, Any]] = []
        self._idem_index: dict[str, dict[str, Any]] = {}
        if path:
            self._load()

    # -- loading / replay ---------------------------------------------------

    def _load(self) -> None:
        assert self.path is not None
        if not os.path.exists(self.path):
            return
        with open(self.path, "r", encoding="utf-8") as fh:
            for line_no, raw in enumerate(fh):
                raw = raw.strip()
                if not raw:
                    continue
                try:
                    rec = json.loads(raw)
                except json.JSONDecodeError as e:
                    raise ValueError(f"corrupt ledger line {line_no}: {e}") from e
                self._events.append(rec)
                key = rec.get("idempotency_key")
                if key:
                    self._idem_index[key] = rec

    # -- writing ------------------------------------------------------------

    def emit(
        self,
        type: str,
        payload: dict[str, Any] | None = None,
        *,
        actor: str = "system",
        subject_ref: str | None = None,
        idempotency_key: str | None = None,
    ) -> dict[str, Any]:
        """Append an event. Returns the stored record.

        Re-emitting an existing ``idempotency_key`` returns the original record
        unchanged without appending a second time.
        """
        if type not in EVENT_TYPES:
            raise ValueError(f"unknown event type: {type!r} (allowed: {sorted(EVENT_TYPES)})")

        if idempotency_key and idempotency_key in self._idem_index:
            return self._idem_index[idempotency_key]

        payload = dict(payload or {})
        # subject_ref is a convenience that also lands in the payload contract.
        if subject_ref is not None:
            payload.setdefault("subject_ref", subject_ref)

        required = EVENT_SCHEMAS.get(type, ())
        missing = [k for k in required if k not in payload or payload[k] in (None, "")]
        if missing:
            raise ValueError(f"event {type!r} missing required payload keys: {missing}")

        redacted_payload, payload_changed = _scan_payload_for_pii(payload)
        redacted_subject = redacted_payload.get("subject_ref", subject_ref)

        seq = len(self._events)
        prev_hash = self._events[-1]["content_hash"] if self._events else GENESIS

        record: dict[str, Any] = {
            "seq": seq,
            "event_id": str(uuid.uuid4()),
            "idempotency_key": idempotency_key,
            "type": type,
            "ts": _utc_now_iso(),
            "actor": actor,
            "subject_ref": redacted_subject,
            "payload": redacted_payload,
            "pii_redacted": bool(payload_changed),
            "prev_hash": prev_hash,
            "schema_version": SCHEMA_VERSION,
        }
        record["content_hash"] = _sha256(_canonical(record))

        self._append(record)
        return record

    def _append(self, record: dict[str, Any]) -> None:
        if self.path:
            line = json.dumps(record, sort_keys=True, ensure_ascii=True)
            # Append-only: open exclusively in append mode and flush durably.
            with open(self.path, "a", encoding="utf-8") as fh:
                fh.write(line + "\n")
                fh.flush()
                os.fsync(fh.fileno())
        self._events.append(record)
        if record.get("idempotency_key"):
            self._idem_index[record["idempotency_key"]] = record

    # -- reading ------------------------------------------------------------

    def read(self, *, since_seq: int = 0, type: str | None = None) -> list[dict[str, Any]]:
        """Return events in append order, optionally filtered.

        ``since_seq`` is exclusive of records with ``seq < since_seq`` — i.e.
        a consumer that has processed up to seq N passes ``since_seq=N+1``.
        """
        out = [e for e in self._events if e["seq"] >= since_seq]
        if type is not None:
            out = [e for e in out if e["type"] == type]
        return out

    @property
    def head_hash(self) -> str:
        return self._events[-1]["content_hash"] if self._events else GENESIS

    def __len__(self) -> int:
        return len(self._events)

    # -- proof --------------------------------------------------------------

    def verify(self) -> dict[str, Any]:
        """Walk the chain and confirm hashes, links, and contiguous ordering."""
        prev = GENESIS
        for i, rec in enumerate(self._events):
            if rec.get("seq") != i:
                return self._broken(i, "non-contiguous seq")
            if rec.get("prev_hash") != prev:
                return self._broken(i, "prev_hash mismatch")
            recomputed = _sha256(_canonical(rec))
            if recomputed != rec.get("content_hash"):
                return self._broken(i, "content_hash mismatch (tampered record)")
            prev = rec["content_hash"]
        return {
            "valid": True,
            "length": len(self._events),
            "head_hash": self.head_hash,
            "broken_at": None,
            "reason": None,
        }

    def _broken(self, index: int, reason: str) -> dict[str, Any]:
        return {
            "valid": False,
            "length": len(self._events),
            "head_hash": self.head_hash,
            "broken_at": index,
            "reason": reason,
        }

    def proof_report(self) -> dict[str, Any]:
        """Deterministic, proof-reportable summary of the ledger state."""
        chain = self.verify()
        counts: dict[str, int] = {}
        pii_count = 0
        for rec in self._events:
            counts[rec["type"]] = counts.get(rec["type"], 0) + 1
            if rec.get("pii_redacted"):
                pii_count += 1
        return {
            "skill": SKILL_NAME,
            "version": SKILL_VERSION,
            "schema_version": SCHEMA_VERSION,
            "total_events": len(self._events),
            "counts_by_type": counts,
            "first_seq": self._events[0]["seq"] if self._events else None,
            "last_seq": self._events[-1]["seq"] if self._events else None,
            "first_ts": self._events[0]["ts"] if self._events else None,
            "last_ts": self._events[-1]["ts"] if self._events else None,
            "head_hash": self.head_hash,
            "chain_valid": chain["valid"],
            "chain_broken_at": chain["broken_at"],
            "pii_redacted_count": pii_count,
        }


# --------------------------- CLI --------------------------------------------

def _print_json(obj: Any) -> None:
    print(json.dumps(obj, indent=2, sort_keys=True))


def _resolve_path(arg_path: str | None) -> str | None:
    return arg_path or os.environ.get("SIGNAL_BUS_LEDGER_PATH") or None


def _cli(argv: list[str] | None = None) -> int:
    _configure_logging()
    p = argparse.ArgumentParser(prog="signal_bus", description=__doc__)
    p.add_argument("--mcp", action="store_true", help="run as MCP stdio server")
    sub = p.add_subparsers(dest="cmd")

    e = sub.add_parser("emit", help="append an event")
    e.add_argument("--type", required=True, choices=sorted(EVENT_TYPES))
    e.add_argument("--payload", default="{}", help="JSON object payload")
    e.add_argument("--actor", default="system")
    e.add_argument("--subject-ref", default=None)
    e.add_argument("--idempotency-key", default=None)
    e.add_argument("--path", default=None, help="JSONL ledger path (or $SIGNAL_BUS_LEDGER_PATH)")

    r = sub.add_parser("read", help="read events in order")
    r.add_argument("--since-seq", type=int, default=0)
    r.add_argument("--type", default=None, choices=sorted(EVENT_TYPES))
    r.add_argument("--path", default=None)

    v = sub.add_parser("verify", help="verify the hash chain")
    v.add_argument("--path", default=None)

    rep = sub.add_parser("report", help="emit a proof report")
    rep.add_argument("--path", default=None)

    args = p.parse_args(argv)

    if args.mcp:
        return _run_mcp_server()

    if args.cmd == "emit":
        try:
            payload = json.loads(args.payload)
        except json.JSONDecodeError as exc:
            LOG.error("invalid --payload JSON: %s", exc)
            return 2
        if not isinstance(payload, dict):
            LOG.error("--payload must be a JSON object")
            return 2
        ledger = ActionLedger(_resolve_path(args.path))
        rec = ledger.emit(
            args.type,
            payload,
            actor=args.actor,
            subject_ref=args.subject_ref,
            idempotency_key=args.idempotency_key,
        )
        _print_json(rec)
        return 0
    if args.cmd == "read":
        ledger = ActionLedger(_resolve_path(args.path))
        _print_json(ledger.read(since_seq=args.since_seq, type=args.type))
        return 0
    if args.cmd == "verify":
        ledger = ActionLedger(_resolve_path(args.path))
        _print_json(ledger.verify())
        return 0
    if args.cmd == "report":
        ledger = ActionLedger(_resolve_path(args.path))
        _print_json(ledger.proof_report())
        return 0

    p.print_help()
    return 2


# --------------------------- MCP server -------------------------------------

def _run_mcp_server() -> int:
    try:
        from mcp.server.fastmcp import FastMCP
    except Exception as e:  # pragma: no cover - exercised only with mcp SDK
        LOG.error("MCP SDK not installed: %s. Install with: pip install mcp", e)
        return 1
    app = FastMCP(SKILL_NAME)

    def _ledger() -> ActionLedger:
        return ActionLedger(_resolve_path(None))

    @app.tool()
    def ledger_emit(
        type: str,
        payload: dict[str, Any] | None = None,
        actor: str = "system",
        subject_ref: str | None = None,
        idempotency_key: str | None = None,
    ) -> dict[str, Any]:
        """Append an append-only, PII-redacted, hash-chained event."""
        return _ledger().emit(
            type,
            payload,
            actor=actor,
            subject_ref=subject_ref,
            idempotency_key=idempotency_key,
        )

    @app.tool()
    def ledger_read(since_seq: int = 0, type: str | None = None) -> list[dict[str, Any]]:
        """Read ledger events in append order (optionally filtered)."""
        return _ledger().read(since_seq=since_seq, type=type)

    @app.tool()
    def ledger_verify() -> dict[str, Any]:
        """Verify the integrity of the ledger hash chain."""
        return _ledger().verify()

    @app.tool()
    def ledger_proof_report() -> dict[str, Any]:
        """Produce a deterministic, proof-reportable ledger summary."""
        return _ledger().proof_report()

    app.run()
    return 0


if __name__ == "__main__":
    sys.exit(_cli())
