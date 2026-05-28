#!/usr/bin/env python3
"""Hermes vision skill.

Safe, local-controlled image/video QC for the Cognitia pipeline.

Tools:
    analyze   -> vision_analyze_image
    compare   -> vision_compare_portraits
    privacy   -> vision_privacy_scan
    frameqc   -> vision_video_frame_qc

Providers (auto-selected; override with HERMES_VISION_PROVIDER):
    openai | anthropic | gemini | openrouter | ollama | ocr_only

Read-only inspection. No uploads to unknown services. No file deletion.
"""

from __future__ import annotations

import argparse
import base64
import json
import logging
import mimetypes
import os
import re
import shutil
import subprocess
import sys
import tempfile
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

SKILL_NAME = "hermes-vision"
SKILL_VERSION = "0.1.0"
DEFAULT_TIMEOUT = 60
MAX_IMAGE_BYTES = 20 * 1024 * 1024

LOG = logging.getLogger("hermes.vision")


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
PATH_RE = re.compile(
    r"(?:[A-Z]:\\\\[^\s\"<>]+|/(?:home|root|Users|var|etc|mnt|tmp|opt)/[^\s\"<>]+)"
)
FINANCIAL_RE = re.compile(
    r"\b(?:\d[ \-]?){13,16}\b|routing\s*[:#]?\s*\d{9}\b|acct\s*[:#]?\s*\d{6,}",
    re.IGNORECASE,
)
ACCOUNT_RE = re.compile(r"@[A-Za-z0-9_]{3,}")


def _redact(text: str) -> str:
    text = EMAIL_RE.sub("[EMAIL_REDACTED]", text)
    for pat, _ in KEY_PATTERNS:
        text = pat.sub("[KEY_REDACTED]", text)
    text = FINANCIAL_RE.sub("[FIN_REDACTED]", text)
    return text


def _scan_text_for_pii(text: str) -> dict[str, Any]:
    emails = sorted({m for m in EMAIL_RE.findall(text)})
    phones = sorted({m for m in PHONE_RE.findall(text)})
    keys: list[str] = []
    for pat, label in KEY_PATTERNS:
        if pat.search(text):
            keys.append(label)
    paths = sorted({m for m in PATH_RE.findall(text)})
    accounts = sorted({m for m in ACCOUNT_RE.findall(text)})
    financial = bool(FINANCIAL_RE.search(text))
    return {
        "emails_detected": emails,
        "phone_numbers_detected": phones,
        "api_keys_or_tokens_detected": sorted(set(keys)),
        "account_names_detected": accounts,
        "file_paths_detected": paths,
        "financial_data_detected": financial,
    }


# --------------------------- Provider routing -------------------------------

@dataclass
class ProviderResult:
    provider: str
    raw_text: str
    parsed: dict[str, Any] = field(default_factory=dict)
    error: str | None = None


def _select_provider() -> str:
    explicit = os.environ.get("HERMES_VISION_PROVIDER", "").strip().lower()
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
    return "ocr_only"


def _ollama_reachable() -> bool:
    base = os.environ.get("OLLAMA_BASE_URL", "http://127.0.0.1:11434").rstrip("/")
    try:
        import urllib.request
        with urllib.request.urlopen(f"{base}/api/tags", timeout=2) as r:
            r.read(1)
        return True
    except Exception:
        return False


def _encode_image(path: Path) -> tuple[str, str]:
    if not path.exists():
        raise FileNotFoundError(f"image not found: {path}")
    if path.stat().st_size > MAX_IMAGE_BYTES:
        raise ValueError(f"image too large (>{MAX_IMAGE_BYTES} bytes): {path}")
    mime, _ = mimetypes.guess_type(str(path))
    if not mime:
        mime = "image/jpeg"
    data = path.read_bytes()
    return base64.b64encode(data).decode("ascii"), mime


def _system_prompt(task: str, schema_keys: list[str]) -> str:
    keys = ", ".join(schema_keys)
    return (
        "You are Hermes Vision, a strict visual reviewer for the Cognitia "
        "content pipeline. You must reply with a single JSON object containing "
        f"these keys: {keys}. No prose outside JSON. Task: {task}"
    )


