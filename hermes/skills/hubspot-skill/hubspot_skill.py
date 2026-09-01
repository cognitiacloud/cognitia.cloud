#!/usr/bin/env python3
"""Hermes HubSpot skill.

Real HubSpot CRM path for the Cognitia pilot: contact lookup, contact
association, and activity write-back (notes + tasks), plus an integration
health/status contract for UI consumption.

Tools:
    health     -> health_check          (UI status contract)
    lookup     -> contact_lookup
    associate  -> contact_associate
    writeback  -> activity_writeback     (note | task)
    auth       -> auth_status            (diagnostics; masked)

Auth (pluggable; override with HUBSPOT_AUTH_MODE = private_app | oauth):
    private_app -> HUBSPOT_ACCESS_TOKEN
    oauth       -> HUBSPOT_CLIENT_ID / HUBSPOT_CLIENT_SECRET / HUBSPOT_REFRESH_TOKEN

Design contract:
    * Fail closed. With no credentials the skill runs in "seam" mode: every
      read/write returns a structured state="blocked" result. It NEVER
      fabricates a successful HubSpot object.
    * Real-vs-seam boundary is explicit. All HTTP goes through the single
      _http_call() seam. Every result/health object carries a `mode` field
      ("live" | "seam"). Simulated responses (opt-in, off by default via
      HUBSPOT_ALLOW_SIMULATION) are stamped {"simulated": true, "source": "seam"}.
    * Secrets stay out of logs. A redacting log filter scrubs tokens/emails;
      auth identity is only ever shown masked.
    * Auditability. Each operation emits a redacted JSONL audit entry (to
      HUBSPOT_AUDIT_LOG when set) and a redacted INFO log line.

No HubSpot SDK dependency: the HubSpot REST API is called directly over
stdlib urllib, consistent with the rest of Hermes.
"""

from __future__ import annotations

import argparse
import json
import logging
import os
import re
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
from dataclasses import asdict, dataclass, field
from datetime import datetime, timezone
from typing import Any

SKILL_NAME = "hermes-hubspot"
SKILL_VERSION = "0.1.0"

DEFAULT_BASE_URL = "https://api.hubapi.com"
DEFAULT_TIMEOUT = 30
DEFAULT_MAX_RETRIES = 3
RETRYABLE_STATUS = {429, 500, 502, 503, 504}

LOG = logging.getLogger("hermes.hubspot")


# --------------------------- Logging / redaction ----------------------------

EMAIL_RE = re.compile(r"\b[A-Za-z0-9._%+\-]+@[A-Za-z0-9.\-]+\.[A-Za-z]{2,}\b")
# HubSpot private-app tokens (pat-na1-..., pat-eu1-..., legacy pat-...) and
# OAuth access/refresh tokens (long opaque strings) plus generic bearer values.
TOKEN_PATTERNS: list[re.Pattern[str]] = [
    re.compile(r"pat-[a-z0-9]{2,4}-[A-Za-z0-9\-]{8,}"),
    re.compile(r"pat-[A-Za-z0-9\-]{16,}"),
    re.compile(r"(?i)bearer\s+[A-Za-z0-9._\-]{12,}"),
    re.compile(r"CL[A-Za-z0-9_\-]{30,}"),  # HubSpot OAuth tokens often start CL/Cg
    re.compile(r"Cg[A-Za-z0-9_\-]{30,}"),
]

# Token strings we have actually loaded this process. Registering them lets the
# redactor mask the *exact* secret even if it doesn't match a known shape.
_KNOWN_SECRETS: set[str] = set()


def _register_secret(value: str | None) -> None:
    if value and len(value) >= 8:
        _KNOWN_SECRETS.add(value)


def _redact(text: str) -> str:
    if not text:
        return text
    for secret in _KNOWN_SECRETS:
        if secret in text:
            text = text.replace(secret, "[TOKEN_REDACTED]")
    for pat in TOKEN_PATTERNS:
        text = pat.sub("[TOKEN_REDACTED]", text)
    text = EMAIL_RE.sub("[EMAIL_REDACTED]", text)
    return text


class _RedactingFilter(logging.Filter):
    def filter(self, record: logging.LogRecord) -> bool:
        try:
            record.msg = _redact(str(record.msg))
            if record.args:
                # Only scrub string args; leave numbers intact so %d/%f still format.
                record.args = tuple(_redact(a) if isinstance(a, str) else a for a in record.args)
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


