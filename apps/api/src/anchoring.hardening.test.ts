import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { randomUUID } from 'node:crypto';
import { mkdtemp, rm, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { InMemoryRepository, type AuditEventRow } from '@cognitia/db';
import { createGtmServices } from '@cognitia/agents';
import { FakeHubspotClient } from '@cognitia/integrations';
import { ApiHandlers, type ApiRequest } from './handlers.js';
import {
  chainTip,
  compareToAnchor,
  anchorAuditChain,
  FileAnchorSink,
  AnchorPublishError,
  type AnchorRecord,
  type AnchorSink,
} from './anchoring.js';

/**
 * Item 6 — anchor-seam hardening.
 *
 * Three properties under test:
 *   1. FileAnchorSink is durable across a process restart (append-only JSONL)
 *      and tenant-scoped — a real step up from the in-memory sink.
 *   2. Publish failure is FAIL-CLOSED: anchorAuditChain throws AnchorPublishError
 *      and the handler records NO `audit_chain_anchored` event, so a failed
 *      anchor never leaves false evidence of tamper-proofing.
 *   3. The HONEST LIMITATION: because FileAnchorSink is co-located and writable
 *      by the app role, a tamperer who rewrites the chain AND the anchor file
 *      defeats detection. This is the residual that only an EXTERNAL,
 *      independent custodian closes — asserted here so the gap stays visible.
 */

const TENANT = '11111111-1111-1111-1111-111111111111';
const OTHER = '22222222-2222-2222-2222-222222222222';
const ts = (n: number) => `2026-06-${String(10 + n).padStart(2, '0')}T00:00:00.000Z`;

async function seedAudit(repo: InMemoryRepository, n: number, tenant = TENANT): Promise<void> {
  for (let i = 1; i <= n; i++) {
    await repo.insertAuditEvent({
      id: randomUUID(),
      tenant_id: tenant,
      actor_ref: 'user:op',
      action: `evt_${i}`,
      subject_ref: `agent_action:a${i}`,
      detail: {},
      occurred_at: ts(i),
      created_at: ts(i),
    });
  }
}

describe('FileAnchorSink — durable + tenant-scoped (append-only)', () => {
  let dir: string;
  let file: string;
  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), 'anchor-'));
    file = join(dir, 'anchors.jsonl');
  });
  afterEach(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  it('returns null before anything is published (missing file is not an error)', async () => {
    expect(await new FileAnchorSink(file).latest(TENANT)).toBeNull();
  });

  it('survives a process restart — a fresh sink instance reads the prior anchor', async () => {
    const repo = new InMemoryRepository();
    await seedAudit(repo, 3);
    const rec = await anchorAuditChain(repo, TENANT, new FileAnchorSink(file), { now: ts(3) });

    // New instance over the same file == "after a restart".
    const reopened = new FileAnchorSink(file);
    expect(await reopened.latest(TENANT)).toEqual(rec);
  });

  it('is append-only: every publish is retained and the latest wins per tenant', async () => {
    const sink = new FileAnchorSink(file);
    const h = (c: string) => c.repeat(64); // a well-formed sha256-hex placeholder
    const a: AnchorRecord = { tenant_id: TENANT, anchored_at: ts(1), events: 1, tip_hash: h('a'), chain_ok: true }; // prettier-ignore
    const b: AnchorRecord = { tenant_id: TENANT, anchored_at: ts(2), events: 2, tip_hash: h('b'), chain_ok: true }; // prettier-ignore
    const other: AnchorRecord = { tenant_id: OTHER, anchored_at: ts(2), events: 9, tip_hash: h('c'), chain_ok: true }; // prettier-ignore
    await sink.publish(a);
    await sink.publish(other);
    await sink.publish(b);

    expect(await sink.latest(TENANT)).toEqual(b); // latest for the tenant
    expect(await sink.latest(OTHER)).toEqual(other); // tenant-scoped
    // The earlier record is still physically present (append-only, never rewritten).
    const lines = (await readFile(file, 'utf8')).trim().split('\n');
    expect(lines).toHaveLength(3);
    expect(JSON.parse(lines[0]!)).toEqual(a);
  });

  it('whitelist-validates before persisting — a malformed record is rejected, not written', async () => {
    const sink = new FileAnchorSink(file);
    const bad: AnchorRecord = {
      tenant_id: 'not-a-uuid',
      anchored_at: ts(1),
      events: 1,
      tip_hash: 'deadbeef', // not 64-hex
      chain_ok: true,
    };
    await expect(sink.publish(bad)).rejects.toBeInstanceOf(TypeError);
    // Nothing was written: the durable file holds only well-formed records.
    expect(await new FileAnchorSink(file).latest(TENANT)).toBeNull();
  });
});

