#!/usr/bin/env python3
"""Smoke + unit tests for the Hermes meeting skill.

Runs without any cloud API keys: summarize / action extraction degrade
gracefully via the deterministic offline path. Each test gets an isolated
JSON store via a temp dir (MEETING_STORE_PATH).
"""

from __future__ import annotations

import json
import os
import tempfile
import unittest
from pathlib import Path

import sys

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))

import meeting_skill  # noqa: E402

SAMPLE_BOOKING = HERE / "sample_data" / "booking_calendly.json"
SAMPLE_TRANSCRIPT = HERE / "sample_data" / "transcript_sample.txt"


class _StoreTestCase(unittest.TestCase):
    """Base: isolated store + forced offline provider per test."""

    def setUp(self) -> None:
        self._tmp = tempfile.TemporaryDirectory()
        self.store = meeting_skill.MeetingStore(Path(self._tmp.name) / "store.json")
        self._saved_provider = os.environ.get("HERMES_MEETING_PROVIDER")
        os.environ["HERMES_MEETING_PROVIDER"] = "offline"

    def tearDown(self) -> None:
        if self._saved_provider is None:
            os.environ.pop("HERMES_MEETING_PROVIDER", None)
        else:
            os.environ["HERMES_MEETING_PROVIDER"] = self._saved_provider
        self._tmp.cleanup()

    # convenience pipeline helpers
    def _ingest(self) -> str:
        payload = json.loads(SAMPLE_BOOKING.read_text())
        out = meeting_skill.meeting_ingest_booking(payload, store=self.store)
        return out["meeting"]["id"]

    def _through_summary(self) -> str:
        mid = self._ingest()
        meeting_skill.meeting_ingest_transcript(
            mid, transcript_text=SAMPLE_TRANSCRIPT.read_text(), store=self.store
        )
        meeting_skill.meeting_summarize(mid, store=self.store)
        return mid


class ProviderRoutingTests(unittest.TestCase):
    def test_explicit_offline_override(self) -> None:
        os.environ["HERMES_MEETING_PROVIDER"] = "offline"
        try:
            self.assertEqual(meeting_skill.select_provider(), "offline")
        finally:
            os.environ.pop("HERMES_MEETING_PROVIDER", None)

    def test_falls_back_to_offline_without_keys(self) -> None:
        saved = {k: os.environ.pop(k) for k in list(os.environ) if k.endswith("_API_KEY")}
        os.environ.pop("HERMES_MEETING_PROVIDER", None)
        try:
            self.assertIn(meeting_skill.select_provider(), {"offline", "ollama"})
        finally:
            os.environ.update(saved)


class BookingIngestionTests(_StoreTestCase):
    def test_ingest_creates_booking_and_scheduled_meeting(self) -> None:
        payload = json.loads(SAMPLE_BOOKING.read_text())
        out = meeting_skill.meeting_ingest_booking(payload, store=self.store)
        self.assertEqual(out["booking"]["provider"], "calendly")
        self.assertEqual(out["booking"]["invitee_email"], "jane.rivera@acme.example")
        self.assertEqual(out["booking"]["scheduled_start"], "2026-06-18T15:00:00Z")
        self.assertEqual(out["meeting"]["state"], "scheduled")
        self.assertEqual(out["meeting"]["contact_id"], "contact_acme_jane")

    def test_canceled_booking_yields_canceled_meeting(self) -> None:
        out = meeting_skill.meeting_ingest_booking(
            {"event_type": "x", "status": "canceled"}, store=self.store
        )
        self.assertEqual(out["meeting"]["state"], "canceled")

    def test_string_payload_accepted(self) -> None:
        out = meeting_skill.meeting_ingest_booking(SAMPLE_BOOKING.read_text(), store=self.store)
        self.assertEqual(out["meeting"]["title"], "Cognitia Intro Call (30 min)")


class TranscriptIngestionTests(_StoreTestCase):
    def test_attach_transcript_advances_state(self) -> None:
        mid = self._ingest()
        out = meeting_skill.meeting_ingest_transcript(
            mid, transcript_text="hello world transcript", store=self.store
        )
        self.assertEqual(out["state"], "transcribed")
        self.assertIn("hello world", out["transcript_text"])

    def test_transcript_from_path(self) -> None:
        mid = self._ingest()
        out = meeting_skill.meeting_ingest_transcript(
            mid, transcript_path=str(SAMPLE_TRANSCRIPT), store=self.store
        )
        self.assertEqual(out["state"], "transcribed")
        self.assertTrue(out["transcript_text"])

    def test_empty_transcript_rejected(self) -> None:
        mid = self._ingest()
        with self.assertRaises(ValueError):
            meeting_skill.meeting_ingest_transcript(mid, transcript_text="   ", store=self.store)

    def test_unknown_meeting_rejected(self) -> None:
        with self.assertRaises(ValueError):
            meeting_skill.meeting_ingest_transcript("mtg_nope", transcript_text="x", store=self.store)


