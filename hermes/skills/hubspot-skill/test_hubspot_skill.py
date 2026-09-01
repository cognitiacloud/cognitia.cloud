#!/usr/bin/env python3
"""Unit tests for the Hermes HubSpot skill.

Runs fully offline with ZERO credentials. The only network seam,
``hubspot_skill._http_call``, is patched to feed canned HTTP responses, so
the real auth/retry/operation code paths execute without touching HubSpot.
"""

from __future__ import annotations

import json
import os
import sys
import tempfile
import unittest
import urllib.request
from pathlib import Path
from unittest import mock

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))

import hubspot_skill as hs  # noqa: E402


HUBSPOT_ENV_KEYS = [
    "HUBSPOT_AUTH_MODE", "HUBSPOT_ACCESS_TOKEN", "HUBSPOT_CLIENT_ID",
    "HUBSPOT_CLIENT_SECRET", "HUBSPOT_REFRESH_TOKEN", "HUBSPOT_BASE_URL",
    "HUBSPOT_AUDIT_LOG", "HUBSPOT_MAX_RETRIES", "HUBSPOT_ALLOW_SIMULATION",
    "HUBSPOT_TIMEOUT",
    "LIVE_OUTBOUND_EXPLICITLY_ALLOWED", "LIVE_OUTBOUND_HUBSPOT_SKILL",
    "LIVE_OUTBOUND_HUBSPOT", "LIVE_OUTBOUND_HUBSPOT_READ",
    "LIVE_OUTBOUND_HUBSPOT_OAUTH_REFRESH",
]


def _allow_hubspot_skill() -> None:
    """Opt-in for protocol tests that patch _http_call. Committed flags stay false."""
    os.environ["LIVE_OUTBOUND_EXPLICITLY_ALLOWED"] = "true"
    os.environ["LIVE_OUTBOUND_HUBSPOT_SKILL"] = "true"


def _clear_env() -> dict[str, str]:
    saved = {k: os.environ.pop(k) for k in HUBSPOT_ENV_KEYS if k in os.environ}
    return saved


def _resp(status: int, body: dict | None = None, headers: dict | None = None):
    return (status, json.dumps(body or {}), headers or {})


class BaseEnvTest(unittest.TestCase):
    def setUp(self) -> None:
        self._saved = _clear_env()
        # Keep tests fast: no real backoff sleeps.
        self._sleep_patch = mock.patch("hubspot_skill.time.sleep", lambda *_: None)
        self._sleep_patch.start()

    def tearDown(self) -> None:
        self._sleep_patch.stop()
        for k in HUBSPOT_ENV_KEYS:
            os.environ.pop(k, None)
        os.environ.update(self._saved)


class AuthSelectionTests(BaseEnvTest):
    def test_no_creds_is_seam(self) -> None:
        self.assertIsNone(hs.select_auth())

    def test_private_app_autodetected(self) -> None:
        os.environ["HUBSPOT_ACCESS_TOKEN"] = "pat-na1-TESTONLY-abcdefghijklmnop"
        auth = hs.select_auth()
        self.assertIsInstance(auth, hs.PrivateAppAuth)
        self.assertEqual(auth.mode, "private_app")
        self.assertEqual(auth.bearer_token(), "pat-na1-TESTONLY-abcdefghijklmnop")

    def test_oauth_autodetected(self) -> None:
        os.environ.update({
            "HUBSPOT_CLIENT_ID": "cid-123",
            "HUBSPOT_CLIENT_SECRET": "csecret-456",
            "HUBSPOT_REFRESH_TOKEN": "refresh-789",
        })
        auth = hs.select_auth()
        self.assertIsInstance(auth, hs.OAuthAuth)
        self.assertEqual(auth.mode, "oauth")

    def test_explicit_override_private_app_without_token_is_seam(self) -> None:
        os.environ["HUBSPOT_AUTH_MODE"] = "private_app"
        self.assertIsNone(hs.select_auth())

    def test_oauth_refresh_mints_and_caches_token(self) -> None:
        _allow_hubspot_skill()
        os.environ.update({
            "HUBSPOT_CLIENT_ID": "cid-123",
            "HUBSPOT_CLIENT_SECRET": "csecret-456",
            "HUBSPOT_REFRESH_TOKEN": "refresh-789",
        })
        auth = hs.select_auth()
        with mock.patch("hubspot_skill._http_call") as m:
            m.return_value = _resp(200, {"access_token": "CL-minted-access-token-xyz",
                                         "expires_in": 1800})
            self.assertEqual(auth.bearer_token(), "CL-minted-access-token-xyz")
            # Second call uses the cache (no second refresh call).
            self.assertEqual(auth.bearer_token(), "CL-minted-access-token-xyz")
            self.assertEqual(m.call_count, 1)


