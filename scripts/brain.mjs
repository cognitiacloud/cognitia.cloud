#!/usr/bin/env node
/**
 * Cognitia Brain CLI — compatibility harness (mock-safe).
 *
 * This is NOT the final model-provider Brain Harness. It is a thin, mock-safe
 * CLI over the EXISTING GTM modules (`@cognitia/agents`, `@cognitia/core`,
 * `@cognitia/db`, `@cognitia/evals`) plus the Brain Core registry from PR #202
 * (`@cognitia/agents` `brain/`). Every command calls a real module; it never
 * touches a network, a vendor SDK, a real CRM, a real model API, or a secret.
 *
 * Each command prints a meta block so the surface is honest about what it did:
 *   status      REAL     — calls a real module that fully implements the command
 *               ALIAS    — real module, but the requested name aliases a
 *                          different real concept (documented limitation)
 *               DISABLED — the requested provider is a disabled V1 scaffold
 *               BLOCKED  — cannot be served by a real module; nothing faked
 *   backing     the real module(s) invoked
 *   limitation  plain-English limitation
 *
 * Run via `pnpm brain <command> [flags]` (wired to `tsx scripts/brain.mjs`).
 * tsx is dev-only tooling so this script can import the workspace TypeScript
 * directly; it is never imported by runtime brain code.
 */

import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(SCRIPT_DIR, '..');

/** Import a workspace package by its TS source entry (resolved by tsx). */
function loadPkg(relSrc) {
  return import(pathToFileURL(resolve(REPO_ROOT, relSrc)).href);
}

// --- mock-safe sandbox constants (Tenant Zero) ------------------------------
// The only workspace this harness will operate on. Budget Wheels exists only as
// a sandbox; the label maps to a fixed, deterministic sandbox tenant id.
const SANDBOX_WORKSPACE = 'budget_wheels_demo';
const SANDBOX_TENANT = '22222222-2222-4222-8222-222222222222';
const DETERMINISTIC_TS = '2026-06-10T00:00:00.000Z';

// --- tiny arg parser --------------------------------------------------------
function parseFlags(argv) {
  const flags = {};
  for (let i = 0; i < argv.length; i++) {
    const tok = argv[i];
    if (!tok.startsWith('--')) continue;
    const eq = tok.indexOf('=');
    if (eq !== -1) {
      flags[tok.slice(2, eq)] = tok.slice(eq + 1);
    } else {
      const next = argv[i + 1];
      if (next !== undefined && !next.startsWith('--')) {
        flags[tok.slice(2)] = next;
        i++;
      } else {
        flags[tok.slice(2)] = true;
      }
    }
  }
  return flags;
}

/** Deterministic id generator so runs are reproducible (uuid-shaped). */
function counterIds() {
  let n = 0;
  return () => `00000000-0000-4000-8000-${String(++n).padStart(12, '0')}`;
}

// --- output helpers ---------------------------------------------------------
const line = (s = '') => console.log(s);
function meta({ status, backing, limitation }) {
  line('');
  line(`  status:     ${status}`);
  line(`  backing:    ${backing}`);
  line(`  limitation: ${limitation}`);
}
function guardWorkspace(flags) {
  const ws = flags.workspace ?? SANDBOX_WORKSPACE;
  if (ws !== SANDBOX_WORKSPACE) {
    throw new Blocked(
      `workspace "${ws}" is not allowed; this harness operates only on the ` +
        `${SANDBOX_WORKSPACE} sandbox (Tenant Zero).`,
    );
  }
  return ws;
}
class Blocked extends Error {}

// ===========================================================================
// commands
// ===========================================================================

async function cmdModelsList() {
  const agents = await loadPkg('packages/agents/src/index.ts');
  const registry = agents.createDefaultBrainRegistry();

  line('Brain agent/model surface (no live external models in V1)');
  line('');
  for (const provider of registry.list()) {
    const d = provider.descriptor;
    const state = provider.isEnabled() ? 'ENABLED' : 'DISABLED';
    line(`- ${d.id}  [${state}]  ${d.displayName}`);
    for (const m of d.models) {
      line(`    model: ${m.id}  family=${m.family}  capabilities=[${m.capabilities.join(', ')}]`);
    }
    if (d.requiresEnvKeys && d.requiresEnvKeys.length > 0) {
      // env-var NAMES only — never values.
      line(`    requires env keys (names only): ${d.requiresEnvKeys.join(', ')}`);
    }
  }
  line('');
  line(
    `enabled: ${registry.listEnabled().length}   disabled: ${registry.listDisabled().length}`,
  );

  meta({
    status: 'REAL',
    backing: '@cognitia/agents brain ModelRegistry (createDefaultBrainRegistry)',
    limitation:
      'Only the deterministic mock provider is ENABLED in V1. Every external ' +
      'LLM provider (OpenAI/Anthropic/DeepSeek/xAI/OpenRouter/Ollama/CLI) is a ' +
      'DISABLED scaffold with no SDK and no keys. This lists the brain surface, ' +
      'not live external models.',
  });
}

