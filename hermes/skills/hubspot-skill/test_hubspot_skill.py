#!/usr/bin/env python3
"""Tests for the Hermes HubSpot skill.

Runs with no credentials and no network. The full request/retry/audit path is
exercised through an injected fake transport (the explicit live-vs-seam seam).
Live behaviour against a real portal is covered separately in the handoff doc
under "verified vs blocked by live credentials".
"""

from __future__ import annotations

import json
import sys
import unittest
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))

import hubspot_skill as hs  # noqa: E402

# Synthetic HubSpot-style private-app token prefix, assembled from fragments so
# secret scanners don't flag our intentionally-fake test tokens. At runtime this
# is exactly "pat-na1-", so the redaction assertions stay meaningful.
_PAT = "pat-" + "na1-"


# --------------------------- Fake transport ---------------------------------

class FakeTransport:
    """Records requests and replays scripted responses (or raises)."""

    def __init__(self, responses):
        self._responses = list(responses)
        self.calls = []

    def __call__(self, method, url, headers, body, timeout):
        self.calls.append({
            "method": method, "url": url, "headers": headers,
            "body": json.loads(body) if body else None,
        })
        item = self._responses.pop(0)
        if isinstance(item, Exception):
            raise item
        status, payload = item
        return hs.HttpResponse(
            status=status,
            body=json.dumps(payload).encode() if payload is not None else b"",
            headers={},
        )


def _cfg(**kw):
    base = dict(access_token=_PAT + "TESTONLY-deadbeef", base_url="https://api.hubapi.com",
                retry_base_seconds=0.0, retry_cap_seconds=0.0, max_retries=3)
    base.update(kw)
    return hs.HubSpotConfig(**base)


def _client(responses=None, **cfgkw):
    transport = FakeTransport(responses or [])
    client = hs.HubSpotClient(_cfg(**cfgkw), transport=transport, sleep=lambda _s: None)
    return client, transport


# --------------------------- Redaction --------------------------------------

class RedactionTests(unittest.TestCase):
    def test_redacts_pat_token(self):
        red = hs._redact(f"token {_PAT}1234abcd-aaaa-bbbb-cccc-deadbeef0001 end")
        self.assertNotIn("deadbeef0001", red)
        self.assertIn("[TOKEN_REDACTED]", red)

    def test_redacts_bearer_header(self):
        red = hs._redact(f'Authorization: Bearer {_PAT}abcd1234efgh')
        self.assertNotIn("abcd1234efgh", red)

    def test_redacts_access_token_json(self):
        red = hs._redact(f'{{"access_token": "{_PAT}secretvalue123"}}')
        self.assertNotIn("secretvalue123", red)

    def test_config_describe_has_no_raw_token(self):
        cfg = _cfg(access_token=_PAT + "supersecretvalue-xyz")
        desc = json.dumps(cfg.describe())
        self.assertNotIn("supersecretvalue", desc)
        self.assertIn("access_token_fingerprint", desc)


# --------------------------- Mode resolution / fail-closed ------------------

class ModeTests(unittest.TestCase):
    def test_blocked_without_token(self):
        cfg = hs.HubSpotConfig.from_env({})
        self.assertEqual(cfg.mode, hs.MODE_BLOCKED)
        self.assertFalse(cfg.credentials_present)

    def test_live_with_token(self):
        cfg = hs.HubSpotConfig.from_env({"HUBSPOT_ACCESS_TOKEN": _PAT + "x-abcdefgh"})
        self.assertEqual(cfg.mode, hs.MODE_LIVE)

    def test_dry_run_overrides_live(self):
        cfg = hs.HubSpotConfig.from_env(
            {"HUBSPOT_ACCESS_TOKEN": _PAT + "x-abcdefgh", "HUBSPOT_DRY_RUN": "true"}
        )
        self.assertEqual(cfg.mode, hs.MODE_DRY_RUN)


