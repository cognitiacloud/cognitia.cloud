#!/usr/bin/env python3
"""W7 enterprise hardening guards for the Hermes vision skill.

These tests are guardrails, not feature tests. They fail loudly if a worker
accidentally introduces a live network egress, a real outreach/send surface,
or weakens a declared safety flag in the mock-safe spine.

They run with no cloud API keys and make no network calls themselves.

    python3 test_enterprise_guard.py -v

The authoritative forbidden-surface denylist mirrored here is documented in
POLICY_CONTRACT.md.
"""

from __future__ import annotations

import ast
import os
import sys
import unittest
import urllib.request
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))

import vision_skill  # noqa: E402

MODULE_PATH = HERE / "vision_skill.py"
MODULE_SRC = MODULE_PATH.read_text()


def _ensure_assets() -> None:
    assets = HERE / "test_assets"
    if not (assets / "portrait.jpg").exists():
        import subprocess
        subprocess.check_call([sys.executable, str(assets / "generate_test_assets.py")])


class _NetworkBlocked(Exception):
    """Raised by the test harness if any code attempts real network egress."""


# --------------------------------------------------------------------------
# 1. Mock/live boundary: ocr_only must be fully airgapped.
# --------------------------------------------------------------------------

class MockSafeNoNetworkTests(unittest.TestCase):
    """Prove the documented safe config (HERMES_VISION_PROVIDER=ocr_only)
    runs every tool without attempting a single network call."""

    @classmethod
    def setUpClass(cls) -> None:
        _ensure_assets()

    def setUp(self) -> None:
        self._saved_env = {
            k: os.environ.pop(k)
            for k in list(os.environ)
            if k.endswith("_API_KEY")
        }
        os.environ["HERMES_VISION_PROVIDER"] = "ocr_only"

        # Trip-wire every egress path the skill could possibly take.
        import socket
        self._orig_urlopen = urllib.request.urlopen
        self._orig_socket = socket.socket

        def _blocked(*_a, **_k):  # noqa: ANN002, ANN003
            raise _NetworkBlocked("network egress attempted in mock-safe mode")

        urllib.request.urlopen = _blocked  # type: ignore[assignment]
        socket.socket = _blocked  # type: ignore[assignment]
        self._socket_mod = socket

    def tearDown(self) -> None:
        urllib.request.urlopen = self._orig_urlopen  # type: ignore[assignment]
        self._socket_mod.socket = self._orig_socket  # type: ignore[assignment]
        os.environ.pop("HERMES_VISION_PROVIDER", None)
        os.environ.update(self._saved_env)

    def _asset(self, name: str) -> str:
        return str(HERE / "test_assets" / name)

    def test_provider_selects_ocr_only(self) -> None:
        self.assertEqual(vision_skill._select_provider(), "ocr_only")

    def test_analyze_makes_no_network_call(self) -> None:
        out = vision_skill.vision_analyze_image(
            self._asset("portrait.jpg"), task="qc"
        )
        self.assertEqual(out["provider"], "ocr_only")

    def test_privacy_scan_makes_no_network_call(self) -> None:
        out = vision_skill.vision_privacy_scan(self._asset("screenshot.jpg"))
        self.assertIn("publish_safe", out)

    def test_compare_makes_no_network_call(self) -> None:
        out = vision_skill.vision_compare_portraits(
            [self._asset("ref1.jpg"), self._asset("ref2.jpg")],
            self._asset("candidate.jpg"),
            task="founder avatar selection",
        )
        self.assertEqual(out["provider"], "ocr_only")

    def test_frameqc_makes_no_network_call(self) -> None:
        out = vision_skill.vision_video_frame_qc(
            frame_path=self._asset("screenshot.jpg")
        )
        self.assertIn("publish_safe", out)


# --------------------------------------------------------------------------
# 2. Egress confinement: urlopen/Request only inside known provider funcs.
# --------------------------------------------------------------------------

class EgressConfinementTests(unittest.TestCase):
    """All network egress must stay inside the explicit provider boundary.
    Fails if a new code path adds raw egress into tool/business logic."""

    # The only functions permitted to touch the network. Each is gated on an
    # explicit env credential or an explicit provider selection.
    ALLOWED_EGRESS_FUNCS = {
        "_call_openai",
        "_call_anthropic",
        "_call_gemini",
        "_call_openrouter",
        "_call_ollama",
        "_ollama_reachable",
    }
    EGRESS_NAMES = {"urlopen", "Request", "urlretrieve", "socket", "create_connection"}

    def test_egress_calls_confined(self) -> None:
        tree = ast.parse(MODULE_SRC)

        # Map every node to its innermost enclosing function name.
        owner: dict[int, str] = {}

        def assign(node: ast.AST, name: str) -> None:
            for child in ast.iter_child_nodes(node):
                if isinstance(child, (ast.FunctionDef, ast.AsyncFunctionDef)):
                    for sub in ast.walk(child):
                        owner[id(sub)] = child.name
                    assign(child, child.name)
                else:
                    owner.setdefault(id(child), name)
                    assign(child, name)

        assign(tree, "<module>")

        violations: list[str] = []
        for node in ast.walk(tree):
            if isinstance(node, ast.Call):
                func = node.func
                name = None
                if isinstance(func, ast.Attribute):
                    name = func.attr
                elif isinstance(func, ast.Name):
                    name = func.id
                if name in self.EGRESS_NAMES:
                    where = owner.get(id(node), "<module>")
                    if where not in self.ALLOWED_EGRESS_FUNCS:
                        violations.append(f"{name}() in {where}() (line {node.lineno})")

        self.assertEqual(
            violations,
            [],
            msg=(
                "Network egress escaped the provider boundary. Allowed only in "
                f"{sorted(self.ALLOWED_EGRESS_FUNCS)}. Violations: {violations}"
            ),
        )