# Belt-and-suspenders: attach the redacting filter to the skill logger at import
# time. Logger-level filters run for every record this logger emits, regardless
# of which handler is configured downstream — so secrets are scrubbed even when
# the skill is imported as a library (e.g. the MCP server) without calling
# _configure_logging().
LOG.addFilter(_RedactingFilter())


def _mask(value: str | None) -> str:
    """Mask a secret/identifier for display: keep a short prefix only."""
    if not value:
        return ""
    if len(value) <= 8:
        return "****"
    return f"{value[:4]}…{value[-2:]} (len={len(value)})"


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


# --------------------------- Config -----------------------------------------

def _base_url() -> str:
    return os.environ.get("HUBSPOT_BASE_URL", DEFAULT_BASE_URL).rstrip("/")


def _max_retries() -> int:
    raw = os.environ.get("HUBSPOT_MAX_RETRIES", "")
    try:
        return max(0, int(raw))
    except (TypeError, ValueError):
        return DEFAULT_MAX_RETRIES


def _timeout() -> int:
    raw = os.environ.get("HUBSPOT_TIMEOUT", "")
    try:
        return max(1, int(raw))
    except (TypeError, ValueError):
        return DEFAULT_TIMEOUT



def _simulation_enabled() -> bool:
    return os.environ.get("HUBSPOT_ALLOW_SIMULATION", "").strip().lower() in {"1", "true", "yes", "on"}


# --------------------------- Live-surface quarantine (CGD-003) --------------

LIVE_SURFACE_DENIED = "LIVE_SURFACE_DENIED"

_LIVE_SURFACE_ENV = {
    "hubspotSkill": "LIVE_OUTBOUND_HUBSPOT_SKILL",
    "hubspotOAuthRefresh": "LIVE_OUTBOUND_HUBSPOT_OAUTH_REFRESH",
}


class LiveSurfaceDeniedError(Exception):
    """Fail-close: secrets are not consent. Raised BEFORE vendor HTTP."""

    code = LIVE_SURFACE_DENIED
    outbound = False
    inbound_vendor = False

    def __init__(self, surface: str = "hubspotSkill") -> None:
        self.surface = surface
        super().__init__(
            f"{LIVE_SURFACE_DENIED}: {surface} outbound blocked "
            "(deny-by-default; secrets are not consent)",
        )


def _env_flag_true(name: str) -> bool:
    return os.environ.get(name, "").strip().lower() == "true"


def assert_live_outbound_allowed(surface: str = "hubspotSkill") -> None:
    """Gate at START of a live HubSpot path, BEFORE token mint or urlopen."""
    nested_env = _LIVE_SURFACE_ENV.get(surface)
    nested_ok = bool(nested_env) and _env_flag_true(nested_env)
    if not (_env_flag_true("LIVE_OUTBOUND_EXPLICITLY_ALLOWED") and nested_ok):
        raise LiveSurfaceDeniedError(surface)


def _q(segment: str) -> str:
    """URL-encode a path segment to prevent path injection from ids/types."""
    return urllib.parse.quote(str(segment), safe="")


# --------------------------- Errors -----------------------------------------

class HubSpotError(Exception):
    """Normalized HubSpot transport/API error with a stable category."""

    def __init__(self, message: str, *, category: str, status: int | None = None,
                 request_id: str | None = None, retryable: bool = False) -> None:
        super().__init__(message)
        self.message = message
        self.category = category  # auth | rate_limit | validation | server | network | config
        self.status = status
        self.request_id = request_id
        self.retryable = retryable


# --------------------------- Auth (pluggable) -------------------------------

class AuthProvider:
    """Interface: yields a bearer token and a masked description."""

    mode = "none"

    def bearer_token(self) -> str:  # pragma: no cover - interface
        raise NotImplementedError

    def describe(self) -> dict[str, Any]:  # pragma: no cover - interface
        raise NotImplementedError


class PrivateAppAuth(AuthProvider):
    mode = "private_app"

    def __init__(self, token: str) -> None:
        self._token = token
        _register_secret(token)

    def bearer_token(self) -> str:
        return self._token

    def describe(self) -> dict[str, Any]:
        return {"mode": self.mode, "source": "HUBSPOT_ACCESS_TOKEN", "token": _mask(self._token)}


