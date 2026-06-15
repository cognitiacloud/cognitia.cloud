#!/usr/bin/env python3
"""Hermes HubSpot skill.

Real CRM path + integration health for the Cognitia pilot.

Tools:
    health    -> hubspot_health           (operator/UI status contract)
    status    -> hubspot_status           (sync ledger + counters for UI)
    find      -> hubspot_find_contact      (lookup by email or id)
    sync      -> hubspot_sync_contact_activity
                                           (find-or-create contact + log activity)
    log       -> hubspot_log_activity      (writeback a Note to a contact timeline)
    config    -> hubspot_describe_config   (redacted, no secrets)

Auth (private app token):
    HUBSPOT_ACCESS_TOKEN   Bearer token for a HubSpot private app.

Operating modes (governs *writes*, reported by every tool as `mode`):
    live                   token present, dry-run off  -> real API calls
    dry_run                HUBSPOT_DRY_RUN truthy       -> plan only, no mutations
    blocked_no_credentials no token, not dry-run        -> fail closed, no network

Design contract:
    * Fail closed. Never reports a live success without a real 2xx response.
    * Auditable. Every operation appends a redacted record to an in-memory
      ledger (and optionally to HUBSPOT_AUDIT_LOG as append-only JSONL).
    * Secrets out of logs. Tokens are scrubbed before anything is logged or
      persisted; the token never appears in a returned object.
    * Real-vs-seam is explicit. The `mode` field, the injectable transport,
      and the dry-run planner make the boundary between a live API call and a
      simulated seam unambiguous.

Stdlib only. No HubSpot SDK dependency (matches the vision skill: each
provider is reached over its public HTTPS API via urllib).
"""

from __future__ import annotations

import argparse
import json
import logging
import os
import re
import time
import uuid
from dataclasses import dataclass, field
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Callable

SKILL_NAME = "hermes-hubspot"
SKILL_VERSION = "0.1.0"

DEFAULT_BASE_URL = "https://api.hubapi.com"
DEFAULT_TIMEOUT = 30
DEFAULT_MAX_RETRIES = 3
DEFAULT_RETRY_BASE_SECONDS = 1.0
DEFAULT_RETRY_CAP_SECONDS = 30.0
LEDGER_MAX = 200

# HubSpot default (HUBSPOT_DEFINED) association type id: Note -> Contact.
# https://developers.hubspot.com/docs/api/crm/associations
NOTE_TO_CONTACT_TYPE_ID = 202

# Status the live connection probe can report.
CONN_OK = "ok"
CONN_AUTH_FAILED = "auth_failed"
CONN_FORBIDDEN = "forbidden_scopes"
CONN_UNREACHABLE = "unreachable"
CONN_NOT_CHECKED = "not_checked"

# Operating modes.
MODE_LIVE = "live"
MODE_DRY_RUN = "dry_run"
MODE_BLOCKED = "blocked_no_credentials"

# Operation outcomes (UI-facing vocabulary).
OUT_OK = "ok"
OUT_CREATED = "created"
OUT_FOUND = "found"
OUT_NOT_FOUND = "not_found"
OUT_DRY_RUN = "dry_run"
OUT_BLOCKED = "blocked"
OUT_ERROR = "error"

LOG = logging.getLogger("hermes.hubspot")


# --------------------------- Redaction / logging ----------------------------

# HubSpot private app tokens look like `pat-na1-xxxxxxxx-...` / `pat-eu1-...`.
_TOKEN_PATTERNS: list[re.Pattern[str]] = [
    re.compile(r"pat-[a-z0-9]{2,4}-[A-Za-z0-9\-]{8,}"),
    re.compile(r"(?i)bearer\s+[A-Za-z0-9._\-]{8,}"),
    re.compile(r"(?i)(authorization\"?\s*[:=]\s*\"?)[^\"\s,}]+"),
    re.compile(r"(?i)(access[_-]?token\"?\s*[:=]\s*\"?)[^\"\s,}]+"),
    re.compile(r"(?i)(hapikey=)[A-Za-z0-9\-]+"),
]


