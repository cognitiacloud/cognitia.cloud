import { describe, it, expect, beforeEach } from 'vitest';
import {
  InMemoryRepository,
  type AccountRow,
  type ContactRow,
  type IntegrationConnectionRow,
} from '@cognitia/db';
import { createGtmServices, type GtmServices } from '@cognitia/agents';
import { FakeHubspotClient } from '@cognitia/integrations';
import { ApiHandlers } from './handlers.js';
import {
  meetingWritebackToNoteProposal,
  meetingNoteFingerprint,
  ingestMeetingWriteback,
  MeetingWritebackError,
  MEETING_WRITEBACK_APPROVED_KIND,
  type MeetingWritebackEnvelope,
  type MeetingWritebackContext,
} from './meetingWriteback.js';

/**
 * MEETING-NOTES WRITEBACK ROUTING — an approved meeting writeback is routed
 * through the EXISTING governed `crm.note.create` lifecycle (HubSpot adapter +
 * approval gate + audit + idempotency), never a second write path. The summary
 * never enters the CRM write (PII discipline); one meeting yields exactly one
 * note (no duplicate engagement). Fakes only — no creds, no DB, no network.
 */

const TENANT = '11111111-1111-1111-1111-111111111111';
const ts = '2026-06-10T00:00:00.000Z';

const ctx: MeetingWritebackContext = { tenantId: TENANT, traceId: 'trace-mtg-1' };
const approved = (over: Partial<MeetingWritebackEnvelope> = {}): MeetingWritebackEnvelope => ({
  kind: MEETING_WRITEBACK_APPROVED_KIND,
  meeting_id: 'mtg-1',
  contact_id: 'ct-1',
  summary: 'Discussed rollout timeline; champion wants a security review next week.',
  occurred_at: ts,
  review_status: 'approved',
  ...over,
});

// --- pure mapping ------------------------------------------------------------

describe('meetingWritebackToNoteProposal (pure mapping)', () => {
  it('maps an approved writeback to a crm.note.create proposal targeting the contact', () => {
    const p = meetingWritebackToNoteProposal(approved(), ctx);
    expect(p.actionType).toBe('crm.note.create');
    expect(p.targetRef).toBe('contact:ct-1');
    expect(p.evidenceRefs).toEqual(['meeting:mtg-1']); // grounded in the meeting
    expect(p.agent).toBe('meeting');
    expect(p.riskLevel).toBe('low');
    // The raw summary is NOT inlined anywhere in the proposal (PII discipline).
    expect(JSON.stringify(p)).not.toContain('security review next week');
    // Out-of-band ref only.
    expect(p.payloadRef).toBe('meeting-summary:mtg-1');
  });

  it('fingerprint is deterministic per meeting and distinct across meetings', () => {
    expect(meetingNoteFingerprint('mtg-1')).toBe(meetingNoteFingerprint('mtg-1'));
    expect(meetingNoteFingerprint('mtg-1')).not.toBe(meetingNoteFingerprint('mtg-2'));
    // The proposal carries the meeting-keyed fingerprint (drives ledger dedup).
    expect(meetingWritebackToNoteProposal(approved(), ctx).contentFingerprint).toBe(
      meetingNoteFingerprint('mtg-1'),
    );
  });

  it('is fail-closed: refuses anything not explicitly approved or malformed', () => {
    expect(() =>
      meetingWritebackToNoteProposal(approved({ kind: 'writeback.preview' }), ctx),
    ).toThrow(MeetingWritebackError);
    expect(() =>
      meetingWritebackToNoteProposal(approved({ review_status: 'rejected' }), ctx),
    ).toThrow(MeetingWritebackError);
    expect(() => meetingWritebackToNoteProposal(approved({ meeting_id: 'bad id!' }), ctx)).toThrow(
      MeetingWritebackError,
    );
    expect(() => meetingWritebackToNoteProposal(approved({ contact_id: '' }), ctx)).toThrow(
      MeetingWritebackError,
    );
  });
});

// --- governed routing through the existing HubSpot integration ---------------

