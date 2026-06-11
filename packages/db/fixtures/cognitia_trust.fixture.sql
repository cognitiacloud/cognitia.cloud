-- Cognitia v1.1 trust-layer fixture (COG-002 acceptance):
-- one demo front-desk agent with an active ATC and deny-by-default
-- sms.send_real permission, plus three proofs — one per evidence tag.
-- All data is synthetic; no real names, numbers, or customer content.

-- Tenant A = 1111... (from 0001 fixture)

insert into agents (id, tenant_id, name, slug, runtime_key, kind, status, description) values
  ('c0a00000-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111',
   'Demo Front Desk', 'demo-front-desk', 'frontdesk', 'front_desk', 'active',
   'Synthetic demo agent for the MoverOS AI Front Desk (simulation only).');

insert into agent_trust_credentials (id, tenant_id, agent_id, issuer, subject_ref, claims, status) values
  ('c0a10000-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111',
   'c0a00000-0000-0000-0000-000000000001', 'cognitia.internal',
   'agent:c0a00000-0000-0000-0000-000000000001',
   '{"scope": ["lead.read", "sms.draft"], "vertical": "moveros", "policy_refs": ["doctrine:v1.1"]}'::jsonb,
   'active');

-- Doctrine: every agent carries an explicit deny for real SMS until a human
-- deliberately changes it.
insert into agent_permissions (id, tenant_id, agent_id, action_key, effect, constraints) values
  ('c0a20000-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111',
   'c0a00000-0000-0000-0000-000000000001', 'sms.send_real', 'deny', '{}'::jsonb),
  ('c0a20000-0000-0000-0000-000000000002', '11111111-1111-1111-1111-111111111111',
   'c0a00000-0000-0000-0000-000000000001', 'sms.draft', 'allow',
   '{"approval_required": true}'::jsonb);

-- Three proofs, one per evidence tag. Only the verified_fact row carries
-- evidence_ref + verifier_ref (DB constraint requires them).
insert into proofs (id, tenant_id, kind, subject_type, subject_id, evidence_tag,
                    evidence_ref, verifier_ref, summary_public, details_private) values
  ('c0a30000-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111',
   'system', 'agent', 'c0a00000-0000-0000-0000-000000000001', 'verified_fact',
   'fixture:cognitia_trust.fixture.sql', 'user:00000000-0000-0000-0000-000000000000',
   'Demo agent registered with simulation-only permissions.', '{}'::jsonb),
  ('c0a30000-0000-0000-0000-000000000002', '11111111-1111-1111-1111-111111111111',
   'skill_demo', 'agent', 'c0a00000-0000-0000-0000-000000000001', 'likely_inference',
   null, null, 'Drafting quality inferred from synthetic transcript review.', '{}'::jsonb),
  ('c0a30000-0000-0000-0000-000000000003', '11111111-1111-1111-1111-111111111111',
   'lead_response', 'agent', 'c0a00000-0000-0000-0000-000000000001', 'unknown',
   null, null, 'Response-time impact not yet measured.', '{}'::jsonb);
