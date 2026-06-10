import { describe, it, expect, beforeEach } from 'vitest';
import {
  InMemoryRepository,
  type AccountRow,
  type ContactRow,
  type IntegrationConnectionRow,
} from '@cognitia/db';
import { createGtmServices } from '@cognitia/agents';
import { FakeHubspotClient } from '@cognitia/integrations';
import { ApiHandlers } from './handlers.js';

/**
 * CRM-NOTE-1 — a second governed CRM action type. Proves Mira proposes a
 * grounded account-context note alongside the task, and that the note flows
 * through the SAME governed lifecycle as the task (preview → approve → execute
 * → undo), carries the evidence pack, and shows up as its own scorecard
 * segment. This is the buyer-visible proof that governance generalizes beyond
 * a single action type — not "it only makes follow-up tasks."
 */

const TENANT = '11111111-1111-1111-1111-111111111111';
const ts = '2026-06-10T00:00:00.000Z';

describe('CRM-NOTE-1 — grounded account-context note as a governed action', () => {
  let handlers: ApiHandlers;
  let repo: InMemoryRepository;
  let hubspot: FakeHubspotClient;

  beforeEach(async () => {
    repo = new InMemoryRepository();
    const account: AccountRow = {
      id: 'acc-1',
      tenant_id: TENANT,
      name: 'Acme',
      domain: 'acme.com',
      industry: 'SaaS',
      employee_count: 200,
      region: 'NA',
      fit_score: 0.9,
      timing_score: 0.8,
      attributes: {},
      created_at: ts,
      updated_at: ts,
    };
    const contact: ContactRow = {
      id: 'ct-1',
      tenant_id: TENANT,
      account_id: 'acc-1',
      full_name: 'Ada A',
      title: 'VP Eng',
      persona: 'champion',
      email_hash: 'sha256:ada',
      phone_hash: null,
      is_suppressed: false,
      attributes: {},
      created_at: ts,
      updated_at: ts,
    };
    const conn: IntegrationConnectionRow = {
      id: 'conn-1',
      tenant_id: TENANT,
      external_system: 'hubspot',
      status: 'active',
      credential_ref: 'cred-1',
      metadata: {},
      created_at: ts,
      updated_at: ts,
    };
    repo.seedAccount(account);
    repo.seedContact(contact);
    repo.seedIntegrationConnection(conn);
    hubspot = new FakeHubspotClient();
    handlers = new ApiHandlers(
      repo,
      createGtmServices({ repo, v1Mode: true, hubspotClient: hubspot }),
      { hubspotClient: hubspot },
    );
    await handlers.runMira({ tenantId: TENANT, role: 'operator', body: {} });
  });

  async function noteAction(): Promise<{ id: string; action_type: string }> {
    const list = await handlers.listAgentActions({ tenantId: TENANT });
    const actions = (
      list.body as { actions: Array<{ id: string; action_type: string; evidence_refs: string[] }> }
    ).actions;
    const note = actions.find((a) => a.action_type === 'crm.note.create');
    expect(note, 'Mira should propose a grounded context note').toBeDefined();
    return note!;
  }

  it('Mira proposes both a task and a grounded note for a fit account', async () => {
    const list = await handlers.listAgentActions({ tenantId: TENANT });
    const types = (
      list.body as { actions: Array<{ action_type: string; evidence_refs: string[] }> }
    ).actions;
    expect(types.map((a) => a.action_type).sort()).toEqual(['crm.note.create', 'crm.task.create']);
    // The note is grounded: it carries the same evidence pack, not empty.
    const note = types.find((a) => a.action_type === 'crm.note.create')!;
    expect(note.evidence_refs.length).toBeGreaterThan(0);
  });

  it('the note has a typed preview that targets the notes object with grounded body', async () => {
    const note = await noteAction();
    const res = await handlers.previewAction({ tenantId: TENANT, params: { id: note.id } });
    const plan = (res.body as { plan: { object: string; properties: Record<string, unknown> } })
      .plan;
    expect(plan.object).toBe('notes');
    expect(plan.properties['hs_note_body']).toBeDefined();
    const noteBody = String(plan.properties['hs_note_body']);
    expect(noteBody).toContain('account context');
    expect(noteBody).toContain('reviewed and approved');
    expect(noteBody).toContain('CRM fact'); // grounded, not empty
    expect(plan.properties['hs_task_subject']).toBeUndefined(); // it's a note, not a task
  });

  it('the note runs the full governed lifecycle: approve → execute → undo', async () => {
    const note = await noteAction();
    await handlers.approveAction({
      tenantId: TENANT,
      role: 'operator',
      params: { id: note.id },
      body: { reason: { reason_code: 'meets_playbook' } },
    });
    const exec = await handlers.executeAction({
      tenantId: TENANT,
      role: 'operator',
      params: { id: note.id },
    });
    expect(exec.status).toBe(200);
    // Exactly one note engagement written, with provenance.
    const noteWrites = hubspot.writeLog.filter((w) => w.kind === 'note');
    expect(noteWrites).toHaveLength(1);
    expect(noteWrites[0]!.input.provenance?.approved_by).toBe('user:operator');

    // And it is reversible like any governed write.
    const undo = await handlers.rollbackAction({
      tenantId: TENANT,
      role: 'operator',
      params: { id: note.id },
      body: { reason: { reason_code: 'wrong_target' } },
    });
    expect(undo.status).toBe(200);
    expect(hubspot.archiveLog.some((a) => a.object === 'notes')).toBe(true);
  });

  it('the note has a decision rationale (the WHY surface generalizes)', async () => {
    const note = await noteAction();
    const res = await handlers.actionRationale({ tenantId: TENANT, params: { id: note.id } });
    const r = res.body as {
      account: { name: string } | null;
      score: { combined: number } | null;
      evidence: unknown[];
    };
    expect(r.account?.name).toBe('Acme');
    expect(r.score?.combined).toBeGreaterThan(0);
    expect(r.evidence.length).toBeGreaterThan(0);
  });

  it('notes appear as their own scorecard segment', async () => {
    const note = await noteAction();
    await handlers.approveAction({
      tenantId: TENANT,
      role: 'operator',
      params: { id: note.id },
      body: { reason: { reason_code: 'meets_playbook' } },
    });
    const res = await handlers.metricsScorecards({ tenantId: TENANT });
    const segments = (res.body as { segments: Array<{ action_type: string }> }).segments;
    expect(segments.some((s) => s.action_type === 'crm.note.create')).toBe(true);
    expect(segments.some((s) => s.action_type === 'crm.task.create')).toBe(true);
  });
});
