#!/usr/bin/env python3
"""Offline tests for the Hermes drafting skill.

The whole suite forces HERMES_DRAFT_PROVIDER=template so it is deterministic
and needs no API keys or network. Provider paths are exercised by monkeypatching
the _call_* functions, never by making real HTTP calls.
"""

from __future__ import annotations

import json
import os
import tempfile
import unittest
from pathlib import Path

import drafting_skill as ds


class _Base(unittest.TestCase):
    @classmethod
    def setUpClass(cls) -> None:
        # Force deterministic, networkless behavior for the whole suite.
        os.environ["HERMES_DRAFT_PROVIDER"] = "template"
        for k in (
            "ANTHROPIC_API_KEY", "OPENAI_API_KEY", "GOOGLE_API_KEY",
            "OPENROUTER_API_KEY",
        ):
            os.environ.pop(k, None)
        cls.context = {"recipient_ref": "r1", "first_name": "Alex", "company": "Acme"}


class ProviderRoutingTests(_Base):
    def test_explicit_override_wins(self) -> None:
        os.environ["HERMES_DRAFT_PROVIDER"] = "openai"
        try:
            self.assertEqual(ds._select_provider(), "openai")
        finally:
            os.environ["HERMES_DRAFT_PROVIDER"] = "template"

    def test_anthropic_is_first_by_key(self) -> None:
        os.environ.pop("HERMES_DRAFT_PROVIDER", None)
        os.environ["ANTHROPIC_API_KEY"] = "sk-ant-TESTONLYxxxxxxxxxxxxxxxxxxxxx"
        os.environ["OPENAI_API_KEY"] = "sk-TESTONLYxxxxxxxxxxxxxxxxxxxxx"
        try:
            self.assertEqual(ds._select_provider(), "anthropic")
        finally:
            os.environ.pop("ANTHROPIC_API_KEY", None)
            os.environ.pop("OPENAI_API_KEY", None)
            os.environ["HERMES_DRAFT_PROVIDER"] = "template"

    def test_no_keys_falls_to_template(self) -> None:
        os.environ.pop("HERMES_DRAFT_PROVIDER", None)
        try:
            # No keys set in setUpClass; ollama almost certainly unreachable in CI.
            self.assertIn(ds._select_provider(), ("template", "ollama"))
        finally:
            os.environ["HERMES_DRAFT_PROVIDER"] = "template"


class TemplateModeTests(_Base):
    def test_template_mode_is_pending_and_substituted(self) -> None:
        env = ds.draft_outreach_message("intro_email", self.context)
        self.assertEqual(env["status"], "pending_approval")
        self.assertEqual(env["audit"]["source"], "template")
        self.assertIn("Alex", env["body"])
        self.assertIn("Acme", env["body"])
        self.assertNotIn("{first_name}", env["body"])
        self.assertEqual(env["channel"], "email")

    def test_required_context_missing_is_flagged(self) -> None:
        env = ds.draft_outreach_message("intro_email", {"recipient_ref": "r2"})
        self.assertEqual(env["status"], "pending_approval")
        joined = " ".join(env["issues"])
        self.assertIn("missing required context", joined)

    def test_render_template_tool_always_safe(self) -> None:
        env = ds.draft_render_template("linkedin_connect", self.context)
        self.assertEqual(env["status"], "pending_approval")
        self.assertEqual(env["channel"], "linkedin")
        self.assertEqual(env["audit"]["source"], "template")


class FailureFallbackTests(_Base):
    def test_provider_error_falls_back_to_template(self) -> None:
        original = ds._call_provider
        ds._select_provider_orig = ds._select_provider

        def fake_select() -> str:
            return "anthropic"

        def fake_call(system: str, user: str, temperature: float) -> ds.DraftResult:
            return ds.DraftResult("anthropic", "", error="http 503: down", model="claude-sonnet-4-6")

        ds._select_provider = fake_select  # type: ignore[assignment]
        ds._call_provider = fake_call  # type: ignore[assignment]
        try:
            env = ds.draft_outreach_message("intro_email", self.context)
        finally:
            ds._select_provider = ds._select_provider_orig  # type: ignore[assignment]
            ds._call_provider = original  # type: ignore[assignment]

        self.assertEqual(env["status"], "pending_approval")
        self.assertEqual(env["audit"]["source"], "template")
        self.assertIsNotNone(env["audit"]["fallback_reason"])
        self.assertIn("503", env["audit"]["provider_error"])
        self.assertIn("Alex", env["body"])  # deterministic content still produced


