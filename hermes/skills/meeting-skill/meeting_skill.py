#!/usr/bin/env python3
"""Hermes meeting skill — Lane E booking & meeting intelligence.

The smallest honest meeting workflow for the Cognitia pipeline: booking
state, meeting records, summaries, action items, follow-up drafts, and a
reviewable CRM writeback preview — with operator-visible meeting state and
searchable summary/action surfaces.

Tools (CLI subcommand -> MCP tool name):
    ingest-booking     -> meeting_ingest_booking
    ingest-transcript  -> meeting_ingest_transcript
    summarize          -> meeting_summarize
    draft-followup     -> meeting_draft_followup
    build-writeback    -> meeting_build_writeback
    review-writeback   -> meeting_review_writeback
    list               -> meeting_list
    get                -> meeting_get
    provider                          # diagnostics

Honest seams (this skill is a standalone stdio process; it does NOT call
other MCP servers itself — the Hermes orchestrator bridges the live edges):
    Calendly / Google Calendar -> feed payloads INTO  meeting_ingest_booking
    Granola                     -> feed transcript INTO meeting_ingest_transcript
    HubSpot CRM                 -> consume the approved writeback envelope OUT
    Gmail / Slack               -> create the follow-up draft OUT (never auto-send)

Text providers (auto-selected; override with HERMES_MEETING_PROVIDER):
    openai | anthropic | gemini | openrouter | ollama | offline

The `offline` path is fully deterministic (no network, no keys) so the
workflow and its tests run anywhere.
"""

from __future__ import annotations

import argparse
import json
import logging
import os
import re
import sys
import uuid
from dataclasses import asdict, dataclass, field
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

SKILL_NAME = "hermes-meeting"
SKILL_VERSION = "0.1.0"
DEFAULT_TIMEOUT = 60

LOG = logging.getLogger("hermes.meeting")


# --------------------------- Logging ----------------------------------------

EMAIL_RE = re.compile(r"\b[A-Za-z0-9._%+\-]+@[A-Za-z0-9.\-]+\.[A-Za-z]{2,}\b")
KEY_PATTERNS: list[re.Pattern[str]] = [
    re.compile(r"sk-ant-[A-Za-z0-9_\-]{20,}"),
    re.compile(r"sk-[A-Za-z0-9_\-]{20,}"),
    re.compile(r"AIza[0-9A-Za-z_\-]{35}"),
    re.compile(r"xox[abprs]-[A-Za-z0-9\-]{10,}"),
    re.compile(r"gh[pousr]_[A-Za-z0-9]{30,}"),
    re.compile(r"eyJ[A-Za-z0-9_\-]{8,}\.[A-Za-z0-9_\-]{8,}\.[A-Za-z0-9_\-]{8,}"),
]


def _redact(text: str) -> str:
    """Scrub emails and secret-shaped tokens before they hit the log stream."""
    text = EMAIL_RE.sub("[EMAIL_REDACTED]", text)
    for pat in KEY_PATTERNS:
        text = pat.sub("[KEY_REDACTED]", text)
    return text


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


# --------------------------- Small helpers ----------------------------------

def _now() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


def _new_id(prefix: str) -> str:
    return f"{prefix}_{uuid.uuid4().hex[:12]}"


def _safe_json(text: str) -> dict[str, Any]:
    """Tolerant JSON extraction from an LLM response (mirrors vision-skill)."""
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


# --------------------------- Domain model -----------------------------------

# Meeting lifecycle (operator-visible). The skill NEVER advances to "synced"
# itself — only the orchestrator does, after a human approves the writeback.
MEETING_STATES = (
    "scheduled",
    "transcribed",
    "summarized",
    "review_ready",
    "writeback_approved",
    "synced",
    "canceled",
    "no_show",
)

# Tracks the CRM edge independently of the meeting lifecycle.
SYNC_STATES = ("none", "preview_pending", "approved", "applied", "rejected", "error")

BOOKING_STATUSES = (
    "requested",
    "confirmed",
    "rescheduled",
    "canceled",
    "completed",
    "no_show",
)


@dataclass
class ActionItem:
    text: str
    owner: str = ""
    due: str = ""
    status: str = "open"  # open | done | dismissed
    source: str = "ai"  # ai | human
    confidence: float = 0.0
    id: str = field(default_factory=lambda: _new_id("act"))


@dataclass
class CrmWritebackPreview:
    contact_id: str
    timeline_activity: dict[str, Any] = field(default_factory=dict)
    proposed_tasks: list[dict[str, Any]] = field(default_factory=list)
    field_suggestions: dict[str, Any] = field(default_factory=dict)
    review_status: str = "pending_review"  # pending_review | approved | rejected
    reviewer: str = ""
    reviewed_at: str = ""
    id: str = field(default_factory=lambda: _new_id("wb"))


