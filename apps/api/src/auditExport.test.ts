import { describe, it, expect, beforeEach } from 'vitest';
import { randomUUID } from 'node:crypto';
import {
  InMemoryRepository,
  verifyAuditChain,
  type AgentActionRow,
  type AgentRunRow,
  type ContactRow,
} from '@cognitia/db';
import { createGtmServices } from '@cognitia/agents';
import { FakeHubspotClient } from '@cognitia/integrations';
import { ApiHandlers, type ApiRequest } from './handlers.js';
import {
  classifyRetention,
  DEFAULT_AUDIT_RETENTION_DAYS,
  type ContactAuditExport,
  type RetentionStatus,
} from './auditExport.js';

/**
 * SEC-2 — audit-trail export + retention. One-click, self-verifying export of a
 * contact's full action + approval chain (scoped to the contact, integrity
 * proof embedded, export access itself logged), plus a minimum-retention status
 * report. Builds on the SEC-1 tamper-evident chain; preserves every guardrail.
 */

const TENANT = '11111111-1111-1111-1111-111111111111';
// Historical dates so retention-window math is independent of the wall clock:
// all seeded events are years old, well inside the 7-year default window but
// far outside a 1-day custom window.
const ts = (n: number) => `2020-06-${String(10 + n).padStart(2, '0')}T00:00:00.000Z`;

function makeHandlers(repo: InMemoryRepository): ApiHandlers {
  return new ApiHandlers(
    repo,
    createGtmServices({ repo, v1Mode: true, hubspotClient: new FakeHubspotClient() }),
  );
}

function contact(id: string): ContactRow {
  return {
    id,
    tenant_id: TENANT,
    account_id: 'acc-1',
    full_name: 'Ada Lovelace',
    title: 'VP Eng',
    persona: 'champion',
    email_hash: 'sha256:ada',
    phone_hash: null,
    is_suppressed: false,
    attributes: {},
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
    trace_id: 'trace-1',
    created_at: ts(0),
    updated_at: ts(0),
  };
}

function action(id: string, targetRef: string, createdAt: string): AgentActionRow {
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
    evidence_refs: ['e1'],
    payload_ref: 'draft:1',
    guardrail_results: [{ name: 'evidence', passed: true }],
    result: null,
    created_at: createdAt,
    updated_at: createdAt,
  };
}

/** Seed an audit event (the memory repo computes the hash chain on insert). */
async function audit(
  repo: InMemoryRepository,
  subjectRef: string,
  actionName: string,
  occurredAt: string,
): Promise<void> {
  await repo.insertAuditEvent({
    id: randomUUID(),
    tenant_id: TENANT,
    actor_ref: 'user:operator',
    action: actionName,
    subject_ref: subjectRef,
    detail: {},
    occurred_at: occurredAt,
    created_at: occurredAt,
  });
}

/** A tenant with two contacts: c1 has a full action+approval chain; c2 is noise. */
async function seedTenant(repo: InMemoryRepository): Promise<{ c1: string; c2: string }> {
  const c1 = 'ct-1';
  const c2 = 'ct-2';
  repo.seedContact(contact(c1));
  repo.seedContact({ ...contact(c2), id: c2, full_name: 'Other' });
  await repo.createAgentRun(run());
  await repo.createAgentAction(action('a1', `contact:${c1}`, ts(1)));
  await repo.createAgentAction(action('a2', `contact:${c1}`, ts(2)));
  await repo.createAgentAction(action('a3', `contact:${c2}`, ts(3)));
  // c1's full chain: proposed → approved → executed for a1; proposed for a2.
  await audit(repo, `agent_action:a1`, 'action_proposed', ts(1));
  await audit(repo, `agent_action:a1`, 'action_approved', ts(2));
  await audit(repo, `agent_action:a1`, 'action_executed', ts(3));
  await audit(repo, `agent_action:a2`, 'action_proposed', ts(4));
  // c2's event — must be excluded from c1's export.
  await audit(repo, `agent_action:a3`, 'action_proposed', ts(5));
  return { c1, c2 };
}

const op = (over: Partial<ApiRequest> = {}): ApiRequest => ({
  tenantId: TENANT,
  role: 'operator',
  userRef: 'olivia',
  ...over,
});

