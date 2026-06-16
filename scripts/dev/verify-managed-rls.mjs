#!/usr/bin/env node
/**
 * verify-managed-rls.mjs — V-6 managed Postgres RLS verification harness.
 *
 * THE RISK THIS CLOSES
 * --------------------
 * Row-level security (RLS) is otherwise only proven on PGlite, whose default role
 * is a superuser that BYPASSES RLS. This harness runs the RLS-critical paths —
 * the Agent Economy (work orders / escrow / reputation), the append-only Proof
 * Registry (public-safe vs private), and the Agent Fabric node registry (0019) —
 * under a real, NON-superuser role on a real Postgres server, where the policies
 * are genuinely enforced. It proves, with the application predicate REMOVED, that
 * the database engine (not the query builder) blocks cross-tenant access.
 *
 * FAIL-CLOSED
 * -----------
 * Refuses to run unless BOTH:
 *   - CONFIRM_DEV_DB=true   (explicit operator acknowledgement this is a dev DB)
 *   - DATABASE_URL is set   (the dev/throwaway target)
 * and refuses outright if the target looks like production (host/db name contains
 * `prod` or `moveros` — the documented `public.leads` collision app). The
 * connection string is NEVER printed.
 *
 * NO PRODUCTION. NO SECRETS. Dev/throwaway database only. No deploy.
 *
 * Usage:
 *   CONFIRM_DEV_DB=true DATABASE_URL=postgres://… \
 *     node scripts/dev/verify-managed-rls.mjs [--apply-migrations]
 *
 * Exit code 0 = all assertions passed; non-zero = a guard refused or an
 * assertion failed (details on stderr; a JSON summary on stdout).
 */
import { readdir, readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { randomUUID, randomBytes } from 'node:crypto';

const here = dirname(fileURLToPath(import.meta.url));
const migrationsDir = join(here, '..', '..', 'packages', 'db', 'migrations');

// The economy + trust + fabric chain. 0015 is DELIBERATELY ABSENT (reserved for
// the parked COG-016 field-provenance branch). 0005/0006/0008 are skipped:
// campaigns / pgvector / credential ciphertexts are not needed for RLS proof and
// 0006 would require the `vector` extension. Mirrors economySmoke.live.test.ts.
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

// Strip extension creation: gen_random_uuid() is core in PG13+, and we do not
// need pgvector for the RLS-critical tables.
const preprocess = (sql) => sql.replace(/create extension[^;]*;/gi, '');

const TENANT_A = '11111111-1111-1111-1111-111111111111';
const TENANT_B = '22222222-2222-2222-2222-222222222222';

const out = (line) => console.log(line);
const log = (msg) => out(`SMOKE> ${msg}`);
const rls = (msg) => out(`RLS>   ${msg}`);
const fab = (msg) => out(`FABRIC> ${msg}`);

let passed = 0;
let failed = 0;
const failures = [];
function assert(name, cond) {
  if (cond) {
    passed++;
    out(`  ok   ${name}`);
  } else {
    failed++;
    failures.push(name);
    out(`  FAIL ${name}`);
  }
}

/** Fail-closed guards. Returns void or process.exit(1). */
function guard() {
  if (process.env.CONFIRM_DEV_DB !== 'true') {
    console.error(
      'REFUSED: CONFIRM_DEV_DB is not "true". This harness only runs against a ' +
        'dedicated DEV/throwaway database. Set CONFIRM_DEV_DB=true to acknowledge.',
    );
    process.exit(1);
  }
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error('REFUSED: DATABASE_URL is not set. Provide a dev/throwaway target.');
    process.exit(1);
  }
  // Parse for a production smell WITHOUT logging the string.
  let host = '';
  let path = '';
  try {
    const u = new URL(url);
    host = u.hostname.toLowerCase();
    path = u.pathname.toLowerCase();
  } catch {
    console.error('REFUSED: DATABASE_URL is not a parseable URL.');
    process.exit(1);
  }
  if (/prod|moveros/.test(host) || /prod|moveros/.test(path)) {
    console.error(
      'REFUSED: target looks like production (host/db name contains "prod" or ' +
        '"moveros"). This harness never runs against production.',
    );
    process.exit(1);
  }
}

async function loadPg() {
  try {
    return (await import('pg')).default;
  } catch {
    console.error('The `pg` package is required. Install it with: pnpm add -w pg');
    process.exit(1);
  }
}

