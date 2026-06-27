from __future__ import annotations
import argparse, hashlib, json, re, time
from dataclasses import asdict, dataclass, field
from pathlib import Path
from typing import Any

CANONICAL_RISK = 'it is not a guaranteed PII detector and should not be relied on as the sole control for redacting real production data.'
FORBIDDEN_ACTIONS = ('provider_api_call','live_crm_write','outreach_send','secret_read','public_investor_token_claim','deploy','push','merge','undraft','pr_mutation')
RESERVED_EMAIL_SUFFIXES = ('@example.com', '@example.test', '@budgetwheels.demo')

@dataclass(frozen=True)
class Lead:
    lead_id: str
    name: str
    email: str
    phone: str
    vehicle_interest: str
    budget_cad: int
    consent_to_process: bool
    consent_source: str
    tenant: str = 'budget_wheels_demo'

@dataclass(frozen=True)
class Decision:
    status: str
    reason: str
    evidence: tuple[str, ...] = field(default_factory=tuple)

@dataclass(frozen=True)
class Approval:
    approval_id: str
    status: str
    reviewer: str
    reason: str
    approved_at: str

@dataclass(frozen=True)
class SpineResult:
    lead: dict[str, Any]
    qualification: dict[str, Any]
    compliance: dict[str, Any]
    approval: dict[str, Any]
    mock_writeback: dict[str, Any]
    proof_receipt: dict[str, Any]
    operator_console: dict[str, Any]
    events: list[dict[str, Any]]

def _hash(obj: Any) -> str:
    return hashlib.sha256(json.dumps(obj, sort_keys=True, separators=(',', ':')).encode()).hexdigest()

def validate_fixture_email(email: str) -> bool:
    return any(email.endswith(suffix) for suffix in RESERVED_EMAIL_SUFFIXES)

def intake_lead(payload: dict[str, Any]) -> Lead:
    required=('lead_id','name','email','phone','vehicle_interest','budget_cad','consent_to_process','consent_source')
    missing=[key for key in required if key not in payload]
    if missing:
        raise ValueError(f'missing required lead fields: {missing}')
    if not validate_fixture_email(str(payload['email'])):
        raise ValueError('Budget Wheels demo lead must use reserved fake fixture email')
    return Lead(**{k: payload[k] for k in required})

def qualify(lead: Lead) -> Decision:
    if lead.budget_cad < 5000:
        return Decision('DISQUALIFIED','budget below demo qualification threshold',(lead.vehicle_interest,))
    if not lead.vehicle_interest.strip():
        return Decision('DISQUALIFIED','missing vehicle interest',())
    return Decision('QUALIFIED','budget and vehicle interest present',(f'budget_cad={lead.budget_cad}', lead.vehicle_interest))

def compliance_gate(lead: Lead, qualification: Decision) -> Decision:
    if qualification.status != 'QUALIFIED':
        return Decision('BLOCKED','qualification did not pass',(qualification.reason,))
    if not lead.consent_to_process:
        return Decision('BLOCKED','consent_to_process is false',('deny_by_default',))
    if lead.consent_source not in {'web_form_demo','operator_demo_fixture'}:
        return Decision('BLOCKED','consent source is not allowlisted',(lead.consent_source,))
    return Decision('ALLOWED','consent and qualification passed',('deny_by_default_checked','mock_only'))

def require_human_approval(lead: Lead, compliance: Decision, approval: dict[str, Any] | None) -> Approval:
    if compliance.status != 'ALLOWED':
        return Approval('approval-not-requested','HOLD','system',compliance.reason,'')
    if not approval:
        return Approval('approval-required','PENDING','human_operator','human approval required before mock writeback','')
    # caller cannot satisfy approval by injecting additional_controls or flags
    if approval.get('additional_controls') or approval.get('human_approval_gate') is True:
        return Approval('approval-forged','DENIED','system','caller-supplied approval controls are ignored','')
    if approval.get('status') != 'APPROVED' or not approval.get('reviewer'):
        return Approval(str(approval.get('approval_id','approval-denied')),'DENIED',str(approval.get('reviewer','unknown')),'approval status/reviewer invalid',str(approval.get('approved_at','')))
    return Approval(str(approval.get('approval_id')), 'APPROVED', str(approval.get('reviewer')), str(approval.get('reason','approved for mock writeback')), str(approval.get('approved_at')))