class OAuthAuth(AuthProvider):
    """OAuth refresh-token flow. Mints + caches a short-lived access token."""

    mode = "oauth"

    def __init__(self, client_id: str, client_secret: str, refresh_token: str) -> None:
        self._client_id = client_id
        self._client_secret = client_secret
        self._refresh_token = refresh_token
        _register_secret(client_secret)
        _register_secret(refresh_token)
        self._access_token: str | None = None
        self._expires_at: float = 0.0

    def bearer_token(self) -> str:
        # Refresh if missing or within 60s of expiry.
        if self._access_token and time.time() < self._expires_at - 60:
            return self._access_token
        self._refresh()
        assert self._access_token is not None
        return self._access_token

    def _refresh(self) -> None:
        # CGD-003: deny BEFORE oauth token HTTP. Cached bearer_token stays local.
        assert_live_outbound_allowed("hubspotSkill")
        body = urllib.parse.urlencode({
            "grant_type": "refresh_token",
            "client_id": self._client_id,
            "client_secret": self._client_secret,
            "refresh_token": self._refresh_token,
        }).encode()
        req = urllib.request.Request(
            f"{_base_url()}/oauth/v1/token",
            data=body,
            headers={"Content-Type": "application/x-www-form-urlencoded"},
            method="POST",
        )
        try:
            status, payload, _ = _http_call(req, _timeout())
        except (HubSpotError, LiveSurfaceDeniedError):
            raise
        except Exception as e:  # noqa: BLE001
            raise HubSpotError(f"oauth token refresh failed: {e}", category="network") from e
        if status != 200:
            raise HubSpotError(
                f"oauth token refresh rejected (http {status})",
                category="auth", status=status,
            )
        data = json.loads(payload or "{}")
        self._access_token = data.get("access_token")
        _register_secret(self._access_token)
        self._expires_at = time.time() + float(data.get("expires_in", 1800))
        if not self._access_token:
            raise HubSpotError("oauth response missing access_token", category="auth", status=status)

    def describe(self) -> dict[str, Any]:
        return {
            "mode": self.mode,
            "source": "HUBSPOT_CLIENT_ID/SECRET/REFRESH_TOKEN",
            "client_id": _mask(self._client_id),
            "access_token_cached": bool(self._access_token),
        }


def select_auth() -> AuthProvider | None:
    """Pick an auth provider from the environment, or None (seam mode)."""
    override = os.environ.get("HUBSPOT_AUTH_MODE", "").strip().lower()
    token = os.environ.get("HUBSPOT_ACCESS_TOKEN", "").strip()
    cid = os.environ.get("HUBSPOT_CLIENT_ID", "").strip()
    csecret = os.environ.get("HUBSPOT_CLIENT_SECRET", "").strip()
    refresh = os.environ.get("HUBSPOT_REFRESH_TOKEN", "").strip()

    if override == "private_app":
        return PrivateAppAuth(token) if token else None
    if override == "oauth":
        return OAuthAuth(cid, csecret, refresh) if (cid and csecret and refresh) else None

    # Auto-detect: prefer an explicit private-app token, else OAuth creds.
    if token:
        return PrivateAppAuth(token)
    if cid and csecret and refresh:
        return OAuthAuth(cid, csecret, refresh)
    return None


# --------------------------- HTTP seam --------------------------------------

def _http_call(req: urllib.request.Request, timeout: int) -> tuple[int, str, dict[str, str]]:
    """The single real network seam. Returns (status, body_text, headers).

    Tests patch THIS function to exercise the live code paths offline.
    HTTPError is converted to a normal (status, body) tuple so the retry/
    categorization logic lives in one place (_request).
    """
    # CGD-003: last-line deny BEFORE urlopen. Patched tests replace this function.
    assert_live_outbound_allowed("hubspotSkill")
    try:
        with urllib.request.urlopen(req, timeout=timeout) as r:
            return r.status, r.read().decode("utf-8", errors="replace"), dict(r.headers)
    except urllib.error.HTTPError as e:
        body = e.read().decode("utf-8", errors="replace") if e.fp else ""
        return e.code, body, dict(e.headers or {})


def _categorize(status: int) -> tuple[str, bool]:
    """Map an HTTP status to (category, retryable)."""
    if status in (401, 403):
        return "auth", False
    if status == 429:
        return "rate_limit", True
    if status in (400, 409, 422):
        return "validation", False
    if status >= 500:
        return "server", status in RETRYABLE_STATUS
    return "validation", False


