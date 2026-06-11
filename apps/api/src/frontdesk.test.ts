import { describe, it, expect, beforeEach } from 'vitest';
import { InMemoryRepository } from '@cognitia/db';
import { createGtmServices } from '@cognitia/agents';
import { ApiHandlers, type ApiRequest } from './handlers.js';

/**
 * COG-006 — MoverOS AI Front Desk (Command Book §E #8, #9 and the Prompt 5
 * acceptance criteria): encrypted PII confinement, approval-gated simulated
 * sends, exactly one proof + one front-desk audit per send, response-time
 * capture, structural refusal of real SMS, and PIPEDA purge.
 */

const TENANT = '11111111-1111-1111-1111-111111111111';
const PHONE = '604-555-0123';
const NAME = 'Jane Doe';
const MESSAGE = 'Hi, I need to move a 2-bedroom apartment on June 20, what would it cost?';

const asRole = (
  role: 'viewer' | 'operator' | 'owner',
  over: Partial<ApiRequest> = {},
): ApiRequest => ({ tenantId: TENANT, role, traceId: 'trace-frontdesk', ...over });

describe('MoverOS AI Front Desk (COG-006)', () => {
  let handlers: ApiHandlers;
  let repo: InMemoryRepository;

  beforeEach(() => {
    repo = new InMemoryRepository();
    handlers = new ApiHandlers(repo, createGtmServices({ repo, v1Mode: true }));
  });

  const ingest = async (over: Record<string, unknown> = {}) => {
    const res = await handlers.ingestLead(
      asRole('operator', {
        body: {
          source: 'sms_sim',
          contact_name: NAME,
          contact_phone: PHONE,
          message_body: MESSAGE,
          consent_captured: true,
          ...over,
        },
      }),
    );
    return (res.body as { lead: { id: string } }).lead.id;
  };

  const draft = async (leadId: string) => {
    const res = await handlers.draftLeadReply(asRole('operator', { params: { id: leadId } }));
    return (res.body as { action: { id: string } }).action.id;
  };

  const approve = (actionId: string) =>
    handlers.approveAction(
      asRole('operator', {
        params: { id: actionId },
        body: { reason: { reason_code: 'accurate_and_relevant' } },
      }),
    );

  it('intake stores PII encrypted-only; list and events never leak raw values (#PII)', async () => {
    const leadId = await ingest();

    // Stored row: encrypted columns, hash for lookup, no plaintext anywhere.
    const stored = await repo.getLeadIntake(TENANT, leadId);
    expect(stored!.contact_phone_enc).toMatch(/^enc:v1:/);
    expect(stored!.contact_name_enc).toMatch(/^enc:v1:/);
    expect(stored!.message_body_enc).toMatch(/^enc:v1:/);
    expect(stored!.contact_phone_hash).toMatch(/^sha256:/);
    const rowJson = JSON.stringify(stored);
    expect(rowJson).not.toContain('555-0123');
    expect(rowJson).not.toContain(NAME);
    expect(rowJson).not.toContain('2-bedroom');

    // Masked list: no PII for viewers.
    const list = await handlers.listLeads(asRole('viewer'));
    const listJson = JSON.stringify(list.body);
    expect(listJson).not.toContain('555-0123');
    expect(listJson).not.toContain(NAME);
    expect((list.body as { leads: Array<{ phone_masked: string }> }).leads[0]!.phone_masked).toBe(
      '•••23',
    );

    // Events/audit payloads: refs only.
    const events = await repo.listEvents(TENANT);
    expect(JSON.stringify(events)).not.toContain('555-0123');
    expect(JSON.stringify(await repo.listAuditEvents(TENANT))).not.toContain(NAME);

    // Operator detail decrypts; consent flag captured.
    const detail = await handlers.getLeadDetail(asRole('operator', { params: { id: leadId } }));
    const lead = (detail.body as { lead: { message_body: string; consent_captured: boolean } })
      .lead;
    expect(lead.message_body).toBe(MESSAGE);
    expect(lead.consent_captured).toBe(true);
    // Viewers cannot read decrypted detail.
    await expect(
      handlers.getLeadDetail(asRole('viewer', { params: { id: leadId } })),
    ).rejects.toMatchObject({ status: 403 });
  });

  it('drafts enter the existing approval lifecycle; nothing executes unapproved (#8 setup)', async () => {
    const leadId = await ingest();
    const actionId = await draft(leadId);

    const action = await repo.getAgentAction(TENANT, actionId);
    expect(action!.approval_status).toBe('proposed');
    expect(action!.simulation).toBe(true);
    expect(action!.risk_level).toBe('high');

    // The draft shows up in the standard approval queue with its body.
    const queue = await handlers.listAgentActions(
      asRole('viewer', { query: { status: 'proposed' } }),
    );
    const queued = (queue.body as { actions: Array<{ id: string; draft: { body: string } }> })
      .actions;
    expect(queued.some((a) => a.id === actionId && /MoverOS Front Desk/.test(a.draft.body))).toBe(
      true,
    );

    // Execute before approval → 409.
    await expect(
      handlers.executeFrontDeskAction(asRole('operator', { params: { id: actionId } })),
    ).rejects.toMatchObject({ status: 409 });
  });

  it('approved execute records a simulated send: exactly one proof + one audit, with response time (#8)', async () => {
    const leadId = await ingest({
      received_at: new Date(Date.now() - 42_000).toISOString(),
    });
    const actionId = await draft(leadId);
    await approve(actionId);

    const res = await handlers.executeFrontDeskAction(
      asRole('operator', { params: { id: actionId } }),
    );
    const body = res.body as { proof_id: string; response_time_ms: number };
    expect(body.response_time_ms).toBeGreaterThanOrEqual(42_000);

    // Exactly one proof: kind lead_response, verified_fact, evidence = the action.
    const proofs = await repo.listProofs(TENANT);
    expect(proofs).toHaveLength(1);
    expect(proofs[0]!.kind).toBe('lead_response');
    expect(proofs[0]!.evidence_tag).toBe('verified_fact');
    expect(proofs[0]!.evidence_ref).toBe(`agent_action:${actionId}`);
    expect(proofs[0]!.public_safe).toBe(false);

    // Exactly one front-desk send audit row; action linked to the proof.
    const audits = await repo.listAuditEvents(TENANT);
    expect(audits.filter((a) => a.action === 'frontdesk.simulated_send.v1')).toHaveLength(1);
    const action = await repo.getAgentAction(TENANT, actionId);
    expect(action!.proof_id).toBe(body.proof_id);
    expect(action!.execution_status).toBe('executed');
    expect(action!.simulation).toBe(true);

    // Idempotent replay: no second proof.
    await handlers.executeFrontDeskAction(asRole('operator', { params: { id: actionId } }));
    expect(await repo.listProofs(TENANT)).toHaveLength(1);
  });

  it('real SMS is structurally refused, even when approved (#9)', async () => {
    const leadId = await ingest();
    const actionId = await draft(leadId);
    await approve(actionId);

    await expect(
      handlers.executeFrontDeskAction(
        asRole('owner', { params: { id: actionId }, body: { simulation: false } }),
      ),
    ).rejects.toMatchObject({ status: 403 });

    // sms_real is not even an ingestable source in v1.1.
    await expect(ingest({ source: 'sms_real' })).rejects.toMatchObject({ status: 400 });

    // And the generic ledger execute path cannot send it either: there is no
    // SMS adapter, so the dispatch fails and the action is marked failed.
    await handlers.executeAction(asRole('operator', { params: { id: actionId } }));
    const after = await repo.getAgentAction(TENANT, actionId);
    expect(after!.execution_status).not.toBe('executed');
    expect(await repo.listProofs(TENANT)).toHaveLength(0); // nothing sent, nothing proven
  });

  it('purge-pii blanks the encrypted columns and blocks further drafting (PIPEDA)', async () => {
    const leadId = await ingest();
    const res = await handlers.purgeLeadPii(asRole('operator', { params: { id: leadId } }));
    expect((res.body as { lead: { pii_status: string } }).lead.pii_status).toBe('purged');

    const stored = await repo.getLeadIntake(TENANT, leadId);
    expect(stored!.contact_name_enc).toBeNull();
    expect(stored!.contact_phone_enc).toBeNull();
    expect(stored!.message_body_enc).toBeNull();

    const audits = await repo.listAuditEvents(TENANT);
    expect(audits.some((a) => a.action === 'lead.pii_purged.v1')).toBe(true);

    await expect(
      handlers.draftLeadReply(asRole('operator', { params: { id: leadId } })),
    ).rejects.toMatchObject({ status: 409 });
  });

  it('intake is role-gated and tenant-scoped', async () => {
    await expect(
      handlers.ingestLead(
        asRole('viewer', { body: { source: 'manual', contact_phone: PHONE, message_body: 'x' } }),
      ),
    ).rejects.toMatchObject({ status: 403 });

    await ingest();
    const other = await handlers.listLeads(
      asRole('viewer', { tenantId: '22222222-2222-2222-2222-222222222222' }),
    );
    expect((other.body as { leads: unknown[] }).leads).toHaveLength(0);
  });
});
