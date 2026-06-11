import { describe, it, expect } from 'vitest';
import { InMemoryRepository } from '@cognitia/db';
import { createGtmServices } from '@cognitia/agents';
import { ApiHandlers, type ApiRequest } from './handlers.js';

/**
 * Mission Pack B end-to-end loop — the first vertical trust proof, in one
 * uninterrupted flow (doctrine: agents doing real business work, under
 * policy, with proof, revenue receipts, and standards-compatible
 * credentials):
 *
 *   register agent → issue ATC → import Core 20 → certify a skill (tier 2,
 *   verified_fact) → ingest a mover lead → propose SMS rescue → human
 *   approval → simulated send (proof + response time) → verified booked
 *   outcome (revenue receipt) → reputation credited → summary shows
 *   verified value — with PII masked and real SMS impossible throughout.
 */

const TENANT = '11111111-1111-1111-1111-111111111111';

const asRole = (
  role: 'viewer' | 'operator' | 'owner',
  over: Partial<ApiRequest> = {},
): ApiRequest => ({ tenantId: TENANT, role, traceId: 'trace-mission-loop', ...over });

describe('Mission Pack B: the full vertical trust loop', () => {
  it('connects ATC agent → certified skill → lead action → proof → revenue outcome → reputation', async () => {
    const repo = new InMemoryRepository();
    const handlers = new ApiHandlers(repo, createGtmServices({ repo, v1Mode: true }));

    // 1. An ATC-backed agent exists (deny-by-default real SMS).
    const agentRes = await handlers.registerAgent(
      asRole('operator', {
        body: { name: 'MoverOS Front Desk', slug: 'moveros-front-desk', kind: 'front_desk' },
      }),
    );
    const agentId = (agentRes.body as { agent: { id: string } }).agent.id;
    await handlers.issueAtc(
      asRole('operator', {
        params: { id: agentId },
        body: { claims: { scope: ['lead.read', 'sms.draft'], vertical: 'moveros' } },
      }),
    );

    // 2. Skills are registered and one is certified to tier 2 with a
    //    verified_fact proof (SkillProof).
    await handlers.importCoreSkills(asRole('operator'));
    const skills = await repo.listSkills(TENANT);
    const rescueSkill = skills.find((s) => s.slug === 'ai-front-desk-lead-rescue')!;
    const [rescueVersion] = await repo.listSkillVersions(TENANT, rescueSkill.id);
    const skillProofRes = await handlers.createProof(
      asRole('operator', {
        body: {
          kind: 'skill_demo',
          subject_type: 'skill',
          subject_id: rescueSkill.id,
          evidence_tag: 'verified_fact',
          evidence_ref: 'vitest:frontdesk.test.ts',
          verifier_ref: 'user:operator',
          summary_public: 'Lead-rescue skill exercised under test with passing assertions.',
        },
      }),
    );
    const certified = await handlers.createSkillProof(
      asRole('operator', {
        params: { id: rescueVersion!.id },
        body: {
          proof_id: (skillProofRes.body as { proof: { id: string } }).proof.id,
          agent_id: agentId,
          tier: 'T2_verified',
          target_proof_tier: 2,
        },
      }),
    );
    expect((certified.body as { version: { proof_tier: number } }).version.proof_tier).toBe(2);

    // 3. A moving-company lead enters the system (simulated SMS, consented).
    const leadRes = await handlers.ingestLead(
      asRole('operator', {
        body: {
          source: 'sms_sim',
          contact_name: 'Demo Mover',
          contact_phone: '604-555-0142',
          message_body: 'Moving a 3-bedroom house July 5, need a quote fast.',
          consent_captured: true,
          received_at: new Date(Date.now() - 30_000).toISOString(),
        },
      }),
    );
    const leadId = (leadRes.body as { lead: { id: string } }).lead.id;

    // 4. The agent proposes the rescue; 5. a human approves; the send is
    //    SIMULATED and produces a proof with response time.
    const proposal = await handlers.proposeLeadAction(
      asRole('operator', { params: { id: leadId }, body: { action: 'propose_sms_reply' } }),
    );
    const actionId = (proposal.body as { action: { id: string } }).action.id;
    await handlers.approveAction(
      asRole('operator', {
        params: { id: actionId },
        body: { reason: { reason_code: 'accurate_and_relevant' } },
      }),
    );
    const send = await handlers.executeFrontDeskAction(
      asRole('operator', { params: { id: actionId } }),
    );
    const sendBody = send.body as { proof_id: string; response_time_ms: number };
    expect(sendBody.response_time_ms).toBeGreaterThanOrEqual(30_000);

    // 6–7. The outcome is tracked as a revenue receipt; reputation improves
    //      ONLY because it is verified_fact with a real evidence source.
    const outcome = await handlers.createLeadOutcome(
      asRole('operator', {
        params: { id: leadId },
        body: {
          outcome: 'booked_job',
          evidence_tag: 'verified_fact',
          evidence_source: 'crm:deal:e2e-demo-1',
          booked_value_cents: 185_000,
          agent_id: agentId,
        },
      }),
    );
    expect((outcome.body as { reputation_event_id: string }).reputation_event_id).toBeTruthy();
    const reputation = await repo.listReputationEvents(TENANT, agentId);
    expect(reputation).toHaveLength(1);
    expect(reputation[0]!.delta).toBeGreaterThan(0);

    // The summary shows the verified receipt; the lead is booked.
    const summary = await handlers.leadRescueSummary(asRole('viewer'));
    expect(
      (summary.body as { verified_booked_value_cents: number }).verified_booked_value_cents,
    ).toBe(185_000);
    expect((await repo.getLeadIntake(TENANT, leadId))!.status).toBe('booked');

    // 8. No real SMS was possible at any point.
    expect((await repo.getAgentAction(TENANT, actionId))!.simulation).toBe(true);
    const perms = await repo.listAgentPermissions(TENANT, agentId);
    expect(perms.find((p) => p.action_key === 'sms.send_real')?.effect).toBe('deny');

    // Proof chain integrity: every step left an evidence-tagged proof.
    const proofs = await repo.listProofs(TENANT);
    const kinds = proofs.map((p) => p.kind).sort();
    expect(kinds).toContain('skill_demo'); // certification evidence
    expect(kinds).toContain('lead_response'); // simulated send
    expect(kinds).toContain('revenue_outcome'); // booked receipt
    expect(proofs.every((p) => !p.public_safe)).toBe(true); // nothing public without redaction
    // 9. (No token marketing exists — doctrine.guard.test.ts enforces repo-wide.)
  });
});
