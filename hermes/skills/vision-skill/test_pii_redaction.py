#!/usr/bin/env python3
"""W7 PII redaction guards for the Hermes vision skill.

Deepens the light redaction coverage in test_vision_skill.py. These tests pin
the redaction contract: secrets must never survive into tool output or logs.

    python3 test_pii_redaction.py -v

Runs with no cloud API keys (ocr_only path). The synthetic secrets below are
clearly-fake test fixtures, not real credentials.
"""

from __future__ import annotations

import logging
import os
import sys
import unittest
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))

import vision_skill  # noqa: E402

# Synthetic, obviously-fake secrets used only to exercise the redactor.
# Built by concatenation around a sentinel so no contiguous token literal
# exists in source (defeats secret-scanning false positives); the runtime
# values still match vision_skill's KEY_PATTERNS.
_S = "TESTONLY"  # sentinel marking every value below as a fake fixture
FAKE_EMAIL = "founder@cognitia.example"
FAKE_OPENAI = "sk-" + _S + "abcdefghijklmnopqrstuvwx"
FAKE_ANTHROPIC = "sk-ant-" + _S + "abcdefghijklmnopqrst"
FAKE_GITHUB = "ghp_" + _S + "abcdefghijklmnopqrstuvwxyz12"
FAKE_AWS = "AKIA" + "IOSFODNN7EXAMPLE"
FAKE_CARD = "4242 4242 4242 4242"


def _ensure_assets() -> None:
    assets = HERE / "test_assets"
    if not (assets / "portrait.jpg").exists():
        import subprocess
        subprocess.check_call([sys.executable, str(assets / "generate_test_assets.py")])


class RedactCoverageTests(unittest.TestCase):
    """_redact must scrub every category it claims to cover."""

    def test_email_redacted(self) -> None:
        self.assertNotIn(FAKE_EMAIL, vision_skill._redact(f"reach {FAKE_EMAIL} now"))

    def test_every_key_pattern_redacted(self) -> None:
        # Build one input that triggers each KEY_PATTERN, then assert none leak.
        samples = [
            FAKE_OPENAI, FAKE_ANTHROPIC, FAKE_GITHUB, FAKE_AWS,
            "AIza" + "SyA1234567890abcdefghijklmnopqrstuv",  # google (AIza + 35)
            "xoxb-" + _S + "abcdefghij",                      # slack
            "hf_" + _S + "abcdefghijklmnopqrstuvwxyz",        # huggingface
            "glpat-" + _S + "abcdefghijklmno",               # gitlab
        ]
        blob = " ".join(samples)
        red = vision_skill._redact(blob)
        for raw in samples:
            self.assertNotIn(raw, red, msg=f"leaked secret: {raw}")
        self.assertIn("[KEY_REDACTED]", red)

    def test_financial_redacted(self) -> None:
        self.assertNotIn("4242", vision_skill._redact(f"card {FAKE_CARD}"))

    def test_redaction_is_idempotent(self) -> None:
        once = vision_skill._redact(f"{FAKE_EMAIL} {FAKE_OPENAI} {FAKE_CARD}")
        twice = vision_skill._redact(once)
        self.assertEqual(once, twice)
        for raw in (FAKE_EMAIL, FAKE_OPENAI, "4242"):
            self.assertNotIn(raw, twice)

    def test_clean_text_unchanged(self) -> None:
        clean = "A perfectly safe caption about a sunny founder portrait."
        self.assertEqual(vision_skill._redact(clean), clean)


class ScanContractTests(unittest.TestCase):
    """_scan_text_for_pii must surface each category it advertises."""

    def test_scan_keys_emails_financial(self) -> None:
        text = f"{FAKE_EMAIL} {FAKE_OPENAI} {FAKE_CARD} /home/founder/secrets.txt"
        out = vision_skill._scan_text_for_pii(text)
        self.assertIn(FAKE_EMAIL, out["emails_detected"])
        self.assertTrue(out["api_keys_or_tokens_detected"])
        self.assertTrue(out["financial_data_detected"])
        self.assertTrue(out["file_paths_detected"])

    def test_scan_returns_all_keys(self) -> None:
        out = vision_skill._scan_text_for_pii("nothing to see here")
        for k in (
            "emails_detected", "phone_numbers_detected",
            "api_keys_or_tokens_detected", "account_names_detected",
            "file_paths_detected", "financial_data_detected",
        ):
            self.assertIn(k, out)


class LogRedactionTests(unittest.TestCase):
    """The logging filter is the audit-log redaction guarantee."""

    def test_filter_scrubs_log_record(self) -> None:
        flt = vision_skill._RedactingFilter()
        record = logging.LogRecord(
            name="hermes.vision", level=logging.INFO, pathname=__file__,
            lineno=1, msg=f"using {FAKE_OPENAI} for {FAKE_EMAIL}",
            args=(), exc_info=None,
        )
        flt.filter(record)
        self.assertNotIn(FAKE_OPENAI, str(record.msg))
        self.assertNotIn(FAKE_EMAIL, str(record.msg))


class OutputNeverLeaksTests(unittest.TestCase):
    """Tool output that echoes OCR text must be redacted, not raw."""

    @classmethod
    def setUpClass(cls) -> None:
        _ensure_assets()
        os.environ["HERMES_VISION_PROVIDER"] = "ocr_only"

    @classmethod
    def tearDownClass(cls) -> None:
        os.environ.pop("HERMES_VISION_PROVIDER", None)

    def test_privacy_scan_output_is_redacted(self) -> None:
        # The secret screenshot fixture contains a fake key; the echoed OCR
        # text field must be the redacted variant, never the raw secret.
        out = vision_skill.vision_privacy_scan(
            str(HERE / "test_assets" / "screenshot_secret.jpg")
        )
        echoed = out.get("ocr_text_redacted", "")
        self.assertNotIn("sk-ant-", echoed)
        self.assertNotIn("ghp_", echoed)

    def test_analyze_detected_text_is_redacted(self) -> None:
        out = vision_skill.vision_analyze_image(
            str(HERE / "test_assets" / "screenshot_secret.jpg"),
            task="check if safe to publish",
        )
        # If a secret was OCR'd, it must be reject + redacted in detected_text.
        self.assertNotIn("sk-ant-", out.get("detected_text", ""))
        self.assertNotIn("ghp_", out.get("detected_text", ""))


if __name__ == "__main__":
    _ensure_assets()
    unittest.main(verbosity=2)