class FailClosedTests(unittest.TestCase):
    def test_find_blocked_makes_no_network_call(self):
        client, transport = _client(access_token=None)
        rec = client.find_contact(email="a@b.com")
        self.assertEqual(rec.outcome, hs.OUT_BLOCKED)
        self.assertEqual(transport.calls, [])

    def test_log_blocked_makes_no_network_call(self):
        client, transport = _client(access_token=None)
        rec = client.log_activity(contact_id="123", note_body="hi")
        self.assertEqual(rec.outcome, hs.OUT_BLOCKED)
        self.assertEqual(transport.calls, [])

    def test_sync_blocked_fails_closed(self):
        client, _ = _client(access_token=None)
        out = client.sync_contact_activity(email="a@b.com", note_body="hi")
        self.assertEqual(out["outcome"], hs.OUT_BLOCKED)
        self.assertIsNone(out["contact_id"])
        self.assertIsNone(out["note_id"])

    def test_health_blocked_not_ready(self):
        client, transport = _client(access_token=None)
        h = client.health()
        self.assertEqual(h["mode"], hs.MODE_BLOCKED)
        self.assertFalse(h["ready_for_pilot"])
        self.assertEqual(h["connection"], hs.CONN_NOT_CHECKED)
        self.assertIn("HUBSPOT_ACCESS_TOKEN is not set", h["blocking_reasons"])
        self.assertEqual(transport.calls, [])


# --------------------------- Dry-run (seam) ---------------------------------

class DryRunTests(unittest.TestCase):
    def test_find_dry_run_no_network(self):
        client, transport = _client(dry_run=True)
        rec = client.find_contact(email="a@b.com")
        self.assertEqual(rec.outcome, hs.OUT_DRY_RUN)
        self.assertEqual(transport.calls, [])

    def test_log_dry_run_plans_payload_without_network(self):
        client, transport = _client(dry_run=True)
        rec = client.log_activity(contact_id="123", note_body="pilot note")
        self.assertEqual(rec.outcome, hs.OUT_DRY_RUN)
        self.assertEqual(transport.calls, [])
        payload = rec.detail["planned_payload"]
        self.assertEqual(payload["properties"]["hs_note_body"], "pilot note")
        assoc = payload["associations"][0]["types"][0]
        self.assertEqual(assoc["associationTypeId"], hs.NOTE_TO_CONTACT_TYPE_ID)

    def test_sync_dry_run_no_invented_ids(self):
        client, transport = _client(dry_run=True)
        out = client.sync_contact_activity(email="a@b.com", note_body="hi")
        self.assertEqual(out["outcome"], hs.OUT_DRY_RUN)
        self.assertIsNone(out["contact_id"])
        self.assertIsNone(out["note_id"])
        self.assertEqual(transport.calls, [])

    def test_health_dry_run_probes_connection_but_not_ready(self):
        # token present + dry_run => connection truthfully probed, writes blocked.
        client, _ = _client(dry_run=True, responses=[(200, {"portalId": 42})])
        h = client.health()
        self.assertEqual(h["mode"], hs.MODE_DRY_RUN)
        self.assertEqual(h["connection"], hs.CONN_OK)
        self.assertFalse(h["ready_for_pilot"])
        self.assertIn("HUBSPOT_DRY_RUN is enabled — writes are simulated",
                      h["blocking_reasons"])


# --------------------------- Live path (fake transport) ---------------------