def _request(
    method: str,
    path: str,
    *,
    auth: AuthProvider,
    params: dict[str, Any] | None = None,
    json_body: dict[str, Any] | None = None,
) -> tuple[dict[str, Any], dict[str, Any]]:
    """Perform an authenticated HubSpot request with retries/backoff.

    Returns (parsed_json, meta) where meta carries {status, attempts, request_id}.
    Raises HubSpotError (categorized) on non-2xx after retries are exhausted.
    """
    # CGD-003: deny BEFORE bearer token / fetch. Seam/simulation never reach here.
    assert_live_outbound_allowed("hubspotSkill")
    url = f"{_base_url()}{path}"
    if params:
        url = f"{url}?{urllib.parse.urlencode(params)}"
    data = json.dumps(json_body).encode() if json_body is not None else None

    max_retries = _max_retries()
    timeout = _timeout()
    last_error: HubSpotError | None = None

    for attempt in range(1, max_retries + 2):  # initial try + retries
        token = auth.bearer_token()
        headers = {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}
        req = urllib.request.Request(url, data=data, headers=headers, method=method)
        try:
            status, body, resp_headers = _http_call(req, timeout)
        except LiveSurfaceDeniedError:
            raise
        except Exception as e:  # noqa: BLE001 - network/transport failure
            last_error = HubSpotError(f"network error: {e}", category="network", retryable=True)
            LOG.warning("hubspot %s %s attempt %d network error: %s", method, path, attempt, e)
            if attempt <= max_retries:
                time.sleep(2 ** attempt)
                continue
            raise last_error from e

        request_id = resp_headers.get("X-Request-Id") or resp_headers.get("x-request-id")
        if 200 <= status < 300:
            parsed = json.loads(body) if body else {}
            return parsed, {"status": status, "attempts": attempt, "request_id": request_id}

        category, retryable = _categorize(status)
        detail = _extract_error_message(body)
        last_error = HubSpotError(
            f"http {status}: {detail}", category=category, status=status,
            request_id=request_id, retryable=retryable,
        )
        LOG.warning("hubspot %s %s attempt %d -> http %d (%s)", method, path, attempt, status, category)
        if retryable and attempt <= max_retries:
            time.sleep(_retry_after(resp_headers, attempt))
            continue
        raise last_error

    assert last_error is not None  # pragma: no cover - loop always sets it
    raise last_error


def _retry_after(headers: dict[str, str], attempt: int) -> float:
    raw = headers.get("Retry-After") or headers.get("retry-after")
    if raw:
        try:
            return float(raw)
        except ValueError:
            pass
    return float(2 ** attempt)


def _extract_error_message(body: str) -> str:
    if not body:
        return ""
    try:
        data = json.loads(body)
        return str(data.get("message") or data.get("error") or body)[:300]
    except Exception:
        return body[:300]


# --------------------------- Status / result contracts ----------------------

@dataclass
class SyncResult:
    """Operator- and UI-visible outcome of a single sync operation."""
    operation: str
    state: str  # success | failed | blocked | skipped | simulated
    mode: str   # live | seam
    attempts: int = 0
    target_id: str | None = None
    request_id: str | None = None
    http_status: int | None = None
    error: str | None = None
    error_category: str | None = None
    simulated: bool = False
    details: dict[str, Any] = field(default_factory=dict)
    started_at: str | None = None
    finished_at: str | None = None
    duration_ms: int | None = None

    def to_dict(self) -> dict[str, Any]:
        return asdict(self)


@dataclass
class HealthCheck:
    name: str
    ok: bool
    detail: str = ""
    latency_ms: int | None = None


@dataclass
class IntegrationHealth:
    """Single status contract for UI consumption."""
    integration: str = "hubspot"
    status: str = "unconfigured"  # ok | degraded | down | unconfigured
    mode: str = "seam"            # live | seam
    base_url: str = ""
    auth: dict[str, Any] = field(default_factory=dict)
    checks: list[dict[str, Any]] = field(default_factory=list)
    portal: dict[str, Any] = field(default_factory=dict)
    last_error: str | None = None
    checked_at: str = ""

    def to_dict(self) -> dict[str, Any]:
        return asdict(self)


# --------------------------- Audit ------------------------------------------

def _audit(entry: dict[str, Any]) -> None:
    """Emit a redacted audit record (JSONL file + INFO log). Never secrets."""
    record = {"ts": _now_iso(), "skill": SKILL_NAME, **entry}
    line = _redact(json.dumps(record, ensure_ascii=False, sort_keys=True))
    path = os.environ.get("HUBSPOT_AUDIT_LOG", "").strip()
    if path:
        try:
            with open(path, "a", encoding="utf-8") as fh:
                fh.write(line + "\n")
        except OSError as e:
            LOG.warning("audit log write failed (%s): %s", path, e)
    LOG.info("audit %s", line)


