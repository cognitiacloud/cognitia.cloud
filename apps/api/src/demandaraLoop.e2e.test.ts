import { describe, it, expect } from 'vitest';
import { InMemoryRepository } from '@cognitia/db';
import { createGtmServices } from '@cognitia/agents';
import { ApiHandlers, type ApiRequest } from './handlers.js';

/**
 * COG-014 — Demandara onboarding pilot loop. Proves the multi-tenant claim
 * end-to-end on the SECOND vertical: the same GTM Control Plane machinery
 * that runs MoverOS (Tenant Zero) runs a demand-generation tenant with zero
 * new trust logic — provisioning → inbound prospect intake → approval-gated
 * simulated outreach → CRM-evidenced outcome → reputation, with hard
 * cross-tenant isolation between Demandara and a co-provisioned Tenant Zero.
 */

const PLATFORM_TENANT = '11111111-1111-1111-1111-111111111111';

const owner = (tenantId: string, over: Partial<ApiRequest> = {}): ApiRequest => ({
  tenantId,
  role: 'owner',
  traceId: 'trace-demandara',
  ...over,
});
const operator = (tenantId: string, over: Partial<ApiRequest> = {}): ApiRequest => ({
  tenantId,
  role: 'operator',
  traceId: 'trace-demandara',
  ...over,
});