class SummarizeOfflineTests(_StoreTestCase):
    def test_summary_and_action_items_offline(self) -> None:
        mid = self._ingest()
        meeting_skill.meeting_ingest_transcript(
            mid, transcript_text=SAMPLE_TRANSCRIPT.read_text(), store=self.store
        )
        out = meeting_skill.meeting_summarize(mid, store=self.store)
        self.assertEqual(out["provider"], "offline")
        self.assertEqual(out["state"], "summarized")
        self.assertTrue(out["summary"].strip())
        self.assertTrue(len(out["action_items"]) >= 2, msg=out["action_items"])
        for a in out["action_items"]:
            for k in ("id", "text", "owner", "due", "status", "source", "confidence"):
                self.assertIn(k, a)

    def test_action_item_heuristic_extracts_owner_and_due(self) -> None:
        items = meeting_skill._offline_action_items(
            "Alice: I'll send the deck by Friday.\n@bob will follow up next week.\nrandom chatter."
        )
        texts = [i.text.lower() for i in items]
        self.assertTrue(any("send the deck" in t for t in texts))
        self.assertTrue(any(i.due for i in items))
        self.assertTrue(any(i.owner == "bob" for i in items))

    def test_summarize_emits_sync_event(self) -> None:
        mid = self._through_summary()
        events = self.store.events_for(mid)
        self.assertTrue(any(e["kind"] == "meeting.summarized" for e in events))

    def test_summarize_requires_transcript(self) -> None:
        mid = self._ingest()
        with self.assertRaises(ValueError):
            meeting_skill.meeting_summarize(mid, store=self.store)


class FollowupDraftTests(_StoreTestCase):
    def test_draft_references_action_items(self) -> None:
        mid = self._through_summary()
        out = meeting_skill.meeting_draft_followup(mid, store=self.store)
        draft = out["follow_up_draft"]
        self.assertTrue(draft.strip())
        self.assertIn("Action items:", draft)
        self.assertIn("Subject:", draft)

    def test_draft_requires_summary(self) -> None:
        mid = self._ingest()
        meeting_skill.meeting_ingest_transcript(mid, transcript_text="hi", store=self.store)
        with self.assertRaises(ValueError):
            meeting_skill.meeting_draft_followup(mid, store=self.store)


class WritebackReviewTests(_StoreTestCase):
    def test_build_writeback_is_pending_not_applied(self) -> None:
        mid = self._through_summary()
        out = meeting_skill.meeting_build_writeback(mid, store=self.store)
        self.assertEqual(out["state"], "review_ready")
        self.assertEqual(out["sync_state"], "preview_pending")
        self.assertEqual(out["writeback"]["review_status"], "pending_review")
        # human gate: never applied/synced by the skill
        self.assertNotEqual(out["sync_state"], "applied")
        self.assertNotEqual(out["state"], "synced")

    def test_approve_emits_approved_envelope(self) -> None:
        mid = self._through_summary()
        meeting_skill.meeting_build_writeback(mid, store=self.store)
        out = meeting_skill.meeting_review_writeback(mid, "approve", "jane-ops", store=self.store)
        self.assertEqual(out["state"], "writeback_approved")
        self.assertEqual(out["sync_state"], "approved")
        self.assertEqual(out["writeback"]["review_status"], "approved")
        self.assertEqual(out["writeback"]["reviewer"], "jane-ops")
        # skill must NOT auto-apply to CRM
        self.assertNotEqual(out["state"], "synced")
        events = self.store.events_for(mid)
        approved = [e for e in events if e["kind"] == "writeback.approved"]
        self.assertEqual(len(approved), 1)
        self.assertEqual(approved[0]["status"], "ready_to_apply")

    def test_reject_marks_rejected(self) -> None:
        mid = self._through_summary()
        meeting_skill.meeting_build_writeback(mid, store=self.store)
        out = meeting_skill.meeting_review_writeback(mid, "reject", store=self.store)
        self.assertEqual(out["sync_state"], "rejected")
        self.assertEqual(out["writeback"]["review_status"], "rejected")

    def test_bad_decision_rejected(self) -> None:
        mid = self._through_summary()
        meeting_skill.meeting_build_writeback(mid, store=self.store)
        with self.assertRaises(ValueError):
            meeting_skill.meeting_review_writeback(mid, "maybe", store=self.store)

    def test_review_requires_preview(self) -> None:
        mid = self._through_summary()
        with self.assertRaises(ValueError):
            meeting_skill.meeting_review_writeback(mid, "approve", store=self.store)


class ListGetSearchTests(_StoreTestCase):
    def test_list_filter_and_search(self) -> None:
        mid = self._through_summary()
        # state filter
        listed = meeting_skill.meeting_list(state="summarized", store=self.store)
        self.assertEqual(listed["count"], 1)
        # contact filter
        listed = meeting_skill.meeting_list(contact_id="contact_acme_jane", store=self.store)
        self.assertEqual(listed["count"], 1)
        # full-text search across summary/action items
        listed = meeting_skill.meeting_list(query="sandbox", store=self.store)
        self.assertEqual(listed["count"], 1)
        # negative search
        listed = meeting_skill.meeting_list(query="zzz-not-present", store=self.store)
        self.assertEqual(listed["count"], 0)
        # row shape
        row = listed = meeting_skill.meeting_list(store=self.store)["meetings"][0]
        for k in ("id", "title", "state", "sync_state", "action_item_count", "summary_excerpt"):
            self.assertIn(k, row)
        _ = mid

    def test_get_returns_meeting_booking_events(self) -> None:
        mid = self._through_summary()
        out = meeting_skill.meeting_get(mid, store=self.store)
        self.assertEqual(out["meeting"]["id"], mid)
        self.assertIsNotNone(out["booking"])
        self.assertTrue(any(e["kind"] == "meeting.summarized" for e in out["events"]))


class PersistenceTests(_StoreTestCase):
    def test_store_round_trips_from_disk(self) -> None:
        mid = self._through_summary()
        # reload a fresh store from the same path
        reloaded = meeting_skill.MeetingStore(self.store.path)
        got = reloaded.get_meeting(mid)
        self.assertIsNotNone(got)
        self.assertEqual(got["state"], "summarized")
        self.assertTrue(got["summary"])


if __name__ == "__main__":
    unittest.main(verbosity=2)