describe('ingestMeetingWriteback → governed crm.note.create lifecycle', () => {
  let repo: InMemoryRepository;
  let services: GtmServices;
  let handlers: ApiHandlers;
  let hubspot: FakeHubspotClient;

  beforeEach(() => {
    repo = new InMemoryRepository();
    const account: AccountRow = {
      id: 'acc-1', tenant_id: TENANT, name: 'Acme', domain: 'acme.com', industry: 'SaaS',
      employee_count: 200, region: 'NA', fit_score: 0.9, timing_score: 0.8, attributes: {},
      created_at: ts, updated_at: ts,
    }; // prettier-ignore
    const contact: ContactRow = {
      id: 'ct-1', tenant_id: TENANT, account_id: 'acc-1', full_name: 'Ada A', title: 'VP Eng',
      persona: 'champion', email_hash: 'sha256:ada', phone_hash: null, is_suppressed: false,
      attributes: {}, created_at: ts, updated_at: ts,
    }; // prettier-ignore
    const conn: IntegrationConnectionRow = {
      id: 'conn-1', tenant_id: TENANT, external_system: 'hubspot', status: 'active',
      credential_ref: 'cred-1', metadata: {}, created_at: ts, updated_at: ts,
    }; // prettier-ignore
    repo.seedAccount(account);
    repo.seedContact(contact);
    repo.seedIntegrationConnection(conn);
    hubspot = new FakeHubspotClient();
    services = createGtmServices({ repo, v1Mode: true, hubspotClient: hubspot });
    handlers = new ApiHandlers(repo, services, { hubspotClient: hubspot });
  });

  async function approve(id: string) {
    return handlers.approveAction({
      tenantId: TENANT,
      role: 'operator',
      params: { id },
      body: { reason: { reason_code: 'meets_playbook' } },
    });
  }
  const execute = (id: string) =>
    handlers.executeAction({ tenantId: TENANT, role: 'operator', params: { id } });

  it('proposes a note that approves → executes into exactly one HubSpot note write', async () => {
    const action = await ingestMeetingWriteback(services.ledger, approved(), ctx);
    expect(action.action_type).toBe('crm.note.create');
    expect(action.approval_status).toBe('proposed');

    await approve(action.id);
    const exec = await execute(action.id);
    expect(exec.status).toBe(200);

    const notes = hubspot.writeLog.filter((w) => w.kind === 'note');
    expect(notes).toHaveLength(1); // routed through the existing HubSpot adapter
    expect(notes[0]!.input.provenance?.approved_by).toBe('user:operator');
  });

  it('no side effect without approval — execute is refused before approval', async () => {
    const action = await ingestMeetingWriteback(services.ledger, approved(), ctx);
    const exec = await execute(action.id);
    expect(exec.status).toBeGreaterThanOrEqual(400); // 409 conflict, not executed
    expect(hubspot.writeLog).toHaveLength(0); // nothing written
  });

  it('re-delivering the same meeting never creates a duplicate note', async () => {
    const first = await ingestMeetingWriteback(services.ledger, approved(), ctx);
    // Same meeting re-delivered (even with an edited summary) → same action row.
    const replay = await ingestMeetingWriteback(
      services.ledger,
      approved({ summary: 'edited summary' }),
      ctx,
    );
    expect(replay.id).toBe(first.id); // ledger dedup on the meeting-keyed key

    await approve(first.id);
    expect((await execute(first.id)).status).toBe(200);
    // Re-executing the replay is an idempotent no-op — still exactly one write.
    expect((await execute(replay.id)).status).toBe(200);
    expect(hubspot.writeLog.filter((w) => w.kind === 'note')).toHaveLength(1);
  });

  it('a different meeting produces its own note (one engagement per meeting)', async () => {
    const a = await ingestMeetingWriteback(services.ledger, approved({ meeting_id: 'mtg-1' }), ctx);
    const b = await ingestMeetingWriteback(services.ledger, approved({ meeting_id: 'mtg-2' }), ctx);
    expect(b.id).not.toBe(a.id);

    for (const id of [a.id, b.id]) {
      await approve(id);
      expect((await execute(id)).status).toBe(200);
    }
    expect(hubspot.writeLog.filter((w) => w.kind === 'note')).toHaveLength(2);
  });
});