describe('anchor publish failure is fail-closed', () => {
  class FailingSink implements AnchorSink {
    async publish(): Promise<void> {
      throw new Error('sink unreachable');
    }
    async latest(): Promise<AnchorRecord | null> {
      return null;
    }
  }

  it('anchorAuditChain throws AnchorPublishError when the sink cannot persist', async () => {
    const repo = new InMemoryRepository();
    await seedAudit(repo, 2);
    const err = await anchorAuditChain(repo, TENANT, new FailingSink()).catch((e) => e);
    expect(err).toBeInstanceOf(AnchorPublishError);
    expect((err as AnchorPublishError).tenantId).toBe(TENANT);
  });

  it('the handler records NO audit_chain_anchored event when publishing fails', async () => {
    const repo = new InMemoryRepository();
    await seedAudit(repo, 2);
    const handlers = new ApiHandlers(
      repo,
      createGtmServices({ repo, v1Mode: true, hubspotClient: new FakeHubspotClient() }),
      { anchorSink: new FailingSink() },
    );
    const owner: ApiRequest = { tenantId: TENANT, role: 'owner', userRef: 'olivia' };
    await expect(handlers.anchorAudit(owner)).rejects.toBeInstanceOf(AnchorPublishError);

    // No false evidence: the chain was NOT marked anchored.
    const events = await repo.listAuditEvents(TENANT);
    expect(events.some((e) => e.action === 'audit_chain_anchored')).toBe(false);
  });
});

describe('anchor detection — replay/tamper signals', () => {
  it('detects truncation below the anchored count (history_shrank)', async () => {
    // A live chain of 1 verifying event whose tip the anchor claims at events=5:
    // tip present + chain ok but fewer events than anchored == an inconsistency.
    const repo = new InMemoryRepository();
    await seedAudit(repo, 1);
    const live = await repo.listAuditEvents(TENANT);
    const tip = chainTip(live);
    const forgedHigh: AnchorRecord = {
      tenant_id: TENANT,
      anchored_at: ts(5),
      events: 5,
      tip_hash: tip.tip_hash,
      chain_ok: true,
    };
    expect(compareToAnchor(live, forgedHigh)).toEqual({
      consistent: false,
      reason: 'history_shrank',
    });
  });

  it('detects a broken live chain before consulting the anchor (current_chain_broken)', async () => {
    const repo = new InMemoryRepository();
    await seedAudit(repo, 3);
    const events = await repo.listAuditEvents(TENANT);
    const anchor: AnchorRecord = {
      tenant_id: TENANT,
      anchored_at: ts(3),
      ...chainTip(events),
    };
    // Mutate content without fixing forward hashes → the chain no longer verifies.
    const broken: AuditEventRow[] = events.map((e, i) =>
      i === 1 ? { ...e, action: 'forged' } : e,
    );
    expect(compareToAnchor(broken, anchor).reason).toBe('current_chain_broken');
  });
});

describe('HONEST LIMITATION — a co-located, writable anchor does not stop a privileged tamperer', () => {
  let dir: string;
  let file: string;
  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), 'anchor-'));
    file = join(dir, 'anchors.jsonl');
  });
  afterEach(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  it('rewriting the chain alone is caught; rewriting the anchor file too defeats detection', async () => {
    const repo = new InMemoryRepository();
    await seedAudit(repo, 3);
    const honest = await anchorAuditChain(repo, TENANT, new FileAnchorSink(file), { now: ts(3) });

    // A privileged tamperer forges an INTERNALLY-CONSISTENT replacement history
    // (it verifies from genesis) with different content — modelled here as an
    // independently-built, valid chain. The honestly-anchored tip is absent.
    const forgedRepo = new InMemoryRepository();
    for (let i = 1; i <= 3; i++) {
      await forgedRepo.insertAuditEvent({
        id: randomUUID(),
        tenant_id: TENANT,
        actor_ref: 'user:attacker',
        action: `forged_${i}`,
        subject_ref: `agent_action:f${i}`,
        detail: {},
        occurred_at: ts(i),
        created_at: ts(i),
      });
    }
    const rewritten = await forgedRepo.listAuditEvents(TENANT);
    expect(chainTip(rewritten).chain_ok).toBe(true); // falsified but self-consistent

    // Against the HONEST anchor, the tamper IS detected — the value of anchoring.
    expect(compareToAnchor(rewritten, honest)).toEqual({
      consistent: false,
      reason: 'anchored_tip_absent',
    });

    // But the FileAnchorSink is co-located and writable: the same attacker forges
    // a matching anchor into the file. latest() now returns the forged record and
    // the rewrite is no longer detectable. Only an EXTERNAL, independent custodian
    // (out of the attacker's reach) closes this gap.
    const sink = new FileAnchorSink(file);
    const rewrittenTip = chainTip(rewritten);
    await sink.publish({
      tenant_id: TENANT,
      anchored_at: ts(4),
      events: rewrittenTip.events,
      tip_hash: rewrittenTip.tip_hash,
      chain_ok: rewrittenTip.chain_ok,
    });
    const forged = await sink.latest(TENANT);
    expect(compareToAnchor(rewritten, forged!).consistent).toBe(true); // detection defeated
  });
});