class RedactionTests(BaseEnvTest):
    def test_redacts_registered_token(self) -> None:
        os.environ["HUBSPOT_ACCESS_TOKEN"] = "pat-na1-SECRET-zzzzzzzzzzzzzzzz"
        hs.select_auth()  # registers the secret
        red = hs._redact("authorization Bearer pat-na1-SECRET-zzzzzzzzzzzzzzzz done")
        self.assertNotIn("SECRET-zzzz", red)
        self.assertIn("[TOKEN_REDACTED]", red)

    def test_redacts_email(self) -> None:
        self.assertNotIn("jane@example.com", hs._redact("hello jane@example.com"))

    def test_mask_never_reveals_full(self) -> None:
        masked = hs._mask("pat-na1-SECRET-zzzzzzzzzzzzzzzz")
        self.assertNotIn("SECRET", masked)
        self.assertIn("len=", masked)

    def test_logger_has_redacting_filter_at_import(self) -> None:
        # Guarantees redaction even when imported as a library (e.g. MCP server)
        # without calling _configure_logging().
        self.assertTrue(any(isinstance(f, hs._RedactingFilter) for f in hs.LOG.filters))


class HealthSeamTests(BaseEnvTest):
    def test_unconfigured_when_no_creds(self) -> None:
        with mock.patch("hubspot_skill._http_call") as m:
            out = hs.health_check()
            m.assert_not_called()  # fail-closed: no network in seam mode
        self.assertEqual(out["status"], "unconfigured")
        self.assertEqual(out["mode"], "seam")
        self.assertFalse(out["checks"][0]["ok"])

    def test_schema_keys_stable(self) -> None:
        out = hs.health_check()
        for key in ("integration", "status", "mode", "base_url", "auth",
                    "checks", "portal", "last_error", "checked_at"):
            self.assertIn(key, out)


class HealthLiveTests(BaseEnvTest):
    def setUp(self) -> None:
        super().setUp()
        _allow_hubspot_skill()
        os.environ["HUBSPOT_ACCESS_TOKEN"] = "pat-na1-TESTONLY-abcdefghijklmnop"

    def test_ok_when_all_checks_pass(self) -> None:
        with mock.patch("hubspot_skill._http_call") as m:
            m.side_effect = [
                _resp(200, {"results": []}),
                _resp(200, {"portalId": 343344751, "accountType": "STANDARD",
                            "uiDomain": "app-na3.hubspot.com"}),
            ]
            out = hs.health_check()
        self.assertEqual(out["status"], "ok")
        self.assertEqual(out["mode"], "live")
        self.assertEqual(out["portal"]["portal_id"], 343344751)

    def test_down_when_auth_fails(self) -> None:
        with mock.patch("hubspot_skill._http_call") as m:
            m.side_effect = [
                _resp(401, {"message": "invalid token"}),
                _resp(401, {"message": "invalid token"}),
            ]
            out = hs.health_check()
        self.assertEqual(out["status"], "down")
        self.assertIsNotNone(out["last_error"])

    def test_degraded_when_partial(self) -> None:
        with mock.patch("hubspot_skill._http_call") as m:
            m.side_effect = [
                _resp(200, {"results": []}),
                _resp(500, {"message": "boom"}),
                _resp(500, {"message": "boom"}),
                _resp(500, {"message": "boom"}),
                _resp(500, {"message": "boom"}),
            ]
            out = hs.health_check()
        self.assertEqual(out["status"], "degraded")