def _redact(text: str) -> str:
    """Scrub anything that looks like a HubSpot credential."""
    if not text:
        return text
    out = text
    out = _TOKEN_PATTERNS[0].sub("[TOKEN_REDACTED]", out)
    out = _TOKEN_PATTERNS[1].sub("Bearer [TOKEN_REDACTED]", out)
    out = _TOKEN_PATTERNS[2].sub(r"\1[REDACTED]", out)
    out = _TOKEN_PATTERNS[3].sub(r"\1[REDACTED]", out)
    out = _TOKEN_PATTERNS[4].sub(r"\1[REDACTED]", out)
    return out


class _RedactingFilter(logging.Filter):
    def filter(self, record: logging.LogRecord) -> bool:
        try:
            record.msg = _redact(str(record.msg))
        except Exception:
            pass
        return True


def _configure_logging(level: int = logging.INFO) -> None:
    import sys

    handler = logging.StreamHandler(sys.stderr)
    handler.addFilter(_RedactingFilter())
    handler.setFormatter(
        logging.Formatter("%(asctime)s [%(levelname)s] %(name)s: %(message)s")
    )
    root = logging.getLogger()
    root.handlers.clear()
    root.addHandler(handler)
    root.setLevel(level)


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _truthy(value: str | None) -> bool:
    return (value or "").strip().lower() in {"1", "true", "yes", "on"}


# --------------------------- Transport (the seam) ---------------------------

class TransportError(Exception):
    """Raised by a transport on a network-level failure (not an HTTP status)."""


@dataclass
class HttpResponse:
    status: int
    body: bytes
    headers: dict[str, str] = field(default_factory=dict)

    def json(self) -> Any:
        if not self.body:
            return None
        try:
            return json.loads(self.body)
        except Exception:
            return None


# A transport is the single point where bytes leave the process. Injecting a
# fake transport in tests exercises the full retry/audit logic with zero
# network — this is the explicit real-vs-seam boundary.
Transport = Callable[[str, str, dict[str, str], bytes | None, float], HttpResponse]


def _urllib_transport(
    method: str,
    url: str,
    headers: dict[str, str],
    body: bytes | None,
    timeout: float,
) -> HttpResponse:
    import urllib.error
    import urllib.request

    req = urllib.request.Request(url=url, method=method, data=body, headers=headers)
    try:
        with urllib.request.urlopen(req, timeout=timeout) as r:
            return HttpResponse(
                status=r.status,
                body=r.read(),
                headers={k.lower(): v for k, v in r.headers.items()},
            )
    except urllib.error.HTTPError as e:
        # An HTTP status (incl. 4xx/5xx) is a *response*, not a transport error,
        # so the retry logic can centrally decide what to do with it.
        return HttpResponse(
            status=e.code,
            body=e.read() or b"",
            headers={k.lower(): v for k, v in (e.headers or {}).items()},
        )
    except urllib.error.URLError as e:
        raise TransportError(str(e.reason)) from e
    except Exception as e:  # noqa: BLE001
        raise TransportError(str(e)) from e


# --------------------------- Config -----------------------------------------

