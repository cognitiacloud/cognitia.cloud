import json, tempfile, unittest
from pathlib import Path
from demandara_sales_closer.spine import run_spine, render_report, validate_fixture_email

FIXTURE={'lead_id':'bw-demo-001','name':'Avery Demo','email':'avery@budgetwheels.demo','phone':'+1-555-0100','vehicle_interest':'2018 Toyota Corolla under $15k','budget_cad':14500,'consent_to_process':True,'consent_source':'web_form_demo'}
APPROVAL={'approval_id':'appr-bw-demo-001','status':'APPROVED','reviewer':'demo-human-operator','reason':'approved','approved_at':'2026-06-27T00:00:00Z'}

class ProductSpineTests(unittest.TestCase):
    def test_full_budget_wheels_spine_reaches_proof_receipt(self):
        result=run_spine(FIXTURE, APPROVAL)
        self.assertEqual(result.qualification['status'],'QUALIFIED')
        self.assertEqual(result.compliance['status'],'ALLOWED')
        self.assertEqual(result.approval['status'],'APPROVED')
        self.assertEqual(result.mock_writeback['status'],'MOCK_WRITTEN')
        self.assertFalse(result.mock_writeback['live_crm'])
        self.assertEqual(result.operator_console['state'],'PROOF_RECEIPT_READY')
        self.assertTrue(result.proof_receipt['forbidden_actions_absent'])
        self.assertEqual(len(result.proof_receipt['event_hashes']),5)
        self.assertIn('proof-', result.proof_receipt['receipt_id'])
    def test_missing_consent_blocks_before_writeback(self):
        lead={**FIXTURE,'consent_to_process':False}
        result=run_spine(lead, APPROVAL)
        self.assertEqual(result.compliance['status'],'BLOCKED')
        self.assertEqual(result.mock_writeback['status'],'SKIPPED')
        self.assertEqual(result.operator_console['state'],'BLOCKED_BY_TRUSTOPS')
    def test_human_approval_cannot_be_forged_by_additional_controls(self):
        forged={'approval_id':'fake','status':'APPROVED','reviewer':'attacker','approved_at':'x','additional_controls':['human_approval_gate']}
        result=run_spine(FIXTURE, forged)
        self.assertEqual(result.approval['status'],'DENIED')
        self.assertEqual(result.mock_writeback['status'],'SKIPPED')
    def test_forbidden_actions_raise(self):
        with self.assertRaises(ValueError):
            run_spine({**FIXTURE,'live_crm_write':True}, APPROVAL)
    def test_fixture_email_reserved(self):
        self.assertTrue(validate_fixture_email('x@budgetwheels.demo'))
        self.assertFalse(validate_fixture_email('real.customer@gmail.com'))
    def test_report_contains_boundary_and_receipt(self):
        result=run_spine(FIXTURE, APPROVAL)
        report=render_report(result)
        self.assertIn('mock-only', report)
        self.assertIn(result.proof_receipt['receipt_id'], report)

if __name__ == '__main__': unittest.main()