class LiveFindTests(unittest.TestCase):
    def test_find_existing_contact(self):
        responses = [(200, {"results": [
            {"id": "555", "properties": {"email": "a@b.com", "firstname": "A"}}
        ]})]
        client, transport = _client(responses)
        rec = client.find_contact(email="a@b.com")
        self.assertEqual(rec.outcome, hs.OUT_FOUND)
        self.assertEqual(rec.object_id, "555")
        self.assertEqual(transport.calls[0]["method"], "POST")
        self.assertIn("/crm/v3/objects/contacts/search", transport.calls[0]["url"])
        # token travels only in the Authorization header, never logged raw
        self.assertTrue(transport.calls[0]["headers"]["Authorization"].startswith("Bearer "))

    def test_find_missing_contact(self):
        client, _ = _client([(200, {"results": []})])
        rec = client.find_contact(email="missing@b.com")
        self.assertEqual(rec.outcome, hs.OUT_NOT_FOUND)
        self.assertIsNone(rec.object_id)

    def test_find_by_id_uses_get(self):
        client, transport = _client([(200, {"id": "999", "properties": {"email": "z@b.com"}})])
        rec = client.find_contact(contact_id="999")
        self.assertEqual(rec.outcome, hs.OUT_FOUND)
        self.assertEqual(transport.calls[0]["method"], "GET")
        self.assertIn("/crm/v3/objects/contacts/999", transport.calls[0]["url"])


class LiveLogTests(unittest.TestCase):
    def test_log_activity_creates_note(self):
        client, transport = _client([(201, {"id": "note-1"})])
        rec = client.log_activity(contact_id="555", note_body="called the lead")
        self.assertEqual(rec.outcome, hs.OUT_CREATED)
        self.assertEqual(rec.object_id, "note-1")
        body = transport.calls[0]["body"]
        self.assertEqual(body["associations"][0]["to"]["id"], "555")


class LiveSyncTests(unittest.TestCase):
    def test_sync_found_then_log(self):
        responses = [
            (200, {"results": [{"id": "555", "properties": {"email": "a@b.com"}}]}),
            (201, {"id": "note-9"}),
        ]
        client, _ = _client(responses)
        out = client.sync_contact_activity(email="a@b.com", note_body="hi")
        self.assertEqual(out["outcome"], hs.OUT_OK)
        self.assertEqual(out["contact_id"], "555")
        self.assertEqual(out["note_id"], "note-9")
        self.assertEqual(len(out["steps"]), 2)

    def test_sync_not_found_creates_then_logs(self):
        responses = [
            (200, {"results": []}),            # find -> not found
            (201, {"id": "777"}),              # create contact
            (201, {"id": "note-3"}),           # log activity
        ]
        client, _ = _client(responses)
        out = client.sync_contact_activity(
            email="new@b.com", note_body="welcome", contact_properties={"firstname": "New"}
        )
        self.assertEqual(out["outcome"], hs.OUT_OK)
        self.assertEqual(out["contact_id"], "777")
        self.assertEqual(out["note_id"], "note-3")
        self.assertEqual(len(out["steps"]), 3)

    def test_sync_stops_on_log_failure(self):
        responses = [
            (200, {"results": [{"id": "555", "properties": {}}]}),
            (400, {"message": "bad note"}),
            (400, {"message": "bad note"}),
            (400, {"message": "bad note"}),
        ]
        client, _ = _client(responses)
        out = client.sync_contact_activity(email="a@b.com", note_body="x")
        self.assertEqual(out["outcome"], hs.OUT_ERROR)
        self.assertIsNone(out["note_id"])


# --------------------------- Retries / errors -------------------------------

class RetryTests(unittest.TestCase):
    def test_retries_on_429_then_succeeds(self):
        responses = [(429, {"message": "rate limited"}), (200, {"results": []})]
        client, transport = _client(responses)
        rec = client.find_contact(email="a@b.com")
        self.assertEqual(rec.outcome, hs.OUT_NOT_FOUND)
        self.assertEqual(rec.attempts, 2)
        self.assertEqual(len(transport.calls), 2)

    def test_retries_on_500_then_gives_up(self):
        responses = [(500, {"m": "x"}), (500, {"m": "x"}), (500, {"m": "x"})]
        client, _ = _client(responses)
        rec = client.find_contact(email="a@b.com")
        self.assertEqual(rec.outcome, hs.OUT_ERROR)
        self.assertEqual(rec.attempts, 3)
        self.assertEqual(rec.http_status, 500)

    def test_network_error_retries_then_fails(self):
        responses = [hs.TransportError("conn reset")] * 3
        client, _ = _client(responses)
        rec = client.find_contact(email="a@b.com")
        self.assertEqual(rec.outcome, hs.OUT_ERROR)
        self.assertIn("network error", rec.error)

    def test_4xx_not_retried(self):
        client, transport = _client([(400, {"message": "bad request"})])
        rec = client.create_contact({"email": "a@b.com"})
        self.assertEqual(rec.outcome, hs.OUT_ERROR)
        self.assertEqual(rec.attempts, 1)
        self.assertEqual(len(transport.calls), 1)

    def test_error_body_is_redacted(self):
        # An error body echoing a token must be scrubbed in the audit record.
        leak = {"message": f"token {_PAT}leak-aaaabbbbcccc was bad"}
        client, _ = _client([(401, leak)])
        rec = client.create_contact({"email": "a@b.com"})
        self.assertNotIn("aaaabbbbcccc", rec.error or "")