class ContactLookupTests(BaseEnvTest):
    def test_seam_fail_closed_no_fabrication(self) -> None:
        out = hs.contact_lookup(email="x@y.com")
        self.assertEqual(out["state"], "blocked")
        self.assertEqual(out["mode"], "seam")
        self.assertFalse(out["simulated"])
        self.assertIsNone(out["target_id"])  # no fake contact

    def test_simulation_is_labelled(self) -> None:
        os.environ["HUBSPOT_ALLOW_SIMULATION"] = "1"
        out = hs.contact_lookup(email="x@y.com")
        self.assertEqual(out["state"], "simulated")
        self.assertTrue(out["simulated"])
        self.assertTrue(out["details"]["simulated"])
        self.assertEqual(out["details"]["source"], "seam")

    def test_live_success(self) -> None:
        _allow_hubspot_skill()
        os.environ["HUBSPOT_ACCESS_TOKEN"] = "pat-na1-TESTONLY-abcdefghijklmnop"
        with mock.patch("hubspot_skill._http_call") as m:
            m.return_value = _resp(200, {"results": [
                {"id": "1001", "properties": {"email": "x@y.com", "firstname": "X"}}
            ]})
            out = hs.contact_lookup(email="x@y.com")
        self.assertEqual(out["state"], "success")
        self.assertEqual(out["target_id"], "1001")
        self.assertTrue(out["details"]["found"])

    def test_live_not_found_is_skipped(self) -> None:
        _allow_hubspot_skill()
        os.environ["HUBSPOT_ACCESS_TOKEN"] = "pat-na1-TESTONLY-abcdefghijklmnop"
        with mock.patch("hubspot_skill._http_call") as m:
            m.return_value = _resp(200, {"results": []})
            out = hs.contact_lookup(email="missing@y.com")
        self.assertEqual(out["state"], "skipped")
        self.assertFalse(out["details"]["found"])


class RetryTests(BaseEnvTest):
    def setUp(self) -> None:
        super().setUp()
        _allow_hubspot_skill()
        os.environ["HUBSPOT_ACCESS_TOKEN"] = "pat-na1-TESTONLY-abcdefghijklmnop"

    def test_429_then_success_retries(self) -> None:
        os.environ["HUBSPOT_MAX_RETRIES"] = "3"
        with mock.patch("hubspot_skill._http_call") as m:
            m.side_effect = [
                _resp(429, {"message": "rate"}, {"Retry-After": "0"}),
                _resp(200, {"results": [{"id": "42", "properties": {}}]}),
            ]
            out = hs.contact_lookup(email="x@y.com")
        self.assertEqual(out["state"], "success")
        self.assertEqual(out["attempts"], 2)

    def test_401_not_retried(self) -> None:
        with mock.patch("hubspot_skill._http_call") as m:
            m.return_value = _resp(401, {"message": "bad token"})
            out = hs.contact_lookup(email="x@y.com")
        self.assertEqual(out["state"], "failed")
        self.assertEqual(out["error_category"], "auth")
        self.assertEqual(m.call_count, 1)  # auth errors are not retried

    def test_5xx_exhausts_retries(self) -> None:
        os.environ["HUBSPOT_MAX_RETRIES"] = "2"
        with mock.patch("hubspot_skill._http_call") as m:
            m.return_value = _resp(503, {"message": "unavailable"})
            out = hs.contact_lookup(email="x@y.com")
        self.assertEqual(out["state"], "failed")
        self.assertEqual(out["error_category"], "server")
        self.assertEqual(m.call_count, 3)  # 1 initial + 2 retries

    def test_network_error_retried_then_fails(self) -> None:
        os.environ["HUBSPOT_MAX_RETRIES"] = "1"
        with mock.patch("hubspot_skill._http_call") as m:
            m.side_effect = OSError("connection reset")
            out = hs.contact_lookup(email="x@y.com")
        self.assertEqual(out["state"], "failed")
        self.assertEqual(out["error_category"], "network")
        self.assertEqual(m.call_count, 2)  # 1 initial + 1 retry


class WritebackTests(BaseEnvTest):
    def setUp(self) -> None:
        super().setUp()
        _allow_hubspot_skill()
        os.environ["HUBSPOT_ACCESS_TOKEN"] = "pat-na1-TESTONLY-abcdefghijklmnop"

    def test_note_success(self) -> None:
        with mock.patch("hubspot_skill._http_call") as m:
            m.return_value = _resp(201, {"id": "note-9001"})
            out = hs.activity_writeback("1001", "note", subject="hi", body="logged from Cognitia")
        self.assertEqual(out["state"], "success")
        self.assertEqual(out["target_id"], "note-9001")
        self.assertEqual(out["details"]["writeback_type"], "note")

    def test_task_success(self) -> None:
        with mock.patch("hubspot_skill._http_call") as m:
            m.return_value = _resp(201, {"id": "task-7001"})
            out = hs.activity_writeback("1001", "task", subject="follow up")
        self.assertEqual(out["state"], "success")
        self.assertEqual(out["target_id"], "task-7001")

    def test_invalid_type_rejected(self) -> None:
        out = hs.activity_writeback("1001", "carrier-pigeon")
        self.assertEqual(out["state"], "failed")
        self.assertEqual(out["error_category"], "validation")

    def test_seam_fail_closed(self) -> None:
        os.environ.pop("HUBSPOT_ACCESS_TOKEN")
        out = hs.activity_writeback("1001", "note", body="x")
        self.assertEqual(out["state"], "blocked")
        self.assertIsNone(out["target_id"])