async function cmdProvidersTest(flags) {
  const providerId = typeof flags.provider === 'string' ? flags.provider : null;
  if (!providerId) {
    throw new Blocked('missing required flag: --provider <id> (e.g. mock)');
  }
  const agents = await loadPkg('packages/agents/src/index.ts');
  const registry = agents.createDefaultBrainRegistry();
  const provider = registry.get(providerId);

  if (!provider) {
    const known = registry.list().map((p) => p.descriptor.id).join(', ');
    throw new Blocked(`unknown brain provider "${providerId}". known: ${known}`);
  }

  const d = provider.descriptor;
  line(`provider: ${d.id}  (${d.displayName})`);

  if (!provider.isEnabled()) {
    // Prove the scaffold refuses to execute and performs no IO.
    let refusal = 'unknown';
    try {
      await provider.generate({ model: d.models[0]?.id ?? `${d.id}-model`, prompt: 'probe' });
      refusal = 'ERROR: provider executed while disabled';
    } catch (err) {
      refusal = `refused with ${err?.name ?? 'Error'} (no IO performed)`;
    }
    line(`  enabled:  false`);
    line(`  generate: ${refusal}`);
    meta({
      status: 'DISABLED',
      backing: `@cognitia/agents brain "${d.id}" provider scaffold`,
      limitation:
        `Provider "${d.id}" is a disabled V1 scaffold: no SDK import, no network, ` +
        `no secret. generate() throws ProviderDisabledError. Enable it deliberately ` +
        `in a later lane before use.`,
    });
    return;
  }

  // Enabled provider (mock): run a deterministic probe; print hashes, not text.
  const probe = { model: d.models[0].id, system: 'brain provider self-test', prompt: 'probe' };
  const res = await provider.generate(probe);
  line(`  enabled:    true`);
  line(`  model:      ${res.model}`);
  line(`  promptHash: ${res.promptHash}`);
  line(`  outputHash: ${res.outputHash}`);
  line(`  finish:     ${res.finishReason}`);
  line(`  deterministic: ${res.deterministic}`);
  line(`  tokensIn/out:  ${res.tokensIn ?? '?'}/${res.tokensOut ?? '?'}`);
  meta({
    status: 'REAL',
    backing: '@cognitia/agents brain mock provider (BrainProvider.generate)',
    limitation:
      'Deterministic, in-memory mock provider only — no network, no model API. ' +
      'Raw prompt/output are never printed; only their hashes.',
  });
}