async function applyMigrations(client) {
  const files = (await readdir(migrationsDir)).filter((f) => MIGRATIONS.includes(f)).sort();
  for (const file of files) {
    const sql = preprocess(await readFile(join(migrationsDir, file), 'utf8'));
    await client.query('begin');
    try {
      await client.query(sql);
      await client.query('commit');
      log(`migration ${file} applied`);
    } catch (err) {
      await client.query('rollback');
      throw new Error(`migration ${file} failed: ${err.message}`);
    }
  }
}

async function main() {
  guard();
  const pg = await loadPg();
  const url = process.env.DATABASE_URL;
  const applyMig = process.argv.includes('--apply-migrations');

  // --- owner/service connection (creates roles, seeds, applies migrations) ---
  const owner = new pg.Client({ connectionString: url });
  await owner.connect();

  // app_user: real LOGIN, NON-superuser role. We connect a SECOND client as this
  // role so RLS is enforced by the engine for a distinct principal (stronger than
  // `set role`). A random password is generated in-process and NEVER printed; on a
  // trust-auth local cluster it is ignored, on a managed DB it is required.
  const appPwd = randomBytes(18).toString('hex');
  let app = null;
  let appMode = 'separate-login';

  try {
    if (applyMig) await applyMigrations(owner);

    // Create the restricted role + grants (idempotent).
    await owner.query(`
      do $$ begin
        if not exists (select 1 from pg_roles where rolname = 'app_user') then
          create role app_user login nosuperuser;
        end if;
      end $$;`);
    await owner.query(`alter role app_user with password '${appPwd}'`);
    await owner.query(`
      grant usage on schema public to app_user;
      grant select, insert, update, delete on all tables in schema public to app_user;
      grant execute on all functions in schema public to app_user;
      grant usage, select on all sequences in schema public to app_user;`);

    // --- seed both tenants as the owner (superuser bypasses RLS) ---
    await seed(owner);

    // --- open the restricted connection ---
    const u = new URL(url);
    try {
      app = new pg.Client({
        host: u.hostname,
        port: u.port ? Number(u.port) : 5432,
        database: u.pathname.replace(/^\//, ''),
        user: 'app_user',
        password: appPwd,
      });
      await app.connect();
    } catch {
      // Fall back to `set role` on the owner connection if a separate login is
      // not permitted (e.g. pg_hba). Still NON-superuser => RLS enforced.
      appMode = 'set-role';
      app = owner;
    }

    await runAssertions(owner, app, appMode);
  } finally {
    if (app && app !== owner) await app.end().catch(() => {});
    await owner.end().catch(() => {});
  }

  const summary = {
    harness: 'verify-managed-rls',
    app_user_mode: appMode,
    migrations_applied: applyMig,
    passed,
    failed,
    failures,
    result: failed === 0 ? 'PASS' : 'FAIL',
  };
  out('SUMMARY ' + JSON.stringify(summary));
  process.exit(failed === 0 ? 0 : 1);
}

// IDs reused across seed + assertions.
const A = {
  req: randomUUID(),
  wrk: randomUUID(),
  funder: randomUUID(),
  acctReq: randomUUID(),
  skill: randomUUID(),
  ver: randomUUID(),
  pubProof: randomUUID(),
  privProof: randomUUID(),
};
const B = {
  req: randomUUID(),
  wrk: randomUUID(),
  acct: randomUUID(),
  skill: randomUUID(),
  ver: randomUUID(),
  proof: randomUUID(),
  wo: randomUUID(),
  listing: randomUUID(),
  node: randomUUID(),
};

async function seed(db) {
  const q = (text, params) => db.query(text, params);
  await q(`insert into tenants (id, name, slug) values ($1,'Tenant A','tenant-a-v6')`, [TENANT_A]);
  await q(`insert into tenants (id, name, slug) values ($1,'Tenant B','tenant-b-v6')`, [TENANT_B]);

  // agents
  for (const [t, a, slug] of [
    [TENANT_A, A.req, 'a-req'],
    [TENANT_A, A.wrk, 'a-wrk'],
    [TENANT_B, B.req, 'b-req'],
    [TENANT_B, B.wrk, 'b-wrk'],
  ]) {
    await q(`insert into agents (id, tenant_id, name, slug, status) values ($1,$2,$3,$4,'active')`, [
      a,
      t,
      slug,
      slug,
    ]);
  }

  // credits accounts: A funder(system) + A requester(agent); B account
  await q(
    `insert into credits_accounts (id, tenant_id, owner_type, owner_id) values ($1,$2,'system',$3)`,
    [A.funder, TENANT_A, A.req],
  );
  await q(
    `insert into credits_accounts (id, tenant_id, owner_type, owner_id) values ($1,$2,'agent',$3)`,
    [A.acctReq, TENANT_A, A.req],
  );
  await q(
    `insert into credits_accounts (id, tenant_id, owner_type, owner_id) values ($1,$2,'agent',$3)`,
    [B.acct, TENANT_B, B.wrk],
  );

  // skills + versions for A and B (needed for marketplace listings)
  for (const [t, s, v] of [
    [TENANT_A, A.skill, A.ver],
    [TENANT_B, B.skill, B.ver],
  ]) {
    await q(`insert into skills (id, tenant_id, name, slug) values ($1,$2,'skill','skill')`, [s, t]);
    await q(
      `insert into skill_versions (id, tenant_id, skill_id, version, status) values ($1,$2,$3,'1.0.0','active')`,
      [v, t, s],
    );
  }

  // proofs for A: one PUBLIC-SAFE (redacted) + one PRIVATE
  await q(
    `insert into proofs (id, tenant_id, kind, subject_type, subject_id, evidence_tag, evidence_ref, verifier_ref, summary_public, details_private, public_safe, redaction_check_passed_at)
     values ($1,$2,'skill_demo','agent',$3,'verified_fact','ev://a','user:owner','REDACTED-PUBLIC-OK', $4, true, now())`,
    [A.pubProof, TENANT_A, A.req, JSON.stringify({ secret: 'A-private-do-not-leak' })],
  );
  await q(
    `insert into proofs (id, tenant_id, kind, subject_type, subject_id, evidence_tag, summary_public, details_private, public_safe)
     values ($1,$2,'system','agent',$3,'unknown', null, $4, false)`,
    [A.privProof, TENANT_A, A.req, JSON.stringify({ secret: 'A-strictly-private' })],
  );

  // cross-tenant read targets for B: proof, work order, listing, fabric node, reputation
  await q(
    `insert into proofs (id, tenant_id, kind, subject_type, subject_id, evidence_tag, evidence_ref, verifier_ref, summary_public, details_private, public_safe, redaction_check_passed_at)
     values ($1,$2,'skill_demo','agent',$3,'verified_fact','ev://b','user:b','B-PUBLIC',$4,true,now())`,
    [B.proof, TENANT_B, B.wrk, JSON.stringify({ secret: 'B-private' })],
  );
  await q(
    `insert into work_orders (id, tenant_id, requester_agent_id, worker_agent_id, title, requested_credits)
     values ($1,$2,$3,$4,'B work order',100)`,
    [B.wo, TENANT_B, B.req, B.wrk],
  );
  await q(
    `insert into marketplace_listings (id, tenant_id, agent_id, skill_id, skill_version_id, price_credits)
     values ($1,$2,$3,$4,$5,50)`,
    [B.listing, TENANT_B, B.wrk, B.skill, B.ver],
  );
  await q(
    `insert into fabric_nodes (id, tenant_id, agent_id, label, platform) values ($1,$2,$3,'B-node','linux')`,
    [B.node, TENANT_B, B.wrk],
  );
  await q(
    `insert into reputation_events (tenant_id, agent_id, proof_id, delta, reason_code) values ($1,$2,$3,2,'seed')`,
    [TENANT_B, B.wrk, B.proof],
  );
}

/** Set tenant GUC on the restricted connection (or clear it if null). */
async function asTenant(app, mode, tenantId) {
  if (mode === 'set-role') {
    await app.query('reset role');
    await app.query('set role app_user');
  }
  if (tenantId) await app.query(`set app.current_tenant_id = '${tenantId}'`);
  else await app.query(`reset app.current_tenant_id`);
}
async function asOwner(app, mode) {
  if (mode === 'set-role') await app.query('reset role');
}

async function runAssertions(owner, app, mode) {
  const count = async (sql, params) => Number((await app.query(sql, params)).rows[0].n);

  // -- control: prove we are actually in an enforced (non-bypass) mode --
  out('\n== control: enforcement is real ==');
  await asOwner(owner, mode); // owner is superuser
  const superCount = Number(
    (await owner.query('select count(*)::int as n from proofs')).rows[0].n,
  );
  assert('superuser sees both tenants (RLS bypass control)', superCount >= 3);
  await asTenant(app, mode, TENANT_A);
  const appCount = await count('select count(*)::int as n from proofs');
  assert('app_user sees ONLY tenant A proofs (RLS enforced)', appCount === 2);

  // -- economy smoke under the restricted role --
  out('\n== economy smoke under app_user (tenant A) ==');
  await asTenant(app, mode, TENANT_A);
  // fund: double-entry transfer
  const idem = 'fund-' + randomUUID();
  await app.query(
    `insert into credits_ledger_entries (tenant_id, account_id, counter_account_id, amount, direction, reason_code, idempotency_key)
     values ($1,$2,$3,500,'debit','grant',$4)`,
    [TENANT_A, A.funder, A.acctReq, idem],
  );
  await app.query(
    `insert into credits_ledger_entries (tenant_id, account_id, counter_account_id, amount, direction, reason_code, idempotency_key)
     values ($1,$2,$3,500,'credit','grant',$4)`,
    [TENANT_A, A.acctReq, A.funder, idem],
  );
  log('funded requester via double-entry ledger');
  // open work order
  const woId = randomUUID();
  await app.query(
    `insert into work_orders (id, tenant_id, requester_agent_id, worker_agent_id, title, requested_credits)
     values ($1,$2,$3,$4,'A work order',100)`,
    [woId, TENANT_A, A.req, A.wrk],
  );
  // reserve escrow (new escrow account owned by the work order)
  const escrowId = randomUUID();
  await app.query(
    `insert into credits_accounts (id, tenant_id, owner_type, owner_id) values ($1,$2,'escrow',$3)`,
    [escrowId, TENANT_A, woId],
  );
  await app.query(
    `update work_orders set escrow_status='reserved', escrow_account_id=$2 where id=$1`,
    [woId, escrowId],
  );
  log('work order opened + escrow reserved');
  // deliver + verified_fact proof => owner verify releases escrow
  const proofId = randomUUID();
  // Delivery proof is verified_fact but NOT public (private until a redaction pass).
  await app.query(
    `insert into proofs (id, tenant_id, kind, subject_type, subject_id, evidence_tag, evidence_ref, verifier_ref, summary_public)
     values ($1,$2,'skill_demo','agent',$3,'verified_fact','ev://deliver','user:owner','done')`,
    [proofId, TENANT_A, woId],
  );
  await app.query(
    `update work_orders set status='verified', escrow_status='released', proof_id=$2, evidence_tag='verified_fact' where id=$1`,
    [woId, proofId],
  );
  const wo = (await app.query(`select status, escrow_status from work_orders where id=$1`, [woId]))
    .rows[0];
  assert('verified_fact proof releases escrow (status=verified)', wo.status === 'verified');
  assert('escrow released', wo.escrow_status === 'released');
  // positive reputation requires verified_fact proof
  await app.query(
    `insert into reputation_events (tenant_id, agent_id, proof_id, delta, reason_code) values ($1,$2,$3,3,'delivered')`,
    [TENANT_A, A.wrk, proofId],
  );
  log('reputation +3 recorded against verified_fact proof');
  assert(
    'in-tenant reputation event visible',
    (await count(`select count(*)::int as n from reputation_events where agent_id=$1`, [A.wrk])) ===
      1,
  );

  // negative: likely_inference cannot release escrow / cannot grant positive reputation
  out('\n== negative paths (engine refuses unproven payouts) ==');
  const woNeg = randomUUID();
  await app.query(
    `insert into work_orders (id, tenant_id, requester_agent_id, worker_agent_id, title, requested_credits)
     values ($1,$2,$3,$4,'A neg',100)`,
    [woNeg, TENANT_A, A.req, A.wrk],
  );
  const weakProof = randomUUID();
  await app.query(
    `insert into proofs (id, tenant_id, kind, subject_type, subject_id, evidence_tag) values ($1,$2,'system','agent',$3,'likely_inference')`,
    [weakProof, TENANT_A, A.wrk],
  );
  let releaseRefused = false;
  try {
    await app.query(
      `update work_orders set status='verified', escrow_status='released', proof_id=$2 where id=$1`,
      [woNeg, weakProof],
    );
  } catch {
    releaseRefused = true;
  }
  assert('likely_inference proof CANNOT release escrow (trigger refuses)', releaseRefused);
  let repRefused = false;
  try {
    await app.query(
      `insert into reputation_events (tenant_id, agent_id, proof_id, delta, reason_code) values ($1,$2,$3,1,'bad')`,
      [TENANT_A, A.wrk, weakProof],
    );
  } catch {
    repRefused = true;
  }
  assert('likely_inference proof CANNOT grant positive reputation', repRefused);

  // -- fabric registry under app_user --
  out('\n== fabric registry (0019) under app_user (tenant A) ==');
  const nodeId = randomUUID();
  await app.query(
    `insert into fabric_nodes (id, tenant_id, agent_id, label, platform) values ($1,$2,$3,'A-node','macos')`,
    [nodeId, TENANT_A, A.wrk],
  );
  await app.query(`update fabric_nodes set status='quarantined' where id=$1`, [nodeId]);
  const node = (await app.query(`select status from fabric_nodes where id=$1`, [nodeId])).rows[0];
  assert('in-tenant fabric node insert + quarantine works', node.status === 'quarantined');
  fab(`node ${nodeId.slice(0, 8)} registered and quarantined in-tenant`);

  // -- cross-tenant denial (pure RLS, no app predicate) --
  out('\n== cross-tenant isolation: tenant A cannot read tenant B ==');
  await asTenant(app, mode, TENANT_A);
  const targets = [
    ['work_orders', B.wo],
    ['proofs', B.proof],
    ['marketplace_listings', B.listing],
    ['fabric_nodes', B.node],
    ['credits_accounts', B.acct],
  ];
  for (const [table, id] of targets) {
    const n = await count(`select count(*)::int as n from ${table} where id=$1`, [id]);
    assert(`A cannot SELECT tenant B row in ${table} (0 rows)`, n === 0);
  }
  // GUC unset => still nothing
  await asTenant(app, mode, null);
  for (const [table] of targets) {
    const n = await count(`select count(*)::int as n from ${table}`);
    assert(`with tenant unset, ${table} returns 0 rows`, n === 0);
  }
  // cross-tenant write attempts
  await asTenant(app, mode, TENANT_A);
  const upd = await app.query(`update fabric_nodes set label='HACKED' where id=$1`, [B.node]);
  assert('A cannot UPDATE tenant B fabric node (0 rows affected)', upd.rowCount === 0);
  let insBlocked = false;
  try {
    await app.query(
      `insert into fabric_nodes (tenant_id, agent_id, label, platform) values ($1,$2,'evil','linux')`,
      [TENANT_B, B.wrk],
    );
  } catch {
    insBlocked = true;
  }
  assert('A cannot INSERT a row for tenant B (WITH CHECK violation)', insBlocked);
  rls('cross-tenant reads + writes denied by the engine, predicate removed');

  // -- public-safe projection stays redacted; private fields inaccessible --
  out('\n== public-safe projection + private proof fields ==');
  await asTenant(app, mode, TENANT_A);
  // The public-shaped projection: ONLY summary_public of public_safe rows.
  const pub = await app.query(
    `select id, summary_public from proofs where public_safe = true order by created_at`,
  );
  assert('public projection returns only the public_safe proof', pub.rows.length === 1);
  assert(
    'public projection narrative is the redacted summary_public',
    pub.rows[0].summary_public === 'REDACTED-PUBLIC-OK',
  );
  assert(
    'public projection NEVER includes details_private (column not selected)',
    !('details_private' in pub.rows[0]),
  );
  // The private proof (public_safe=false) is excluded from any public projection.
  assert(
    'private (public_safe=false) proof is excluded from the public projection',
    !pub.rows.some((r) => r.id === A.privProof),
  );
  // Cross-tenant: tenant B's private details are unreachable even by id.
  await asTenant(app, mode, TENANT_B);
  const bPriv = await app.query(`select details_private from proofs where id=$1`, [A.pubProof]);
  assert('tenant B cannot read tenant A private proof fields (0 rows)', bPriv.rows.length === 0);
  rls('public-safe projection redacted; private proof fields engine-protected');
}

main().catch((err) => {
  console.error(String(err && err.stack ? err.stack : err));
  process.exit(1);
});