@dataclass
class HubSpotConfig:
    access_token: str | None = None
    base_url: str = DEFAULT_BASE_URL
    dry_run: bool = False
    timeout: float = DEFAULT_TIMEOUT
    max_retries: int = DEFAULT_MAX_RETRIES
    retry_base_seconds: float = DEFAULT_RETRY_BASE_SECONDS
    retry_cap_seconds: float = DEFAULT_RETRY_CAP_SECONDS
    audit_log_path: str | None = None
    health_probe: bool = True

    @classmethod
    def from_env(cls, env: dict[str, str] | None = None) -> "HubSpotConfig":
        e = env if env is not None else os.environ
        token = (e.get("HUBSPOT_ACCESS_TOKEN") or "").strip() or None
        return cls(
            access_token=token,
            base_url=(e.get("HUBSPOT_BASE_URL") or DEFAULT_BASE_URL).rstrip("/"),
            dry_run=_truthy(e.get("HUBSPOT_DRY_RUN")),
            timeout=float(e.get("HUBSPOT_TIMEOUT") or DEFAULT_TIMEOUT),
            max_retries=int(e.get("HUBSPOT_MAX_RETRIES") or DEFAULT_MAX_RETRIES),
            retry_base_seconds=float(
                e.get("HUBSPOT_RETRY_BASE_SECONDS") or DEFAULT_RETRY_BASE_SECONDS
            ),
            retry_cap_seconds=float(
                e.get("HUBSPOT_RETRY_CAP_SECONDS") or DEFAULT_RETRY_CAP_SECONDS
            ),
            audit_log_path=(e.get("HUBSPOT_AUDIT_LOG") or "").strip() or None,
            health_probe=not _truthy(e.get("HUBSPOT_HEALTH_PROBE_DISABLE")),
        )

    @property
    def credentials_present(self) -> bool:
        return bool(self.access_token)

    @property
    def mode(self) -> str:
        if self.dry_run:
            return MODE_DRY_RUN
        if self.credentials_present:
            return MODE_LIVE
        return MODE_BLOCKED

    def describe(self) -> dict[str, Any]:
        """Redacted, secret-free description suitable for UI / logs."""
        token_fp = None
        if self.access_token:
            # Non-reversible fingerprint: prefix + length only.
            token_fp = f"{self.access_token[:7]}…(len={len(self.access_token)})"
        return {
            "integration": "hubspot",
            "base_url": self.base_url,
            "mode": self.mode,
            "credentials_present": self.credentials_present,
            "access_token_fingerprint": token_fp,
            "dry_run": self.dry_run,
            "timeout_seconds": self.timeout,
            "max_retries": self.max_retries,
            "retry_base_seconds": self.retry_base_seconds,
            "audit_log_enabled": bool(self.audit_log_path),
            "health_probe_enabled": self.health_probe,
        }


# --------------------------- API result -------------------------------------

@dataclass
class ApiResult:
    ok: bool
    status: int | None
    data: Any = None
    error: str | None = None  # already redacted
    attempts: int = 0
    retryable_failure: bool = False


# --------------------------- Operation record (audit) -----------------------

@dataclass
class OperationRecord:
    action: str
    mode: str
    outcome: str = OUT_ERROR  # fail-closed default until explicitly set
    object_type: str | None = None
    object_id: str | None = None
    idempotency_key: str = field(default_factory=lambda: uuid.uuid4().hex)
    http_status: int | None = None
    attempts: int = 0
    error: str | None = None
    started_at: str = field(default_factory=_now_iso)
    finished_at: str | None = None
    duration_ms: int | None = None
    detail: dict[str, Any] = field(default_factory=dict)

    def to_dict(self) -> dict[str, Any]:
        return {
            "action": self.action,
            "mode": self.mode,
            "outcome": self.outcome,
            "object_type": self.object_type,
            "object_id": self.object_id,
            "idempotency_key": self.idempotency_key,
            "http_status": self.http_status,
            "attempts": self.attempts,
            "error": self.error,
            "started_at": self.started_at,
            "finished_at": self.finished_at,
            "duration_ms": self.duration_ms,
            "detail": self.detail,
        }


# --------------------------- Client -----------------------------------------