# --------------------------------------------------------------------------
# 3. No outreach / live-vendor surface may be introduced.
# --------------------------------------------------------------------------

class NoOutreachSurfaceTests(unittest.TestCase):
    """Fail if a real outreach/send surface or heavyweight live-vendor SDK is
    introduced into the protected module. Mirrored in POLICY_CONTRACT.md."""

    # Forbidden tokens: real outreach/send surfaces and vendor SDKs that would
    # imply live, fire-and-forget side effects. The skill must stay read-only.
    FORBIDDEN_TOKENS = [
        # mail / messaging transports
        "smtplib", "sendmail", "smtp.", "imaplib",
        # outreach vendors
        "twilio", "sendgrid", "mailgun", "mailchimp", "postmark",
        "tweepy", "slack_sdk", "discord", "telegram", "praw",
        # generic HTTP clients that bypass the urllib provider boundary
        "import requests", "import httpx", "import aiohttp",
        # cloud SDKs (heavyweight live side effects)
        "boto3", "google.cloud", "azure.",
        # outreach-shaped call surfaces
        "post_message", "send_message", "send_email", "send_sms",
        "webhook", "publish_post",
    ]

    def test_no_forbidden_outreach_tokens(self) -> None:
        lowered = MODULE_SRC.lower()
        hits = [tok for tok in self.FORBIDDEN_TOKENS if tok.lower() in lowered]
        self.assertEqual(
            hits,
            [],
            msg=(
                "Forbidden outreach/live-vendor surface detected in "
                f"vision_skill.py: {hits}. The first-wave spine must remain "
                "read-only with no send/post surface. See POLICY_CONTRACT.md."
            ),
        )

    def test_only_urllib_used_for_http(self) -> None:
        # The skill's documented egress mechanism is stdlib urllib only.
        tree = ast.parse(MODULE_SRC)
        imported: set[str] = set()
        for node in ast.walk(tree):
            if isinstance(node, ast.Import):
                imported.update(a.name.split(".")[0] for a in node.names)
            elif isinstance(node, ast.ImportFrom) and node.module:
                imported.add(node.module.split(".")[0])
        for banned in {"requests", "httpx", "aiohttp", "urllib3"}:
            self.assertNotIn(
                banned,
                imported,
                msg=f"{banned} import bypasses the urllib egress boundary",
            )


# --------------------------------------------------------------------------
# 4. Safety contract: declared flags must not be silently weakened.
# --------------------------------------------------------------------------

class SafetyContractTests(unittest.TestCase):
    """skill.yaml's declared safety posture is part of the contract. Flipping a
    flag should break the build, not pass silently."""

    @classmethod
    def setUpClass(cls) -> None:
        cls.yaml_src = (HERE / "skill.yaml").read_text()

    def test_safety_flags_remain_true(self) -> None:
        for flag in (
            "read_only",
            "no_delete",
            "no_post",
            "no_unknown_uploads",
            "redact_logs",
        ):
            self.assertIn(
                f"{flag}: true",
                self.yaml_src,
                msg=f"safety flag '{flag}: true' missing or weakened in skill.yaml",
            )

    def test_ocr_only_is_the_fallback(self) -> None:
        # ocr_only must remain the last provider in priority (the safe default).
        after = self.yaml_src.split("priority:", 1)[1]
        priority_block = after.split("env:", 1)[0]  # stop before the env: list
        providers = [
            line.strip()[2:].strip()
            for line in priority_block.splitlines()
            if line.strip().startswith("- ")
        ]
        self.assertTrue(providers, msg="no provider priority list found")
        self.assertEqual(
            providers[-1],
            "ocr_only",
            msg=f"ocr_only must be the final fallback provider; got {providers}",
        )

    def test_select_provider_defaults_to_ocr_only(self) -> None:
        # With no keys and ollama unreachable, the spine must pick ocr_only.
        saved = {k: os.environ.pop(k) for k in list(os.environ) if k.endswith("_API_KEY")}
        os.environ.pop("HERMES_VISION_PROVIDER", None)
        try:
            self.assertIn(
                vision_skill._select_provider(),
                {"ocr_only", "ollama"},  # ollama only if a local daemon is up
            )
        finally:
            os.environ.update(saved)


if __name__ == "__main__":
    _ensure_assets()
    unittest.main(verbosity=2)
