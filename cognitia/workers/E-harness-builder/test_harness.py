#!/usr/bin/env python3
"""Stdlib unittest suite for the Cognitia goal-loop harness MVP."""
import json
import os
import tempfile
import unittest

import harness_mvp as h


class LedgerTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.mkdtemp()
        self.path = os.path.join(self.tmp, "ledger.jsonl")

    def test_append_and_ordering(self):
        ledger = h.Ledger(self.path)
        ledger.append({"action": "a", "status": "OK"})
        ledger.append({"action": "b", "status": "OK"})
        ledger.append({"action": "c", "status": "OK"})
        rows = ledger.read_all()
        self.assertEqual([r["seq"] for r in rows], [1, 2, 3])
        self.assertEqual([r["action"] for r in rows], ["a", "b", "c"])

    def test_append_only_resumes_sequence(self):
        h.Ledger(self.path).append({"action": "a", "status": "OK"})
        # Re-open: new Ledger must continue, not overwrite.
        h.Ledger(self.path).append({"action": "b", "status": "OK"})
        rows = h.Ledger(self.path).read_all()
        self.assertEqual([r["seq"] for r in rows], [1, 2])


class GuardrailTests(unittest.TestCase):
    def test_blocks_hard_stop_action(self):
        allowed, reason = h.guardrail_check({"action": "send_email", "args": {}})
        self.assertFalse(allowed)
        self.assertIn("hard-stop", reason)

    def test_blocks_hard_stop_intent_text(self):
        allowed, reason = h.guardrail_check(
            {"action": "draft_artifact", "args": {"intent": "do a public token_launch"}}
        )
        self.assertFalse(allowed)

    def test_allows_safe_action(self):
        allowed, _ = h.guardrail_check({"action": "research", "args": {"topic": "x"}})
        self.assertTrue(allowed)

    def test_blocked_step_writes_unsafe_ledger_entry(self):
        tmp = tempfile.mkdtemp()
        ledger = h.Ledger(os.path.join(tmp, "l.jsonl"))
        entry = h.run_step(
            {"id": "S", "action": "send_sms", "args": {}}, ledger
        )
        self.assertEqual(entry["status"], "BLOCKED")
        self.assertEqual(entry["classification"], "UNSAFE")
        # The mock was never executed -> no result key.
        self.assertNotIn("result", entry)


class ExecutorTests(unittest.TestCase):
    def test_noop_idempotent_and_conservative(self):
        # Same input -> identical deterministic result (conservation).
        r1 = h.exec_noop({"tag": "t"})
        r2 = h.exec_noop({"tag": "t"})
        self.assertEqual(r1, r2)

    def test_research_deterministic(self):
        self.assertEqual(
            h.exec_research({"topic": "abc"})["result_hash"],
            h.exec_research({"topic": "abc"})["result_hash"],
        )

    def test_step_execution_records_ok(self):
        tmp = tempfile.mkdtemp()
        ledger = h.Ledger(os.path.join(tmp, "l.jsonl"))
        e = h.run_step({"id": "S", "action": "noop", "args": {"tag": "z"}}, ledger)
        self.assertEqual(e["status"], "OK")
        self.assertEqual(e["classification"], "VERIFIED")

    def test_unknown_action_errors_not_blocks(self):
        tmp = tempfile.mkdtemp()
        ledger = h.Ledger(os.path.join(tmp, "l.jsonl"))
        e = h.run_step({"id": "S", "action": "fly_to_moon", "args": {}}, ledger)
        self.assertEqual(e["status"], "ERROR")


class CheckpointTests(unittest.TestCase):
    def _write_goals(self):
        tmp = tempfile.mkdtemp()
        goals_path = os.path.join(tmp, "goals.json")
        with open(goals_path, "w", encoding="utf-8") as fh:
            json.dump(
                {
                    "goals": [
                        {
                            "id": "G1",
                            "title": "ok goal",
                            "steps": [
                                {"id": "G1.S1", "action": "noop", "args": {"tag": "a"}},
                                {"id": "G1.S2", "action": "research", "args": {"topic": "t"}},
                            ],
                        },
                        {
                            "id": "G2",
                            "title": "blocked goal",
                            "steps": [
                                {"id": "G2.S1", "action": "send_email", "args": {}},
                            ],
                        },
                    ]
                },
                fh,
            )
        return tmp, goals_path

    def test_checkpoint_generation(self):
        tmp, goals_path = self._write_goals()
        out_dir = os.path.join(tmp, "out")
        cp = h.run(goals_path, out_dir)
        self.assertEqual(cp["goals_total"], 2)
        self.assertEqual(cp["goals_complete"], 1)
        self.assertEqual(cp["steps_blocked"], 1)
        self.assertEqual(cp["steps_ok"], 2)
        self.assertEqual(len(cp["guardrail_blocks"]), 1)
        # Output files exist.
        self.assertTrue(os.path.exists(os.path.join(out_dir, "action_ledger.jsonl")))
        self.assertTrue(os.path.exists(os.path.join(out_dir, "checkpoint.json")))
        self.assertTrue(os.path.exists(os.path.join(out_dir, "checkpoint.md")))

    def test_run_is_deterministic(self):
        tmp, goals_path = self._write_goals()
        cp1 = h.run(goals_path, os.path.join(tmp, "out1"))
        cp2 = h.run(goals_path, os.path.join(tmp, "out2"))
        # Strip the per-run nothing; outputs should be structurally identical.
        self.assertEqual(cp1["steps_ok"], cp2["steps_ok"])
        self.assertEqual(cp1["guardrail_blocks"], cp2["guardrail_blocks"])


if __name__ == "__main__":
    unittest.main(verbosity=2)
