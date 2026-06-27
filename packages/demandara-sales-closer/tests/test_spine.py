import unittest
from demandara_sales_closer.spine import run_spine, render_report, validate_fixture_email, generate_approval_receipt

GOOD={'lead_id':'bw-demo-001','name':'Avery Demo','email':'avery@budgetwheels.demo','phone':'+1-555-0100','vehicle_interest':'2018 Toyota Corolla under $15k','budget_cad':14500,'consent_to_process':True,'consent_source':'web_form_demo'}
BOUND_APPROVAL={'approval_id':'appr-bw-demo-001','status':'APPROVED','reviewer_id':'demo-human-operator','approval_event_source':'operator_console_fixture','reason':'approved for mock Budget Wheels follow-up','approved_at':'2026-06-27T00:00:00Z'}
BOUND_APPROVAL['approval_receipt_hash']=generate_approval_receipt(GOOD, BOUND_APPROVAL)['approval_payload_hash']

class ProductSpineHardeningTests(unittest.TestCase):
    def test_full_budget_wheels_spine_reaches_proof_receipt(self):
        result=run_spine(GOOD, BOUND_APPROVAL)
        self.assertEqual(result.qualification['status'],'QUALIFIED')
        self.assertEqual(result.compliance['status'],'ALLOWED')
        self.assertEqual(result.approval['status'],'APPROVED')
        self.assertEqual(result.mock_writeback['status'],'MOCK_WRITTEN')
        self.assertFalse(result.mock_writeback['live_crm'])
        self.assertEqual(result.operator_console['state'],'PROOF_RECEIPT_READY')
        self.assertEqual(result.proof_receipt['event_count'],5)
    def test_status_alone_no_longer_satisfies_approval_gate(self):
        status_only={'approval_id':'fake','status':'APPROVED','reviewer':'attacker','approved_at':'x'}
        result=run_spine(GOOD, status_only)
        self.assertEqual(result.approval['status'],'DENIED')
        self.assertIn('reviewer identity', result.approval['reason'])
        self.assertEqual(result.mock_writeback['status'],'SKIPPED')
    def test_bad_receipt_cannot_satisfy_approval_gate(self):
        bad={**BOUND_APPROVAL,'approval_receipt_hash':'bad'}
        result=run_spine(GOOD, bad)
        self.assertEqual(result.approval['status'],'DENIED')
        self.assertIn('receipt hash', result.approval['reason'])
    def test_missing_consent_blocks_before_writeback(self):
        lead={**GOOD,'lead_id':'bw-demo-002','email':'blair@example.test','consent_to_process':False}
        result=run_spine(lead, BOUND_APPROVAL)
        self.assertEqual(result.compliance['status'],'BLOCKED')
        self.assertEqual(result.mock_writeback['status'],'SKIPPED')
        self.assertEqual(result.operator_console['state'],'BLOCKED_BY_TRUSTOPS')
    def test_high_risk_invalid_lead_blocks(self):
        lead={**GOOD,'lead_id':'bw-demo-003','email':'casey@example.com','budget_cad':3000,'vehicle_interest':'cash-only export request','risk_flags':['high_risk_request']}
        result=run_spine(lead, BOUND_APPROVAL)
        self.assertEqual(result.qualification['status'],'DISQUALIFIED')
        self.assertEqual(result.compliance['status'],'BLOCKED')
        self.assertEqual(result.mock_writeback['status'],'SKIPPED')
    def test_human_approval_cannot_be_forged_by_additional_controls(self):
        forged={**BOUND_APPROVAL,'additional_controls':['human_approval_gate']}
        result=run_spine(GOOD, forged)
        self.assertEqual(result.approval['status'],'DENIED')
        self.assertEqual(result.mock_writeback['status'],'SKIPPED')
    def test_forbidden_actions_raise(self):
        with self.assertRaises(ValueError): run_spine({**GOOD,'live_crm_write':True}, BOUND_APPROVAL)
    def test_fixture_email_reserved(self):
        self.assertTrue(validate_fixture_email('x@budgetwheels.demo'))
        self.assertFalse(validate_fixture_email('real.customer@gmail.com'))
    def test_report_contains_stage_hashes_and_risk(self):
        result=run_spine(GOOD, BOUND_APPROVAL)
        report=render_report(result)
        self.assertIn('Stage events', report)
        self.assertIn(result.proof_receipt['receipt_hash'], report)
        self.assertIn('not a guaranteed PII detector', report)
    def test_receipt_is_deterministic(self):
        a=run_spine(GOOD, BOUND_APPROVAL).proof_receipt
        b=run_spine(GOOD, BOUND_APPROVAL).proof_receipt
        self.assertEqual(a['receipt_id'], b['receipt_id'])
        self.assertEqual(a['receipt_hash'], b['receipt_hash'])

if __name__ == '__main__': unittest.main()