@dataclass
class Booking:
    provider: str = "manual"  # calendly | google | manual
    contact_id: str = ""
    invitee_name: str = ""
    invitee_email: str = ""
    event_type: str = ""
    scheduled_start: str = ""
    scheduled_end: str = ""
    join_url: str = ""
    status: str = "confirmed"
    source_payload: dict[str, Any] = field(default_factory=dict)
    created_at: str = field(default_factory=_now)
    id: str = field(default_factory=lambda: _new_id("bkg"))


@dataclass
class Meeting:
    booking_id: str = ""
    contact_id: str = ""
    title: str = ""
    start: str = ""
    end: str = ""
    participants: list[str] = field(default_factory=list)
    state: str = "scheduled"
    transcript_ref: str = ""
    transcript_text: str = ""
    summary: str = ""
    action_items: list[dict[str, Any]] = field(default_factory=list)
    follow_up_draft: str = ""
    writeback: dict[str, Any] | None = None
    sync_state: str = "none"
    provider: str = ""
    created_at: str = field(default_factory=_now)
    updated_at: str = field(default_factory=_now)
    id: str = field(default_factory=lambda: _new_id("mtg"))


@dataclass
class SyncEvent:
    """Cross-lane contract. The CRM / contact-timeline lane consumes these."""

    meeting_id: str
    contact_id: str
    kind: str  # meeting.summarized | writeback.preview | writeback.approved | writeback.rejected
    payload: dict[str, Any] = field(default_factory=dict)
    status: str = "emitted"
    created_at: str = field(default_factory=_now)
    id: str = field(default_factory=lambda: _new_id("evt"))


# --------------------------- Persistence ------------------------------------

def _store_path() -> Path:
    raw = os.environ.get("MEETING_STORE_PATH")
    if raw:
        return Path(raw).expanduser()
    return Path(__file__).resolve().parent / ".meeting_store.json"


class MeetingStore:
    """File-backed JSON store. Zero deps, matches the repo's stdlib-only norm.

    Other lanes (or a future DB) can adopt the same load()/save() interface.
    """

    def __init__(self, path: Path | None = None) -> None:
        self.path = path or _store_path()
        self._data: dict[str, Any] = {"bookings": {}, "meetings": {}, "events": []}
        self.load()

    def load(self) -> None:
        if self.path.exists():
            try:
                self._data = json.loads(self.path.read_text())
            except Exception as e:  # noqa: BLE001
                LOG.warning("meeting store unreadable, starting fresh: %s", e)
                self._data = {"bookings": {}, "meetings": {}, "events": []}
        self._data.setdefault("bookings", {})
        self._data.setdefault("meetings", {})
        self._data.setdefault("events", [])

    def save(self) -> None:
        self.path.parent.mkdir(parents=True, exist_ok=True)
        self.path.write_text(json.dumps(self._data, indent=2, ensure_ascii=False))

    # bookings -----------------------------------------------------------
    def put_booking(self, booking: Booking) -> None:
        self._data["bookings"][booking.id] = asdict(booking)
        self.save()

    def get_booking(self, booking_id: str) -> dict[str, Any] | None:
        return self._data["bookings"].get(booking_id)

    # meetings -----------------------------------------------------------
    def put_meeting(self, meeting: Meeting) -> None:
        meeting.updated_at = _now()
        self._data["meetings"][meeting.id] = asdict(meeting)
        self.save()

    def get_meeting(self, meeting_id: str) -> dict[str, Any] | None:
        return self._data["meetings"].get(meeting_id)

    def all_meetings(self) -> list[dict[str, Any]]:
        return list(self._data["meetings"].values())

    # events -------------------------------------------------------------
    def add_event(self, event: SyncEvent) -> None:
        self._data["events"].append(asdict(event))
        self.save()

    def events_for(self, meeting_id: str) -> list[dict[str, Any]]:
        return [e for e in self._data["events"] if e.get("meeting_id") == meeting_id]


# --------------------------- Provider routing -------------------------------

@dataclass
class ProviderResult:
    provider: str
    raw_text: str
    parsed: dict[str, Any] = field(default_factory=dict)
    error: str | None = None


def select_provider() -> str:
    explicit = os.environ.get("HERMES_MEETING_PROVIDER", "").strip().lower()
    if explicit:
        return explicit
    if os.environ.get("OPENAI_API_KEY"):
        return "openai"
    if os.environ.get("ANTHROPIC_API_KEY"):
        return "anthropic"
    if os.environ.get("GOOGLE_API_KEY"):
        return "gemini"
    if os.environ.get("OPENROUTER_API_KEY"):
        return "openrouter"
    if _ollama_reachable():
        return "ollama"
    return "offline"


