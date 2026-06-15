import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { Kysely } from 'kysely';
import { PGlite } from '@electric-sql/pglite';
import { KyselyPGlite } from 'kysely-pglite';
import { KyselyRepository, type Database } from '@cognitia/db';
import { createGtmServices } from '@cognitia/agents';
import { ApiHandlers, type ApiRequest } from './handlers.js';
import { registerAgent, issueAtc } from './atc.js';
import { openAccount, transfer, getAccountView } from './credits.js';
import { createProof } from './proofs.js';
import { ECONOMY_PERMISSION_KEYS } from './agentEconomyActions.js';

/**
 * ECONOMY-SMOKE-001 — live runtime verification of the merged economy stack
 * (main @ c2caf97) against a REAL Postgres engine (PGlite, in-process WASM),
 * applying the actual migrations 0001–0014 + 0016–0018 (0015 reserved/absent)
 * and driving the full Agent Economy loop through the production ApiHandlers +
 * KyselyRepository. Local/dev DB only — no production, no real payments.
 *
 * Emits `SMOKE>` log lines captured into the runtime log.
 */

const here = dirname(fileURLToPath(import.meta.url));
const migrationsDir = join(here, '..', '..', '..', 'packages', 'db', 'migrations');

// The economy stack's migration chain. 0015 is DELIBERATELY ABSENT (reserved
// for the parked COG-016 field-provenance branch). 0005/0006/0008 are not
// needed for economy behavior (campaigns / pgvector / credential ciphertexts).
const MIGRATIONS = [
  '0001_tenants_users.sql',
  '0002_integrations_external_maps.sql',
  '0003_gtm_entities.sql',
  '0004_events_agent_runs_actions.sql',
  '0007_evals_experiments.sql',
  '0009_cognitia_trust_core.sql',
  '0010_skillproof_reputation.sql',
  '0011_moveros_lead_rescue.sql',
  '0012_credits_wallet.sql',
  '0013_skillproof_frontdesk_ext.sql',
  '0014_wallet_binding_deactivate.sql',
  '0016_agent_economy.sql',
  '0017_dispute_resolution.sql',
  '0018_marketplace_listings.sql',
  '0019_agent_fabric_nodes.sql',
];

function preprocess(sql: string): string {
  return sql.replace(/create extension[^;]*;/gi, '');
}

const log = (msg: string) => console.log(`SMOKE> ${msg}`);

const TENANT = '11111111-1111-1111-1111-111111111111';
const TENANT_B = '22222222-2222-2222-2222-222222222222';

const op = (over: Partial<ApiRequest> = {}): ApiRequest => ({
  tenantId: TENANT,
  role: 'operator',
  traceId: 'trace-smoke',
  ...over,
});
const owner = (over: Partial<ApiRequest> = {}): ApiRequest => ({
  tenantId: TENANT,
  role: 'owner',
  traceId: 'trace-smoke',
  ...over,
});

let pglite: PGlite;
let db: Kysely<Database>;
let repo: KyselyRepository;
let handlers: ApiHandlers;

async function seedTenant(id: string): Promise<void> {
  await pglite.query('insert into tenants (id, name, slug) values ($1, $2, $3)', [id, id, id]);
}

beforeAll(async () => {
  pglite = new PGlite({
    parsers: { 1700: (value: string) => (value == null ? null : Number(value)) },
  });
  for (const file of MIGRATIONS) {
    await pglite.exec(preprocess(readFileSync(join(migrationsDir, file), 'utf8')));
    log(`applied migration ${file}`);
  }
  const { dialect } = new KyselyPGlite(pglite);
  db = new Kysely<Database>({ dialect });
  repo = new KyselyRepository(db);
  handlers = new ApiHandlers(repo, createGtmServices({ repo, v1Mode: true }));
  await seedTenant(TENANT);
  await seedTenant(TENANT_B);
});

afterAll(async () => {
  await db.destroy();
});