describe('COG-014: Demandara onboarding mission loop', () => {
  it('provisions Demandara and runs the full demand-gen loop with tenant isolation', async () => {
    const repo = new InMemoryRepository();
    const handlers = new ApiHandlers(repo, createGtmServices({ repo, v1Mode: true }));

    // 1. Provision BOTH tenants from the platform seat — same endpoint,
    //    different specs.
    const moveros = (
      (await handlers.provisionTenant(owner(PLATFORM_TENANT, { body: { slug: 'moveros' } })))
        .body as { tenant: { id: string } }
    ).tenant.id;
    const demandaraRes = await handlers.provisionTenant(
      owner(PLATFORM_TENANT, { body: { slug: 'demandara' } }),
    );
    const demandara = (demandaraRes.body as { tenant: { id: string } }).tenant.id;
    const demandaraAgent = (await repo.listAgents(demandara))[0]!;
    expect(demandaraAgent.slug).toBe('demandara-pipeline');
    expect(await repo.listSkills(demandara)).toHaveLength(20);

    // 2. An inbound B2B prospect reaches Demandara (web form, consented).
    //    Same intake machinery; different vertical's content.
    const leadRes = await handlers.ingestLead(
      operator(demandara, {
        body: {
          source: 'web',
          contact_name: 'Prospect CTO',
          contact_phone: '604-555-0233',
          message_body: 'Interested in your pipeline automation for our 50-rep sales org.',
          consent_captured: true,
          received_at: new Date(Date.now() - 20_000).toISOString(),
        },
      }),
    );
    const leadId = (leadRes.body as { lead: { id: string } }).lead.id;

    // 3. RESEARCH stage (simulated GTM workflow): qualify + urgency. Every
    //    action creates a proof — asserted below per stage.
    const qualify = await handlers.proposeLeadAction(
      operator(demandara, { params: { id: leadId }, body: { action: 'qualify_lead' } }),
    );
    expect((qualify.body as { proof_id: string }).proof_id).toBeTruthy();
    const urgency = await handlers.proposeLeadAction(
      operator(demandara, { params: { id: leadId }, body: { action: 'estimate_urgency' } }),
    );
    expect((urgency.body as { proof_id: string }).proof_id).toBeTruthy();

    // 4. DRAFT OUTREACH → QA: the draft first FAILS human QA (rejected with
    //    a structured reason — the reject path IS the QA gate) and cannot
    //    execute. Re-proposing identical content is IDEMPOTENT (content
    //    fingerprint → same action, no duplicate outreach), so QA pass is an
    //    explicit human reconsideration — both decisions land as labels.
    const draft1 = await handlers.proposeLeadAction(
      operator(demandara, { params: { id: leadId }, body: { action: 'propose_sms_reply' } }),
    );
    const actionId = (draft1.body as { action: { id: string } }).action.id;
    await handlers.rejectAction(
      operator(demandara, {
        params: { id: actionId },
        body: { reason: { reason_code: 'tone_off_brand' } },
      }),
    );
    await expect(
      handlers.executeFrontDeskAction(operator(demandara, { params: { id: actionId } })),
    ).rejects.toMatchObject({ status: 409 }); // QA-rejected drafts cannot send

    const draft2 = await handlers.proposeLeadAction(
      operator(demandara, { params: { id: leadId }, body: { action: 'propose_sms_reply' } }),
    );
    expect((draft2.body as { action: { id: string } }).action.id).toBe(actionId); // idempotent

    await handlers.approveAction(
      operator(demandara, {
        params: { id: actionId },
        body: { reason: { reason_code: 'high_value_target' } },
      }),
    );
    // The QA trail is preserved: reject AND approve decision labels exist.
    const labels = await repo.listFeedbackLabels(demandara);
    const decisionsForAction = labels.filter((l) => l.subject_ref.includes(actionId));
    expect(decisionsForAction.map((l) => l.label).sort()).toEqual(['approved', 'rejected']);

    const send = await handlers.executeFrontDeskAction(
      operator(demandara, { params: { id: actionId } }),
    );
    expect((send.body as { response_time_ms: number }).response_time_ms).toBeGreaterThanOrEqual(
      20_000,
    );

    // PROOF discipline: every action in the loop is proof-linked — research
    // ×2 (proposal proofs) + the simulated send (lead_response proof).
    const detail = await handlers.getLeadDetail(operator(demandara, { params: { id: leadId } }));
    const detailBody = detail.body as {
      actions: Array<{ id: string; proof_id: string | null }>;
      proofs: Array<{ kind: string; evidence_tag: string }>;
    };
    expect(detailBody.actions).toHaveLength(3);
    expect(detailBody.actions.every((a) => a.proof_id)).toBe(true);
    expect(detailBody.proofs.length).toBeGreaterThanOrEqual(3);
    expect(detailBody.proofs.every((p) => p.evidence_tag)).toBe(true);

    // 5a. A merely-asserted outcome (no evidence ref) is likely_inference and
    //     must NOT move reputation.
    await handlers.createLeadOutcome(
      operator(demandara, {
        params: { id: leadId },
        body: {
          outcome: 'booking_intent',
          evidence_tag: 'likely_inference',
          agent_id: demandaraAgent.id,
        },
      }),
    );
    expect(await repo.listReputationEvents(demandara, demandaraAgent.id)).toHaveLength(0);

    // 5b. OUTCOME with CRM evidence — Demandara's proof currency is pipeline
    //     value with CRM refs. Only THIS verified_fact moves reputation.
    const outcome = await handlers.createLeadOutcome(
      operator(demandara, {
        params: { id: leadId },
        body: {
          outcome: 'booking_intent',
          evidence_tag: 'verified_fact',
          evidence_source: 'crm:hubspot:deal:dmd-001',
          estimated_value_cents: 2_400_000,
          agent_id: demandaraAgent.id,
        },
      }),
    );
    expect((outcome.body as { reputation_event_id: string }).reputation_event_id).toBeTruthy();

    // 5. Demandara's dashboard shows ITS world; reputation moved for ITS agent.
    const summary = await handlers.commandSummary(operator(demandara));
    const s = summary.body as {
      trustSummary: Record<string, number>;
      frontdeskSummary: Record<string, number>;
      skillproofSummary: Record<string, number | string>;
    };
    expect(s.trustSummary.total_agents).toBe(1);
    expect(s.frontdeskSummary.total_leads).toBe(1);
    expect(s.frontdeskSummary.booking_intents).toBe(2); // 1 inference + 1 verified
    expect(s.skillproofSummary.core20_count).toBe(20);
    const reputation = await repo.listReputationEvents(demandara, demandaraAgent.id);
    expect(reputation).toHaveLength(1);
    expect(reputation[0]!.delta).toBeGreaterThan(0);

    // 6. HARD ISOLATION: Tenant Zero sees none of it, and vice versa.
    const moverosSummary = await handlers.commandSummary(operator(moveros));
    const ms = moverosSummary.body as { frontdeskSummary: Record<string, number> };
    expect(ms.frontdeskSummary.total_leads).toBe(0);
    expect(await repo.listLeadIntakes(moveros)).toHaveLength(0);
    expect(await repo.listReputationEvents(moveros)).toHaveLength(0);
    // Demandara's lead detail is unreachable from the MoverOS seat.
    await expect(
      handlers.getLeadDetail(operator(moveros, { params: { id: leadId } })),
    ).rejects.toMatchObject({ status: 404 });
    // And no PII crosses any aggregate.
    expect(JSON.stringify(summary.body)).not.toContain('Prospect CTO');
    expect(JSON.stringify(summary.body)).not.toContain('555-0233');

    // 7. Guardrails identical on the second tenant: real send refused.
    await expect(
      handlers.executeFrontDeskAction(
        owner(demandara, { params: { id: actionId }, body: { simulation: false } }),
      ),
    ).rejects.toMatchObject({ status: 403 });
  });
});