def mock_crm_writeback(lead: Lead, approval: Approval) -> dict[str, Any]:
    if approval.status != 'APPROVED':
        return {'status':'SKIPPED','reason':'approval not approved','live_crm':False,'adapter':'mock_crm_only'}
    record={'mock_crm_record_id':f'mock-crm-{lead.lead_id}','tenant':lead.tenant,'lead_id':lead.lead_id,'appointment_intent':'demo_followup_call','vehicle_interest':lead.vehicle_interest,'live_crm':False,'adapter':'mock_crm_only'}
    record['record_hash']=_hash(record)
    return {'status':'MOCK_WRITTEN','record':record,'live_crm':False,'adapter':'mock_crm_only'}

def proof_receipt(events: list[dict[str, Any]]) -> dict[str, Any]:
    event_hashes=[_hash(e) for e in events]
    receipt={'receipt_id':'proof-'+_hash(event_hashes)[:16],'event_hashes':event_hashes,'risk':CANONICAL_RISK,'forbidden_actions_absent':True,'mock_only':True,'created_at':'static-demo-time'}
    receipt['receipt_hash']=_hash(receipt)
    return receipt

def operator_console_trace(lead: Lead, qualification: Decision, compliance: Decision, approval: Approval, writeback: dict[str, Any], receipt: dict[str, Any]) -> dict[str, Any]:
    if approval.status == 'PENDING': state='AWAITING_HUMAN_APPROVAL'
    elif writeback.get('status') == 'MOCK_WRITTEN': state='PROOF_RECEIPT_READY'
    elif compliance.status == 'BLOCKED': state='BLOCKED_BY_TRUSTOPS'
    else: state='HELD'
    return {'tenant':lead.tenant,'lead_id':lead.lead_id,'state':state,'qualification':qualification.status,'compliance':compliance.status,'approval':approval.status,'writeback':writeback.get('status'),'proof_receipt_id':receipt.get('receipt_id') if receipt else None}

def run_spine(payload: dict[str, Any], approval: dict[str, Any] | None=None) -> SpineResult:
    for key in FORBIDDEN_ACTIONS:
        if payload.get(key) or (approval or {}).get(key):
            raise ValueError(f'forbidden action requested: {key}')
    lead=intake_lead(payload)
    q=qualify(lead); c=compliance_gate(lead,q); a=require_human_approval(lead,c,approval)
    w=mock_crm_writeback(lead,a)
    events=[{'kind':'lead_intake','lead':asdict(lead)}, {'kind':'qualification','decision':asdict(q)}, {'kind':'compliance_gate','decision':asdict(c)}, {'kind':'human_approval','approval':asdict(a)}, {'kind':'mock_writeback','writeback':w}]
    r=proof_receipt(events)
    console=operator_console_trace(lead,q,c,a,w,r)
    return SpineResult(asdict(lead), asdict(q), asdict(c), asdict(a), w, r, console, events)

def render_report(result: SpineResult) -> str:
    return '\n'.join(['# Budget Wheels Demo Proof Receipt','',f"Lead: `{result.lead['lead_id']}`",f"Console state: `{result.operator_console['state']}`",f"Qualification: `{result.qualification['status']}`",f"Compliance: `{result.compliance['status']}`",f"Approval: `{result.approval['status']}`",f"Writeback: `{result.mock_writeback['status']}`",f"Receipt: `{result.proof_receipt['receipt_id']}`",'',f"Risk: {CANONICAL_RISK}",'','Hard boundary: mock-only; no live CRM, outreach, provider/API, secrets, deploy, push, PR mutation, merge, or public/investor/token claims.'])

def main(argv=None):
    p=argparse.ArgumentParser()
    p.add_argument('--fixture', required=True)
    p.add_argument('--approval', default=None)
    p.add_argument('--out', default=None)
    args=p.parse_args(argv)
    payload=json.loads(Path(args.fixture).read_text())
    approval=json.loads(Path(args.approval).read_text()) if args.approval else None
    result=run_spine(payload,approval)
    data=json.dumps(asdict(result), indent=2, sort_keys=True)
    if args.out:
        out=Path(args.out); out.mkdir(parents=True, exist_ok=True)
        (out/'spine-result.json').write_text(data)
        (out/'proof-receipt-report.md').write_text(render_report(result)+'\n')
    print(data)
    return 0
