import inspect, json, unittest
from pathlib import Path
from demandara_sales_closer.alta60 import (
    crm_fake_adapter_v2, idempotency_key, workflow_breadth_fixtures_v2,
    mock_calendar_booking_intent, multi_agent_trace_v2, icp_score_v2,
    channel_disabled_mock_states_v2, WORKFLOW_STATES, AGENT_ROLES,
    local_proof_receipt_reference, validate_local_proof_receipt_reference
)
import demandara_sales_closer.alta60 as alta60

APPROVAL_BINDING='approval-local-demo-bound-hash-v2'
GOOD={'tenant_id':'budget_wheels_demo','lead_id':'bw-demo-001','email':'buyer@example.test','company':'Budget Wheels Demo','budget_cad':14500,'vehicle_interest':'2018 Toyota Corolla','consent_to_process':True,'approval_receipt_hash':APPROVAL_BINDING}
GOOD_PROOF=local_proof_receipt_reference('budget_wheels_demo','bw-demo-001',APPROVAL_BINDING)
APPROVAL={'status':'APPROVED','approval_receipt_hash':GOOD_PROOF}

class Alta60PackageIntegrationTests(unittest.TestCase):
    def test_dashboard_v2_static_no_egress_scan(self):
        html=Path(__file__).resolve().parents[1].joinpath('static','operator-dashboard-v2.html').read_text()
        for term in ['fetch','XMLHttpRequest','WebSocket','EventSource','sendBeacon','http://','https://','<button','<form',' action=','innerHTML']:
            self.assertNotIn(term, html)
        self.assertIn('Next recommended local action', html)
        self.assertIn('bw-demo-001', html)
    def test_crm_fake_adapter_v2_dry_run_payloads(self):
        out=crm_fake_adapter_v2(GOOD,GOOD_PROOF,'budget_wheels_demo')
        self.assertEqual(out['status'],'DRY_RUN_OK')
        self.assertFalse(out['live_crm'])
        self.assertFalse(out['network_attempted'])
        self.assertEqual(out['writeback_intent']['idempotency_key'], idempotency_key('budget_wheels_demo','bw-demo-001',GOOD_PROOF))
        self.assertIn('fake_hubspot_payload', out)
        self.assertIn('fake_salesforce_payload', out)
        self.assertEqual(out['proof_receipt_reference'], GOOD_PROOF)
    def test_crm_fake_adapter_v2_blocks_tenant_and_bad_receipt(self):
        self.assertEqual(crm_fake_adapter_v2({**GOOD,'tenant_id':'other'},GOOD_PROOF,'budget_wheels_demo')['status'],'BLOCKED')
        self.assertEqual(crm_fake_adapter_v2(GOOD,'bad','budget_wheels_demo')['status'],'BLOCKED')
    def test_arbitrary_proof_prefix_no_longer_passes(self):
        arbitrary='proof-arbitrary-not-bound-to-lead'
        self.assertFalse(validate_local_proof_receipt_reference(GOOD, arbitrary, 'budget_wheels_demo'))
        self.assertEqual(crm_fake_adapter_v2(GOOD, arbitrary, 'budget_wheels_demo')['status'], 'BLOCKED')
        self.assertEqual(mock_calendar_booking_intent(GOOD, {'status':'APPROVED','approval_receipt_hash':arbitrary})['status'], 'BLOCKED')
    def test_local_proof_receipt_reference_is_deterministic_and_bound(self):
        a=local_proof_receipt_reference('budget_wheels_demo','bw-demo-001',APPROVAL_BINDING)
        b=local_proof_receipt_reference('budget_wheels_demo','bw-demo-001',APPROVAL_BINDING)
        c=local_proof_receipt_reference('budget_wheels_demo','bw-demo-002',APPROVAL_BINDING)
        self.assertEqual(a,b)
        self.assertNotEqual(a,c)
        self.assertTrue(validate_local_proof_receipt_reference(GOOD, a, 'budget_wheels_demo'))
    def test_crm_fake_adapter_v2_no_crm_sdk_or_http_path(self):
        src=inspect.getsource(alta60)
        for term in ['import requests','from requests','urllib','http://','https://','hubspot3','hubspot_api','salesforce_api','simple_salesforce','import socket','from socket']:
            self.assertNotIn(term, src.lower())
    def test_workflow_breadth_executable_fixtures(self):
        states={f['state'] for f in workflow_breadth_fixtures_v2()}
        self.assertEqual(states, set(WORKFLOW_STATES))
        for f in workflow_breadth_fixtures_v2():
            self.assertFalse(f['expected_live_action'])
            self.assertTrue(f['fixture_reserved'])
    def test_workflow_fixture_file_matches_required_states(self):
        data=json.loads(Path(__file__).resolve().parents[1].joinpath('fixtures','alta60','workflow_breadth_v2.json').read_text())
        self.assertEqual({f['state'] for f in data['fixtures']}, set(WORKFLOW_STATES))
    def test_mock_calendar_requires_consent_and_approval(self):
        self.assertEqual(mock_calendar_booking_intent({**GOOD,'consent_to_process':False}, APPROVAL)['status'],'BLOCKED')
        self.assertEqual(mock_calendar_booking_intent(GOOD, {'status':'PENDING'})['status'],'BLOCKED')
        ok=mock_calendar_booking_intent(GOOD, APPROVAL)
        self.assertEqual(ok['status'],'BOOKING_INTENT_READY')
        self.assertFalse(ok['live_booking'])
        self.assertFalse(ok['provider_call'])
    def test_multi_agent_trace_roles_without_live_agents(self):
        trace=multi_agent_trace_v2('bw-demo-001')
        self.assertEqual(tuple(trace['roles']), AGENT_ROLES)
        for e in trace['events']:
            self.assertFalse(e['live_action'])
    def test_icp_scoring_fake_reserved_only(self):
        score=icp_score_v2(GOOD)
        self.assertGreaterEqual(score['icp_score'],80)
        self.assertFalse(score['live_enrichment'])
        blocked=icp_score_v2({**GOOD,'consent_to_process':False})
        self.assertEqual(blocked['bucket'],'blocked')
        self.assertFalse(blocked['live_enrichment'])
    def test_channel_states_disabled_mock_only(self):
        states=channel_disabled_mock_states_v2()
        for channel, info in states.items():
            self.assertFalse(info['live_adapter'])
            self.assertFalse(info['provider_api'])
            self.assertFalse(info['outreach'])
        self.assertEqual(states['calendar']['state'],'booking_intent_mock')

if __name__ == '__main__':
    unittest.main()