async function cmdRun(flags) {
  const workspace = guardWorkspace(flags);
  const task = typeof flags.task === 'string' ? flags.task : 'prospect.research';
  const providerId = typeof flags.provider === 'string' ? flags.provider : 'mock';

  const agents = await loadPkg('packages/agents/src/index.ts');
  const db = await loadPkg('packages/db/src/index.ts');
  const registry = agents.createDefaultBrainRegistry();

  const provider = registry.get(providerId);
  if (!provider) {
    const known = registry.list().map((p) => p.descriptor.id).join(', ');
    throw new Blocked(`unknown brain provider "${providerId}". known: ${known}`);
  }
  if (!provider.isEnabled()) {
    line(`task:      ${task}`);
    line(`workspace: ${workspace}`);
    line(`provider:  ${providerId} (disabled) — run not executed`);
    meta({
      status: 'DISABLED',
      backing: `@cognitia/agents brain "${providerId}" provider scaffold`,
      limitation:
        `Provider "${providerId}" is disabled in V1; the brain run is skipped. ` +
        `Re-run with --provider mock.`,
    });
    return;
  }

  // --- seed synthetic, non-PII sandbox data (clearly fake; .example / 555-01xx).
  const repo = new db.InMemoryRepository();
  const acct = (id, name, industry) => ({
    id,
    tenant_id: SANDBOX_TENANT,
    name,
    domain: `${id}.example`,
    industry,
    employee_count: 200,
    region: 'NA',
    fit_score: 0.9,
    timing_score: 0.8,
    attributes: {},
    created_at: DETERMINISTIC_TS,
    updated_at: DETERMINISTIC_TS,
  });
  const contact = (id, accountId, suppressed) => ({
    id,
    tenant_id: SANDBOX_TENANT,
    account_id: accountId,
    full_name: 'Synthetic Sample Buyer',
    title: 'Fleet Manager',
    persona: 'economic_buyer',
    // already hashed — no raw email/phone is ever stored or printed.
    email_hash: `sha256:${id}`,
    phone_hash: null,
    is_suppressed: suppressed,
    attributes: { phone_example: '555-0100' },
    created_at: DETERMINISTIC_TS,
    updated_at: DETERMINISTIC_TS,
  });
  repo.seedAccount(acct('a0000001-0000-4000-8000-000000000001', 'Budget Wheels Demo Co', 'SaaS'));
  repo.seedAccount(acct('a0000002-0000-4000-8000-000000000002', 'Demo Fleet Co', 'SaaS'));
  repo.seedContact(contact('c0000001-0000-4000-8000-000000000001', 'a0000001-0000-4000-8000-000000000001', false));
  repo.seedContact(contact('c0000002-0000-4000-8000-000000000002', 'a0000002-0000-4000-8000-000000000002', false));
  // a suppressed contact — proves it is never proposed to.
  repo.seedContact(contact('c0000003-0000-4000-8000-000000000003', 'a0000002-0000-4000-8000-000000000002', true));

  const services = agents.createGtmServices({
    repo,
    v1Mode: true, // CRM-only fence: no email/outreach path exists in the runtime.
    now: () => new Date(DETERMINISTIC_TS),
    newId: counterIds(),
  });

  // Real Mira propose-only pass over the synthetic sandbox.
  const result = await services.mira.run({
    tenantId: SANDBOX_TENANT,
    objective: task,
    traceId: `brain-cli:${task}`,
    icp: { industries: ['SaaS'], minEmployees: 50, regions: ['NA'] },
    maxAccounts: 5,
  });
  const actions = await repo.listAgentActions(SANDBOX_TENANT);

  // Brain mock tie-in: derive a deterministic research-step hash from NON-PII
  // account attributes. The raw prompt is never printed — only its hashes.
  const mock = registry.getEnabled('mock');
  const ranked = result.ranked ?? [];
  const researchPrompt = ranked
    .map((r) => `account=${r.accountId} score=${r.combined.toFixed(3)}`)
    .join('; ');
  const brainResp = await mock.generate({
    model: 'mock-deterministic-1',
    system: `task:${task}`,
    prompt: researchPrompt,
  });

  line(`task:       ${task}`);
  line(`workspace:  ${workspace}  (tenant ${SANDBOX_TENANT})`);
  line(`provider:   ${brainResp.providerId} / ${brainResp.model}`);
  line('');
  line('brain step (hashes only — no raw prompt/PII):');
  line(`  promptHash: ${brainResp.promptHash}`);
  line(`  outputHash: ${brainResp.outputHash}`);
  line('');
  line(`mira run:   runId=${result.runId}`);
  line(`ranked accounts:`);
  for (const r of ranked) line(`  - ${r.accountId}  score=${r.combined.toFixed(3)}`);
  line(`proposed actions (proofRefs): ${result.proposedActionIds.length}`);
  for (const a of actions) {
    line(
      `  - id=${a.id} type=${a.action_type} risk=${a.risk_level} ` +
        `approval=${a.approval_status} target=${a.target_ref} ` +
        `evidence=[${a.evidence_refs.join(', ')}] idem=${a.idempotency_key}`,
    );
  }
  line(`excluded (suppressed): [${result.excludedSuppressed.join(', ')}]`);

  meta({
    status: 'REAL',
    backing:
      '@cognitia/agents MiraAgent.run + ActionLedger, @cognitia/db InMemoryRepository, brain mock provider',
    limitation:
      'task "prospect.research" is a CLI alias that runs the real Mira ' +
      'propose-only pass (v1Mode, CRM-only) over synthetic sandbox data. No real ' +
      'CRM writes, no outreach, no model API. Brain content is the deterministic ' +
      'mock; only ids/refs/hashes are printed.',
  });
}