def _call_openai(prompt: str, images: list[Path]) -> ProviderResult:
    import urllib.error
    import urllib.request
    key = os.environ["OPENAI_API_KEY"]
    model = os.environ.get("HERMES_VISION_OPENAI_MODEL", "gpt-4o-mini")
    content: list[dict[str, Any]] = [{"type": "text", "text": prompt}]
    for p in images:
        b64, mime = _encode_image(p)
        content.append({"type": "image_url", "image_url": {"url": f"data:{mime};base64,{b64}"}})
    body = {
        "model": model,
        "messages": [{"role": "user", "content": content}],
        "response_format": {"type": "json_object"},
        "temperature": 0,
    }
    req = urllib.request.Request(
        "https://api.openai.com/v1/chat/completions",
        data=json.dumps(body).encode(),
        headers={
            "Authorization": f"Bearer {key}",
            "Content-Type": "application/json",
        },
    )
    try:
        with urllib.request.urlopen(req, timeout=DEFAULT_TIMEOUT) as r:
            out = json.loads(r.read())
        text = out["choices"][0]["message"]["content"]
        parsed = _safe_json(text)
        return ProviderResult("openai", text, parsed)
    except urllib.error.HTTPError as e:
        return ProviderResult("openai", "", error=f"http {e.code}: {e.read()[:200].decode(errors='replace')}")
    except Exception as e:  # noqa: BLE001
        return ProviderResult("openai", "", error=str(e))