class AssociateTests(BaseEnvTest):
    def test_live_success_uses_default_endpoint(self) -> None:
        _allow_hubspot_skill()
        os.environ["HUBSPOT_ACCESS_TOKEN"] = "pat-na1-TESTONLY-abcdefghijklmnop"
        with mock.patch("hubspot_skill._http_call") as m:
            m.return_value = _resp(200, {"status": "COMPLETE"})
            out = hs.contact_associate("1001", "companies", "2002")
            req = m.call_args.args[0]
            self.assertIn("/associations/default/companies/2002", req.full_url)
            self.assertEqual(req.method, "PUT")
        self.assertEqual(out["state"], "success")
        self.assertEqual(out["target_id"], "1001")

    def test_labeled_association_uses_typed_endpoint(self) -> None:
        _allow_hubspot_skill()
        os.environ["HUBSPOT_ACCESS_TOKEN"] = "pat-na1-TESTONLY-abcdefghijklmnop"
        with mock.patch("hubspot_skill._http_call") as m:
            m.return_value = _resp(200, {"status": "COMPLETE"})
            hs.contact_associate("1001", "companies", "2002", association_type_id=1)
            req = m.call_args.args[0]
            self.assertIn("/associations/companies/2002", req.full_url)
            self.assertNotIn("/default/", req.full_url)

    def test_seam_fail_closed(self) -> None:
        out = hs.contact_associate("1001", "companies", "2002")
        self.assertEqual(out["state"], "blocked")


class AuditTests(BaseEnvTest):
    def test_audit_line_written_and_token_free(self) -> None:
        with tempfile.TemporaryDirectory() as d:
            audit_path = Path(d) / "audit.jsonl"
            os.environ["HUBSPOT_AUDIT_LOG"] = str(audit_path)
            _allow_hubspot_skill()
            os.environ["HUBSPOT_ACCESS_TOKEN"] = "pat-na1-SECRET-zzzzzzzzzzzzzzzz"
            with mock.patch("hubspot_skill._http_call") as m:
                m.return_value = _resp(201, {"id": "note-1"})
                hs.activity_writeback("1001", "note", body="hi")
            lines = audit_path.read_text().strip().splitlines()
            self.assertTrue(lines)
            blob = "\n".join(lines)
            self.assertNotIn("SECRET-zzzz", blob)
            entry = json.loads(lines[-1])
            self.assertEqual(entry["operation"], "activity_writeback:note")
            self.assertEqual(entry["state"], "success")


class ContractSchemaTests(BaseEnvTest):
    def test_syncresult_to_dict_keys(self) -> None:
        r = hs.SyncResult(operation="x", state="success", mode="live")
        for key in ("operation", "state", "mode", "attempts", "target_id",
                    "request_id", "http_status", "error", "error_category",
                    "simulated", "details", "started_at", "finished_at", "duration_ms"):
            self.assertIn(key, r.to_dict())

    def test_auth_status_masks(self) -> None:
        os.environ["HUBSPOT_ACCESS_TOKEN"] = "pat-na1-SECRET-zzzzzzzzzzzzzzzz"
        out = hs.auth_status()
        self.assertTrue(out["configured"])
        self.assertNotIn("SECRET", json.dumps(out))