def _audit_from_result(result: SyncResult) -> None:
    _audit({
        "operation": result.operation,
        "mode": result.mode,
        "state": result.state,
        "target_id": result.target_id,
        "attempts": result.attempts,
        "http_status": result.http_status,
        "error_category": result.error_category,
        "request_id": result.request_id,
    })


# --------------------------- Operation helpers ------------------------------

def _denied_live(operation: str, err: LiveSurfaceDeniedError, started: float) -> SyncResult:
    """Fail-closed result when live flags are off. No vendor HTTP was issued."""
    res = SyncResult(
        operation=operation, state="blocked", mode="seam",
        error=str(err), error_category=LIVE_SURFACE_DENIED,
        started_at=_iso_from(started), finished_at=_now_iso(),
        duration_ms=_ms_since(started),
        details={"surface": err.surface, "outbound": False, "inboundVendor": False, "code": LIVE_SURFACE_DENIED},
    )
    _audit_from_result(res)
    return res


def _blocked(operation: str, reason: str, started: float) -> SyncResult:
    """Fail-closed result when credentials are absent (seam mode)."""
    res = SyncResult(
        operation=operation, state="blocked", mode="seam",
        error=reason, error_category="config",
        started_at=_iso_from(started), finished_at=_now_iso(),
        duration_ms=_ms_since(started),
    )
    _audit_from_result(res)
    return res


def _failed_from_error(operation: str, err: HubSpotError, attempts: int, started: float) -> SyncResult:
    res = SyncResult(
        operation=operation, state="failed", mode="live",
        attempts=attempts, error=err.message, error_category=err.category,
        http_status=err.status, request_id=err.request_id,
        started_at=_iso_from(started), finished_at=_now_iso(), duration_ms=_ms_since(started),
    )
    _audit_from_result(res)
    return res


def _iso_from(monotonic_unused: float) -> str:
    # started_at is wall-clock; we just record "now-ish" at call boundaries.
    return _now_iso()


def _ms_since(started: float) -> int:
    return int((time.monotonic() - started) * 1000)


# --------------------------- Tool: health_check -----------------------------

def health_check() -> dict[str, Any]:
    """Return the integration health/status contract for UI consumption."""
    health = IntegrationHealth(base_url=_base_url(), checked_at=_now_iso())
    auth = select_auth()
    if auth is None:
        health.status = "unconfigured"
        health.mode = "seam"
        health.auth = {"mode": "none", "configured": False}
        health.checks = [{
            "name": "credentials",
            "ok": False,
            "detail": "no HUBSPOT_ACCESS_TOKEN or OAuth credentials provided",
            "latency_ms": None,
        }]
        if _simulation_enabled():
            health.checks.append({
                "name": "simulation", "ok": True,
                "detail": "HUBSPOT_ALLOW_SIMULATION on: seam responses are labelled simulated=true",
                "latency_ms": None,
            })
        _audit({"operation": "health_check", "mode": "seam", "state": "unconfigured"})
        return health.to_dict()

    health.mode = "live"
    health.auth = auth.describe()
    try:
        assert_live_outbound_allowed("hubspotSkill")
    except LiveSurfaceDeniedError as e:
        health.status = "down"
        health.mode = "seam"
        health.last_error = str(e)
        health.checks = [{
            "name": "live_surface",
            "ok": False,
            "detail": LIVE_SURFACE_DENIED,
            "latency_ms": None,
        }]
        _audit({"operation": "health_check", "mode": "seam", "state": LIVE_SURFACE_DENIED})
        return health.to_dict()
    checks: list[HealthCheck] = []

    # Check 1: connectivity + token validity via a cheap authenticated read.
    t0 = time.monotonic()
    try:
        _request("GET", "/crm/v3/objects/contacts", auth=auth, params={"limit": 1})
        checks.append(HealthCheck("contacts_read", True, "contacts read OK", _ms(t0)))
    except HubSpotError as e:
        checks.append(HealthCheck("contacts_read", False, f"{e.category}: {e.message}", _ms(t0)))
        health.last_error = e.message

    # Check 2: account/portal context (best-effort; non-fatal).
    t1 = time.monotonic()
    try:
        info, _ = _request("GET", "/account-info/v3/details", auth=auth)
        health.portal = {
            "portal_id": info.get("portalId"),
            "account_type": info.get("accountType"),
            "time_zone": info.get("timeZone"),
            "ui_domain": info.get("uiDomain"),
            "company_currency": info.get("companyCurrency"),
        }
        checks.append(HealthCheck("account_info", True, "account-info read OK", _ms(t1)))
    except HubSpotError as e:
        checks.append(HealthCheck("account_info", False, f"{e.category}: {e.message}", _ms(t1)))

    health.checks = [asdict(c) for c in checks]
    ok = sum(1 for c in checks if c.ok)
    if ok == len(checks):
        health.status = "ok"
    elif ok == 0:
        health.status = "down"
    else:
        health.status = "degraded"
    _audit({"operation": "health_check", "mode": "live", "state": health.status})
    return health.to_dict()