class HubSpotClient:
    """HubSpot CRM client with retries, dry-run planning, and an audit ledger.

    The transport is injectable so the full request/retry/audit path is
    testable without any network access.
    """

    def __init__(
        self,
        config: HubSpotConfig | None = None,
        transport: Transport | None = None,
        sleep: Callable[[float], None] = time.sleep,
    ) -> None:
        self.config = config or HubSpotConfig.from_env()
        self._transport = transport or _urllib_transport
        self._sleep = sleep
        self.ledger: list[OperationRecord] = []

    # -- ledger / audit ------------------------------------------------------

    def _record(self, rec: OperationRecord) -> OperationRecord:
        rec.finished_at = rec.finished_at or _now_iso()
        self.ledger.append(rec)
        if len(self.ledger) > LEDGER_MAX:
            self.ledger = self.ledger[-LEDGER_MAX:]
        self._append_audit_log(rec)
        LOG.info(
            "hubspot op action=%s mode=%s outcome=%s object=%s/%s attempts=%d status=%s",
            rec.action, rec.mode, rec.outcome, rec.object_type, rec.object_id,
            rec.attempts, rec.http_status,
        )
        return rec

    def _append_audit_log(self, rec: OperationRecord) -> None:
        path = self.config.audit_log_path
        if not path:
            return
        try:
            line = json.dumps(rec.to_dict(), ensure_ascii=False)
            line = _redact(line)
            p = Path(path)
            p.parent.mkdir(parents=True, exist_ok=True)
            with p.open("a", encoding="utf-8") as fh:
                fh.write(line + "\n")
        except Exception as e:  # noqa: BLE001 — auditing must never crash an op
            LOG.warning("audit log write failed: %s", e)

    # -- low-level request with retries -------------------------------------

    def _request(
        self,
        method: str,
        path: str,
        body: dict[str, Any] | None = None,
    ) -> ApiResult:
        """Issue a request with bounded exponential backoff on 429/5xx/network.

        Caller is responsible for ensuring this is only invoked in live mode.
        """
        url = f"{self.config.base_url}{path}"
        headers = {
            "Authorization": f"Bearer {self.config.access_token}",
            "Content-Type": "application/json",
            "Accept": "application/json",
            "User-Agent": f"{SKILL_NAME}/{SKILL_VERSION}",
        }
        payload = json.dumps(body).encode() if body is not None else None

        attempts = 0
        last_error: str | None = None
        last_status: int | None = None
        for attempt in range(1, self.config.max_retries + 1):
            attempts = attempt
            try:
                resp = self._transport(
                    method, url, headers, payload, self.config.timeout
                )
            except TransportError as e:
                last_error = _redact(str(e))
                last_status = None
                if attempt < self.config.max_retries:
                    self._backoff(attempt, retry_after=None)
                    continue
                return ApiResult(
                    ok=False, status=None, error=f"network error: {last_error}",
                    attempts=attempts, retryable_failure=True,
                )

            last_status = resp.status
            if 200 <= resp.status < 300:
                return ApiResult(
                    ok=True, status=resp.status, data=resp.json(), attempts=attempts
                )

            # Decode an error body for the audit trail (redacted).
            err_text = _redact((resp.body or b"")[:500].decode(errors="replace"))
            last_error = f"http {resp.status}: {err_text}"

            retryable = resp.status == 429 or 500 <= resp.status < 600
            if retryable and attempt < self.config.max_retries:
                retry_after = _parse_retry_after(resp.headers.get("retry-after"))
                self._backoff(attempt, retry_after=retry_after)
                continue
            return ApiResult(
                ok=False, status=resp.status, data=resp.json(), error=last_error,
                attempts=attempts, retryable_failure=retryable,
            )

        return ApiResult(
            ok=False, status=last_status, error=last_error or "unknown error",
            attempts=attempts, retryable_failure=True,
        )

    def _backoff(self, attempt: int, retry_after: float | None) -> None:
        if retry_after is not None:
            delay = min(retry_after, self.config.retry_cap_seconds)
        else:
            delay = min(
                self.config.retry_base_seconds * (2 ** (attempt - 1)),
                self.config.retry_cap_seconds,
            )
        LOG.warning("retrying after %.2fs (attempt %d)", delay, attempt)
        self._sleep(delay)

    # -- guards --------------------------------------------------------------

    def _guard(self, action: str, object_type: str | None) -> OperationRecord | None:
        """Return a terminal record if the operation cannot proceed live.

        Fail-closed: blocked when no credentials; seam (no network) in dry-run.
        Returns None when the caller should proceed with a live request.
        """
        mode = self.config.mode
        if mode == MODE_BLOCKED:
            return self._record(OperationRecord(
                action=action, mode=mode, outcome=OUT_BLOCKED,
                object_type=object_type,
                error="no HUBSPOT_ACCESS_TOKEN configured; refusing to claim success",
            ))
        return None

    # -- connection probe (health) ------------------------------------------

    def probe_connection(self) -> dict[str, Any]:
        """Non-mutating credential check. Runs whenever a token is present,
        regardless of dry-run, because operators need the truth about creds.
        """
        if not self.config.credentials_present:
            return {
                "connection": CONN_NOT_CHECKED,
                "checked": False,
                "reason": "no credentials configured",
            }
        if not self.config.health_probe:
            return {
                "connection": CONN_NOT_CHECKED,
                "checked": False,
                "reason": "health probe disabled (HUBSPOT_HEALTH_PROBE_DISABLE)",
            }
        started = time.time()
        res = self._request("GET", "/account-info/v3/details")
        elapsed_ms = int((time.time() - started) * 1000)
        if res.ok:
            data = res.data or {}
            account = {
                "portal_id": data.get("portalId"),
                "hub_domain": data.get("uiDomain"),
                "account_type": data.get("accountType"),
                "time_zone": data.get("timeZone"),
                "company_currency": data.get("companyCurrency"),
            }
            return {
                "connection": CONN_OK,
                "checked": True,
                "latency_ms": elapsed_ms,
                "account": account,
                "attempts": res.attempts,
            }
        connection = CONN_UNREACHABLE
        if res.status in (401,):
            connection = CONN_AUTH_FAILED
        elif res.status in (403,):
            connection = CONN_FORBIDDEN
        return {
            "connection": connection,
            "checked": True,
            "latency_ms": elapsed_ms,
            "http_status": res.status,
            "error": res.error,
            "attempts": res.attempts,
        }

    # -- contact lookup ------------------------------------------------------

    def find_contact(
        self,
        email: str | None = None,
        contact_id: str | None = None,
        properties: list[str] | None = None,
    ) -> OperationRecord:
        if not email and not contact_id:
            return self._record(OperationRecord(
                action="find_contact", mode=self.config.mode, outcome=OUT_ERROR,
                object_type="contact", error="provide email or contact_id",
            ))
        props = properties or ["email", "firstname", "lastname", "lifecyclestage"]
        guard = self._guard("find_contact", "contact")
        if guard is not None:
            return guard

        if self.config.mode == MODE_DRY_RUN:
            return self._record(OperationRecord(
                action="find_contact", mode=MODE_DRY_RUN, outcome=OUT_DRY_RUN,
                object_type="contact",
                detail={"seam": "no live lookup performed",
                        "query": {"email": email, "contact_id": contact_id}},
            ))

        started = time.time()
        if contact_id:
            qs = "properties=" + ",".join(props)
            res = self._request(
                "GET", f"/crm/v3/objects/contacts/{contact_id}?{qs}"
            )
            found = res.data if res.ok else None
        else:
            body = {
                "filterGroups": [{
                    "filters": [{
                        "propertyName": "email", "operator": "EQ", "value": email,
                    }]
                }],
                "properties": props,
                "limit": 1,
            }
            res = self._request("POST", "/crm/v3/objects/contacts/search", body)
            results = (res.data or {}).get("results") if res.ok else None
            found = results[0] if results else None

        rec = OperationRecord(
            action="find_contact", mode=MODE_LIVE,
            object_type="contact", attempts=res.attempts, http_status=res.status,
            duration_ms=int((time.time() - started) * 1000),
        )
        if not res.ok:
            rec.outcome = OUT_ERROR
            rec.error = res.error
        elif found:
            rec.outcome = OUT_FOUND
            rec.object_id = str(found.get("id"))
            rec.detail = {"contact": _safe_contact(found)}
        else:
            rec.outcome = OUT_NOT_FOUND
            rec.detail = {"query": {"email": email, "contact_id": contact_id}}
        return self._record(rec)

    def create_contact(self, properties: dict[str, Any]) -> OperationRecord:
        guard = self._guard("create_contact", "contact")
        if guard is not None:
            return guard
        body = {"properties": properties}
        if self.config.mode == MODE_DRY_RUN:
            return self._record(OperationRecord(
                action="create_contact", mode=MODE_DRY_RUN, outcome=OUT_DRY_RUN,
                object_type="contact",
                detail={"seam": "no live write performed", "planned_payload": body},
            ))
        started = time.time()
        res = self._request("POST", "/crm/v3/objects/contacts", body)
        rec = OperationRecord(
            action="create_contact", mode=MODE_LIVE, object_type="contact",
            attempts=res.attempts, http_status=res.status,
            duration_ms=int((time.time() - started) * 1000),
        )
        if res.ok:
            rec.outcome = OUT_CREATED
            rec.object_id = str((res.data or {}).get("id"))
            rec.detail = {"contact": _safe_contact(res.data or {})}
        else:
            rec.outcome = OUT_ERROR
            rec.error = res.error
        return self._record(rec)

    # -- activity writeback --------------------------------------------------

    def log_activity(
        self,
        contact_id: str,
        note_body: str,
        timestamp_ms: int | None = None,
    ) -> OperationRecord:
        """Write a Note to a contact's timeline and associate it (type 202)."""
        guard = self._guard("log_activity", "note")
        if guard is not None:
            return guard
        ts = timestamp_ms if timestamp_ms is not None else int(time.time() * 1000)
        body = {
            "properties": {"hs_note_body": note_body, "hs_timestamp": ts},
            "associations": [{
                "to": {"id": contact_id},
                "types": [{
                    "associationCategory": "HUBSPOT_DEFINED",
                    "associationTypeId": NOTE_TO_CONTACT_TYPE_ID,
                }],
            }],
        }
        if self.config.mode == MODE_DRY_RUN:
            return self._record(OperationRecord(
                action="log_activity", mode=MODE_DRY_RUN, outcome=OUT_DRY_RUN,
                object_type="note", object_id=None,
                detail={"seam": "no live write performed",
                        "associated_contact_id": contact_id,
                        "planned_payload": body},
            ))
        started = time.time()
        res = self._request("POST", "/crm/v3/objects/notes", body)
        rec = OperationRecord(
            action="log_activity", mode=MODE_LIVE, object_type="note",
            attempts=res.attempts, http_status=res.status,
            duration_ms=int((time.time() - started) * 1000),
            detail={"associated_contact_id": contact_id},
        )
        if res.ok:
            rec.outcome = OUT_CREATED
            rec.object_id = str((res.data or {}).get("id"))
        else:
            rec.outcome = OUT_ERROR
            rec.error = res.error
        return self._record(rec)

    # -- composite pilot path ------------------------------------------------

    def sync_contact_activity(
        self,
        email: str,
        note_body: str,
        contact_properties: dict[str, Any] | None = None,
        timestamp_ms: int | None = None,
    ) -> dict[str, Any]:
        """The full pilot path: find-or-create a contact by email, then log a
        note to its timeline. Returns a combined, UI-ready result that links
        the individual audit records by idempotency key.
        """
        steps: list[OperationRecord] = []

        find = self.find_contact(email=email)
        steps.append(find)

        if find.outcome == OUT_BLOCKED:
            return _compose_sync(MODE_BLOCKED, OUT_BLOCKED, steps,
                                 contact_id=None, note_id=None,
                                 error="blocked: no credentials")
        if self.config.mode == MODE_DRY_RUN:
            # Seam: we can't know the contact id without a live lookup, so we
            # report the planned create + log without inventing an id.
            props = {"email": email, **(contact_properties or {})}
            create = self.create_contact(props)
            steps.append(create)
            log = self.log_activity(contact_id="<dry-run-contact-id>",
                                    note_body=note_body, timestamp_ms=timestamp_ms)
            steps.append(log)
            return _compose_sync(MODE_DRY_RUN, OUT_DRY_RUN, steps,
                                 contact_id=None, note_id=None)

        if find.outcome == OUT_ERROR:
            return _compose_sync(MODE_LIVE, OUT_ERROR, steps,
                                 contact_id=None, note_id=None, error=find.error)

        contact_id = find.object_id
        if find.outcome == OUT_NOT_FOUND:
            props = {"email": email, **(contact_properties or {})}
            create = self.create_contact(props)
            steps.append(create)
            if create.outcome != OUT_CREATED:
                return _compose_sync(MODE_LIVE, OUT_ERROR, steps,
                                     contact_id=None, note_id=None,
                                     error=create.error)
            contact_id = create.object_id

        log = self.log_activity(
            contact_id=contact_id, note_body=note_body, timestamp_ms=timestamp_ms
        )
        steps.append(log)
        if log.outcome != OUT_CREATED:
            return _compose_sync(MODE_LIVE, OUT_ERROR, steps,
                                 contact_id=contact_id, note_id=None,
                                 error=log.error)
        return _compose_sync(MODE_LIVE, OUT_OK, steps,
                             contact_id=contact_id, note_id=log.object_id)

    # -- health / status contracts ------------------------------------------

    def health(self) -> dict[str, Any]:
        """Integration health contract for the UI. Fail-closed: never reports
        ready_for_pilot=true unless a live connection was actually verified and
        writes are not blocked.
        """
        cfg = self.config
        probe = self.probe_connection()
        connection = probe.get("connection", CONN_NOT_CHECKED)

        blocking: list[str] = []
        if not cfg.credentials_present:
            blocking.append("HUBSPOT_ACCESS_TOKEN is not set")
        if cfg.dry_run:
            blocking.append("HUBSPOT_DRY_RUN is enabled — writes are simulated")
        if cfg.credentials_present and connection == CONN_AUTH_FAILED:
            blocking.append("token rejected by HubSpot (401)")
        if cfg.credentials_present and connection == CONN_FORBIDDEN:
            blocking.append("token missing required scopes (403)")
        if cfg.credentials_present and connection == CONN_UNREACHABLE:
            blocking.append("HubSpot API unreachable")

        ready = (
            cfg.mode == MODE_LIVE
            and connection == CONN_OK
            and not blocking
        )

        health: dict[str, Any] = {
            "integration": "hubspot",
            "skill_version": SKILL_VERSION,
            "mode": cfg.mode,
            "credentials_present": cfg.credentials_present,
            "dry_run": cfg.dry_run,
            "base_url": cfg.base_url,
            "connection": connection,
            "connection_checked": probe.get("checked", False),
            "ready_for_pilot": ready,
            "blocking_reasons": blocking,
            "last_checked": _now_iso(),
        }
        if "account" in probe:
            health["account"] = probe["account"]
        if "latency_ms" in probe:
            health["latency_ms"] = probe["latency_ms"]
        if probe.get("error"):
            health["connection_error"] = probe["error"]
        if probe.get("http_status"):
            health["connection_http_status"] = probe["http_status"]
        if probe.get("reason"):
            health["connection_note"] = probe["reason"]
        return health

    def status(self, recent: int = 20) -> dict[str, Any]:
        """Operator/UI status: health + sync ledger counters + recent ops."""
        counters: dict[str, int] = {}
        last_success: dict[str, Any] | None = None
        last_error: dict[str, Any] | None = None
        for rec in self.ledger:
            counters[rec.outcome] = counters.get(rec.outcome, 0) + 1
            if rec.outcome in (OUT_OK, OUT_CREATED, OUT_FOUND):
                last_success = rec.to_dict()
            if rec.outcome == OUT_ERROR:
                last_error = rec.to_dict()
        return {
            "integration": "hubspot",
            "mode": self.config.mode,
            "health": self.health(),
            "counters": counters,
            "total_operations": len(self.ledger),
            "recent_operations": [r.to_dict() for r in self.ledger[-recent:]],
            "last_success": last_success,
            "last_error": last_error,
        }