def _ollama_reachable() -> bool:
    base = os.environ.get("OLLAMA_BASE_URL", "http://127.0.0.1:11434").rstrip("/")
    try:
        import urllib.request

        with urllib.request.urlopen(f"{base}/api/tags", timeout=2) as r:
            r.read(1)
        return True
    except Exception:
        return False


def _call_openai(prompt: str) -> ProviderResult:
    import urllib.error
    import urllib.request

    key = os.environ["OPENAI_API_KEY"]
    model = os.environ.get("HERMES_MEETING_OPENAI_MODEL", "gpt-4o-mini")
    body = {
        "model": model,
        "messages": [{"role": "user", "content": prompt}],
        "response_format": {"type": "json_object"},
        "temperature": 0,
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
        return ProviderResult("openai", text, _safe_json(text))
    except urllib.error.HTTPError as e:
        return ProviderResult("openai", "", error=f"http {e.code}: {e.read()[:200].decode(errors='replace')}")
    except Exception as e:  # noqa: BLE001
        return ProviderResult("openai", "", error=str(e))


def _call_anthropic(prompt: str) -> ProviderResult:
    import urllib.error
    import urllib.request

    key = os.environ["ANTHROPIC_API_KEY"]
    model = os.environ.get("HERMES_MEETING_ANTHROPIC_MODEL", "claude-sonnet-4-6")
    body = {
        "model": model,
        "max_tokens": 1500,
        "messages": [{"role": "user", "content": prompt}],
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
        return ProviderResult("anthropic", text, _safe_json(text))
    except urllib.error.HTTPError as e:
        return ProviderResult("anthropic", "", error=f"http {e.code}: {e.read()[:200].decode(errors='replace')}")
    except Exception as e:  # noqa: BLE001
        return ProviderResult("anthropic", "", error=str(e))


def _call_gemini(prompt: str) -> ProviderResult:
    import urllib.error
    import urllib.request

    key = os.environ["GOOGLE_API_KEY"]
    model = os.environ.get("HERMES_MEETING_GEMINI_MODEL", "gemini-1.5-flash")
    body = {"contents": [{"parts": [{"text": prompt}]}], "generationConfig": {"temperature": 0}}
    url = f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent?key={key}"
    req = urllib.request.Request(url, data=json.dumps(body).encode(), headers={"Content-Type": "application/json"})
    try:
        with urllib.request.urlopen(req, timeout=DEFAULT_TIMEOUT) as r:
            out = json.loads(r.read())
        cand = out.get("candidates", [{}])[0]
        text = "".join(p.get("text", "") for p in cand.get("content", {}).get("parts", []))
        return ProviderResult("gemini", text, _safe_json(text))
    except urllib.error.HTTPError as e:
        return ProviderResult("gemini", "", error=f"http {e.code}: {e.read()[:200].decode(errors='replace')}")
    except Exception as e:  # noqa: BLE001
        return ProviderResult("gemini", "", error=str(e))


def _call_openrouter(prompt: str) -> ProviderResult:
    import urllib.error
    import urllib.request

    key = os.environ["OPENROUTER_API_KEY"]
    model = os.environ.get("HERMES_MEETING_OPENROUTER_MODEL", "openai/gpt-4o-mini")
    body = {"model": model, "messages": [{"role": "user", "content": prompt}], "temperature": 0}
    req = urllib.request.Request(
        "https://openrouter.ai/api/v1/chat/completions",
        data=json.dumps(body).encode(),
        headers={"Authorization": f"Bearer {key}", "Content-Type": "application/json"},
    )
    try:
        with urllib.request.urlopen(req, timeout=DEFAULT_TIMEOUT) as r:
            out = json.loads(r.read())
        text = out["choices"][0]["message"]["content"]
        return ProviderResult("openrouter", text, _safe_json(text))
    except urllib.error.HTTPError as e:
        return ProviderResult("openrouter", "", error=f"http {e.code}: {e.read()[:200].decode(errors='replace')}")
    except Exception as e:  # noqa: BLE001
        return ProviderResult("openrouter", "", error=str(e))


def _call_ollama(prompt: str) -> ProviderResult:
    import urllib.error
    import urllib.request

    base = os.environ.get("OLLAMA_BASE_URL", "http://127.0.0.1:11434").rstrip("/")
    model = os.environ.get("HERMES_MEETING_OLLAMA_MODEL", "llama3.1")
    body = {"model": model, "prompt": prompt, "stream": False, "options": {"temperature": 0}}
    req = urllib.request.Request(
        f"{base}/api/generate", data=json.dumps(body).encode(), headers={"Content-Type": "application/json"}
    )
    try:
        with urllib.request.urlopen(req, timeout=DEFAULT_TIMEOUT) as r:
            out = json.loads(r.read())
        text = out.get("response", "")
        return ProviderResult("ollama", text, _safe_json(text))
    except urllib.error.HTTPError as e:
        return ProviderResult("ollama", "", error=f"http {e.code}: {e.read()[:200].decode(errors='replace')}")
    except Exception as e:  # noqa: BLE001
        return ProviderResult("ollama", "", error=str(e))


def _call_text(prompt: str) -> ProviderResult:
    provider = select_provider()
    LOG.info("meeting text provider selected: %s", provider)
    if provider == "openai":
        return _call_openai(prompt)
    if provider == "anthropic":
        return _call_anthropic(prompt)
    if provider == "gemini":
        return _call_gemini(prompt)
    if provider == "openrouter":
        return _call_openrouter(prompt)
    if provider == "ollama":
        return _call_ollama(prompt)
    return ProviderResult("offline", "", error="no LLM text provider configured")


# --------------------------- Offline NLP ------------------------------------

# Deterministic, network-free heuristics so summary + action extraction work
# (and stay testable) with no provider configured.

_ACTION_CUES = re.compile(
    r"\b(?:action item|action:|todo|to-do|follow up|follow-up|next step|"
    r"will|i'?ll|we'?ll|please|let'?s|need to|should|by (?:eod|tomorrow|"
    r"monday|tuesday|wednesday|thursday|friday|next week|\w+ \d{1,2}))\b",
    re.IGNORECASE,
)
_DUE_RE = re.compile(
    r"\bby\s+(eod|tomorrow|next week|monday|tuesday|wednesday|thursday|"
    r"friday|\w+ \d{1,2}(?:st|nd|rd|th)?)\b",
    re.IGNORECASE,
)
_OWNER_RE = re.compile(r"@([A-Za-z][A-Za-z0-9_]{1,})")
_SENT_SPLIT = re.compile(r"(?<=[.!?])\s+|\n+")


def _clean_lines(transcript: str) -> list[str]:
    lines: list[str] = []
    for raw in transcript.splitlines():
        # strip "Name: " / "[00:01] Name:" speaker prefixes for content scans
        line = re.sub(r"^\s*(?:\[[^\]]+\]\s*)?[A-Z][\w .'-]{0,40}:\s*", "", raw).strip()
        if line:
            lines.append(line)
    return lines


def _offline_summary(transcript: str, title: str) -> str:
    cleaned = " ".join(_clean_lines(transcript))
    sentences = [s.strip() for s in _SENT_SPLIT.split(cleaned) if len(s.strip()) > 25]
    if not sentences:
        return (transcript.strip()[:280] or "No transcript content to summarize.")
    # Pick the longest few sentences as a crude extractive summary, in order.
    ranked = sorted(range(len(sentences)), key=lambda i: len(sentences[i]), reverse=True)
    keep = sorted(ranked[:3])
    body = " ".join(sentences[i] for i in keep)
    prefix = f"{title}: " if title else ""
    return (prefix + body)[:600]


def _offline_action_items(transcript: str) -> list[ActionItem]:
    items: list[ActionItem] = []
    seen: set[str] = set()
    for line in _clean_lines(transcript):
        if not _ACTION_CUES.search(line):
            continue
        text = line.strip().rstrip(".")
        key = text.lower()
        if key in seen or len(text) < 6:
            continue
        seen.add(key)
        owner_m = _OWNER_RE.search(line)
        due_m = _DUE_RE.search(line)
        items.append(
            ActionItem(
                text=text[:280],
                owner=owner_m.group(1) if owner_m else "",
                due=due_m.group(1) if due_m else "",
                source="offline",
                confidence=0.4,
            )
        )
    return items


# --------------------------- Booking ingestion ------------------------------

def _coalesce(payload: dict[str, Any], *keys: str) -> str:
    for k in keys:
        cur: Any = payload
        ok = True
        for part in k.split("."):
            if isinstance(cur, dict) and part in cur:
                cur = cur[part]
            else:
                ok = False
                break
        if ok and isinstance(cur, (str, int, float)) and str(cur).strip():
            return str(cur)
    return ""


def parse_booking_payload(payload: dict[str, Any], contact_id: str = "") -> Booking:
    """Map a booking-link payload (Calendly-shaped or generic) -> Booking.

    Tolerant to a flat generic shape and to Calendly's nested
    `resource`/`event`/`invitee` shapes. No network call is made.
    """
    provider = _coalesce(payload, "provider") or ("calendly" if "scheduling_url" in json.dumps(payload) else "manual")
    return Booking(
        provider=provider or "manual",
        contact_id=contact_id or _coalesce(payload, "contact_id"),
        invitee_name=_coalesce(payload, "invitee_name", "invitee.name", "name"),
        invitee_email=_coalesce(payload, "invitee_email", "invitee.email", "email"),
        event_type=_coalesce(payload, "event_type", "event.name", "event_type_name", "name"),
        scheduled_start=_coalesce(payload, "start", "scheduled_start", "event.start_time", "start_time"),
        scheduled_end=_coalesce(payload, "end", "scheduled_end", "event.end_time", "end_time"),
        join_url=_coalesce(payload, "join_url", "location.join_url", "event.location.join_url"),
        status=_coalesce(payload, "status") or "confirmed",
        source_payload=payload,
    )


def meeting_ingest_booking(
    payload: dict[str, Any] | str,
    contact_id: str = "",
    store: MeetingStore | None = None,
) -> dict[str, Any]:
    """Ingest a booking payload; create a Booking + a scheduled Meeting.

    SEAM: the orchestrator feeds `payload` from Calendly / Google Calendar
    MCP tools. This skill never calls a calendar provider itself.
    """
    store = store or MeetingStore()
    if isinstance(payload, str):
        payload = json.loads(payload)
    booking = parse_booking_payload(payload, contact_id)
    store.put_booking(booking)

    state = "scheduled"
    if booking.status in ("canceled", "no_show"):
        state = booking.status
    meeting = Meeting(
        booking_id=booking.id,
        contact_id=booking.contact_id,
        title=booking.event_type or "Untitled meeting",
        start=booking.scheduled_start,
        end=booking.scheduled_end,
        participants=[p for p in (booking.invitee_name, booking.invitee_email) if p],
        state=state,
    )
    store.put_meeting(meeting)
    LOG.info("ingested booking %s -> meeting %s (%s)", booking.id, meeting.id, state)
    return {"booking": asdict(booking), "meeting": asdict(meeting)}


# --------------------------- Transcript ingestion ---------------------------

def meeting_ingest_transcript(
    meeting_id: str,
    transcript_text: str | None = None,
    transcript_path: str | None = None,
    transcript_ref: str = "",
    store: MeetingStore | None = None,
) -> dict[str, Any]:
    """Attach a transcript to a meeting and advance to `transcribed`.

    SEAM: the orchestrator feeds transcript text from Granola
    (`get_meeting_transcript`) or a paste/upload. No transcript is fabricated.
    """
    store = store or MeetingStore()
    raw = store.get_meeting(meeting_id)
    if raw is None:
        raise ValueError(f"meeting not found: {meeting_id}")
    if transcript_path and not transcript_text:
        transcript_text = Path(transcript_path).expanduser().read_text()
    if not transcript_text or not transcript_text.strip():
        raise ValueError("transcript_text or transcript_path is required and must be non-empty")

    meeting = Meeting(**raw)
    meeting.transcript_text = transcript_text
    meeting.transcript_ref = transcript_ref or transcript_path or "inline"
    if meeting.state in ("scheduled", "transcribed"):
        meeting.state = "transcribed"
    store.put_meeting(meeting)
    LOG.info("attached transcript to meeting %s (%d chars)", meeting_id, len(transcript_text))
    return asdict(meeting)


# --------------------------- Summarize + action items -----------------------

SUMMARY_SCHEMA = ["summary", "action_items"]


def meeting_summarize(meeting_id: str, store: MeetingStore | None = None) -> dict[str, Any]:
    """Generate a summary + action items from the transcript.

    Uses the configured LLM provider; falls back to a deterministic offline
    path (extractive summary + action-item heuristics) when no provider is
    configured, so the workflow always produces a reviewable result.
    """
    store = store or MeetingStore()
    raw = store.get_meeting(meeting_id)
    if raw is None:
        raise ValueError(f"meeting not found: {meeting_id}")
    meeting = Meeting(**raw)
    if not meeting.transcript_text.strip():
        raise ValueError("meeting has no transcript; call meeting_ingest_transcript first")

    prompt = (
        "You are Hermes Meeting, a precise meeting analyst. Reply with a single "
        "JSON object with keys: summary (string, <=120 words) and action_items "
        "(array of objects with keys text, owner, due). No prose outside JSON.\n\n"
        f"Meeting title: {meeting.title}\n\nTranscript:\n{meeting.transcript_text}"
    )
    pr = _call_text(prompt)

    summary = ""
    action_items: list[ActionItem] = []
    if pr.parsed and not pr.error:
        summary = str(pr.parsed.get("summary", "")).strip()
        for it in pr.parsed.get("action_items", []) or []:
            if isinstance(it, dict) and str(it.get("text", "")).strip():
                action_items.append(
                    ActionItem(
                        text=str(it["text"]).strip()[:280],
                        owner=str(it.get("owner", "")).strip(),
                        due=str(it.get("due", "")).strip(),
                        source="ai",
                        confidence=0.7,
                    )
                )

    # Offline fallback (also fills gaps if the model returned nothing usable).
    if not summary:
        summary = _offline_summary(meeting.transcript_text, meeting.title)
    if not action_items:
        action_items = _offline_action_items(meeting.transcript_text)

    meeting.summary = summary
    meeting.action_items = [asdict(a) for a in action_items]
    meeting.provider = pr.provider
    meeting.state = "summarized"
    store.put_meeting(meeting)

    store.add_event(
        SyncEvent(
            meeting_id=meeting.id,
            contact_id=meeting.contact_id,
            kind="meeting.summarized",
            payload={"summary": summary, "action_item_count": len(action_items)},
        )
    )

    result = asdict(meeting)
    if pr.error:
        result["provider_error"] = pr.error
    return result


# --------------------------- Follow-up draft --------------------------------

def meeting_draft_followup(meeting_id: str, store: MeetingStore | None = None) -> dict[str, Any]:
    """Draft a follow-up email/message from the summary + action items.

    SEAM: returns draft TEXT only. The orchestrator creates the actual draft
    via Gmail (`create_draft`) or Slack (`slack_send_message_draft`). This
    skill never sends anything.
    """
    store = store or MeetingStore()
    raw = store.get_meeting(meeting_id)
    if raw is None:
        raise ValueError(f"meeting not found: {meeting_id}")
    meeting = Meeting(**raw)
    if not meeting.summary:
        raise ValueError("meeting has no summary; call meeting_summarize first")

    prompt = (
        "Write a concise, friendly follow-up email after a meeting. Reply with a "
        "single JSON object with keys: subject and body. Reference the summary and "
        "list the action items as bullets with owners/due dates when present. No "
        "prose outside JSON.\n\n"
        f"Summary: {meeting.summary}\n\nAction items: {json.dumps(meeting.action_items)}"
    )
    pr = _call_text(prompt)

    if pr.parsed and not pr.error and str(pr.parsed.get("body", "")).strip():
        subject = str(pr.parsed.get("subject", "")).strip() or f"Follow-up: {meeting.title}"
        body = str(pr.parsed["body"]).strip()
        draft = f"Subject: {subject}\n\n{body}"
    else:
        draft = _offline_followup(meeting)

    meeting.follow_up_draft = draft
    store.put_meeting(meeting)
    return {"meeting_id": meeting.id, "follow_up_draft": draft, "provider": pr.provider}


def _offline_followup(meeting: Meeting) -> str:
    name = meeting.participants[0].split("@")[0] if meeting.participants else "there"
    lines = [
        f"Subject: Follow-up: {meeting.title or 'our meeting'}",
        "",
        f"Hi {name},",
        "",
        "Thanks for the time today. Quick recap:",
        meeting.summary,
        "",
    ]
    if meeting.action_items:
        lines.append("Action items:")
        for a in meeting.action_items:
            who = f" ({a['owner']})" if a.get("owner") else ""
            due = f" — due {a['due']}" if a.get("due") else ""
            lines.append(f"  - {a['text']}{who}{due}")
        lines.append("")
    lines += ["Let me know if I missed anything.", "", "Best,", "Cognitia"]
    return "\n".join(lines)


# --------------------------- CRM writeback (preview + review) ----------------

def meeting_build_writeback(meeting_id: str, store: MeetingStore | None = None) -> dict[str, Any]:
    """Build a CRM writeback PREVIEW for human review. Nothing is applied.

    The preview becomes the envelope the CRM lane / orchestrator applies to
    HubSpot — but only after a human approves it via meeting_review_writeback.
    """
    store = store or MeetingStore()
    raw = store.get_meeting(meeting_id)
    if raw is None:
        raise ValueError(f"meeting not found: {meeting_id}")
    meeting = Meeting(**raw)
    if not meeting.summary:
        raise ValueError("meeting has no summary; call meeting_summarize first")

    preview = CrmWritebackPreview(
        contact_id=meeting.contact_id,
        timeline_activity={
            "type": "meeting",
            "title": meeting.title or "Meeting",
            "body": meeting.summary,
            "occurred_at": meeting.start or meeting.created_at,
        },
        proposed_tasks=[
            {"text": a["text"], "owner": a.get("owner", ""), "due": a.get("due", "")}
            for a in meeting.action_items
        ],
        field_suggestions={"last_meeting_at": meeting.start or meeting.created_at},
        review_status="pending_review",
    )
    meeting.writeback = asdict(preview)
    meeting.sync_state = "preview_pending"
    meeting.state = "review_ready"
    store.put_meeting(meeting)

    store.add_event(
        SyncEvent(
            meeting_id=meeting.id,
            contact_id=meeting.contact_id,
            kind="writeback.preview",
            payload=meeting.writeback,
            status="pending_review",
        )
    )
    LOG.info("built writeback preview for meeting %s (pending_review)", meeting.id)
    return asdict(meeting)


def meeting_review_writeback(
    meeting_id: str,
    decision: str,
    reviewer: str = "operator",
    store: MeetingStore | None = None,
) -> dict[str, Any]:
    """Human review gate for the CRM writeback (approve | reject).

    Approve -> emits the `writeback.approved` envelope for the orchestrator to
    apply via HubSpot. Reject -> marks rejected. The skill itself NEVER writes
    to the CRM and NEVER advances to `synced`.
    """
    store = store or MeetingStore()
    raw = store.get_meeting(meeting_id)
    if raw is None:
        raise ValueError(f"meeting not found: {meeting_id}")
    meeting = Meeting(**raw)
    if not meeting.writeback:
        raise ValueError("no writeback preview; call meeting_build_writeback first")
    decision = decision.strip().lower()
    if decision not in ("approve", "reject"):
        raise ValueError("decision must be 'approve' or 'reject'")

    meeting.writeback["reviewer"] = reviewer
    meeting.writeback["reviewed_at"] = _now()
    if decision == "approve":
        meeting.writeback["review_status"] = "approved"
        meeting.sync_state = "approved"
        meeting.state = "writeback_approved"
        kind, status = "writeback.approved", "ready_to_apply"
    else:
        meeting.writeback["review_status"] = "rejected"
        meeting.sync_state = "rejected"
        kind, status = "writeback.rejected", "rejected"
    store.put_meeting(meeting)

    store.add_event(
        SyncEvent(
            meeting_id=meeting.id,
            contact_id=meeting.contact_id,
            kind=kind,
            payload=meeting.writeback,
            status=status,
        )
    )
    LOG.info("writeback for meeting %s reviewed: %s by %s", meeting.id, decision, reviewer)
    return asdict(meeting)


# --------------------------- List / get / search ----------------------------

def _meeting_summary_row(m: dict[str, Any]) -> dict[str, Any]:
    return {
        "id": m["id"],
        "title": m["title"],
        "contact_id": m["contact_id"],
        "start": m["start"],
        "state": m["state"],
        "sync_state": m["sync_state"],
        "action_item_count": len(m.get("action_items", [])),
        "has_followup_draft": bool(m.get("follow_up_draft")),
        "summary_excerpt": (m.get("summary") or "")[:160],
    }


def _search_blob(m: dict[str, Any]) -> str:
    parts = [m.get("title", ""), m.get("summary", ""), m.get("contact_id", "")]
    parts += [a.get("text", "") for a in m.get("action_items", [])]
    parts += list(m.get("participants", []))
    return " ".join(parts).lower()


def meeting_list(
    state: str | None = None,
    contact_id: str | None = None,
    query: str | None = None,
    limit: int = 50,
    store: MeetingStore | None = None,
) -> dict[str, Any]:
    """List meetings with optional state/contact filters and full-text search.

    Searches across titles, summaries, and action items (searchable surface).
    """
    store = store or MeetingStore()
    rows = store.all_meetings()
    if state:
        rows = [m for m in rows if m.get("state") == state]
    if contact_id:
        rows = [m for m in rows if m.get("contact_id") == contact_id]
    if query:
        q = query.lower()
        rows = [m for m in rows if q in _search_blob(m)]
    rows.sort(key=lambda m: m.get("updated_at", ""), reverse=True)
    rows = rows[: max(0, limit)]
    return {"count": len(rows), "meetings": [_meeting_summary_row(m) for m in rows]}


def meeting_get(meeting_id: str, store: MeetingStore | None = None) -> dict[str, Any]:
    """Full detail view contract for a single meeting (incl. booking + events)."""
    store = store or MeetingStore()
    meeting = store.get_meeting(meeting_id)
    if meeting is None:
        raise ValueError(f"meeting not found: {meeting_id}")
    booking = store.get_booking(meeting.get("booking_id", "")) if meeting.get("booking_id") else None
    return {"meeting": meeting, "booking": booking, "events": store.events_for(meeting_id)}


# --------------------------- CLI --------------------------------------------

def _print_json(obj: Any) -> None:
    print(json.dumps(obj, indent=2, ensure_ascii=False))


def _load_payload_arg(payload: str | None, payload_path: str | None) -> dict[str, Any]:
    if payload_path:
        return json.loads(Path(payload_path).expanduser().read_text())
    if payload:
        return json.loads(payload)
    raise SystemExit("provide --payload or --payload-file")


def _cli(argv: list[str] | None = None) -> int:
    _configure_logging()
    p = argparse.ArgumentParser(prog="meeting_skill", description=__doc__)
    p.add_argument("--mcp", action="store_true", help="run as MCP stdio server")
    sub = p.add_subparsers(dest="cmd")

    b = sub.add_parser("ingest-booking")
    b.add_argument("--payload", default=None, help="inline JSON booking payload")
    b.add_argument("--payload-file", default=None, help="path to JSON booking payload")
    b.add_argument("--contact-id", default="")

    t = sub.add_parser("ingest-transcript")
    t.add_argument("--meeting-id", required=True)
    t.add_argument("--transcript", default=None, help="inline transcript text")
    t.add_argument("--transcript-file", default=None)
    t.add_argument("--ref", default="")

    s = sub.add_parser("summarize")
    s.add_argument("--meeting-id", required=True)

    d = sub.add_parser("draft-followup")
    d.add_argument("--meeting-id", required=True)

    w = sub.add_parser("build-writeback")
    w.add_argument("--meeting-id", required=True)

    r = sub.add_parser("review-writeback")
    r.add_argument("--meeting-id", required=True)
    rg = r.add_mutually_exclusive_group(required=True)
    rg.add_argument("--approve", action="store_true")
    rg.add_argument("--reject", action="store_true")
    r.add_argument("--reviewer", default="operator")

    ls = sub.add_parser("list")
    ls.add_argument("--state", default=None)
    ls.add_argument("--contact-id", default=None)
    ls.add_argument("--query", default=None)
    ls.add_argument("--limit", type=int, default=50)

    g = sub.add_parser("get")
    g.add_argument("--meeting-id", required=True)

    sub.add_parser("provider")  # diagnostics

    args = p.parse_args(argv)
    if args.mcp:
        return _run_mcp_server()

    if args.cmd == "ingest-booking":
        payload = _load_payload_arg(args.payload, args.payload_file)
        _print_json(meeting_ingest_booking(payload, args.contact_id))
        return 0
    if args.cmd == "ingest-transcript":
        _print_json(
            meeting_ingest_transcript(
                args.meeting_id, args.transcript, args.transcript_file, args.ref
            )
        )
        return 0
    if args.cmd == "summarize":
        _print_json(meeting_summarize(args.meeting_id))
        return 0
    if args.cmd == "draft-followup":
        _print_json(meeting_draft_followup(args.meeting_id))
        return 0
    if args.cmd == "build-writeback":
        _print_json(meeting_build_writeback(args.meeting_id))
        return 0
    if args.cmd == "review-writeback":
        decision = "approve" if args.approve else "reject"
        _print_json(meeting_review_writeback(args.meeting_id, decision, args.reviewer))
        return 0
    if args.cmd == "list":
        _print_json(meeting_list(args.state, args.contact_id, args.query, args.limit))
        return 0
    if args.cmd == "get":
        _print_json(meeting_get(args.meeting_id))
        return 0
    if args.cmd == "provider":
        _print_json({"selected_provider": select_provider(), "store_path": str(_store_path())})
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
    def ingest_booking(payload: dict[str, Any], contact_id: str = "") -> dict[str, Any]:
        """Ingest a booking-link payload (Calendly/Google-shaped); create booking + scheduled meeting."""
        return meeting_ingest_booking(payload, contact_id)

    @app.tool()
    def ingest_transcript(
        meeting_id: str,
        transcript_text: str | None = None,
        transcript_path: str | None = None,
        transcript_ref: str = "",
    ) -> dict[str, Any]:
        """Attach a transcript to a meeting and advance it to `transcribed`."""
        return meeting_ingest_transcript(meeting_id, transcript_text, transcript_path, transcript_ref)

    @app.tool()
    def summarize(meeting_id: str) -> dict[str, Any]:
        """Generate a summary + action items (LLM with deterministic offline fallback)."""
        return meeting_summarize(meeting_id)

    @app.tool()
    def draft_followup(meeting_id: str) -> dict[str, Any]:
        """Draft a follow-up email/message (text only; never sends)."""
        return meeting_draft_followup(meeting_id)

    @app.tool()
    def build_writeback(meeting_id: str) -> dict[str, Any]:
        """Build a CRM writeback preview for human review (nothing is applied)."""
        return meeting_build_writeback(meeting_id)

    @app.tool()
    def review_writeback(meeting_id: str, decision: str, reviewer: str = "operator") -> dict[str, Any]:
        """Approve or reject the CRM writeback preview (human review gate)."""
        return meeting_review_writeback(meeting_id, decision, reviewer)

    @app.tool()
    def list_meetings(
        state: str | None = None, contact_id: str | None = None, query: str | None = None, limit: int = 50
    ) -> dict[str, Any]:
        """List/search meetings by state, contact, or full-text query."""
        return meeting_list(state, contact_id, query, limit)

    @app.tool()
    def get_meeting(meeting_id: str) -> dict[str, Any]:
        """Full detail for a single meeting (incl. booking + sync events)."""
        return meeting_get(meeting_id)

    app.run()
    return 0


if __name__ == "__main__":
    sys.exit(_cli())