def _call_anthropic(prompt: str, images: list[Path]) -> ProviderResult:
    import urllib.error
    import urllib.request
    key = os.environ["ANTHROPIC_API_KEY"]
    model = os.environ.get("HERMES_VISION_ANTHROPIC_MODEL", "claude-sonnet-4-6")
    content: list[dict[str, Any]] = []
    for p in images:
        b64, mime = _encode_image(p)
        content.append({
            "type": "image",
            "source": {"type": "base64", "media_type": mime, "data": b64},
        })
    content.append({"type": "text", "text": prompt})
    body = {
        "model": model,
        "max_tokens": 1024,
        "messages": [{"role": "user", "content": content}],
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


def _call_gemini(prompt: str, images: list[Path]) -> ProviderResult:
    import urllib.error
    import urllib.request
    key = os.environ["GOOGLE_API_KEY"]
    model = os.environ.get("HERMES_VISION_GEMINI_MODEL", "gemini-1.5-flash")
    parts: list[dict[str, Any]] = [{"text": prompt}]
    for p in images:
        b64, mime = _encode_image(p)
        parts.append({"inline_data": {"mime_type": mime, "data": b64}})
    body = {"contents": [{"parts": parts}], "generationConfig": {"temperature": 0}}
    url = f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent?key={key}"
    req = urllib.request.Request(
        url, data=json.dumps(body).encode(), headers={"Content-Type": "application/json"}
    )
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


def _call_openrouter(prompt: str, images: list[Path]) -> ProviderResult:
    import urllib.error
    import urllib.request
    key = os.environ["OPENROUTER_API_KEY"]
    model = os.environ.get("HERMES_VISION_OPENROUTER_MODEL", "openai/gpt-4o-mini")
    content: list[dict[str, Any]] = [{"type": "text", "text": prompt}]
    for p in images:
        b64, mime = _encode_image(p)
        content.append({"type": "image_url", "image_url": {"url": f"data:{mime};base64,{b64}"}})
    body = {
        "model": model,
        "messages": [{"role": "user", "content": content}],
        "temperature": 0,
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
        return ProviderResult("openrouter", text, _safe_json(text))
    except urllib.error.HTTPError as e:
        return ProviderResult("openrouter", "", error=f"http {e.code}: {e.read()[:200].decode(errors='replace')}")
    except Exception as e:  # noqa: BLE001
        return ProviderResult("openrouter", "", error=str(e))


def _call_ollama(prompt: str, images: list[Path]) -> ProviderResult:
    import urllib.error
    import urllib.request
    base = os.environ.get("OLLAMA_BASE_URL", "http://127.0.0.1:11434").rstrip("/")
    model = os.environ.get("HERMES_VISION_OLLAMA_MODEL", "llava")
    imgs_b64 = [_encode_image(p)[0] for p in images]
    body = {
        "model": model,
        "prompt": prompt,
        "images": imgs_b64,
        "stream": False,
        "options": {"temperature": 0},
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
        return ProviderResult("ollama", text, _safe_json(text))
    except urllib.error.HTTPError as e:
        return ProviderResult("ollama", "", error=f"http {e.code}: {e.read()[:200].decode(errors='replace')}")
    except Exception as e:  # noqa: BLE001
        return ProviderResult("ollama", "", error=str(e))


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


def _call_vision(prompt: str, images: list[Path]) -> ProviderResult:
    provider = _select_provider()
    LOG.info("vision provider selected: %s", provider)
    if provider == "openai":
        return _call_openai(prompt, images)
    if provider == "anthropic":
        return _call_anthropic(prompt, images)
    if provider == "gemini":
        return _call_gemini(prompt, images)
    if provider == "openrouter":
        return _call_openrouter(prompt, images)
    if provider == "ollama":
        return _call_ollama(prompt, images)
    return ProviderResult("ocr_only", "", error="no LLM vision provider configured")


# --------------------------- OCR --------------------------------------------

def _ocr(path: Path) -> str:
    try:
        import pytesseract
        from PIL import Image
        return pytesseract.image_to_string(Image.open(path))
    except Exception as e:  # noqa: BLE001
        LOG.warning("OCR failed for %s: %s", path, e)
        return ""


# --------------------------- Video frame extraction -------------------------

def _extract_first_frame(video: Path) -> Path:
    if not shutil.which("ffmpeg"):
        raise RuntimeError("ffmpeg not available for video frame extraction")
    tmpdir = Path(tempfile.mkdtemp(prefix="hermes-vision-"))
    out = tmpdir / "frame.jpg"
    subprocess.run(
        ["ffmpeg", "-y", "-i", str(video), "-vf", "thumbnail", "-frames:v", "1", str(out)],
        check=True,
        capture_output=True,
        timeout=120,
    )
    return out


# --------------------------- Output helpers ---------------------------------

def _write_output(result: dict[str, Any], output_json_path: str | None) -> None:
    if not output_json_path:
        return
    p = Path(output_json_path)
    p.parent.mkdir(parents=True, exist_ok=True)
    p.write_text(json.dumps(result, indent=2, ensure_ascii=False))


# --------------------------- Tool 1: analyze_image --------------------------

ANALYZE_SCHEMA = [
    "image_type", "summary", "visible_subject", "quality_score",
    "brand_score", "identity_notes", "production_notes",
    "privacy_risks", "detected_text", "recommended_action", "confidence",
]


def vision_analyze_image(
    image_path: str,
    task: str,
    output_json_path: str | None = None,
) -> dict[str, Any]:
    path = Path(image_path).expanduser().resolve()
    prompt = _system_prompt(task, ANALYZE_SCHEMA)
    pr = _call_vision(prompt, [path])
    ocr_text = _ocr(path)
    privacy = _scan_text_for_pii(ocr_text)
    privacy_flags = [k for k, v in privacy.items() if v]
    base: dict[str, Any] = {
        "image_type": "unknown",
        "summary": "",
        "visible_subject": "",
        "quality_score": None,
        "brand_score": None,
        "identity_notes": "",
        "production_notes": "",
        "privacy_risks": privacy_flags,
        "detected_text": _redact(ocr_text).strip()[:2000],
        "recommended_action": "manual_review",
        "confidence": 0.0,
    }
    if pr.parsed:
        base.update({k: v for k, v in pr.parsed.items() if k in ANALYZE_SCHEMA})
    base["provider"] = pr.provider
    if pr.error:
        base["provider_error"] = pr.error
        base["recommended_action"] = base.get("recommended_action") or "manual_review"
    if privacy.get("api_keys_or_tokens_detected"):
        base["recommended_action"] = "reject_publish_secrets_visible"
    _write_output(base, output_json_path)
    return base


# --------------------------- Tool 2: compare_portraits ----------------------

COMPARE_SCHEMA = [
    "identity_match_score", "naturalness_score", "handsome_polished_score",
    "fake_ai_risk_score", "beard_consistency_notes", "hair_consistency_notes",
    "face_consistency_notes", "recommended_use",
]


def vision_compare_portraits(
    reference_image_paths: list[str],
    candidate_image_path: str,
    task: str,
) -> dict[str, Any]:
    refs = [Path(p).expanduser().resolve() for p in reference_image_paths]
    cand = Path(candidate_image_path).expanduser().resolve()
    schema = (
        "Score 0.0-1.0. recommended_use must be one of "
        "['main_avatar','backup_reference','reject']. "
    )
    prompt = (
        _system_prompt(task, COMPARE_SCHEMA)
        + " "
        + schema
        + f" The first {len(refs)} images are references; the LAST image is the candidate."
    )
    pr = _call_vision(prompt, refs + [cand])
    base: dict[str, Any] = {
        "identity_match_score": None,
        "naturalness_score": None,
        "handsome_polished_score": None,
        "fake_ai_risk_score": None,
        "beard_consistency_notes": "",
        "hair_consistency_notes": "",
        "face_consistency_notes": "",
        "recommended_use": "reject",
        "provider": pr.provider,
    }
    if pr.parsed:
        base.update({k: v for k, v in pr.parsed.items() if k in COMPARE_SCHEMA})
    if pr.error:
        base["provider_error"] = pr.error
        base["recommended_use"] = "reject"
        base["notes"] = "LLM vision unavailable; cannot judge identity match. Manual review required."
    return base


# --------------------------- Tool 3: privacy_scan ---------------------------

PRIVACY_SCHEMA = [
    "emails_detected", "phone_numbers_detected", "api_keys_or_tokens_detected",
    "account_names_detected", "file_paths_detected", "financial_data_detected",
    "blur_recommendations", "publish_safe",
]


def vision_privacy_scan(image_path: str) -> dict[str, Any]:
    path = Path(image_path).expanduser().resolve()
    ocr_text = _ocr(path)
    findings = _scan_text_for_pii(ocr_text)
    blur: list[str] = []
    if findings["emails_detected"]:
        blur.append("blur email addresses")
    if findings["phone_numbers_detected"]:
        blur.append("blur phone numbers")
    if findings["api_keys_or_tokens_detected"]:
        blur.append("blur all visible tokens/keys")
    if findings["financial_data_detected"]:
        blur.append("blur financial digits / card / account numbers")
    if findings["file_paths_detected"]:
        blur.append("blur local file paths")
    publish_safe = not (
        findings["emails_detected"]
        or findings["api_keys_or_tokens_detected"]
        or findings["financial_data_detected"]
    )
    result = {
        **findings,
        "blur_recommendations": blur,
        "publish_safe": publish_safe,
        "ocr_text_redacted": _redact(ocr_text).strip()[:2000],
        "provider": "ocr+regex",
    }
    return result


# --------------------------- Tool 4: video_frame_qc -------------------------

FRAMEQC_SCHEMA = [
    "face_visible", "captions_readable", "logo_visible", "safe_zones_ok",
    "private_info_visible", "looks_like_ai_slop_risk", "publish_safe",
    "recommended_fixes",
]


def vision_video_frame_qc(
    video_path: str | None = None,
    frame_path: str | None = None,
) -> dict[str, Any]:
    if not video_path and not frame_path:
        raise ValueError("Provide video_path or frame_path")
    if frame_path:
        target = Path(frame_path).expanduser().resolve()
    else:
        target = _extract_first_frame(Path(video_path).expanduser().resolve())
    prompt = _system_prompt(
        "Judge whether this frame is safe to publish as a short-form video frame. "
        "Use 9:16 safe zones. Be strict.",
        FRAMEQC_SCHEMA,
    )
    pr = _call_vision(prompt, [target])
    privacy = vision_privacy_scan(str(target))
    base: dict[str, Any] = {
        "face_visible": None,
        "captions_readable": None,
        "logo_visible": None,
        "safe_zones_ok": None,
        "private_info_visible": not privacy["publish_safe"],
        "looks_like_ai_slop_risk": None,
        "publish_safe": privacy["publish_safe"],
        "recommended_fixes": list(privacy["blur_recommendations"]),
        "provider": pr.provider,
        "frame_inspected": str(target),
    }
    if pr.parsed:
        base.update({k: v for k, v in pr.parsed.items() if k in FRAMEQC_SCHEMA})
    if pr.error:
        base["provider_error"] = pr.error
    if not base["publish_safe"]:
        base.setdefault("recommended_fixes", []).append("blur or recompose; do not publish as-is")
    return base


# --------------------------- CLI --------------------------------------------

def _print_json(obj: dict[str, Any]) -> None:
    print(json.dumps(obj, indent=2, ensure_ascii=False))


def _cli(argv: list[str] | None = None) -> int:
    _configure_logging()
    p = argparse.ArgumentParser(prog="vision_skill", description=__doc__)
    p.add_argument("--mcp", action="store_true", help="run as MCP stdio server")
    sub = p.add_subparsers(dest="cmd")

    a = sub.add_parser("analyze")
    a.add_argument("--image", required=True)
    a.add_argument("--task", required=True)
    a.add_argument("--output-json-path", default=None)

    c = sub.add_parser("compare")
    c.add_argument("--refs", required=True, help="comma-separated reference image paths")
    c.add_argument("--candidate", required=True)
    c.add_argument("--task", default="judge candidate for use as main founder avatar")

    pr = sub.add_parser("privacy")
    pr.add_argument("--image", required=True)

    f = sub.add_parser("frameqc")
    g = f.add_mutually_exclusive_group(required=True)
    g.add_argument("--video", default=None)
    g.add_argument("--frame", default=None)

    sub.add_parser("provider")  # diagnostics

    args = p.parse_args(argv)

    if args.mcp:
        return _run_mcp_server()

    if args.cmd == "analyze":
        _print_json(vision_analyze_image(args.image, args.task, args.output_json_path))
        return 0
    if args.cmd == "compare":
        refs = [s for s in args.refs.split(",") if s.strip()]
        _print_json(vision_compare_portraits(refs, args.candidate, args.task))
        return 0
    if args.cmd == "privacy":
        _print_json(vision_privacy_scan(args.image))
        return 0
    if args.cmd == "frameqc":
        _print_json(vision_video_frame_qc(args.video, args.frame))
        return 0
    if args.cmd == "provider":
        _print_json({"selected_provider": _select_provider()})
        return 0
    p.print_help()
    return 2


# --------------------------- MCP server -------------------------------------

def _run_mcp_server() -> int:
    try:
        from mcp.server.fastmcp import FastMCP
    except Exception as e:
        LOG.error("MCP SDK not installed: %s. Install with: pip install mcp", e)
        return 1
    app = FastMCP(SKILL_NAME)

    @app.tool()
    def analyze_image(image_path: str, task: str, output_json_path: str | None = None) -> dict[str, Any]:
        """Analyze a single image and return Hermes review JSON."""
        return vision_analyze_image(image_path, task, output_json_path)

    @app.tool()
    def compare_portraits(reference_image_paths: list[str], candidate_image_path: str, task: str) -> dict[str, Any]:
        """Compare a candidate portrait against reference portraits."""
        return vision_compare_portraits(reference_image_paths, candidate_image_path, task)

    @app.tool()
    def privacy_scan(image_path: str) -> dict[str, Any]:
        """Scan an image for emails, phones, secrets, file paths, financials."""
        return vision_privacy_scan(image_path)

    @app.tool()
    def video_frame_qc(video_path: str | None = None, frame_path: str | None = None) -> dict[str, Any]:
        """QC a single video frame (or first frame of a video) for safe publish."""
        return vision_video_frame_qc(video_path, frame_path)

    app.run()
    return 0


if __name__ == "__main__":
    sys.exit(_cli())
