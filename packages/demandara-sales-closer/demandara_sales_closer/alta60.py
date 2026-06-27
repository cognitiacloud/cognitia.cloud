from __future__ import annotations
import hashlib, json
from typing import Any

ALTA60_MODE = 'local_mock_only_no_live_egress'
PROOF_RECEIPT_BINDING_VERSION = 'local-proof-receipt-v2-no-secret-no-signature'
WORKFLOW_STATES = ('retry_scheduled','follow_up_due','no_show','closed_lost_revival','manual_hold','completed','disqualified')
AGENT_ROLES = ('Prospector / SDR','Inbound qualifier','Compliance gate','Operator / RevOps intelligence','Proof recorder')
CHANNELS = ('email','linkedin','sms','whatsapp','calls','calendar')

def _hash(payload: Any) -> str:
    return hashlib.sha256(json.dumps(payload, sort_keys=True, separators=(',', ':')).encode()).hexdigest()

def local_proof_receipt_reference(tenant_id: str, lead_id: str, approval_receipt_hash: str) -> str:
    """Deterministic local proof receipt binding. No key, no signature, no live auth."""
    payload = {
        'version': PROOF_RECEIPT_BINDING_VERSION,
        'tenant_id': tenant_id,
        'lead_id': lead_id,
        'approval_receipt_hash': approval_receipt_hash,
        'mode': ALTA60_MODE,
    }
    return 'proof-' + _hash(payload)[:24]

def validate_local_proof_receipt_reference(lead: dict[str, Any], proof_receipt_reference: str, tenant_id: str) -> bool:
    approval_receipt_hash = str(lead.get('approval_receipt_hash') or lead.get('approval_payload_hash') or '')
    if not approval_receipt_hash:
        return False
    expected = local_proof_receipt_reference(tenant_id, str(lead.get('lead_id','')), approval_receipt_hash)
    return proof_receipt_reference == expected

def idempotency_key(tenant_id: str, lead_id: str, proof_receipt_reference: str) -> str:
    return _hash({'tenant_id': tenant_id, 'lead_id': lead_id, 'proof_receipt_reference': proof_receipt_reference})[:24]

def _fake_object_id(prefix: str, key: str) -> str:
    return f'{prefix}_{hashlib.sha256(key.encode()).hexdigest()[:12]}'

def crm_fake_adapter_v2(lead: dict[str, Any], proof_receipt_reference: str, tenant_id: str) -> dict[str, Any]:
    """Return fake HubSpot/Salesforce-shaped dry-run payloads. No CRM/network path exists."""
    if lead.get('tenant_id') != tenant_id:
        return {'status':'BLOCKED','reason':'tenant_scope_mismatch','live_crm':False,'network_attempted':False}
    if not validate_local_proof_receipt_reference(lead, proof_receipt_reference, tenant_id):
        return {'status':'BLOCKED','reason':'invalid_or_unbound_local_proof_receipt_reference','live_crm':False,'network_attempted':False}
    key=idempotency_key(tenant_id, str(lead['lead_id']), proof_receipt_reference)
    intent={'operation':'upsert_contact_and_activity','tenant_id':tenant_id,'lead_id':lead['lead_id'],'idempotency_key':key,'dry_run':True}
    hubspot={'object':'contact','id':_fake_object_id('hs_fake_contact',key),'properties':{'email':lead.get('email','reserved@example.test'),'lifecyclestage':'marketingqualifiedlead','demandara_receipt':proof_receipt_reference}}
    salesforce={'sobject':'Lead','Id':_fake_object_id('sf_fake_lead',key),'fields':{'Company':lead.get('company','Budget Wheels Demo'),'Status':'Qualified - Mock','Demandara_Receipt__c':proof_receipt_reference}}
    return {'status':'DRY_RUN_OK','live_crm':False,'network_attempted':False,'adapter':'fake_crm_v2_local_only','writeback_intent':intent,'fake_hubspot_payload':hubspot,'fake_salesforce_payload':salesforce,'proof_receipt_reference':proof_receipt_reference}

def workflow_breadth_fixtures_v2() -> list[dict[str, Any]]:
    return [{'lead_id':f'bw-state-{i:03d}','state':state,'tenant_id':'budget_wheels_demo','fixture_reserved':True,'expected_live_action':False} for i,state in enumerate(WORKFLOW_STATES,1)]

def mock_calendar_booking_intent(lead: dict[str, Any], approval: dict[str, Any]) -> dict[str, Any]:
    consent = bool(lead.get('consent_to_process') or lead.get('consent') == 'allowed')
    receipt = str(approval.get('approval_receipt_hash') or approval.get('approval_payload_hash') or '')
    approved = approval.get('status') == 'APPROVED' and validate_local_proof_receipt_reference(lead, receipt, str(lead.get('tenant_id') or lead.get('tenant','budget_wheels_demo')))
    if not consent:
        return {'status':'BLOCKED','reason':'consent_required','live_booking':False,'provider_call':False}
    if not approved:
        return {'status':'BLOCKED','reason':'bound_local_approval_receipt_required','live_booking':False,'provider_call':False}
    return {'status':'BOOKING_INTENT_READY','tenant_id':lead.get('tenant_id') or lead.get('tenant','budget_wheels_demo'),'lead_id':lead.get('lead_id'),'calendar_provider':'disabled_mock','time_window':'next_business_day_afternoon','live_booking':False,'provider_call':False}

def multi_agent_trace_v2(lead_id: str) -> dict[str, Any]:
    events=[]
    names=('fake lead prepared','qualified fake lead','consent and risk checked','operator state summarized','proof receipt reference attached')
    for role,event in zip(AGENT_ROLES,names):
        events.append({'role':role,'event':event,'lead_id':lead_id,'live_action':False})
    return {'mode':ALTA60_MODE,'lead_id':lead_id,'roles':list(AGENT_ROLES),'events':events}

def icp_score_v2(lead: dict[str, Any]) -> dict[str, Any]:
    if not bool(lead.get('consent_to_process', lead.get('consent') == 'allowed')):
        return {'icp_score':0,'bucket':'blocked','reasons':['consent false blocks scoring'],'live_enrichment':False}
    if lead.get('risk_flags'):
        return {'icp_score':0,'bucket':'blocked','reasons':['risk flags block scoring'],'live_enrichment':False}
    score=50
    reasons=[]
    if int(lead.get('budget_cad',0)) >= 10000:
        score += 20; reasons.append('budget clear')
    if str(lead.get('vehicle_interest','')).strip():
        score += 15; reasons.append('vehicle interest clear')
    score += 5; reasons.append('reserved fixture source')
    bucket='high' if score >= 80 else 'manual_review' if score >= 60 else 'low'
    return {'icp_score':score,'bucket':bucket,'reasons':reasons,'live_enrichment':False}

def channel_disabled_mock_states_v2() -> dict[str, dict[str, Any]]:
    return {ch:{'state':'booking_intent_mock' if ch == 'calendar' else 'disabled_mock','live_adapter':False,'provider_api':False,'outreach':False} for ch in CHANNELS}