describe('SEC-2 — per-contact audit export', () => {
  let repo: InMemoryRepository;
  let handlers: ApiHandlers;
  let c1: string;
  let c2: string;

  beforeEach(async () => {
    repo = new InMemoryRepository();
    handlers = makeHandlers(repo);
    ({ c1, c2 } = await seedTenant(repo));
  });

  const exportFor = async (id: string) => {
    const res = await handlers.exportContactAudit(op({ params: { id } }));
    return { res, bundle: res.body as ContactAuditExport };
  };

  it('exports the full action + approval chain scoped to the contact', async () => {
    const { res, bundle } = await exportFor(c1);
    expect(res.status).toBe(200);
    expect(bundle.schema_version).toBe('sec-2.v1');
    expect(bundle.contact.id).toBe(c1);
    // Only c1's two actions; a3 (c2) is excluded.
    expect(bundle.action_count).toBe(2);
    expect(bundle.actions.map((a) => a.id).sort()).toEqual(['a1', 'a2']);
    // a1's three events + a2's one = 4; a3's event excluded.
    expect(bundle.approval_chain).toHaveLength(4);
    expect(bundle.approval_chain.every((e) => e.subject_ref !== 'agent_action:a3')).toBe(true);
    // Oldest-first ordering.
    expect(bundle.approval_chain[0]!.action).toBe('action_proposed');
  });

  it('embeds a passing integrity proof and is recomputable by a reviewer', async () => {
    const { bundle } = await exportFor(c1);
    expect(bundle.chain_verification.ok).toBe(true);
    // The reviewer can independently recompute over the same tenant chain.
    const independent = verifyAuditChain(await repo.listAuditEvents(TENANT));
    // (independent now includes the export-access event, but still verifies.)
    expect(independent.ok).toBe(true);
  });

  it('logs the export access itself (append-only) without breaking the chain', async () => {
    const before = (await repo.listAuditEvents(TENANT)).length;
    const { bundle } = await exportFor(c1);
    const after = await repo.listAuditEvents(TENANT);
    // Exactly one new event: the export-access log.
    expect(after.length).toBe(before + 1);
    const accessEvent = after.find((e) => e.action === 'audit_exported');
    expect(accessEvent?.subject_ref).toBe(`contact:${c1}`);
    expect(accessEvent?.actor_ref).toBe('user:olivia');
    // The embedded proof was computed BEFORE the access event was appended.
    expect(bundle.chain_verification.events).toBe(before);
    // Chain still verifies after the append.
    expect(verifyAuditChain(after).ok).toBe(true);
  });

  it('is operator-gated: a viewer cannot export (least privilege)', async () => {
    const err = await handlers
      .exportContactAudit(op({ role: 'viewer', params: { id: c1 } }))
      .catch((e) => e);
    expect(err.status).toBe(403);
    // No access event was written for the denied attempt.
    const events = await repo.listAuditEvents(TENANT);
    expect(events.some((e) => e.action === 'audit_exported')).toBe(false);
  });

  it('returns 404 for an unknown contact', async () => {
    const err = await handlers.exportContactAudit(op({ params: { id: 'nope' } })).catch((e) => e);
    expect(err.status).toBe(404);
  });

  it('carries a retention block with the default window', async () => {
    const { bundle } = await exportFor(c1);
    expect(bundle.retention.window_days).toBe(DEFAULT_AUDIT_RETENTION_DAYS);
    expect(bundle.retention.compliant).toBe(true);
    expect(bundle.retention.total_events).toBe(4);
    expect(c2).toBe('ct-2');
  });
});

describe('SEC-2 — retention status', () => {
  let repo: InMemoryRepository;
  let handlers: ApiHandlers;

  beforeEach(async () => {
    repo = new InMemoryRepository();
    handlers = makeHandlers(repo);
    await seedTenant(repo);
  });

  it('reports a compliant minimum-retention floor over the whole tenant log', async () => {
    const res = await handlers.auditRetention(op());
    const status = res.body as RetentionStatus;
    expect(res.status).toBe(200);
    expect(status.policy).toBe('retain_minimum');
    expect(status.window_days).toBe(DEFAULT_AUDIT_RETENTION_DAYS);
    expect(status.total_events).toBe(5);
    expect(status.compliant).toBe(true);
    expect(status.beyond_window_count).toBe(0);
  });

  it('is viewer-allowed (read-only compliance report, no PII)', async () => {
    const res = await handlers.auditRetention(op({ role: 'viewer' }));
    expect(res.status).toBe(200);
  });

  it('honors a custom window and flags archival-eligible events', async () => {
    const res = await handlers.auditRetention(op({ query: { retention_days: '1' } }));
    const status = res.body as RetentionStatus;
    // All seeded events are far older than 1 day relative to "now".
    expect(status.window_days).toBe(1);
    expect(status.beyond_window_count).toBe(5);
    expect(status.compliant).toBe(true); // append-only ⇒ floor still met
    expect(status.note).toMatch(/archival/i);
  });
});

describe('SEC-2 — classifyRetention (pure)', () => {
  it('classifies within/beyond a window deterministically', () => {
    const now = '2026-06-20T00:00:00.000Z';
    const mk = (occurred: string) =>
      ({
        id: randomUUID(),
        tenant_id: TENANT,
        actor_ref: 'user:op',
        action: 'x',
        subject_ref: 's',
        detail: {},
        occurred_at: occurred,
        created_at: occurred,
        prev_hash: 'p',
        hash: 'h',
      }) as const;
    const events = [mk('2026-06-01T00:00:00.000Z'), mk('2026-06-19T00:00:00.000Z')];
    const status = classifyRetention([...events], 5, now);
    expect(status.total_events).toBe(2);
    expect(status.beyond_window_count).toBe(1); // June 1 is >5 days before June 20
    expect(status.within_window_count).toBe(1);
    expect(status.oldest_event_at).toBe('2026-06-01T00:00:00.000Z');
    expect(status.newest_event_at).toBe('2026-06-19T00:00:00.000Z');
  });

  it('handles an empty set', () => {
    const status = classifyRetention([], 30, '2026-06-20T00:00:00.000Z');
    expect(status.total_events).toBe(0);
    expect(status.oldest_event_at).toBeNull();
    expect(status.retained_through_days).toBe(0);
    expect(status.compliant).toBe(true);
  });
});
