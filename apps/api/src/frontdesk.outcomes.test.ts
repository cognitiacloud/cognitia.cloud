import { describe, it, expect, beforeEach } from 'vitest';
import { InMemoryRepository } from '@cognitia/db';
import { createGtmServices } from '@cognitia/agents';
import { ApiHandlers, type ApiRequest } from './handlers.js';

/**
 * COG-006 (Mission Pack B §15) — lead actions, outcomes, reputation gating,
 * and the Lead Rescue summary. Complements frontdesk.test.ts (intake/PII/
 * simulated-send coverage lives there).
 */

const TENANT = '11111111-1111-1111-1111-111111111111';

const asRole = (
  role: 'viewer' | 'operator' | 'owner',
  over: Partial<ApiRequest> = {},
): ApiRequest => ({ tenantId: TENANT, role, traceId: 'trace-outcomes', ...over });

describe('MoverOS Lead Rescue: actions, outcomes, reputation, summary', () => {
  let handlers: ApiHandlers;
  let repo: InMemoryRepository;
  let leadId: string;
  let agentId: string;

  beforeEach(async () => {
    repo = new InMemoryRepository();
    handlers = new ApiHandlers(repo, createGtmServices({ repo, v1Mode: true }));
    const lead = await handlers.ingestLead(
      asRole('operator', {
        body: {
          source: 'sms_sim',
          contact_phone: '604-555-0188',
          message_body: 'Need a move quote',
          consent_captured: true,
        },
      }),
    );
    leadId = (lead.body as { lead: { id: string } }).lead.id;
    const agent = await handlers.registerAgent(
      asRole('operator', { body: { name: 'Front Desk', slug: 'front-desk', kind: 'front_desk' } }),
    );
    agentId = (agent.body as { agent: { id: string } }).agent.id;
  });

  const propose = (action: string) =>
    handlers.proposeLeadAction(asRole('operator', { params: { id: leadId }, body: { action } }));

  const outcome = (body: Record<string, unknown>) =>
    handlers.createLeadOutcome(asRole('operator', { params: { id: leadId }, body }));

  it('proposing an action creates a proof + audit and moves lead status (#3, #6, #13)', async () => {
    const res = await propose('qualify_lead');
    const body = res.body as { action: { simulation: boolean }; proof_id: string };
    expect(body.proof_id).toBeTruthy();
    expect(body.action.simulation).toBe(true);

    const proofs = await repo.listProofs(TENANT);
    expect(proofs.some((p) => p.id === body.proof_id && p.evidence_tag === 'verified_fact')).toBe(
      true,
    );
    const audits = await repo.listAuditEvents(TENANT);
    expect(audits.filter((a) => a.action === 'frontdesk.action.proposed.v1')).toHaveLength(1);

    const lead = await repo.getLeadIntake(TENANT, leadId);
    expect(lead!.status).toBe('agent_action_proposed');
  });

  it('propose_sms_reply routes through the full SMS pipeline (simulation, approval) (#4)', async () => {
    const res = await propose('propose_sms_reply');
    const body = res.body as { action: { simulation: boolean; approval_status: string } };
    expect(body.action.simulation).toBe(true);
    expect(body.action.approval_status).toBe('proposed');
    expect((await repo.getLeadIntake(TENANT, leadId))!.status).toBe('human_review_required');
  });

  it('risky actions need approval; routine ones are pre-approved but still simulated', async () => {
    const booking = await propose('create_booking_intent');
    expect((booking.body as { action: { approval_status: string } }).action.approval_status).toBe(
      'proposed',
    );
    const qualify = await propose('estimate_urgency');
    expect((qualify.body as { action: { approval_status: string } }).action.approval_status).toBe(
      'approved',
    );
    expect((qualify.body as { action: { simulation: boolean } }).action.simulation).toBe(true);
  });

  it('verified_fact booked outcome links a proof and credits reputation (#7, #8)', async () => {
    const res = await outcome({
      outcome: 'booked_job',
      evidence_tag: 'verified_fact',
      evidence_source: 'crm:deal:demo-123',
      booked_value_cents: 250_000,
      agent_id: agentId,
    });
    const body = res.body as { proof_id: string; reputation_event_id: string };
    expect(body.reputation_event_id).toBeTruthy();

    const outcomes = await repo.listLeadOutcomes(TENANT, leadId);
    expect(outcomes[0]!.proof_id).toBe(body.proof_id);
    expect(outcomes[0]!.evidence_source).toBe('crm:deal:demo-123');

    const reputation = await repo.listReputationEvents(TENANT, agentId);
    expect(reputation).toHaveLength(1);
    expect(reputation[0]!.delta).toBeGreaterThan(0);
    expect(reputation[0]!.proof_id).toBe(body.proof_id);

    expect((await repo.getLeadIntake(TENANT, leadId))!.status).toBe('booked');
    const audits = await repo.listAuditEvents(TENANT);
    expect(audits.filter((a) => a.action === 'frontdesk.outcome.recorded.v1')).toHaveLength(1); // #14
  });

  it('likely_inference and unknown outcomes never create positive reputation (#9, #10)', async () => {
    for (const tag of ['likely_inference', 'unknown'] as const) {
      await outcome({
        outcome: 'booking_intent',
        evidence_tag: tag,
        estimated_value_cents: 100_000,
        agent_id: agentId,
      });
    }
    expect(await repo.listReputationEvents(TENANT, agentId)).toHaveLength(0);

    // Belt-and-braces: even a direct positive insert against a non-verified
    // proof is rejected by the repository (mirror of the 0010 trigger).
    const proofs = await repo.listProofs(TENANT);
    const inference = proofs.find((p) => p.evidence_tag === 'likely_inference')!;
    await expect(
      repo.insertReputationEvent({
        id: 'b0000000-0000-0000-0000-000000000001',
        tenant_id: TENANT,
        agent_id: agentId,
        proof_id: inference.id,
        delta: 1,
        reason_code: 'sneaky',
        created_at: new Date().toISOString(),
      }),
    ).rejects.toThrow(/verified_fact/);
  });

  it('verified_fact outcomes require an evidence_source (#evidence discipline)', async () => {
    await expect(
      outcome({ outcome: 'booked_job', evidence_tag: 'verified_fact', agent_id: agentId }),
    ).rejects.toMatchObject({ status: 400 });
  });

  it('summary reports counts and only verified booked value (#11)', async () => {
    await propose('qualify_lead');
    await outcome({
      outcome: 'rescued_lead',
      evidence_tag: 'verified_fact',
      evidence_source: 'event:sim-send-1',
      agent_id: agentId,
    });
    await outcome({
      outcome: 'booking_intent',
      evidence_tag: 'likely_inference',
      estimated_value_cents: 150_000,
    });
    await outcome({
      outcome: 'booked_job',
      evidence_tag: 'verified_fact',
      evidence_source: 'crm:deal:demo-9',
      booked_value_cents: 300_000,
      agent_id: agentId,
    });
    await outcome({
      outcome: 'booked_job',
      evidence_tag: 'likely_inference',
      booked_value_cents: 999_999,
    });
    await outcome({ outcome: 'unknown', evidence_tag: 'unknown' });

    const res = await handlers.leadRescueSummary(asRole('viewer'));
    const summary = res.body as Record<string, number>;
    expect(summary.total_leads).toBe(1);
    expect(summary.actions_proposed).toBeGreaterThanOrEqual(1);
    expect(summary.rescued_leads).toBe(1);
    expect(summary.booking_intents).toBe(1);
    expect(summary.booked_jobs).toBe(2);
    expect(summary.unknown_outcomes).toBe(1);
    expect(summary.estimated_value_cents).toBe(150_000);
    // The likely_inference "booked" 999,999 is EXCLUDED — verified only.
    expect(summary.verified_booked_value_cents).toBe(300_000);
    // Summary leaks no PII.
    expect(JSON.stringify(res.body)).not.toContain('604-555');
  });

  it('outcomes on unknown leads 404; viewer cannot record outcomes', async () => {
    await expect(
      handlers.createLeadOutcome(
        asRole('operator', {
          params: { id: 'c0ffee00-0000-0000-0000-000000000000' },
          body: { outcome: 'unknown', evidence_tag: 'unknown' },
        }),
      ),
    ).rejects.toMatchObject({ status: 404 });
    await expect(
      handlers.createLeadOutcome(
        asRole('viewer', {
          params: { id: leadId },
          body: { outcome: 'unknown', evidence_tag: 'unknown' },
        }),
      ),
    ).rejects.toMatchObject({ status: 403 });
  });
});

