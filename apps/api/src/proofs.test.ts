import { describe, it, expect, beforeEach } from 'vitest';
import { InMemoryRepository } from '@cognitia/db';
import { createGtmServices } from '@cognitia/agents';
import { ApiHandlers, type ApiRequest } from './handlers.js';

/**
 * COG-003 — Proof Registry integrity at the API surface (Command Book §E
 * tests #1, #5, #6, #7, #11): evidence-tag validation, verified_fact evidence
 * requirements, default-deny publishing, PII-gated redaction checks, public
 * projection that never leaks private fields, and supersede-not-edit.
 */

const TENANT = '11111111-1111-1111-1111-111111111111';
const SUBJECT = 'c0a00000-0000-0000-0000-000000000001';

const operator = (over: Partial<ApiRequest> = {}): ApiRequest => ({
  tenantId: TENANT,
  role: 'operator',
  traceId: 'trace-proofs',
  ...over,
});

const validBody = (over: Record<string, unknown> = {}) => ({
  kind: 'lead_response',
  subject_type: 'agent',
  subject_id: SUBJECT,
  evidence_tag: 'verified_fact',
  evidence_ref: 'event:abc',
  verifier_ref: 'user:operator',
  summary_public: 'Lead answered within 42 seconds (simulation).',
  details_private: { transcript_ref: 'enc:v1:t1' },
  ...over,
});

describe('Proof Registry (COG-003)', () => {
  let handlers: ApiHandlers;
  let repo: InMemoryRepository;

  beforeEach(() => {
    repo = new InMemoryRepository();
    handlers = new ApiHandlers(repo, createGtmServices({ repo, v1Mode: true }));
  });

  const create = async (body: Record<string, unknown>) => handlers.createProof(operator({ body }));

  it('rejects a proof without an evidence_tag (#1)', async () => {
    await expect(create(validBody({ evidence_tag: undefined }))).rejects.toMatchObject({
      status: 400,
    });
    await expect(create(validBody({ evidence_tag: 'confirmed' }))).rejects.toMatchObject({
      status: 400,
    });
  });

  it('verified_fact requires evidence_ref AND verifier_ref (#5)', async () => {
    await expect(create(validBody({ evidence_ref: undefined }))).rejects.toMatchObject({
      status: 400,
    });
    await expect(create(validBody({ verifier_ref: undefined }))).rejects.toMatchObject({
      status: 400,
    });
    const res = await create(validBody());
    expect(res.status).toBe(201);
  });

  it('creation is mutating-role gated and emits one event + one audit row', async () => {
    await expect(
      handlers.createProof(operator({ role: 'viewer', body: validBody() })),
    ).rejects.toMatchObject({ status: 403 });

    await create(validBody());
    const events = await repo.listEvents(TENANT);
    const audits = await repo.listAuditEvents(TENANT);
    expect(events.filter((e) => e.event_name === 'proof.created.v1')).toHaveLength(1);
    expect(audits.filter((a) => a.action === 'proof.created.v1')).toHaveLength(1);
    // Event payloads carry refs/tags only — never summary text or details.
    const payload = JSON.stringify(events[0]!.payload);
    expect(payload).not.toContain('42 seconds');
    expect(payload).not.toContain('enc:v1:t1');
  });

  it('public_safe defaults to false and the redaction check gates publishing (#6)', async () => {
    const created = await create(
      validBody({ summary_public: 'call jane.doe@example.com at 604-555-0123' }),
    );
    const id = (created.body as { proof: { id: string; public_safe: boolean } }).proof.id;
    expect((created.body as { proof: { public_safe: boolean } }).proof.public_safe).toBe(false);

    // PII in the summary → blocked, with audit-safe findings.
    const blocked = await handlers.proofRedactionCheck(operator({ params: { id } }));
    const blockedBody = blocked.body as { publish_safe: boolean; findings: string[] };
    expect(blockedBody.publish_safe).toBe(false);
    expect(blockedBody.findings.length).toBeGreaterThan(0);
    expect(blockedBody.findings.join(' ')).not.toContain('jane.doe');

    // Clean summary → published.
    const clean = await create(validBody());
    const cleanId = (clean.body as { proof: { id: string } }).proof.id;
    const passed = await handlers.proofRedactionCheck(operator({ params: { id: cleanId } }));
    expect((passed.body as { publish_safe: boolean }).publish_safe).toBe(true);
  });

  it('the public projection returns only redaction-checked rows and never private fields (#7)', async () => {
    const created = await create(validBody());
    const id = (created.body as { proof: { id: string } }).proof.id;

    // Nothing public before the check.
    let pub = await handlers.listPublicProofs(operator());
    expect((pub.body as { proofs: unknown[] }).proofs).toHaveLength(0);

    await handlers.proofRedactionCheck(operator({ params: { id } }));
    pub = await handlers.listPublicProofs(operator());
    const rows = (pub.body as { proofs: Record<string, unknown>[] }).proofs;
    expect(rows).toHaveLength(1);
    for (const forbidden of ['details_private', 'evidence_ref', 'verifier_ref', 'subject_id']) {
      expect(rows[0]).not.toHaveProperty(forbidden);
    }
    expect(rows[0]!.evidence_tag).toBe('verified_fact');
  });

  it('proofs are corrected by supersede, never edited (#11)', async () => {
    const created = await create(
      validBody({ evidence_tag: 'unknown', evidence_ref: undefined, verifier_ref: undefined }),
    );
    const priorId = (created.body as { proof: { id: string } }).proof.id;

    const superseded = await handlers.supersedeProof(
      operator({ params: { id: priorId }, body: validBody() }),
    );
    expect(superseded.status).toBe(201);
    const row = (superseded.body as { proof: { supersedes_proof_id: string } }).proof;
    expect(row.supersedes_proof_id).toBe(priorId);

    // Superseding a missing proof is a 404; there is no update/delete surface.
    await expect(
      handlers.supersedeProof(operator({ params: { id: 'missing' }, body: validBody() })),
    ).rejects.toMatchObject({ status: 404 });
    const handlerNames = Object.getOwnPropertyNames(Object.getPrototypeOf(handlers));
    expect(handlerNames.some((n) => /proof/i.test(n) && /(update|delete|patch)/i.test(n))).toBe(
      false,
    );
  });

  it('proof routes are tenant-scoped (no cross-tenant reads)', async () => {
    await create(validBody());
    const other = await handlers.listProofs(
      operator({ tenantId: '22222222-2222-2222-2222-222222222222' }),
    );
    expect((other.body as { proofs: unknown[] }).proofs).toHaveLength(0);
  });
});
