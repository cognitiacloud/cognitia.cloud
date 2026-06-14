import { describe, it, expect, beforeEach } from 'vitest';
import { randomUUID } from 'node:crypto';
import { InMemoryRepository, type AuditEventRow } from '@cognitia/db';
import { createGtmServices } from '@cognitia/agents';
import { FakeHubspotClient } from '@cognitia/integrations';
import { ApiHandlers, type ApiRequest } from './handlers.js';
import {
  chainTip,
  compareToAnchor,
  InMemoryAnchorSink,
  anchorAuditChain,
  verifyAgainstLatestAnchor,
  type AnchorRecord,
  type AnchorVerification,
} from './anchoring.js';

/**
 * Audit-chain anchoring: publish the chain tip to an independent sink, then
 * detect rewrite/truncation by checking the anchored tip is still present in the
 * live chain. The in-memory sink is mechanism-only (documented).
 */

const TENANT = '11111111-1111-1111-1111-111111111111';
const ts = (n: number) => `2026-06-${String(10 + n).padStart(2, '0')}T00:00:00.000Z`;

async function seedAudit(repo: InMemoryRepository, n: number): Promise<void> {
  for (let i = 1; i <= n; i++) {
    await repo.insertAuditEvent({
      id: randomUUID(),
      tenant_id: TENANT,
      actor_ref: 'user:op',
      action: `evt_${i}`,
      subject_ref: `agent_action:a${i}`,
      detail: {},
      occurred_at: ts(i),
      created_at: ts(i),
    });
  }
}

describe('anchoring — chainTip + compareToAnchor (pure)', () => {
  it('empty chain → null tip, ok', () => {
    expect(chainTip([])).toEqual({ events: 0, tip_hash: null, chain_ok: true });
  });

  it('computes the head hash of a real chain and verifies it', async () => {
    const repo = new InMemoryRepository();
    await seedAudit(repo, 3);
    const events = await repo.listAuditEvents(TENANT);
    const tip = chainTip(events);
    expect(tip.events).toBe(3);
    expect(tip.chain_ok).toBe(true);
    expect(tip.tip_hash).toBeTruthy();
    // The tip is some event's hash, and no event uses it as prev_hash (it's the head).
    expect(events.some((e) => e.hash === tip.tip_hash)).toBe(true);
    expect(events.some((e) => e.prev_hash === tip.tip_hash)).toBe(false);
  });

  it('append-only growth stays consistent; a rewritten/absent tip is detected', async () => {
    const repo = new InMemoryRepository();
    await seedAudit(repo, 3);
    const anchored: AnchorRecord = {
      tenant_id: TENANT,
      anchored_at: ts(3),
      ...chainTip(await repo.listAuditEvents(TENANT)),
    };

    // Grow the chain — old hashes preserved → consistent.
    await seedAudit(repo, 2);
    const grown = await repo.listAuditEvents(TENANT);
    expect(compareToAnchor(grown, anchored)).toEqual({
      consistent: true,
      reason: 'append_only_growth',
    });

    // Simulate a rewrite: the anchored tip hash no longer appears in the chain.
    const rewritten: AuditEventRow[] = grown.map((e) =>
      e.hash === anchored.tip_hash ? { ...e, hash: 'REWRITTEN', action: 'tampered' } : e,
    );
    expect(compareToAnchor(rewritten, anchored).consistent).toBe(false);
    expect(compareToAnchor(rewritten, anchored).reason).toMatch(
      /anchored_tip_absent|current_chain_broken/,
    );
  });
});

describe('anchoring — repo + sink wrappers', () => {
  it('anchorAuditChain publishes the tip; verify reports append-only growth', async () => {
    const repo = new InMemoryRepository();
    const sink = new InMemoryAnchorSink();
    await seedAudit(repo, 2);

    const rec = await anchorAuditChain(repo, TENANT, sink, { now: ts(2) });
    expect(rec.events).toBe(2);
    expect((await sink.latest(TENANT))?.tip_hash).toBe(rec.tip_hash);

    await seedAudit(repo, 1); // append
    const v = await verifyAgainstLatestAnchor(repo, TENANT, sink, { now: ts(9) });
    expect(v.consistent).toBe(true);
    expect(v.reason).toBe('append_only_growth');
    expect(v.current.events).toBe(3);
  });

  it('verify with no anchor reports no_anchor', async () => {
    const repo = new InMemoryRepository();
    const v = await verifyAgainstLatestAnchor(repo, TENANT, new InMemoryAnchorSink());
    expect(v.anchored).toBeNull();
    expect(v.reason).toBe('no_anchor');
  });
});

describe('anchoring — handlers (gating + audit)', () => {
  let repo: InMemoryRepository;
  let handlers: ApiHandlers;
  const owner = (over: Partial<ApiRequest> = {}): ApiRequest => ({
    tenantId: TENANT,
    role: 'owner',
    userRef: 'olivia',
    ...over,
  });

  beforeEach(async () => {
    repo = new InMemoryRepository();
    handlers = new ApiHandlers(
      repo,
      createGtmServices({ repo, v1Mode: true, hubspotClient: new FakeHubspotClient() }),
    );
    await seedAudit(repo, 2);
  });

  it('anchor is owner-only and audited; verify is viewer-allowed', async () => {
    // operator/viewer cannot anchor.
    for (const role of ['operator', 'viewer'] as const) {
      const err = await handlers.anchorAudit(owner({ role })).catch((e) => e);
      expect(err.status).toBe(403);
    }
    const res = await handlers.anchorAudit(owner());
    expect(res.status).toBe(200);
    expect((res.body as AnchorRecord).events).toBe(2);
    const events = await repo.listAuditEvents(TENANT);
    expect(events.some((e) => e.action === 'audit_chain_anchored')).toBe(true);

    // verify is read-only → viewer allowed; consistent after the anchor (the
    // anchoring event is append-only growth).
    const v = await handlers.verifyAuditAnchor(owner({ role: 'viewer' }));
    expect(v.status).toBe(200);
    expect((v.body as AnchorVerification).consistent).toBe(true);
  });
});
