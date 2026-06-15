import { describe, it, expect, beforeEach } from 'vitest';
import { randomUUID } from 'node:crypto';
import {
  InMemoryRepository,
  verifyAuditChain,
  type ContactRow,
  type AgentActionRow,
  type AgentRunRow,
} from '@cognitia/db';
import { createGtmServices } from '@cognitia/agents';
import { FakeHubspotClient } from '@cognitia/integrations';
import { ApiHandlers, type ApiRequest } from './handlers.js';
import type { DsarExport, DsarErasureResult } from './dsar.js';

/**
 * DSAR — data-subject access export + right-to-erasure. Owner-only; both
 * operations audited; erasure anonymizes PII while preserving the append-only
 * audit chain (which never stored raw PII).
 */

const TENANT = '11111111-1111-1111-1111-111111111111';
const CONTACT = 'cccccccc-1111-2222-3333-444444444444';
const ts = (n: number) => `2026-06-${String(10 + n).padStart(2, '0')}T00:00:00.000Z`;

function contact(): ContactRow {
  return {
    id: CONTACT,
    tenant_id: TENANT,
    account_id: 'acc-1',
    full_name: 'Ada Lovelace',
    title: 'VP Eng',
    persona: 'champion',
    email_hash: 'sha256:ada',
    phone_hash: 'sha256:phone',
    is_suppressed: false,
    attributes: { source: 'hubspot' },
    created_at: ts(0),
    updated_at: ts(0),
  };
}

function run(): AgentRunRow {
  return {
    id: 'run-1',
    tenant_id: TENANT,
    agent: 'mira',
    objective: 'outbound',
    input_refs: [],
    status: 'completed',
    trace_id: 't',
    created_at: ts(0),
    updated_at: ts(0),
  };
}

function action(id: string, targetRef: string): AgentActionRow {
  return {
    id,
    tenant_id: TENANT,
    agent_run_id: 'run-1',
    action_type: 'crm.task.create',
    risk_level: 'low',
    idempotency_key: `idem-${id}`,
    approval_status: 'approved',
    execution_status: 'executed',
    target_ref: targetRef,
    evidence_refs: [],
    payload_ref: null,
    guardrail_results: [],
    result: null,
    created_at: ts(1),
    updated_at: ts(1),
  };
}

async function makeLab() {
  const repo = new InMemoryRepository();
  const handlers = new ApiHandlers(
    repo,
    createGtmServices({ repo, v1Mode: true, hubspotClient: new FakeHubspotClient() }),
  );
  repo.seedContact(contact());
  await repo.createAgentRun(run());
  await repo.createAgentAction(action('a1', `contact:${CONTACT}`));
  await repo.createAgentAction(action('a2', `account:acc-1`)); // noise — excluded
  // Audit chain: a1's lifecycle + one event on the contact + noise on a2.
  const audit = (subjectRef: string, name: string, at: string) =>
    repo.insertAuditEvent({
      id: randomUUID(),
      tenant_id: TENANT,
      actor_ref: 'user:operator',
      action: name,
      subject_ref: subjectRef,
      detail: {},
      occurred_at: at,
      created_at: at,
    });
  await audit(`agent_action:a1`, 'approved', ts(1));
  await audit(`agent_action:a1`, 'executed', ts(2));
  await audit(`contact:${CONTACT}`, 'note_added', ts(3));
  await audit(`agent_action:a2`, 'approved', ts(4)); // noise
  return { repo, handlers };
}

const owner = (over: Partial<ApiRequest> = {}): ApiRequest => ({
  tenantId: TENANT,
  role: 'owner',
  userRef: 'olivia',
  ...over,
});

