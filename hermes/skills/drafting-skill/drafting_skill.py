#!/usr/bin/env python3
"""Hermes drafting skill.

AI-assisted outreach drafting under governance for the Cognitia pipeline.

This skill turns a template key + context into a structured outreach DRAFT.
It NEVER sends, posts, or transmits anything. Every draft is returned with
status "pending_approval" and full audit metadata so a human can review it in
the approval queue before any side effect occurs. An LLM provider drafts the
copy when one is configured; otherwise (or when the LLM output fails safety/
structure validation) the skill falls back to the deterministic template. The
deterministic template path is always safe and requires no network access.

Tools:
    draft     -> draft_outreach_message     (LLM with template fallback)
    validate  -> draft_validate_draft        (re-check an edited draft)
    template  -> draft_render_template        (deterministic render only)
    provider  -> draft_list_providers         (diagnostics)

Providers (auto-selected; override with HERMES_DRAFT_PROVIDER):
    anthropic | openai | gemini | openrouter | ollama | template

Approval-first: this module exposes no sender. Transitioning a draft to
approved/sent and invoking any sender is the job of the downstream approval
queue, never this skill.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import logging
import os
import re
import sys
from dataclasses import dataclass, field
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

try:  # TypedDict is only used for typing; keep import resilient on old runtimes.
    from typing import TypedDict
except Exception:  # pragma: no cover
    TypedDict = dict  # type: ignore

SKILL_NAME = "hermes-drafting"
SKILL_VERSION = "0.1.0"
DEFAULT_TIMEOUT = 60
MAX_OUTPUT_CHARS = 20_000
DEFAULT_CONFIG_PATH = Path(__file__).with_name("drafting_config.yaml")

# The ONLY status generation can ever emit. Approval/sent states are owned by
# the downstream approval queue, never by this skill.
PENDING_STATUS = "pending_approval"

LOG = logging.getLogger("hermes.drafting")


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


# --------------------------- Privacy / secret regex -------------------------
# Shared with vision-skill's conventions: never let secrets/PII leak into logs
# or into a generated draft.

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
URL_RE = re.compile(r"https?://([A-Za-z0-9.\-]+)(?:[/:?#][^\s\"'<>]*)?", re.IGNORECASE)
PLACEHOLDER_RE = re.compile(r"\{[A-Za-z0-9_]+\}")


def _redact(text: str) -> str:
    text = EMAIL_RE.sub("[EMAIL_REDACTED]", text)
    for pat, _ in KEY_PATTERNS:
        text = pat.sub("[KEY_REDACTED]", text)
    return text


def _detect_secrets(text: str) -> list[str]:
    found: list[str] = []
    for pat, label in KEY_PATTERNS:
        if pat.search(text):
            found.append(label)
    return sorted(set(found))


# --------------------------- Config -----------------------------------------

def _config_path(path: str | None = None) -> Path:
    if path:
        return Path(path).expanduser().resolve()
    env = os.environ.get("HERMES_DRAFT_CONFIG", "").strip()
    if env:
        return Path(env).expanduser().resolve()
    return DEFAULT_CONFIG_PATH


def _load_config(path: str | None = None) -> dict[str, Any]:
    """Load drafting_config.yaml. config_version is sha256[:12] of file bytes.

    Falls back to a minimal built-in config if PyYAML or the file is missing so
    the skill still degrades safely rather than raising.
    """
    p = _config_path(path)
    try:
        raw = p.read_bytes()
        import yaml  # local import: keeps PyYAML optional at import time

        cfg = yaml.safe_load(raw.decode("utf-8")) or {}
        cfg["config_version"] = hashlib.sha256(raw).hexdigest()[:12]
        cfg.setdefault("config_path", str(p))
        return cfg
    except Exception as e:  # noqa: BLE001
        LOG.warning("config load failed (%s); using built-in minimal config", e)
        return _builtin_config()


def _builtin_config() -> dict[str, Any]:
    cfg = {
        "tone": "Write concise, warm, professional outreach. One clear ask. No hype.",
        "limits": {"max_body_chars": 1200, "max_subject_chars": 140, "temperature": 0.4},
        "banned_phrases": ["act now", "guaranteed", "risk-free"],
        "allowed_link_hosts": ["cognitia.cloud", "www.cognitia.cloud"],
        "templates": {
            "intro_email": {
                "channel": "email",
                "intent": "First-touch introduction email.",
                "subject_template": "Quick idea for {company}",
                "body_template": (
                    "Hi {first_name},\n\nI'm reaching out from Cognitia about a "
                    "review-first content workflow for {company}.\n"
                ),
                "cta_template": "Would you be open to a 15-minute call next week?",
                "required_context": ["first_name", "company"],
            }
        },
    }
    cfg["config_version"] = "builtin000000"
    cfg["config_path"] = "<builtin>"
    return cfg


# --------------------------- Provider routing -------------------------------

@dataclass
class DraftResult:
    provider: str
    raw_text: str
    parsed: dict[str, Any] = field(default_factory=dict)
    error: str | None = None
    model: str | None = None


def _select_provider() -> str:
    explicit = os.environ.get("HERMES_DRAFT_PROVIDER", "").strip().lower()
    if explicit:
        return explicit
    if os.environ.get("ANTHROPIC_API_KEY"):
        return "anthropic"
    if os.environ.get("OPENAI_API_KEY"):
        return "openai"
    if os.environ.get("GOOGLE_API_KEY"):
        return "gemini"
    if os.environ.get("OPENROUTER_API_KEY"):
        return "openrouter"
    if _ollama_reachable():
        return "ollama"
    return "template"


def _ollama_reachable() -> bool:
    base = os.environ.get("OLLAMA_BASE_URL", "http://127.0.0.1:11434").rstrip("/")
    try:
        import urllib.request

        with urllib.request.urlopen(f"{base}/api/tags", timeout=2) as r:
            r.read(1)
        return True
    except Exception:
        return False


def _safe_json(text: str) -> dict[str, Any]:
    text = text.strip()
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


def _call_anthropic(system: str, user: str, temperature: float) -> DraftResult:
    import urllib.error
    import urllib.request

    key = os.environ["ANTHROPIC_API_KEY"]
    model = os.environ.get("HERMES_DRAFT_ANTHROPIC_MODEL", "claude-sonnet-4-6")
    body = {
        "model": model,
        "max_tokens": 1024,
        "temperature": temperature,
        "system": system,
        "messages": [{"role": "user", "content": user}],
    }
    req = urllib.request.Request(
        "https://api.anthropic.com/v1/messages",
        data=json.dumps(body).encode(),
        headers={
            "x-api-key": key,
            "anthropic-version": "2023-06-01",
            "Content-Type": "application/json",
        },
    )
    try:
        with urllib.request.urlopen(req, timeout=DEFAULT_TIMEOUT) as r:
            out = json.loads(r.read())
        text = "".join(b.get("text", "") for b in out.get("content", []))
        return DraftResult("anthropic", text, _safe_json(text), model=model)
    except urllib.error.HTTPError as e:
        return DraftResult("anthropic", "", error=f"http {e.code}: {e.read()[:200].decode(errors='replace')}", model=model)
    except Exception as e:  # noqa: BLE001
        return DraftResult("anthropic", "", error=str(e), model=model)


def _call_openai(system: str, user: str, temperature: float) -> DraftResult:
    import urllib.error
    import urllib.request

    key = os.environ["OPENAI_API_KEY"]
    model = os.environ.get("HERMES_DRAFT_OPENAI_MODEL", "gpt-4o-mini")
    body = {
        "model": model,
        "messages": [
            {"role": "system", "content": system},
            {"role": "user", "content": user},
        ],
        "response_format": {"type": "json_object"},
        "temperature": temperature,
    }
    req = urllib.request.Request(
        "https://api.openai.com/v1/chat/completions",
        data=json.dumps(body).encode(),
        headers={"Authorization": f"Bearer {key}", "Content-Type": "application/json"},
    )
    try:
        with urllib.request.urlopen(req, timeout=DEFAULT_TIMEOUT) as r:
            out = json.loads(r.read())
        text = out["choices"][0]["message"]["content"]
        return DraftResult("openai", text, _safe_json(text), model=model)
    except urllib.error.HTTPError as e:
        return DraftResult("openai", "", error=f"http {e.code}: {e.read()[:200].decode(errors='replace')}", model=model)
    except Exception as e:  # noqa: BLE001
        return DraftResult("openai", "", error=str(e), model=model)


def _call_gemini(system: str, user: str, temperature: float) -> DraftResult:
    import urllib.error
    import urllib.request

    key = os.environ["GOOGLE_API_KEY"]
    model = os.environ.get("HERMES_DRAFT_GEMINI_MODEL", "gemini-1.5-flash")
    body = {
        "system_instruction": {"parts": [{"text": system}]},
        "contents": [{"parts": [{"text": user}]}],
        "generationConfig": {"temperature": temperature, "responseMimeType": "application/json"},
    }
    url = f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent?key={key}"
    req = urllib.request.Request(
        url, data=json.dumps(body).encode(), headers={"Content-Type": "application/json"}
    )
    try:
        with urllib.request.urlopen(req, timeout=DEFAULT_TIMEOUT) as r:
            out = json.loads(r.read())
        cand = out.get("candidates", [{}])[0]
        text = "".join(p.get("text", "") for p in cand.get("content", {}).get("parts", []))
        return DraftResult("gemini", text, _safe_json(text), model=model)
    except urllib.error.HTTPError as e:
        return DraftResult("gemini", "", error=f"http {e.code}: {e.read()[:200].decode(errors='replace')}", model=model)
    except Exception as e:  # noqa: BLE001
        return DraftResult("gemini", "", error=str(e), model=model)


def _call_openrouter(system: str, user: str, temperature: float) -> DraftResult:
    import urllib.error
    import urllib.request

    key = os.environ["OPENROUTER_API_KEY"]
    model = os.environ.get("HERMES_DRAFT_OPENROUTER_MODEL", "anthropic/claude-3.5-sonnet")
    body = {
        "model": model,
        "messages": [
            {"role": "system", "content": system},
            {"role": "user", "content": user},
        ],
        "temperature": temperature,
    }
    req = urllib.request.Request(
        "https://openrouter.ai/api/v1/chat/completions",
        data=json.dumps(body).encode(),
        headers={"Authorization": f"Bearer {key}", "Content-Type": "application/json"},
    )
    try:
        with urllib.request.urlopen(req, timeout=DEFAULT_TIMEOUT) as r:
            out = json.loads(r.read())
        text = out["choices"][0]["message"]["content"]
        return DraftResult("openrouter", text, _safe_json(text), model=model)
    except urllib.error.HTTPError as e:
        return DraftResult("openrouter", "", error=f"http {e.code}: {e.read()[:200].decode(errors='replace')}", model=model)
    except Exception as e:  # noqa: BLE001
        return DraftResult("openrouter", "", error=str(e), model=model)


def _call_ollama(system: str, user: str, temperature: float) -> DraftResult:
    import urllib.error
    import urllib.request

    base = os.environ.get("OLLAMA_BASE_URL", "http://127.0.0.1:11434").rstrip("/")
    model = os.environ.get("HERMES_DRAFT_OLLAMA_MODEL", "llama3.1")
    body = {
        "model": model,
        "system": system,
        "prompt": user,
        "format": "json",
        "stream": False,
        "options": {"temperature": temperature},
    }
    req = urllib.request.Request(
        f"{base}/api/generate",
        data=json.dumps(body).encode(),
        headers={"Content-Type": "application/json"},
    )
    try:
        with urllib.request.urlopen(req, timeout=DEFAULT_TIMEOUT) as r:
            out = json.loads(r.read())
        text = out.get("response", "")
        return DraftResult("ollama", text, _safe_json(text), model=model)
    except urllib.error.HTTPError as e:
        return DraftResult("ollama", "", error=f"http {e.code}: {e.read()[:200].decode(errors='replace')}", model=model)
    except Exception as e:  # noqa: BLE001
        return DraftResult("ollama", "", error=str(e), model=model)


def _call_provider(system: str, user: str, temperature: float) -> DraftResult:
    provider = _select_provider()
    LOG.info("drafting provider selected: %s", provider)
    if provider == "anthropic":
        return _call_anthropic(system, user, temperature)
    if provider == "openai":
        return _call_openai(system, user, temperature)
    if provider == "gemini":
        return _call_gemini(system, user, temperature)
    if provider == "openrouter":
        return _call_openrouter(system, user, temperature)
    if provider == "ollama":
        return _call_ollama(system, user, temperature)
    # "template" (or any unknown name) → no LLM call. Deterministic path handles it.
    return DraftResult("template", "", error=None)


# --------------------------- Prompt assembly --------------------------------

DRAFT_KEYS = ["subject", "body", "call_to_action", "personalization_notes"]


def _get_template(config: dict[str, Any], template_key: str) -> dict[str, Any]:
    templates = config.get("templates", {}) or {}
    tpl = templates.get(template_key)
    if not tpl:
        raise KeyError(f"unknown template_key: {template_key!r}")
    return tpl


def _build_prompt(
    template_key: str, context: dict[str, Any], config: dict[str, Any], tone: str | None
) -> tuple[str, str, str, str]:
    """Return (system, user, prompt_id, prompt_version)."""
    tpl = _get_template(config, template_key)
    tone_text = tone or config.get("tone", "")
    banned = config.get("banned_phrases", []) or []
    limits = config.get("limits", {}) or {}
    max_body = limits.get("max_body_chars", 1200)

    system = (
        "You are Hermes Drafting, the outreach copywriter for the Cognitia "
        "content pipeline. You produce a DRAFT for human review; you never "
        "send anything. Reply with a single JSON object containing exactly "
        f"these keys: {', '.join(DRAFT_KEYS)}. No prose outside JSON.\n"
        f"Channel: {tpl.get('channel', 'email')}.\n"
        f"Tone: {tone_text}\n"
        f"Hard rules: keep body <= {max_body} characters; never use these "
        f"phrases: {banned}; never invent facts about the recipient; never add "
        "links other than to cognitia.cloud; leave no unfilled {placeholders}."
    )
    safe_ctx = {k: ("" if v is None else v) for k, v in (context or {}).items()}
    user = (
        f"Task / intent: {tpl.get('intent', '').strip()}\n\n"
        f"Recipient context (JSON): {json.dumps(safe_ctx, ensure_ascii=False)}\n\n"
        "Write the draft now as JSON."
    )
    prompt_id = template_key
    prompt_version = hashlib.sha256((system + "\n" + user).encode("utf-8")).hexdigest()[:12]
    return system, user, prompt_id, prompt_version


# --------------------------- Validation & shaping ---------------------------

def _validate_and_shape(
    fields: dict[str, Any], config: dict[str, Any]
) -> tuple[dict[str, Any], list[str], bool]:
    """Validate a candidate draft. Returns (shaped_fields, issues, safe).

    `safe=False` means a hard governance check failed and the caller must fall
    back to the deterministic template.
    """
    issues: list[str] = []
    safe = True
    limits = config.get("limits", {}) or {}
    max_body = int(limits.get("max_body_chars", 1200))
    max_subject = int(limits.get("max_subject_chars", 140))
    banned = [str(b).lower() for b in (config.get("banned_phrases", []) or [])]
    allowed_hosts = {str(h).lower() for h in (config.get("allowed_link_hosts", []) or [])}

    shaped: dict[str, Any] = {}
    for k in DRAFT_KEYS:
        v = fields.get(k, "")
        shaped[k] = "" if v is None else str(v)

    body = shaped["body"].strip()
    subject = shaped["subject"].strip()

    # Structural: a usable draft needs a body.
    if not body:
        issues.append("empty body")
        safe = False
    if len(body) > max_body:
        issues.append(f"body exceeds {max_body} chars ({len(body)})")
        safe = False
    if len(subject) > max_subject:
        issues.append(f"subject exceeds {max_subject} chars ({len(subject)})")
        safe = False

    haystack = " ".join(shaped.values()).lower()
    for phrase in banned:
        if phrase and phrase in haystack:
            issues.append(f"banned phrase present: {phrase!r}")
            safe = False

    blob = " ".join(shaped.values())
    secrets = _detect_secrets(blob)
    if secrets:
        issues.append(f"secret-like tokens present: {', '.join(secrets)}")
        safe = False

    if PLACEHOLDER_RE.search(blob):
        issues.append("unfilled {placeholder} present")
        safe = False

    for host in URL_RE.findall(blob):
        if host.lower() not in allowed_hosts:
            issues.append(f"disallowed link host: {host}")
            safe = False

    return shaped, issues, safe


# --------------------------- Deterministic template renderer ----------------

def _render_template(
    template_key: str, context: dict[str, Any], config: dict[str, Any]
) -> tuple[dict[str, Any], list[str]]:
    """Pure, networkless render of a template. Always safe. Returns (fields, issues)."""
    tpl = _get_template(config, template_key)
    issues: list[str] = []
    required = tpl.get("required_context", []) or []
    ctx = dict(context or {})
    for key in required:
        if not str(ctx.get(key, "")).strip():
            issues.append(f"missing required context: {key}")

    class _Default(dict):
        def __missing__(self, k: str) -> str:  # leave unknown placeholders inert/blank
            return ""

    safe_ctx = _Default(ctx)
    fields = {
        "subject": str(tpl.get("subject_template", "")).format_map(safe_ctx),
        "body": str(tpl.get("body_template", "")).format_map(safe_ctx),
        "call_to_action": str(tpl.get("cta_template", "")).format_map(safe_ctx),
        "personalization_notes": "Rendered from deterministic template.",
    }
    return fields, issues


# --------------------------- Draft envelope ---------------------------------

class DraftAudit(TypedDict, total=False):
    provider: str
    model: str | None
    prompt_id: str
    prompt_version: str
    config_version: str
    skill_version: str
    generated_at: str
    source: str  # "llm" | "template"
    fallback_reason: str | None
    provider_error: str | None


class DraftEnvelope(TypedDict, total=False):
    draft_id: str
    status: str  # always PENDING_STATUS
    channel: str
    subject: str
    body: str
    call_to_action: str
    personalization_notes: str
    recipient_ref: str
    issues: list[str]
    audit: DraftAudit


def _now_iso() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


def _build_envelope(
    fields: dict[str, Any],
    *,
    channel: str,
    recipient_ref: str,
    issues: list[str],
    audit: dict[str, Any],
) -> DraftEnvelope:
    generated_at = audit.get("generated_at") or _now_iso()
    audit["generated_at"] = generated_at
    seed = f"{audit.get('prompt_version', '')}|{fields.get('body', '')}|{generated_at}"
    draft_id = hashlib.sha256(seed.encode("utf-8")).hexdigest()[:16]
    env: DraftEnvelope = {
        "draft_id": draft_id,
        "status": PENDING_STATUS,  # invariant: generation only ever emits this
        "channel": channel,
        "subject": fields.get("subject", ""),
        "body": fields.get("body", ""),
        "call_to_action": fields.get("call_to_action", ""),
        "personalization_notes": fields.get("personalization_notes", ""),
        "recipient_ref": recipient_ref,
        "issues": issues,
        "audit": audit,  # type: ignore[typeddict-item]
    }
    return env


# --------------------------- Output helper ----------------------------------

def _write_output(result: dict[str, Any], output_json_path: str | None) -> None:
    if not output_json_path:
        return
    p = Path(output_json_path)
    p.parent.mkdir(parents=True, exist_ok=True)
    p.write_text(json.dumps(result, indent=2, ensure_ascii=False))


# --------------------------- Tool 1: draft_outreach_message -----------------

def draft_outreach_message(
    template_key: str,
    context: dict[str, Any],
    tone: str | None = None,
    output_json_path: str | None = None,
    config_path: str | None = None,
) -> DraftEnvelope:
    """Generate an outreach draft (LLM with deterministic template fallback).

    Returns a DraftEnvelope with status "pending_approval". Performs NO side
    effects beyond optionally writing to output_json_path when the caller asks.
    Never sends or transmits anything.
    """
    config = _load_config(config_path)
    tpl = _get_template(config, template_key)
    channel = str(tpl.get("channel", "email"))
    recipient_ref = str((context or {}).get("recipient_ref", ""))
    temperature = float((config.get("limits", {}) or {}).get("temperature", 0.4))

    system, user, prompt_id, prompt_version = _build_prompt(template_key, context, config, tone)

    audit: dict[str, Any] = {
        "provider": _select_provider(),
        "model": None,
        "prompt_id": prompt_id,
        "prompt_version": prompt_version,
        "config_version": config.get("config_version", "unknown"),
        "skill_version": SKILL_VERSION,
        "generated_at": _now_iso(),
        "source": "template",
        "fallback_reason": None,
        "provider_error": None,
    }

    fallback_reason: str | None = None
    fields: dict[str, Any] | None = None
    issues: list[str] = []

    if audit["provider"] != "template":
        pr = _call_provider(system, user, temperature)
        audit["model"] = pr.model
        if pr.error:
            audit["provider_error"] = pr.error
            fallback_reason = f"provider error: {pr.error}"
        elif not pr.parsed:
            fallback_reason = "provider returned no parseable JSON"
        else:
            shaped, val_issues, safe = _validate_and_shape(pr.parsed, config)
            if safe:
                fields = shaped
                issues = val_issues
                audit["source"] = "llm"
            else:
                fallback_reason = "llm output failed validation: " + "; ".join(val_issues)
    else:
        fallback_reason = None  # template was the selected provider, not a failure

    if fields is None:
        # Deterministic fallback (also the normal path when provider == template).
        fields, tpl_issues = _render_template(template_key, context, config)
        issues = tpl_issues
        audit["source"] = "template"
        if fallback_reason:
            audit["fallback_reason"] = fallback_reason
            issues = ["fell back to deterministic template", *issues]

    env = _build_envelope(
        fields, channel=channel, recipient_ref=recipient_ref, issues=issues, audit=audit
    )
    _write_output(dict(env), output_json_path)
    return env


# --------------------------- Tool 2: draft_validate_draft -------------------

def draft_validate_draft(draft: dict[str, Any], config_path: str | None = None) -> dict[str, Any]:
    """Re-validate a draft (e.g. after a human edit) before approval.

    Read-only: returns a verdict, never mutates or sends. The approval queue
    calls this after edits to confirm governance rules still hold.
    """
    config = _load_config(config_path)
    fields = {k: draft.get(k, "") for k in DRAFT_KEYS}
    shaped, issues, safe = _validate_and_shape(fields, config)
    return {
        "safe": safe,
        "issues": issues,
        "shaped": shaped,
        "config_version": config.get("config_version", "unknown"),
        "skill_version": SKILL_VERSION,
    }


# --------------------------- Tool 3: draft_render_template ------------------

def draft_render_template(
    template_key: str, context: dict[str, Any], config_path: str | None = None
) -> DraftEnvelope:
    """Deterministic render only (no LLM, no network). Always returns a safe draft."""
    config = _load_config(config_path)
    tpl = _get_template(config, template_key)
    fields, issues = _render_template(template_key, context, config)
    audit = {
        "provider": "template",
        "model": None,
        "prompt_id": template_key,
        "prompt_version": "deterministic",
        "config_version": config.get("config_version", "unknown"),
        "skill_version": SKILL_VERSION,
        "generated_at": _now_iso(),
        "source": "template",
        "fallback_reason": None,
        "provider_error": None,
    }
    return _build_envelope(
        fields,
        channel=str(tpl.get("channel", "email")),
        recipient_ref=str((context or {}).get("recipient_ref", "")),
        issues=issues,
        audit=audit,
    )


# --------------------------- Tool 4: provider diagnostics -------------------

def draft_list_providers(config_path: str | None = None) -> dict[str, Any]:
    config = _load_config(config_path)
    return {
        "selected_provider": _select_provider(),
        "priority": ["anthropic", "openai", "gemini", "openrouter", "ollama", "template"],
        "templates": sorted((config.get("templates", {}) or {}).keys()),
        "config_version": config.get("config_version", "unknown"),
        "config_path": config.get("config_path", str(_config_path(config_path))),
        "skill_version": SKILL_VERSION,
    }


# --------------------------- CLI --------------------------------------------

def _print_json(obj: Any) -> None:
    print(json.dumps(obj, indent=2, ensure_ascii=False))


def _parse_context(raw: str | None) -> dict[str, Any]:
    if not raw:
        return {}
    try:
        val = json.loads(raw)
    except Exception as e:  # noqa: BLE001
        raise SystemExit(f"--context must be valid JSON: {e}")
    if not isinstance(val, dict):
        raise SystemExit("--context must be a JSON object")
    return val


def _cli(argv: list[str] | None = None) -> int:
    _configure_logging()
    p = argparse.ArgumentParser(prog="drafting_skill", description=__doc__)
    p.add_argument("--mcp", action="store_true", help="run as MCP stdio server")
    sub = p.add_subparsers(dest="cmd")

    d = sub.add_parser("draft")
    d.add_argument("--template", required=True)
    d.add_argument("--context", default="{}", help="JSON object of recipient context")
    d.add_argument("--tone", default=None)
    d.add_argument("--output-json-path", default=None)
    d.add_argument("--config", default=None)

    v = sub.add_parser("validate")
    v.add_argument("--draft", required=True, help="JSON object of a draft to re-check")
    v.add_argument("--config", default=None)

    t = sub.add_parser("template")
    t.add_argument("--template", required=True)
    t.add_argument("--context", default="{}")
    t.add_argument("--config", default=None)

    pr = sub.add_parser("provider")
    pr.add_argument("--config", default=None)

    args = p.parse_args(argv)

    if args.mcp:
        return _run_mcp_server()

    if args.cmd == "draft":
        _print_json(
            draft_outreach_message(
                args.template,
                _parse_context(args.context),
                tone=args.tone,
                output_json_path=args.output_json_path,
                config_path=args.config,
            )
        )
        return 0
    if args.cmd == "validate":
        _print_json(draft_validate_draft(_parse_context(args.draft), config_path=args.config))
        return 0
    if args.cmd == "template":
        _print_json(
            draft_render_template(args.template, _parse_context(args.context), config_path=args.config)
        )
        return 0
    if args.cmd == "provider":
        _print_json(draft_list_providers(config_path=args.config))
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
    def draft_outreach(template_key: str, context: dict[str, Any], tone: str | None = None,
                       output_json_path: str | None = None) -> dict[str, Any]:
        """Generate an outreach DRAFT (status pending_approval). Never sends."""
        return dict(draft_outreach_message(template_key, context, tone, output_json_path))

    @app.tool()
    def validate_draft(draft: dict[str, Any]) -> dict[str, Any]:
        """Re-validate a (possibly human-edited) draft against governance rules."""
        return draft_validate_draft(draft)

    @app.tool()
    def render_template(template_key: str, context: dict[str, Any]) -> dict[str, Any]:
        """Deterministic, networkless render of a template (the safe fallback)."""
        return dict(draft_render_template(template_key, context))

    @app.tool()
    def list_providers() -> dict[str, Any]:
        """Show selected provider, routing priority, and available templates."""
        return draft_list_providers()

    app.run()
    return 0


if __name__ == "__main__":
    sys.exit(_cli())