async function cmdEval(flags) {
  const suite = typeof flags.suite === 'string' ? flags.suite : 'gtm-routing-v1';
  const evals = await loadPkg('packages/evals/src/index.ts');

  let summary;
  let metaInfo;
  if (suite === 'gtm-routing-v1' || suite === 'golden-v1') {
    summary = await evals.runGoldenEval();
    metaInfo =
      suite === 'gtm-routing-v1'
        ? {
            status: 'ALIAS',
            backing: '@cognitia/evals runGoldenEval (golden-v1 dataset)',
            limitation:
              'No "gtm-routing-v1" dataset exists in V1; this aliases the real ' +
              'golden-v1 suite (CRM-only invariants: scope fence, targeting, ' +
              'suppression, evidence, idempotency).',
          }
        : {
            status: 'REAL',
            backing: '@cognitia/evals runGoldenEval (golden-v1 dataset)',
            limitation: 'Deterministic golden suite over synthetic scenarios; no PII.',
          };
  } else if (suite === 'regressions-v1') {
    const ds = evals.loadRegressionDataset();
    if (!ds) {
      throw new Blocked('no regression dataset present (regressions-v1 is empty in this build)');
    }
    summary = await evals.runGoldenEval(ds);
    metaInfo = {
      status: 'REAL',
      backing: '@cognitia/evals runGoldenEval (regression dataset)',
      limitation: 'Promoted-regression scenarios; deterministic; no PII.',
    };
  } else {
    throw new Blocked(
      `unknown suite "${suite}". supported: gtm-routing-v1 (alias of golden-v1), ` +
        `golden-v1, regressions-v1`,
    );
  }

  line(`suite:     ${suite}`);
  line(`dataset:   ${summary.version}`);
  line(`scenarios: ${summary.scenarios}   passed: ${summary.passed}   failed: ${summary.failed}`);
  line('');
  for (const r of summary.results) {
    line(`  - ${r.scenarioId}: ${r.passed ? 'PASS' : 'FAIL'}`);
    for (const item of r.results) {
      line(`      ${item.rubric}: ${item.score}`);
    }
  }
  meta(metaInfo);
  return summary.failed > 0 ? 1 : 0;
}

async function cmdPolicyExplain(flags) {
  const workspace = guardWorkspace(flags);
  const agents = await loadPkg('packages/agents/src/index.ts');
  const core = await loadPkg('packages/core/src/index.ts');

  // Real ActionType union from the schema, with a safe fallback.
  const actionTypes = core.actionType?.options ?? [
    'email.draft.send',
    'crm.task.create',
    'crm.note.create',
  ];
  const gate = new agents.PolicyGate({}); // default (most conservative) tenant settings

  line(`policy for workspace: ${workspace}  (default TenantApprovalSettings)`);
  line('');
  for (const actionType of actionTypes) {
    line(`- ${actionType}  (risk=${core.classifyRisk(actionType)})`);
    for (const isSuppressed of [false, true]) {
      const d = gate.evaluate({ actionType, isSuppressed });
      line(
        `    suppressed=${isSuppressed}: requiresApproval=${d.requiresApproval} ` +
          `blocked=${d.blocked} reason="${d.reason}"`,
      );
    }
  }
  meta({
    status: 'REAL',
    backing: '@cognitia/agents PolicyGate + @cognitia/core classifyRisk/decideApproval',
    limitation:
      'Explains the deterministic V1 approval policy with default settings; ' +
      'suppressed targets are always blocked. No state is read or written.',
  });
}

// ===========================================================================
// dispatch
// ===========================================================================

function usage() {
  line('Cognitia Brain CLI — compatibility harness (mock-safe)');
  line('');
  line('Usage: pnpm brain <command> [flags]');
  line('');
  line('Commands:');
  line('  models:list');
  line('  providers:test --provider <mock|ollama|...>');
  line('  run --task prospect.research --workspace budget_wheels_demo --provider mock');
  line('  eval --suite gtm-routing-v1');
  line('  policy:explain --workspace budget_wheels_demo');
}

async function main() {
  const [command, ...rest] = process.argv.slice(2);
  const flags = parseFlags(rest);

  line('=== Cognitia Brain CLI — compatibility harness (mock-safe) ===');
  line('');

  try {
    switch (command) {
      case 'models:list':
        await cmdModelsList();
        return 0;
      case 'providers:test':
        await cmdProvidersTest(flags);
        return 0;
      case 'run':
        await cmdRun(flags);
        return 0;
      case 'eval':
        return (await cmdEval(flags)) ?? 0;
      case 'policy:explain':
        await cmdPolicyExplain(flags);
        return 0;
      case undefined:
      case 'help':
      case '--help':
      case '-h':
        usage();
        return 0;
      default:
        line(`unknown command: ${command}`);
        line('');
        usage();
        return 1;
    }
  } catch (err) {
    if (err instanceof Blocked) {
      line('');
      meta({
        status: 'BLOCKED',
        backing: 'n/a',
        limitation: err.message,
      });
      return 1;
    }
    throw err;
  }
}

main().then((code) => {
  process.exitCode = code ?? 0;
});