describe('Lead detail aggregate (COG-011)', () => {
  it('returns the full lead story without cross-lead leakage; viewer is 403', async () => {
    const repo = new InMemoryRepository();
    const handlers = new ApiHandlers(repo, createGtmServices({ repo, v1Mode: true }));
    const role = (
      r: 'viewer' | 'operator' | 'owner',
      over: Partial<ApiRequest> = {},
    ): ApiRequest => ({ tenantId: TENANT, role: r, traceId: 'trace-detail', ...over });

    const mk = async (phone: string, msg: string) => {
      const res = await handlers.ingestLead(
        role('operator', {
          body: {
            source: 'sms_sim',
            contact_phone: phone,
            message_body: msg,
            consent_captured: true,
          },
        }),
      );
      return (res.body as { lead: { id: string } }).lead.id;
    };
    const leadA = await mk('604-555-0111', 'Lead A needs a quote');
    const leadB = await mk('604-555-0222', 'Lead B different customer');

    // Build A's story: draft -> approve -> execute -> verified outcome.
    const draft = await handlers.proposeLeadAction(
      role('operator', { params: { id: leadA }, body: { action: 'propose_sms_reply' } }),
    );
    const actionId = (draft.body as { action: { id: string } }).action.id;
    await handlers.approveAction(
      role('operator', {
        params: { id: actionId },
        body: { reason: { reason_code: 'accurate_and_relevant' } },
      }),
    );
    await handlers.executeFrontDeskAction(role('operator', { params: { id: actionId } }));
    await handlers.createLeadOutcome(
      role('operator', {
        params: { id: leadA },
        body: {
          outcome: 'booked_job',
          evidence_tag: 'verified_fact',
          evidence_source: 'crm:deal:detail-1',
          booked_value_cents: 50_000,
        },
      }),
    );
    // Noise on B so leakage would be visible.
    await handlers.proposeLeadAction(
      role('operator', { params: { id: leadB }, body: { action: 'qualify_lead' } }),
    );

    const res = await handlers.getLeadDetail(role('operator', { params: { id: leadA } }));
    const body = res.body as {
      lead: { message_body: string };
      actions: Array<{ id: string; draft: { body: string } | null; simulation: boolean | null }>;
      outcomes: Array<{ evidence_source: string | null }>;
      proofs: Array<{ kind: string }>;
      audit_refs: Array<{ action: string }>;
    };
    // Decrypted content for the operator; only A's records.
    expect(body.lead.message_body).toBe('Lead A needs a quote');
    expect(body.actions).toHaveLength(1);
    expect(body.actions[0]!.id).toBe(actionId);
    expect(body.actions[0]!.simulation).toBe(true);
    expect(body.actions[0]!.draft?.body).toMatch(/MoverOS Front Desk/);
    expect(body.outcomes).toHaveLength(1);
    expect(body.outcomes[0]!.evidence_source).toBe('crm:deal:detail-1');
    // Proofs: the simulated send (lead_response, subject=action) + the
    // revenue outcome (subject=lead) — and nothing from lead B.
    expect(body.proofs.map((p) => p.kind).sort()).toEqual(['lead_response', 'revenue_outcome']);
    expect(body.audit_refs.length).toBeGreaterThanOrEqual(2);
    expect(JSON.stringify(body)).not.toContain('Lead B');

    // Viewers cannot read decrypted detail.
    await expect(
      handlers.getLeadDetail(role('viewer', { params: { id: leadA } })),
    ).rejects.toMatchObject({ status: 403 });
  });
});