def _ms(t0: float) -> int:
    return int((time.monotonic() - t0) * 1000)


# --------------------------- Tool: contact_lookup ---------------------------

CONTACT_PROPERTIES = ["email", "firstname", "lastname", "company", "lifecyclestage"]


def contact_lookup(
    email: str | None = None,
    contact_id: str | None = None,
) -> dict[str, Any]:
    """Look up a contact by email (search) or by HubSpot object id."""
    started = time.monotonic()
    op = "contact_lookup"
    if not email and not contact_id:
        res = SyncResult(op, "failed", "seam", error="provide email or contact_id",
                         error_category="validation", started_at=_now_iso(),
                         finished_at=_now_iso(), duration_ms=0)
        _audit_from_result(res)
        return res.to_dict()

    auth = select_auth()
    if auth is None:
        if _simulation_enabled():
            return _simulated_lookup(email, contact_id, started).to_dict()
        return _blocked(op, "no HubSpot credentials configured (fail-closed)", started).to_dict()

    try:
        if contact_id:
            data, meta = _request(
                "GET", f"/crm/v3/objects/contacts/{_q(contact_id)}",
                auth=auth, params={"properties": ",".join(CONTACT_PROPERTIES)},
            )
            found = bool(data.get("id"))
            contact = data if found else {}
        else:
            body = {
                "filterGroups": [{"filters": [
                    {"propertyName": "email", "operator": "EQ", "value": email}
                ]}],
                "properties": CONTACT_PROPERTIES,
                "limit": 1,
            }
            data, meta = _request("POST", "/crm/v3/objects/contacts/search", auth=auth, json_body=body)
            results = data.get("results", [])
            found = bool(results)
            contact = results[0] if found else {}
    except LiveSurfaceDeniedError as e:
        return _denied_live(op, e, started).to_dict()
    except HubSpotError as e:
        return _failed_from_error(op, e, 1, started).to_dict()

    res = SyncResult(
        op, "success" if found else "skipped", "live",
        attempts=meta["attempts"], request_id=meta.get("request_id"),
        http_status=meta["status"], target_id=contact.get("id"),
        details={
            "found": found,
            "contact_id": contact.get("id"),
            "properties": contact.get("properties", {}),
        },
        started_at=_now_iso(), finished_at=_now_iso(), duration_ms=_ms_since(started),
    )
    _audit_from_result(res)
    return res.to_dict()


def _simulated_lookup(email: str | None, contact_id: str | None, started: float) -> SyncResult:
    return SyncResult(
        "contact_lookup", "simulated", "seam", simulated=True,
        target_id="SIMULATED-CONTACT-1",
        details={
            "source": "seam",
            "simulated": True,
            "found": True,
            "contact_id": "SIMULATED-CONTACT-1",
            "properties": {"email": email or "sim@example.com", "firstname": "Sim",
                           "lastname": "Contact", "lifecyclestage": "lead"},
        },
        started_at=_now_iso(), finished_at=_now_iso(), duration_ms=_ms_since(started),
    )


# --------------------------- Tool: contact_associate ------------------------