class UnsafeOutputFallbackTests(_Base):
    def _run_with_llm_output(self, parsed: dict) -> ds.DraftEnvelope:
        original = ds._call_provider
        orig_select = ds._select_provider

        ds._select_provider = lambda: "anthropic"  # type: ignore[assignment]
        ds._call_provider = lambda s, u, t: ds.DraftResult(  # type: ignore[assignment]
            "anthropic", json.dumps(parsed), parsed, model="claude-sonnet-4-6"
        )
        try:
            return ds.draft_outreach_message("intro_email", self.context)
        finally:
            ds._call_provider = original  # type: ignore[assignment]
            ds._select_provider = orig_select  # type: ignore[assignment]

    def test_banned_phrase_forces_fallback(self) -> None:
        env = self._run_with_llm_output(
            {"subject": "Hi", "body": "Act now, this is guaranteed!", "call_to_action": "", "personalization_notes": ""}
        )
        self.assertEqual(env["audit"]["source"], "template")
        self.assertIn("validation", env["audit"]["fallback_reason"])

    def test_leaked_secret_forces_fallback(self) -> None:
        env = self._run_with_llm_output(
            {"subject": "Hi", "body": "Use key sk-ant-ABCDEFGHIJKLMNOPQRSTUVWX to log in.", "call_to_action": "", "personalization_notes": ""}
        )
        self.assertEqual(env["audit"]["source"], "template")
        self.assertIsNotNone(env["audit"]["fallback_reason"])

    def test_unfilled_placeholder_forces_fallback(self) -> None:
        env = self._run_with_llm_output(
            {"subject": "Hi {first_name}", "body": "Hello {company} team", "call_to_action": "", "personalization_notes": ""}
        )
        self.assertEqual(env["audit"]["source"], "template")

    def test_disallowed_link_forces_fallback(self) -> None:
        env = self._run_with_llm_output(
            {"subject": "Hi", "body": "See http://evil.example.com/track now.", "call_to_action": "", "personalization_notes": ""}
        )
        self.assertEqual(env["audit"]["source"], "template")

    def test_valid_llm_output_is_used(self) -> None:
        env = self._run_with_llm_output(
            {"subject": "Quick idea for Acme", "body": "Hi Alex, short note about Acme.", "call_to_action": "Call?", "personalization_notes": "ok"}
        )
        self.assertEqual(env["audit"]["source"], "llm")
        self.assertEqual(env["status"], "pending_approval")
        self.assertEqual(env["audit"]["model"], "claude-sonnet-4-6")


class ValidateDraftTests(_Base):
    def test_validate_flags_banned_phrase(self) -> None:
        out = ds.draft_validate_draft({"subject": "", "body": "guaranteed wins", "call_to_action": "", "personalization_notes": ""})
        self.assertFalse(out["safe"])
        self.assertTrue(out["issues"])

    def test_validate_accepts_clean_draft(self) -> None:
        out = ds.draft_validate_draft({"subject": "Hello", "body": "A short clean note.", "call_to_action": "Chat?", "personalization_notes": ""})
        self.assertTrue(out["safe"])


class AuditAndSideEffectTests(_Base):
    REQUIRED_AUDIT_KEYS = {
        "provider", "model", "prompt_id", "prompt_version", "config_version",
        "skill_version", "generated_at", "source", "fallback_reason", "provider_error",
    }

    def test_audit_is_complete(self) -> None:
        env = ds.draft_outreach_message("intro_email", self.context)
        self.assertEqual(set(env["audit"].keys()), self.REQUIRED_AUDIT_KEYS)
        self.assertTrue(env["audit"]["prompt_version"])
        self.assertTrue(env["audit"]["config_version"])
        self.assertTrue(env["draft_id"])

    def test_status_is_only_pending(self) -> None:
        # Across template, llm-valid, and fallback paths, status never changes.
        envs = [
            ds.draft_outreach_message("intro_email", self.context),
            ds.draft_render_template("intro_email", self.context),
        ]
        for env in envs:
            self.assertEqual(env["status"], "pending_approval")

    def test_no_file_written_without_path(self) -> None:
        with tempfile.TemporaryDirectory() as d:
            before = set(Path(d).iterdir())
            ds.draft_outreach_message("intro_email", self.context)
            after = set(Path(d).iterdir())
            self.assertEqual(before, after)

    def test_file_written_only_when_requested(self) -> None:
        with tempfile.TemporaryDirectory() as d:
            out = Path(d) / "draft.json"
            ds.draft_outreach_message("intro_email", self.context, output_json_path=str(out))
            self.assertTrue(out.exists())
            saved = json.loads(out.read_text())
            self.assertEqual(saved["status"], "pending_approval")

    def test_no_sender_symbols_exist(self) -> None:
        # Governance: the module must expose no send/post/transmit capability.
        src = Path(ds.__file__).read_text()
        for needle in ("smtplib", "sendmail", "def send", "def _send", ".send("):
            self.assertNotIn(needle, src, f"unexpected sender-like construct: {needle}")


class ProviderListingTests(_Base):
    def test_lists_templates_and_provider(self) -> None:
        out = ds.draft_list_providers()
        self.assertEqual(out["selected_provider"], "template")
        self.assertIn("intro_email", out["templates"])
        self.assertEqual(out["priority"][0], "anthropic")


if __name__ == "__main__":
    unittest.main()