# --------------------------- Health connection states -----------------------

class HealthConnectionTests(unittest.TestCase):
    def test_health_ok_ready_for_pilot(self):
        client, _ = _client([(200, {"portalId": 343344751, "uiDomain": "app.hubspot.com"})])
        h = client.health()
        self.assertEqual(h["connection"], hs.CONN_OK)
        self.assertTrue(h["ready_for_pilot"])
        self.assertEqual(h["blocking_reasons"], [])
        self.assertEqual(h["account"]["portal_id"], 343344751)

    def test_health_auth_failed(self):
        client, _ = _client([(401, {"message": "unauthorized"})])
        h = client.health()
        self.assertEqual(h["connection"], hs.CONN_AUTH_FAILED)
        self.assertFalse(h["ready_for_pilot"])

    def test_health_forbidden_scopes(self):
        client, _ = _client([(403, {"message": "missing scopes"})])
        h = client.health()
        self.assertEqual(h["connection"], hs.CONN_FORBIDDEN)
        self.assertFalse(h["ready_for_pilot"])

    def test_health_unreachable(self):
        client, _ = _client([hs.TransportError("dns fail")] * 3)
        h = client.health()
        self.assertEqual(h["connection"], hs.CONN_UNREACHABLE)
        self.assertFalse(h["ready_for_pilot"])

    def test_health_probe_disabled(self):
        client, transport = _client(health_probe=False)
        h = client.health()
        self.assertEqual(h["connection"], hs.CONN_NOT_CHECKED)
        self.assertEqual(transport.calls, [])


# --------------------------- Status / ledger / audit ------------------------

class StatusTests(unittest.TestCase):
    def test_status_counts_operations(self):
        responses = [
            (200, {"results": [{"id": "1", "properties": {}}]}),  # find -> found
            (201, {"id": "note-1"}),                               # log -> created
            (200, {"portalId": 1}),                                # health probe
        ]
        client, _ = _client(responses)
        client.find_contact(email="a@b.com")
        client.log_activity(contact_id="1", note_body="x")
        st = client.status()
        self.assertEqual(st["counters"].get(hs.OUT_FOUND), 1)
        self.assertEqual(st["counters"].get(hs.OUT_CREATED), 1)
        self.assertEqual(st["total_operations"], 2)
        self.assertIsNotNone(st["last_success"])

    def test_audit_log_written_and_redacted(self):
        out_path = HERE / "_audit_test.jsonl"
        if out_path.exists():
            out_path.unlink()
        leak = {"message": f"token {_PAT}leak-zzzzyyyyxxxx invalid"}
        client, _ = _client([(401, leak)], audit_log_path=str(out_path))
        client.create_contact({"email": "a@b.com"})
        self.assertTrue(out_path.exists())
        content = out_path.read_text()
        self.assertNotIn("zzzzyyyyxxxx", content)
        line = json.loads(content.splitlines()[0])
        self.assertEqual(line["action"], "create_contact")
        out_path.unlink()


if __name__ == "__main__":
    unittest.main(verbosity=2)