def contact_associate(
    contact_id: str,
    to_object_type: str,
    to_object_id: str,
    association_type: str = "HUBSPOT_DEFINED",
    association_type_id: int | None = None,
) -> dict[str, Any]:
    """Associate a contact with another CRM object (company, deal, etc.)."""
    started = time.monotonic()
    op = "contact_associate"
    auth = select_auth()
    if auth is None:
        if _simulation_enabled():
            res = SyncResult(op, "simulated", "seam", simulated=True,
                             target_id=contact_id,
                             details={"source": "seam", "simulated": True,
                                      "to_object_type": to_object_type, "to_object_id": to_object_id},
                             started_at=_now_iso(), finished_at=_now_iso(), duration_ms=_ms_since(started))
            _audit_from_result(res)
            return res.to_dict()
        return _blocked(op, "no HubSpot credentials configured (fail-closed)", started).to_dict()

    # HubSpot v4 associations. With an explicit type id, use the labeled
    # endpoint (body = type spec). Otherwise use the default-association
    # endpoint, which needs no body.
    cid, tot, toid = _q(contact_id), _q(to_object_type), _q(to_object_id)
    if association_type_id is not None:
        path = f"/crm/v4/objects/contacts/{cid}/associations/{tot}/{toid}"
        body: Any = [{
            "associationCategory": association_type,
            "associationTypeId": association_type_id,
        }]
    else:
        path = f"/crm/v4/objects/contacts/{cid}/associations/default/{tot}/{toid}"
        body = None
    try:
        data, meta = _request("PUT", path, auth=auth, json_body=body)
    except LiveSurfaceDeniedError as e:
        return _denied_live(op, e, started).to_dict()
    except HubSpotError as e:
        return _failed_from_error(op, e, 1, started).to_dict()

    res = SyncResult(
        op, "success", "live", attempts=meta["attempts"], request_id=meta.get("request_id"),
        http_status=meta["status"], target_id=contact_id,
        details={"to_object_type": to_object_type, "to_object_id": to_object_id, "response": data},
        started_at=_now_iso(), finished_at=_now_iso(), duration_ms=_ms_since(started),
    )
    _audit_from_result(res)
    return res.to_dict()


# --------------------------- Tool: activity_writeback -----------------------

# v4 association type ids for engagement -> contact (HubSpot-defined defaults).
ASSOC_NOTE_TO_CONTACT = 202
ASSOC_TASK_TO_CONTACT = 204


def activity_writeback(
    contact_id: str,
    writeback_type: str = "note",
    subject: str | None = None,
    body: str | None = None,
    task_status: str = "NOT_STARTED",
) -> dict[str, Any]:
    """Write an activity (note | task) back to HubSpot, associated to a contact."""
    started = time.monotonic()
    op = f"activity_writeback:{writeback_type}"
    if writeback_type not in ("note", "task"):
        res = SyncResult(op, "failed", "seam", error="writeback_type must be 'note' or 'task'",
                         error_category="validation", started_at=_now_iso(),
                         finished_at=_now_iso(), duration_ms=0)
        _audit_from_result(res)
        return res.to_dict()

    auth = select_auth()
    if auth is None:
        if _simulation_enabled():
            res = SyncResult(op, "simulated", "seam", simulated=True,
                             target_id=f"SIMULATED-{writeback_type.upper()}-1",
                             details={"source": "seam", "simulated": True, "contact_id": contact_id,
                                      "subject": subject, "body": body},
                             started_at=_now_iso(), finished_at=_now_iso(), duration_ms=_ms_since(started))
            _audit_from_result(res)
            return res.to_dict()
        return _blocked(op, "no HubSpot credentials configured (fail-closed)", started).to_dict()

    ts = _now_iso()
    if writeback_type == "note":
        payload = {
            "properties": {"hs_note_body": body or subject or "", "hs_timestamp": ts},
            "associations": [_assoc(contact_id, ASSOC_NOTE_TO_CONTACT)],
        }
        path = "/crm/v3/objects/notes"
    else:
        payload = {
            "properties": {
                "hs_task_subject": subject or "Cognitia task",
                "hs_task_body": body or "",
                "hs_task_status": task_status,
                "hs_timestamp": ts,
            },
            "associations": [_assoc(contact_id, ASSOC_TASK_TO_CONTACT)],
        }
        path = "/crm/v3/objects/tasks"

    try:
        data, meta = _request("POST", path, auth=auth, json_body=payload)
    except LiveSurfaceDeniedError as e:
        return _denied_live(op, e, started).to_dict()
    except HubSpotError as e:
        return _failed_from_error(op, e, 1, started).to_dict()

    res = SyncResult(
        op, "success", "live", attempts=meta["attempts"], request_id=meta.get("request_id"),
        http_status=meta["status"], target_id=data.get("id"),
        details={"writeback_type": writeback_type, "contact_id": contact_id,
                 "object_id": data.get("id")},
        started_at=_now_iso(), finished_at=_now_iso(), duration_ms=_ms_since(started),
    )
    _audit_from_result(res)
    return res.to_dict()