describe('DSAR — data-subject access export', () => {
  let lab: Awaited<ReturnType<typeof makeLab>>;
  beforeEach(async () => {
    lab = await makeLab();
  });

  it('exports the subject PII + processing record + audit trail (owner-only)', async () => {
    const res = await lab.handlers.dsarExport(owner({ params: { id: CONTACT } }));
    expect(res.status).toBe(200);
    const b = res.body as DsarExport;
    expect(b.schema_version).toBe('dsar.v1');
    expect(b.contact.full_name).toBe('Ada Lovelace');
    expect(b.contact.erased).toBe(false);
    expect(b.actions.map((a) => a.id)).toEqual(['a1']); // a2 (account) excluded
    // a1 approved+executed + the contact note = 3; a2 noise excluded.
    expect(b.audit_trail).toHaveLength(3);
    expect(b.audit_trail.every((e) => e.subject_ref !== 'agent_action:a2')).toBe(true);
  });

  it('logs the export access (dsar_exported) and is owner-only (operator/viewer 403)', async () => {
    await lab.handlers.dsarExport(owner({ params: { id: CONTACT } }));
    const events = await lab.repo.listAuditEvents(TENANT);
    expect(events.find((e) => e.action === 'dsar_exported')?.actor_ref).toBe('user:olivia');
    for (const role of ['operator', 'viewer'] as const) {
      const err = await lab.handlers
        .dsarExport(owner({ role, params: { id: CONTACT } }))
        .catch((e) => e);
      expect(err.status).toBe(403);
    }
  });

  it('returns 404 for an unknown contact', async () => {
    const err = await lab.handlers.dsarExport(owner({ params: { id: 'nope' } })).catch((e) => e);
    expect(err.status).toBe(404);
  });
});

describe('DSAR — right-to-erasure', () => {
  let lab: Awaited<ReturnType<typeof makeLab>>;
  beforeEach(async () => {
    lab = await makeLab();
  });

  it('anonymizes PII, records the erasure, and PRESERVES the audit chain', async () => {
    const chainBefore = verifyAuditChain(await lab.repo.listAuditEvents(TENANT));
    expect(chainBefore.ok).toBe(true);

    const res = await lab.handlers.dsarErase(owner({ params: { id: CONTACT } }));
    expect(res.status).toBe(200);
    expect((res.body as DsarErasureResult).status).toBe('erased');

    const c = await lab.repo.getContact(TENANT, CONTACT);
    expect(c!.full_name).toBeNull();
    expect(c!.email_hash).toBeNull();
    expect(c!.phone_hash).toBeNull();
    expect(c!.is_suppressed).toBe(true);
    expect(c!.attributes).toMatchObject({ erased: true });

    const events = await lab.repo.listAuditEvents(TENANT);
    expect(events.find((e) => e.action === 'contact_data_erased')?.actor_ref).toBe('user:olivia');
    // The erasure appended an event but did NOT break the hash chain.
    expect(verifyAuditChain(events).ok).toBe(true);
  });

  it('is idempotent: a second erase reports already_erased', async () => {
    await lab.handlers.dsarErase(owner({ params: { id: CONTACT } }));
    const res2 = await lab.handlers.dsarErase(owner({ params: { id: CONTACT } }));
    expect((res2.body as DsarErasureResult).status).toBe('already_erased');
  });

  it('export after erasure shows erased=true with null PII', async () => {
    await lab.handlers.dsarErase(owner({ params: { id: CONTACT } }));
    const res = await lab.handlers.dsarExport(owner({ params: { id: CONTACT } }));
    const b = res.body as DsarExport;
    expect(b.contact.erased).toBe(true);
    expect(b.contact.full_name).toBeNull();
    // The processing record + audit trail remain available for accountability.
    expect(b.actions.map((a) => a.id)).toEqual(['a1']);
  });

  it('is owner-only (operator/viewer 403) and 404 for unknown contact', async () => {
    for (const role of ['operator', 'viewer'] as const) {
      const err = await lab.handlers
        .dsarErase(owner({ role, params: { id: CONTACT } }))
        .catch((e) => e);
      expect(err.status).toBe(403);
    }
    const err404 = await lab.handlers.dsarErase(owner({ params: { id: 'nope' } })).catch((e) => e);
    expect(err404.status).toBe(404);
  });
});