# --------------------------- Helpers ----------------------------------------

def _parse_retry_after(value: str | None) -> float | None:
    if not value:
        return None
    try:
        return float(value)
    except (TypeError, ValueError):
        return None


def _safe_contact(obj: dict[str, Any]) -> dict[str, Any]:
    """Return a compact, non-sensitive contact view for UI/audit."""
    props = obj.get("properties", {}) or {}
    return {
        "id": str(obj.get("id")) if obj.get("id") is not None else None,
        "email": props.get("email"),
        "firstname": props.get("firstname"),
        "lastname": props.get("lastname"),
        "lifecyclestage": props.get("lifecyclestage"),
    }


def _compose_sync(
    mode: str,
    outcome: str,
    steps: list[OperationRecord],
    contact_id: str | None,
    note_id: str | None,
    error: str | None = None,
) -> dict[str, Any]:
    return {
        "action": "sync_contact_activity",
        "mode": mode,
        "outcome": outcome,
        "contact_id": contact_id,
        "note_id": note_id,
        "error": error,
        "steps": [s.to_dict() for s in steps],
    }


# --------------------------- Module-level convenience -----------------------

def _client_from_env() -> HubSpotClient:
    return HubSpotClient(HubSpotConfig.from_env())


def hubspot_health() -> dict[str, Any]:
    return _client_from_env().health()