def _assoc(contact_id: str, type_id: int) -> dict[str, Any]:
    return {
        "to": {"id": contact_id},
        "types": [{"associationCategory": "HUBSPOT_DEFINED", "associationTypeId": type_id}],
    }


# --------------------------- Tool: auth_status ------------------------------

def auth_status() -> dict[str, Any]:
    """Diagnostics: report the selected auth mode (masked) without secrets."""
    auth = select_auth()
    if auth is None:
        return {"configured": False, "mode": "seam",
                "detail": "no credentials; skill is in fail-closed seam mode",
                "simulation": _simulation_enabled()}
    return {"configured": True, "mode": auth.mode, "auth": auth.describe(),
            "base_url": _base_url(), "simulation": _simulation_enabled()}


# --------------------------- CLI --------------------------------------------

def _print_json(obj: dict[str, Any]) -> None:
    print(json.dumps(obj, indent=2, ensure_ascii=False))


def _cli(argv: list[str] | None = None) -> int:
    _configure_logging()
    p = argparse.ArgumentParser(prog="hubspot_skill", description=__doc__)
    p.add_argument("--mcp", action="store_true", help="run as MCP stdio server")
    sub = p.add_subparsers(dest="cmd")

    sub.add_parser("auth")
    sub.add_parser("health")

    lk = sub.add_parser("lookup")
    lk.add_argument("--email", default=None)
    lk.add_argument("--contact-id", default=None)

    asc = sub.add_parser("associate")
    asc.add_argument("--contact-id", required=True)
    asc.add_argument("--to-type", required=True, help="e.g. companies, deals")
    asc.add_argument("--to-id", required=True)
    asc.add_argument("--assoc-type-id", type=int, default=None)

    wb = sub.add_parser("writeback")
    wb.add_argument("--contact-id", required=True)
    wb.add_argument("--type", dest="wtype", choices=["note", "task"], default="note")
    wb.add_argument("--subject", default=None)
    wb.add_argument("--body", default=None)
    wb.add_argument("--task-status", default="NOT_STARTED")

    args = p.parse_args(argv)
    if args.mcp:
        return _run_mcp_server()

    if args.cmd == "auth":
        _print_json(auth_status()); return 0
    if args.cmd == "health":
        _print_json(health_check()); return 0
    if args.cmd == "lookup":
        _print_json(contact_lookup(args.email, args.contact_id)); return 0
    if args.cmd == "associate":
        _print_json(contact_associate(args.contact_id, args.to_type, args.to_id,
                                       association_type_id=args.assoc_type_id)); return 0
    if args.cmd == "writeback":
        _print_json(activity_writeback(args.contact_id, args.wtype, args.subject,
                                       args.body, args.task_status)); return 0
    p.print_help()
    return 2


# --------------------------- MCP server -------------------------------------

def _run_mcp_server() -> int:
    _configure_logging()
    try:
        from mcp.server.fastmcp import FastMCP
    except Exception as e:  # noqa: BLE001
        LOG.error("MCP SDK not installed: %s. Install with: pip install mcp", e)
        return 1
    app = FastMCP(SKILL_NAME)

    @app.tool()
    def hubspot_health_check() -> dict[str, Any]:
        """Return HubSpot integration health/status (UI status contract)."""
        return health_check()

    @app.tool()
    def hubspot_contact_lookup(email: str | None = None, contact_id: str | None = None) -> dict[str, Any]:
        """Look up a HubSpot contact by email or object id."""
        return contact_lookup(email, contact_id)

    @app.tool()
    def hubspot_contact_associate(contact_id: str, to_object_type: str, to_object_id: str,
                                  association_type_id: int | None = None) -> dict[str, Any]:
        """Associate a contact with another CRM object."""
        return contact_associate(contact_id, to_object_type, to_object_id,
                                 association_type_id=association_type_id)

    @app.tool()
    def hubspot_activity_writeback(contact_id: str, writeback_type: str = "note",
                                   subject: str | None = None, body: str | None = None,
                                   task_status: str = "NOT_STARTED") -> dict[str, Any]:
        """Write a note or task back to HubSpot, associated to a contact."""
        return activity_writeback(contact_id, writeback_type, subject, body, task_status)

    app.run()
    return 0


if __name__ == "__main__":
    sys.exit(_cli())