class Cgd003LiveSurfaceTests(BaseEnvTest):
    """CGD-003: remaining HubSpot HTTP fail-closes LIVE_SURFACE_DENIED before network."""

    def _exploding_http(self):
        return mock.patch(
            "hubspot_skill._http_call",
            side_effect=AssertionError("CGD-003 packet failed: network was used"),
        )

    def test_lookup_denied_before_http_with_secret_and_flags_off(self) -> None:
        os.environ["HUBSPOT_ACCESS_TOKEN"] = "pat-na1-TESTONLY-abcdefghijklmnop"
        with self._exploding_http() as m:
            out = hs.contact_lookup(email="x@y.com")
            m.assert_not_called()
        self.assertEqual(out["state"], "blocked")
        self.assertEqual(out["error_category"], hs.LIVE_SURFACE_DENIED)
        self.assertIn(hs.LIVE_SURFACE_DENIED, out["error"])
        self.assertFalse(out["details"]["outbound"])
        self.assertFalse(out["details"]["inboundVendor"])
        self.assertEqual(out["details"]["surface"], "hubspotSkill")

    def test_writeback_denied_before_http(self) -> None:
        os.environ["HUBSPOT_ACCESS_TOKEN"] = "pat-na1-TESTONLY-abcdefghijklmnop"
        with self._exploding_http() as m:
            out = hs.activity_writeback("1001", "note", body="x")
            m.assert_not_called()
        self.assertEqual(out["error_category"], hs.LIVE_SURFACE_DENIED)

    def test_associate_denied_before_http(self) -> None:
        os.environ["HUBSPOT_ACCESS_TOKEN"] = "pat-na1-TESTONLY-abcdefghijklmnop"
        with self._exploding_http() as m:
            out = hs.contact_associate("1001", "companies", "2002")
            m.assert_not_called()
        self.assertEqual(out["error_category"], hs.LIVE_SURFACE_DENIED)

    def test_health_denied_before_http(self) -> None:
        os.environ["HUBSPOT_ACCESS_TOKEN"] = "pat-na1-TESTONLY-abcdefghijklmnop"
        with self._exploding_http() as m:
            out = hs.health_check()
            m.assert_not_called()
        self.assertEqual(out["status"], "down")
        self.assertEqual(out["mode"], "seam")
        self.assertIn(hs.LIVE_SURFACE_DENIED, out["last_error"])
        self.assertEqual(out["checks"][0]["detail"], hs.LIVE_SURFACE_DENIED)

    def test_oauth_refresh_denied_before_http(self) -> None:
        os.environ.update({
            "HUBSPOT_CLIENT_ID": "cid-123",
            "HUBSPOT_CLIENT_SECRET": "csecret-456",
            "HUBSPOT_REFRESH_TOKEN": "refresh-789",
        })
        auth = hs.select_auth()
        with self._exploding_http() as m:
            with self.assertRaises(hs.LiveSurfaceDeniedError) as ctx:
                auth.bearer_token()
            m.assert_not_called()
        self.assertEqual(ctx.exception.code, hs.LIVE_SURFACE_DENIED)
        self.assertEqual(ctx.exception.surface, "hubspotSkill")
        self.assertFalse(ctx.exception.outbound)
        self.assertFalse(ctx.exception.inbound_vendor)

    def test_http_call_denied_before_urlopen(self) -> None:
        req = urllib.request.Request("https://api.hubapi.com/crm/v3/objects/contacts")
        with mock.patch("hubspot_skill.urllib.request.urlopen") as u:
            u.side_effect = AssertionError("CGD-003 packet failed: network was used")
            with self.assertRaises(hs.LiveSurfaceDeniedError):
                hs._http_call(req, 1)
            u.assert_not_called()

    def test_master_only_still_denied(self) -> None:
        os.environ["LIVE_OUTBOUND_EXPLICITLY_ALLOWED"] = "true"
        os.environ["HUBSPOT_ACCESS_TOKEN"] = "pat-na1-TESTONLY-abcdefghijklmnop"
        with self._exploding_http() as m:
            out = hs.contact_lookup(email="x@y.com")
            m.assert_not_called()
        self.assertEqual(out["error_category"], hs.LIVE_SURFACE_DENIED)

    def test_write_flag_does_not_authorize_skill(self) -> None:
        os.environ["LIVE_OUTBOUND_EXPLICITLY_ALLOWED"] = "true"
        os.environ["LIVE_OUTBOUND_HUBSPOT"] = "true"
        os.environ["LIVE_OUTBOUND_HUBSPOT_READ"] = "true"
        os.environ["HUBSPOT_ACCESS_TOKEN"] = "pat-na1-TESTONLY-abcdefghijklmnop"
        with self._exploding_http() as m:
            out = hs.contact_lookup(email="x@y.com")
            m.assert_not_called()
        self.assertEqual(out["error_category"], hs.LIVE_SURFACE_DENIED)

    def test_seam_without_creds_stays_ungated_blocked(self) -> None:
        with self._exploding_http() as m:
            out = hs.contact_lookup(email="x@y.com")
            m.assert_not_called()
        self.assertEqual(out["state"], "blocked")
        self.assertEqual(out["error_category"], "config")

    def test_simulation_stays_ungated(self) -> None:
        os.environ["HUBSPOT_ALLOW_SIMULATION"] = "1"
        with self._exploding_http() as m:
            out = hs.contact_lookup(email="x@y.com")
            m.assert_not_called()
        self.assertEqual(out["state"], "simulated")

if __name__ == "__main__":
    unittest.main(verbosity=2)