def hubspot_status(recent: int = 20) -> dict[str, Any]:
    return _client_from_env().status(recent=recent)


def hubspot_describe_config() -> dict[str, Any]:
    return HubSpotConfig.from_env().describe()


def hubspot_find_contact(
    email: str | None = None, contact_id: str | None = None
) -> dict[str, Any]:
    return _client_from_env().find_contact(
        email=email, contact_id=contact_id
    ).to_dict()


def hubspot_log_activity(contact_id: str, note_body: str) -> dict[str, Any]:
    return _client_from_env().log_activity(contact_id, note_body).to_dict()


def hubspot_sync_contact_activity(
    email: str, note_body: str, contact_properties: dict[str, Any] | None = None
) -> dict[str, Any]:
    return _client_from_env().sync_contact_activity(
        email=email, note_body=note_body, contact_properties=contact_properties
    )


# --------------------------- CLI --------------------------------------------

def _print_json(obj: Any) -> None:
    print(json.dumps(obj, indent=2, ensure_ascii=False))


def _cli(argv: list[str] | None = None) -> int:
    _configure_logging()
    p = argparse.ArgumentParser(prog="hubspot_skill", description=__doc__)
    p.add_argument("--mcp", action="store_true", help="run as MCP stdio server")
    sub = p.add_subparsers(dest="cmd")

    sub.add_parser("health", help="integration health contract")
    sub.add_parser("config", help="redacted config (no secrets)")

    st = sub.add_parser("status", help="sync ledger + health")
    st.add_argument("--recent", type=int, default=20)

    fc = sub.add_parser("find", help="lookup a contact")
    fc.add_argument("--email", default=None)
    fc.add_argument("--id", dest="contact_id", default=None)

    lg = sub.add_parser("log", help="log a note activity to a contact")
    lg.add_argument("--id", dest="contact_id", required=True)
    lg.add_argument("--note", required=True)

    sy = sub.add_parser("sync", help="find-or-create contact + log activity")
    sy.add_argument("--email", required=True)
    sy.add_argument("--note", required=True)
    sy.add_argument("--firstname", default=None)
    sy.add_argument("--lastname", default=None)

    args = p.parse_args(argv)

    if args.mcp:
        return _run_mcp_server()

    if args.cmd == "health":
        _print_json(hubspot_health())
        return 0
    if args.cmd == "config":
        _print_json(hubspot_describe_config())
        return 0
    if args.cmd == "status":
        _print_json(hubspot_status(recent=args.recent))
        return 0
    if args.cmd == "find":
        _print_json(hubspot_find_contact(email=args.email, contact_id=args.contact_id))
        return 0
    if args.cmd == "log":
        _print_json(hubspot_log_activity(args.contact_id, args.note))
        return 0
    if args.cmd == "sync":
        props: dict[str, Any] = {}
        if args.firstname:
            props["firstname"] = args.firstname
        if args.lastname:
            props["lastname"] = args.lastname
        _print_json(hubspot_sync_contact_activity(args.email, args.note, props or None))
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
    def health() -> dict[str, Any]:
        """HubSpot integration health contract (mode, connection, readiness)."""
        return hubspot_health()

    @app.tool()
    def status(recent: int = 20) -> dict[str, Any]:
        """HubSpot sync status: health + ledger counters + recent operations."""
        return hubspot_status(recent=recent)

    @app.tool()
    def config() -> dict[str, Any]:
        """Redacted HubSpot config (never returns the token)."""
        return hubspot_describe_config()

    @app.tool()
    def find_contact(email: str | None = None, contact_id: str | None = None) -> dict[str, Any]:
        """Look up a HubSpot contact by email or id. Fail-closed without creds."""
        return hubspot_find_contact(email=email, contact_id=contact_id)

    @app.tool()
    def log_activity(contact_id: str, note_body: str) -> dict[str, Any]:
        """Write a Note activity to a contact's timeline. Fail-closed without creds."""
        return hubspot_log_activity(contact_id, note_body)

    @app.tool()
    def sync_contact_activity(
        email: str, note_body: str, firstname: str | None = None, lastname: str | None = None
    ) -> dict[str, Any]:
        """Find-or-create a contact by email, then log a note activity."""
        props: dict[str, Any] = {}
        if firstname:
            props["firstname"] = firstname
        if lastname:
            props["lastname"] = lastname
        return hubspot_sync_contact_activity(email, note_body, props or None)

    app.run()
    return 0


if __name__ == "__main__":
    import sys
    sys.exit(_cli())
