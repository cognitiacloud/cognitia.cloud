#!/usr/bin/env python3
"""Smoke + unit tests for the Hermes vision skill.

Runs without any cloud API keys: privacy_scan and analyze degrade
gracefully via the OCR-only path. With keys present, exercises the
configured provider too.
"""

from __future__ import annotations

import json
import os
import subprocess
import sys
import unittest
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))

import vision_skill  # noqa: E402


def _ensure_assets() -> None:
    assets = HERE / "test_assets"
    portrait = assets / "portrait.jpg"
    if not portrait.exists():
        subprocess.check_call([sys.executable, str(assets / "generate_test_assets.py")])


class PrivacyRegexTests(unittest.TestCase):
    def test_detects_email_and_key(self) -> None:
        text = "contact jane.doe@example.com key sk-TESTONLYabcdefghijklmnopqrst"
        out = vision_skill._scan_text_for_pii(text)
        self.assertIn("jane.doe@example.com", out["emails_detected"])
        self.assertTrue(any("openai" in k for k in out["api_keys_or_tokens_detected"]))

    def test_detects_paths_and_financial(self) -> None:
        text = "/home/jane/notes.md  card 4242 4242 4242 4242"
        out = vision_skill._scan_text_for_pii(text)
        self.assertTrue(out["file_paths_detected"])
        self.assertTrue(out["financial_data_detected"])

    def test_redaction(self) -> None:
        red = vision_skill._redact("a@b.com sk-TESTONLYabcdefghijklmnopqrst 4242 4242 4242 4242")
        self.assertNotIn("a@b.com", red)
        self.assertNotIn("sk-TESTONLY", red)


class ProviderRoutingTests(unittest.TestCase):
    def test_explicit_override(self) -> None:
        os.environ["HERMES_VISION_PROVIDER"] = "ocr_only"
        try:
            self.assertEqual(vision_skill._select_provider(), "ocr_only")
        finally:
            del os.environ["HERMES_VISION_PROVIDER"]

    def test_falls_back_to_ocr_only_without_keys(self) -> None:
        saved = {k: os.environ.pop(k) for k in list(os.environ) if k.endswith("_API_KEY")}
        os.environ.pop("HERMES_VISION_PROVIDER", None)
        try:
            self.assertIn(
                vision_skill._select_provider(),
                {"ocr_only", "ollama"},  # ollama only if a local daemon is up
            )
        finally:
            os.environ.update(saved)


class PrivacyScanIntegrationTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls) -> None:
        _ensure_assets()

    def test_clean_screenshot_publish_safe(self) -> None:
        out = vision_skill.vision_privacy_scan(str(HERE / "test_assets" / "screenshot.jpg"))
        self.assertTrue(out["publish_safe"], msg=out)
        self.assertFalse(out["emails_detected"])
        self.assertFalse(out["api_keys_or_tokens_detected"])

    def test_secret_screenshot_blocked(self) -> None:
        out = vision_skill.vision_privacy_scan(str(HERE / "test_assets" / "screenshot_secret.jpg"))
        self.assertFalse(out["publish_safe"], msg=out)
        self.assertTrue(
            out["emails_detected"]
            or out["api_keys_or_tokens_detected"]
            or out["financial_data_detected"]
            or out["file_paths_detected"],
            msg=out,
        )
        self.assertTrue(out["blur_recommendations"])


class AnalyzeImageOcrOnlyTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls) -> None:
        _ensure_assets()
        os.environ["HERMES_VISION_PROVIDER"] = "ocr_only"

    @classmethod
    def tearDownClass(cls) -> None:
        os.environ.pop("HERMES_VISION_PROVIDER", None)

    def test_returns_schema_with_provider_error(self) -> None:
        out = vision_skill.vision_analyze_image(
            str(HERE / "test_assets" / "portrait.jpg"),
            task="judge if suitable for Cognitia founder avatar",
        )
        for k in vision_skill.ANALYZE_SCHEMA:
            self.assertIn(k, out)
        self.assertEqual(out["provider"], "ocr_only")
        self.assertIn("provider_error", out)

    def test_secret_image_forces_reject(self) -> None:
        out = vision_skill.vision_analyze_image(
            str(HERE / "test_assets" / "screenshot_secret.jpg"),
            task="check if safe to publish",
        )
        self.assertEqual(out["recommended_action"], "reject_publish_secrets_visible")

    def test_writes_output_file(self) -> None:
        out_path = HERE / "test_assets" / "_out.json"
        if out_path.exists():
            out_path.unlink()
        vision_skill.vision_analyze_image(
            str(HERE / "test_assets" / "screenshot.jpg"),
            task="describe screenshot",
            output_json_path=str(out_path),
        )
        self.assertTrue(out_path.exists())
        loaded = json.loads(out_path.read_text())
        self.assertIn("image_type", loaded)
        out_path.unlink()


class ComparePortraitsOcrOnlyTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls) -> None:
        _ensure_assets()
        os.environ["HERMES_VISION_PROVIDER"] = "ocr_only"

    @classmethod
    def tearDownClass(cls) -> None:
        os.environ.pop("HERMES_VISION_PROVIDER", None)

    def test_returns_reject_without_llm(self) -> None:
        out = vision_skill.vision_compare_portraits(
            [str(HERE / "test_assets" / "ref1.jpg"), str(HERE / "test_assets" / "ref2.jpg")],
            str(HERE / "test_assets" / "candidate.jpg"),
            task="founder avatar selection",
        )
        for k in vision_skill.COMPARE_SCHEMA:
            self.assertIn(k, out)
        self.assertEqual(out["recommended_use"], "reject")
        self.assertEqual(out["provider"], "ocr_only")


class FrameQcOcrOnlyTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls) -> None:
        _ensure_assets()
        os.environ["HERMES_VISION_PROVIDER"] = "ocr_only"

    @classmethod
    def tearDownClass(cls) -> None:
        os.environ.pop("HERMES_VISION_PROVIDER", None)

    def test_clean_frame_safe(self) -> None:
        out = vision_skill.vision_video_frame_qc(
            frame_path=str(HERE / "test_assets" / "screenshot.jpg")
        )
        self.assertTrue(out["publish_safe"])

    def test_secret_frame_blocked(self) -> None:
        out = vision_skill.vision_video_frame_qc(
            frame_path=str(HERE / "test_assets" / "screenshot_secret.jpg")
        )
        self.assertFalse(out["publish_safe"])
        self.assertTrue(out["private_info_visible"])
        self.assertTrue(out["recommended_fixes"])


if __name__ == "__main__":
    _ensure_assets()
    unittest.main(verbosity=2)