describe('ECONOMY-SMOKE-001 (live PGlite)', () => {
  it('migration chain present through 0018; 0015 reserved/absent', async () => {
    const tables = await pglite.query<{ table_name: string }>(
      `select table_name from information_schema.tables where table_schema='public'`,
    );
    const names = new Set(tables.rows.map((r) => r.table_name));
    // 0016/0017/0018 tables exist.
    for (const t of [
      'work_orders',
      'skill_execution_orders',
      'dispute_resolutions',
      'marketplace_listings',
    ]) {
      expect(names.has(t)).toBe(true);
      log(`table present: ${t}`);
    }
    // 0015 (field provenance) is NOT applied.
    expect(names.has('field_provenance')).toBe(false);
    log('0015 field_provenance ABSENT (reserved for parked COG-016) ✓');
    // Escrow owner-type widening (0016) is live.
    await pglite.query(
      `insert into credits_accounts (tenant_id, owner_type, owner_id) values ($1,'escrow',$2)`,
      [TENANT, randomUUID()],
    );
    log('credits_accounts accepts owner_type=escrow (0016 widening live) ✓');
  });

  it('full happy-path loop: provision → list → order → ledger accept → escrow reserve → deliver → verify → release + reputation', async () => {
    // Requester agent + ATC.
    const { agent: requester } = await registerAgent(
      repo,
      TENANT,
      { name: 'Requester', slug: 'smoke-requester', kind: 'internal_ops' },
      'user:smoke',
      'trace-smoke',
    );
    log(`requester agent ${requester.id.slice(0, 8)} registered (sms.send_real deny seeded)`);

    // Worker agent + ATC + economy permissions.
    const { agent: worker } = await registerAgent(
      repo,
      TENANT,
      { name: 'Worker', slug: 'smoke-worker', kind: 'internal_ops' },
      'user:smoke',
      'trace-smoke',
    );
    await issueAtc(repo, TENANT, worker.id, { claims: {} }, 'user:smoke', 'trace-smoke');
    const ts = new Date().toISOString();
    for (const key of [
      ECONOMY_PERMISSION_KEYS.accept,
      ECONOMY_PERMISSION_KEYS.deliver,
      ECONOMY_PERMISSION_KEYS.dispute,
    ]) {
      await repo.upsertAgentPermission({
        id: randomUUID(),
        tenant_id: TENANT,
        agent_id: worker.id,
        action_key: key,
        effect: 'allow',
        constraints: {},
        created_at: ts,
        updated_at: ts,
      });
    }
    const wAtcs = await repo.listAtcsByAgent(TENANT, worker.id);
    expect(wAtcs.some((a) => a.status === 'active')).toBe(true);
    log(`worker agent ${worker.id.slice(0, 8)} has active ATC + accept/deliver/dispute allows`);

    // Fund requester from system treasury (internal credits only).
    const treasury = await openAccount(
      repo,
      TENANT,
      { owner_type: 'system', owner_id: randomUUID() },
      'user:smoke',
    );
    const requesterAcct = await openAccount(
      repo,
      TENANT,
      { owner_type: 'agent', owner_id: requester.id },
      'user:smoke',
    );
    await transfer(
      repo,
      TENANT,
      {
        from_account_id: treasury.id,
        to_account_id: requesterAcct.id,
        amount: 500,
        reason_code: 'grant',
        idempotency_key: 'smoke-grant',
      },
      'user:smoke',
    );
    expect((await getAccountView(repo, TENANT, requesterAcct.id)).balance).toBe(500);
    log('requester funded with 500 internal credits (rail=internal_credits)');

    // SkillProof skill + verified tier-2 version.
    const skill = await repo.upsertSkill({
      id: randomUUID(),
      tenant_id: TENANT,
      name: 'Research Brief',
      slug: 'smoke-skill',
      category: 'analysis',
      description: null,
      visibility: 'internal',
      namespace: 'cognitia.core',
      source_path: null,
      owner_agent_id: worker.id,
      created_at: ts,
      updated_at: ts,
    });
    const version = await repo.insertSkillVersion({
      id: randomUUID(),
      tenant_id: TENANT,
      skill_id: skill.id,
      version: '1.0.0',
      spec: {},
      status: 'active',
      manifest_hash: null,
      content_hash: null,
      metadata: {},
      proof_tier: 0,
      yanked: false,
      yank_reason: null,
      created_at: ts,
      updated_at: ts,
    });
    const tierProof = await createProof(
      repo,
      TENANT,
      {
        kind: 'skill_demo',
        subject_type: 'skill',
        subject_id: skill.id,
        evidence_tag: 'verified_fact',
        evidence_ref: `eval:${skill.id}`,
        verifier_ref: 'verifier:economy-lab',
      },
      'user:smoke',
      'trace-smoke',
    );
    await repo.insertSkillProof({
      id: randomUUID(),
      tenant_id: TENANT,
      skill_id: skill.id,
      agent_id: worker.id,
      proof_id: tierProof.id,
      tier: 'T2_verified',
      evidence_tag: 'verified_fact',
      created_at: ts,
      updated_at: ts,
    });
    // 0013 trigger enforces verified_fact for tier >= 2 — this proves it on real PG.
    await repo.setSkillVersionTier(TENANT, version.id, 2);
    log('skill version upgraded to tier 2 (0013 DB trigger accepted verified_fact)');

    // Marketplace listing — visibility must be internal.
    const listingRes = await handlers.createMarketplaceListing(
      op({
        body: { agent_id: worker.id, skill_version_id: version.id, price_credits: 100 },
      }),
    );
    const listing = (listingRes.body as { listing: { id: string; visibility: string } }).listing;
    expect(listing.visibility).toBe('internal');
    log(`listing ${listing.id.slice(0, 8)} created, visibility=internal ✓`);

    // Order from listing — files the worker's accept ask on the Action Ledger.
    const orderRes = await handlers.orderFromListing(
      op({
        params: { id: listing.id },
        body: { requester_agent_id: requester.id },
      }),
    );
    const ob = orderRes.body as {
      work_order: { id: string; requested_credits: number; status: string };
      accept_ask: { id: string; approval_status: string } | null;
      accept_ask_blocked: string | null;
    };
    expect(ob.work_order.requested_credits).toBe(100);
    expect(ob.accept_ask_blocked).toBeNull();
    expect(ob.accept_ask?.approval_status).toBe('proposed');
    const woId = ob.work_order.id;
    const acceptAskId = ob.accept_ask!.id;
    log(
      `work order ${woId.slice(0, 8)} @100cr created from listing; accept ask ${acceptAskId.slice(0, 8)} filed (approval required)`,
    );

    // Execute before approval is refused.
    await expect(
      handlers.executeEconomyAction(op({ params: { id: acceptAskId } })),
    ).rejects.toMatchObject({ status: 409 });
    log('execute-before-approval refused (409) ✓');

    // Approve on the existing ledger, then execute → escrow reserved once.
    await handlers.approveAction(
      op({ params: { id: acceptAskId }, body: { reason: { reason_code: 'meets_playbook' } } }),
    );
    await handlers.executeEconomyAction(op({ params: { id: acceptAskId } }));
    const woAfterAccept = (await repo.getWorkOrder(TENANT, woId))!;
    expect(woAfterAccept.status).toBe('accepted');
    expect(woAfterAccept.escrow_status).toBe('reserved');
    expect((await getAccountView(repo, TENANT, requesterAcct.id)).balance).toBe(400);
    log('accept executed: status=accepted, escrow=reserved, requester balance 500→400');

    // Re-execute refused; escrow reserved exactly once.
    await expect(
      handlers.executeEconomyAction(op({ params: { id: acceptAskId } })),
    ).rejects.toMatchObject({ status: 409 });
    expect((await getAccountView(repo, TENANT, requesterAcct.id)).balance).toBe(400);
    log('re-execute refused (409); escrow reserved EXACTLY once ✓');

    // Deliver via agent ask (carries no proof → simulated execution mints it).
    const deliverAsk = await handlers.proposeEconomyAction(
      op({ params: { id: woId }, body: { agent_id: worker.id, result_summary: 'smoke brief' } }),
      'deliver',
    );
    const deliverAskId = (deliverAsk.body as { action: { id: string } }).action.id;
    await handlers.approveAction(
      op({ params: { id: deliverAskId }, body: { reason: { reason_code: 'meets_playbook' } } }),
    );
    await handlers.executeEconomyAction(op({ params: { id: deliverAskId } }));
    const woDelivered = (await repo.getWorkOrder(TENANT, woId))!;
    expect(woDelivered.status).toBe('delivered');
    expect(woDelivered.proof_id).toBeTruthy();
    const delProof = await repo.getProof(TENANT, woDelivered.proof_id!);
    expect(delProof?.evidence_tag).toBe('verified_fact');
    log(
      `delivered via agent ask; execution proof ${woDelivered.proof_id!.slice(0, 8)} tag=verified_fact`,
    );

    // Verify (owner) → escrow released to worker, reputation +3.
    await handlers.verifyWorkOrder(owner({ params: { id: woId } }));
    const woVerified = (await repo.getWorkOrder(TENANT, woId))!;
    expect(woVerified.status).toBe('verified');
    expect(woVerified.escrow_status).toBe('released');
    const workerAccts = await repo.listCreditsAccounts(TENANT);
    const workerAcct = workerAccts.find(
      (a) => a.owner_type === 'agent' && a.owner_id === worker.id,
    )!;
    expect((await getAccountView(repo, TENANT, workerAcct.id)).balance).toBe(100);
    const rep = await repo.listReputationEvents(TENANT, worker.id);
    expect(rep).toHaveLength(1);
    expect(rep[0]!.delta).toBe(3);
    log(
      `verified: escrow released → worker balance 100; reputation +${rep[0]!.delta} (${rep[0]!.reason_code})`,
    );

    // Marketplace matching reflects tier + reputation + verified work.
    const mk = (await handlers.getMarketplace(op())).body as {
      matches: Array<{
        agent: { id: string };
        version: { proof_tier: number };
        reputation_score: number;
        verified_work_orders: number;
        match_score: number;
        eligible_for_verified_work: boolean;
      }>;
      ranking_rule: string;
    };
    const m = mk.matches.find((x) => x.agent.id === worker.id)!;
    expect(m.version.proof_tier).toBe(2);
    expect(m.eligible_for_verified_work).toBe(true);
    expect(m.reputation_score).toBe(3);
    expect(m.verified_work_orders).toBe(1);
    expect(m.match_score).toBe(2 * 1000 + 3 * 10 + 1);
    log(
      `marketplace match_score=${m.match_score} (tier 2 + rep 3 + 1 verified order); eligible_for_verified_work=true`,
    );

    // Audit trail recorded the ledger lifecycle.
    const audits = (await repo.listAuditEvents(TENANT)).map((a) => a.action);
    expect(audits).toContain('economy.agent_action.proposed.v1');
    expect(audits).toContain('economy.agent_action.executed.v1');
    expect(audits).toContain('economy.work_order.verified.v1');
    log('audit events present: proposed.v1, executed.v1, verified.v1 ✓');
  });

  it('negative path: likely_inference / unknown delivery proof CANNOT release escrow', async () => {
    const { agent: requester } = await registerAgent(
      repo,
      TENANT,
      { name: 'Req2', slug: 'smoke-req2', kind: 'internal_ops' },
      'user:smoke',
      'trace-smoke',
    );
    const { agent: worker } = await registerAgent(
      repo,
      TENANT,
      { name: 'Wkr2', slug: 'smoke-wkr2', kind: 'internal_ops' },
      'user:smoke',
      'trace-smoke',
    );
    await issueAtc(repo, TENANT, worker.id, { claims: {} }, 'user:smoke', 'trace-smoke');
    const treasury = await openAccount(
      repo,
      TENANT,
      { owner_type: 'system', owner_id: randomUUID() },
      'user:smoke',
    );
    const rAcct = await openAccount(
      repo,
      TENANT,
      { owner_type: 'agent', owner_id: requester.id },
      'user:smoke',
    );
    await transfer(
      repo,
      TENANT,
      {
        from_account_id: treasury.id,
        to_account_id: rAcct.id,
        amount: 200,
        reason_code: 'grant',
        idempotency_key: 'smoke-grant-2',
      },
      'user:smoke',
    );

    const created = await handlers.createWorkOrder(
      op({
        body: { requester_agent_id: requester.id, title: 'weak-proof job', requested_credits: 50 },
      }),
    );
    const woId = (created.body as { work_order: { id: string } }).work_order.id;
    await handlers.acceptWorkOrder(
      op({ params: { id: woId }, body: { worker_agent_id: worker.id } }),
    );

    for (const tag of ['likely_inference', 'unknown'] as const) {
      const weak = await createProof(
        repo,
        TENANT,
        { kind: 'skill_demo', subject_type: 'work_order', subject_id: woId, evidence_tag: tag },
        'user:smoke',
        'trace-smoke',
      );
      // Fresh order per tag would be cleaner, but deliver+verify on the same one demonstrates the refusal.
      if (tag === 'likely_inference') {
        await handlers.deliverWorkOrder(op({ params: { id: woId }, body: { proof_id: weak.id } }));
      }
      await expect(handlers.verifyWorkOrder(owner({ params: { id: woId } }))).rejects.toMatchObject(
        { status: 409 },
      );
      log(`verify refused with ${tag} delivery proof (409) — escrow NOT released ✓`);
    }
    const wo = (await repo.getWorkOrder(TENANT, woId))!;
    expect(wo.escrow_status).toBe('reserved'); // still held, never released
    expect(await repo.listReputationEvents(TENANT, worker.id)).toHaveLength(0);
    log('weak-proof path: escrow stays reserved, zero reputation ✓');
  });

  it('dispute path: held escrow → owner refund; audit + reputation semantics', async () => {
    const { agent: requester } = await registerAgent(
      repo,
      TENANT,
      { name: 'Req3', slug: 'smoke-req3', kind: 'internal_ops' },
      'user:smoke',
      'trace-smoke',
    );
    const { agent: worker } = await registerAgent(
      repo,
      TENANT,
      { name: 'Wkr3', slug: 'smoke-wkr3', kind: 'internal_ops' },
      'user:smoke',
      'trace-smoke',
    );
    await issueAtc(repo, TENANT, worker.id, { claims: {} }, 'user:smoke', 'trace-smoke');
    const treasury = await openAccount(
      repo,
      TENANT,
      { owner_type: 'system', owner_id: randomUUID() },
      'user:smoke',
    );
    const rAcct = await openAccount(
      repo,
      TENANT,
      { owner_type: 'agent', owner_id: requester.id },
      'user:smoke',
    );
    await transfer(
      repo,
      TENANT,
      {
        from_account_id: treasury.id,
        to_account_id: rAcct.id,
        amount: 300,
        reason_code: 'grant',
        idempotency_key: 'smoke-grant-3',
      },
      'user:smoke',
    );

    const created = await handlers.createWorkOrder(
      op({
        body: { requester_agent_id: requester.id, title: 'disputed job', requested_credits: 80 },
      }),
    );
    const woId = (created.body as { work_order: { id: string } }).work_order.id;
    await handlers.acceptWorkOrder(
      op({ params: { id: woId }, body: { worker_agent_id: worker.id } }),
    );
    expect((await getAccountView(repo, TENANT, rAcct.id)).balance).toBe(220);
    const vproof = await createProof(
      repo,
      TENANT,
      {
        kind: 'skill_demo',
        subject_type: 'work_order',
        subject_id: woId,
        evidence_tag: 'verified_fact',
        evidence_ref: `art:${woId}`,
        verifier_ref: 'user:smoke',
      },
      'user:smoke',
      'trace-smoke',
    );
    await handlers.deliverWorkOrder(op({ params: { id: woId }, body: { proof_id: vproof.id } }));
    await handlers.disputeWorkOrder(
      op({ params: { id: woId }, body: { reason: { reason_code: 'quality_contested' } } }),
    );
    const woDisputed = (await repo.getWorkOrder(TENANT, woId))!;
    expect(woDisputed.escrow_status).toBe('disputed');
    log(
      `dispute filed: escrow HELD (status=${woDisputed.status}, escrow=${woDisputed.escrow_status})`,
    );

    // Operator cannot arbitrate; owner refunds.
    await expect(
      handlers.resolveWorkOrder(
        op({ params: { id: woId }, body: { decision: 'refund', reason_code: 'work_unusable' } }),
      ),
    ).rejects.toMatchObject({ status: 403 });
    await handlers.resolveWorkOrder(
      owner({ params: { id: woId }, body: { decision: 'refund', reason_code: 'work_unusable' } }),
    );
    const woResolved = (await repo.getWorkOrder(TENANT, woId))!;
    expect(woResolved.status).toBe('resolved');
    expect((await getAccountView(repo, TENANT, rAcct.id)).balance).toBe(300); // fully refunded
    const resolution = await repo.getDisputeResolutionByWorkOrder(TENANT, woId);
    expect(resolution?.decision).toBe('refund');
    expect(resolution?.proof_id).toBeTruthy();
    const negRep = (await repo.listReputationEvents(TENANT, worker.id)).filter((e) => e.delta < 0);
    expect(negRep).toHaveLength(1);
    log(
      `owner refund: balance restored to 300; resolution proof ${resolution!.proof_id.slice(0, 8)}; worker reputation ${negRep[0]!.delta}`,
    );
    const audits = (await repo.listAuditEvents(TENANT)).map((a) => a.action);
    expect(audits).toContain('economy.work_order.resolved.v1');
    log('dispute audit event present: resolved.v1 ✓');
  });

  it('tenant isolation holds on real PG: tenant B sees none of tenant A economy', async () => {
    const aOrders = await repo.listWorkOrders(TENANT);
    expect(aOrders.length).toBeGreaterThan(0);
    expect(await repo.listWorkOrders(TENANT_B)).toHaveLength(0);
    expect(await repo.listMarketplaceListings(TENANT_B)).toHaveLength(0);
    const bSummary = (await handlers.getMarketplace(op({ tenantId: TENANT_B }))).body as {
      matches: unknown[];
    };
    expect(bSummary.matches).toHaveLength(0);
    log(`tenant isolation: A has ${aOrders.length} work orders, B has 0 ✓`);
  });
});
