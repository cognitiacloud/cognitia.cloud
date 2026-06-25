#!/usr/bin/env node
/**
 * Cognitia Brain CLI — mock-safe runner over the #206 brain harness.
 *
 * A thin, mock-safe CLI over the canonical #206 brain API in `@cognitia/agents`
 * (`listModels` / `testProvider` / `runTask` / `evalModelRouterSuite` and the
 * Brain⇆GTM seam `runGtmBrainTask`). Every command calls real module code; it
 * never touches a network, a vendor SDK, a real CRM, a real model API, or a
 * secret. The only executable model is the deterministic mock; every external /
 * local provider is a disabled descriptor.
 *
 * Each command prints a meta block so the surface is honest about what it did:
 *   status      REAL     — calls a real module that fully implements the command
 *               DISABLED — the requested provider is a disabled V1 descriptor
 *               BLOCKED  — cannot be served (bad input / non-sandbox workspace)
 *   backing     the real module(s) invoked
 *   limitation  plain-English limitation
 *
 * Run via `pnpm brain <command> [flags]` (wired to `tsx scripts/brain.mjs`).
 * tsx is dev-only tooling so this script can import the workspace TypeScript
 * directly; it is never imported by runtime brain code, and the brain source
 * scan additionally proves no `brain/` module performs egress.
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
const SANDBOX_WORKSPACE = 'budget_wheels_demo';
const DETERMINISTIC_TS = '2026-01-01T00:00:00.000Z';

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
class Blocked extends Error {}

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

// ===========================================================================
// commands
// ===========================================================================

async function cmdModelsList() {
  const agents = await loadPkg('packages/agents/src/index.ts');
  const models = agents.listModels();

  line('Brain model surface (no live external models in V1)');
  line('');
  for (const d of models) {
    const state = d.enabled ? 'ENABLED' : 'DISABLED';
    line(`- ${d.providerId}/${d.modelId}  [${state}]  mode=${d.mode}  location=${d.location}`);
    line(`    capabilities=[${d.capabilities.join(', ')}]  privacy=${d.privacyTier}`);
  }
  line('');
  const enabled = models.filter((d) => d.enabled);
  line(`enabled: ${enabled.length}   disabled: ${models.length - enabled.length}`);

  meta({
    status: 'REAL',
    backing: '@cognitia/agents brain listModels (createDefaultModelRegistry)',
    limitation:
      'Only the deterministic mock provider is ENABLED in V1. Every external ' +
      '(OpenAI/Anthropic/DeepSeek/xAI/OpenRouter) and local (Ollama/OpenAI-' +
      'compatible-local) provider is a DISABLED descriptor — registered metadata ' +
      'with no SDK and no key. This lists the brain surface, not live models.',
  });
}

async function cmdProvidersTest(flags) {
  const providerId = typeof flags.provider === 'string' ? flags.provider : null;
  if (!providerId) {
    throw new Blocked('missing required flag: --provider <id> (e.g. mock)');
  }
  const agents = await loadPkg('packages/agents/src/index.ts');
  const probe = agents.testProvider(providerId);

  line(`provider: ${providerId}`);
  line(`  registered: ${probe.registered}`);
  line(`  executable: ${probe.executable}`);
  for (const d of probe.models) {
    line(`    model: ${d.modelId}  mode=${d.mode}  enabled=${d.enabled}`);
  }

  if (!probe.registered) {
    throw new Blocked(`unknown brain provider "${providerId}".`);
  }

  if (!probe.executable) {
    // Prove the disabled descriptor refuses to execute and performs no IO.
    const registry = agents.createDefaultModelRegistry();
    const model = probe.models[0];
    const provider = registry.get(providerId, model.modelId);
    let refusal = 'unknown';
    try {
      await provider.generate({ prompt: 'probe', taskType: 'prospect.research' });
      refusal = 'ERROR: provider executed while disabled';
    } catch (err) {
      refusal = `refused with ${err?.name ?? 'Error'} (no IO performed)`;
    }
    line(`  generate:   ${refusal}`);
    meta({
      status: 'DISABLED',
      backing: `@cognitia/agents brain "${providerId}" disabled descriptor`,
      limitation:
        `Provider "${providerId}" is a disabled V1 descriptor: no SDK import, no ` +
        `network, no env read. generate() throws ProviderDisabledError. Enable it ` +
        `deliberately behind the controlled_live release gate before use.`,
    });
    return;
  }

  // Enabled provider (mock): route a deterministic probe; print hashes only.
  const result = await agents.runTask({
    workspaceId: SANDBOX_WORKSPACE,
    taskType: 'prospect.research',
    prompt: 'brain provider self-test probe',
    preferredModel: { providerId, modelId: probe.models[0].modelId },
    now: () => new Date(DETERMINISTIC_TS),
  });
  line(`  ok:         ${result.ok}`);
  line(`  model:      ${result.receipt.provider}/${result.receipt.model}`);
  line(`  inputHash:  ${result.receipt.inputHash}`);
  line(`  outputHash: ${result.receipt.outputHash}`);
  meta({
    status: 'REAL',
    backing: '@cognitia/agents brain runTask (deterministic mock provider)',
    limitation:
      'Deterministic, in-memory mock provider only — no network, no model API. ' +
      'Raw prompt/output are never printed; only their sha256 hashes.',
  });
}

async function cmdRun(flags) {
  const workspace = guardWorkspace(flags);
  const task = typeof flags.task === 'string' ? flags.task : 'prospect.research';
  const approval = flags.approve === true || flags.approve === 'true';

  const agents = await loadPkg('packages/agents/src/index.ts');
  const gtmTasks = ['prospect.research', 'gtm.routing', 'outreach.draft'];

  if (!gtmTasks.includes(task)) {
    throw new Blocked(
      `unknown task "${task}". supported: ${gtmTasks.join(', ')} (the Brain⇆GTM seam tasks).`,
    );
  }

  // Route through the Brain⇆GTM seam, which delegates to the #206 router.
  const result = await agents.runGtmBrainTask({
    task,
    promptText: `Sandbox ${task} over the Budget Wheels demo pipeline (mock, never sent).`,
    approval,
    workspaceId: workspace,
    now: () => new Date(DETERMINISTIC_TS),
    newId: counterIds(),
  });

  line(`task:       ${task}`);
  line(`workspace:  ${workspace}`);
  line(`approval:   ${approval}`);
  line('');
  line(`executed:   ${result.executed}`);
  line(`blocked:    ${result.blocked}`);
  line(`provider:   ${result.provider}/${result.model}`);
  line(`fallback:   ${result.fallbackUsed}`);
  line(`policy:     risk=${result.policyDecision.riskLevel} ` +
    `requiresApproval=${result.policyDecision.requiresApproval} ` +
    `reason="${result.policyDecision.reason}"`);
  line('');
  line('brain step (hashes only — no raw prompt/PII):');
  line(`  promptHash: ${result.promptHash}`);
  line(`  outputHash: ${result.outputHash ?? '(none — blocked)'}`);
  line(`  proofRef:   ${result.proofRef}  kind=${result.proof.kind}`);
  line(`  attestation: ${result.attestation.statement}`);

  meta({
    status: result.executed ? 'REAL' : 'BLOCKED',
    backing: '@cognitia/agents runGtmBrainTask → #206 ModelRouter + GTM proof ledger',
    limitation:
      'Routes a GTM task through the governed #206 router on the sandbox tenant. ' +
      'High-risk outreach.draft requires --approve; otherwise it blocks at the ' +
      'approval gate and nothing executes. Mock provider only; no real model/CRM/send.',
  });
}

async function cmdEval(flags) {
  const requested = typeof flags.suite === 'string' ? flags.suite : 'model-router';
  const agents = await loadPkg('packages/agents/src/index.ts');

  // The canonical #206 suite is `model-router`. `gtm-routing-v1` (the named
  // routing suite) is delivered by the eval lane; here it aliases the canonical
  // router suite so the command is honest about what actually ran.
  const aliased = requested === 'gtm-routing-v1';
  const report = await agents.evalModelRouterSuite();

  line(`suite:     ${requested}${aliased ? ' (alias of model-router)' : ''}`);
  line(`dataset:   ${report.suite}`);
  line(`cases:     ${report.total}   passed: ${report.passed}   score: ${report.score}`);
  line('');
  for (const c of report.cases) {
    line(`  - ${c.name}: ${c.passed ? 'PASS' : 'FAIL'}` +
      `${c.blockedReason ? ` (${c.blockedReason})` : ''}` +
      `${c.deterministic ? '' : ' [NON-DETERMINISTIC]'}`);
  }
  meta({
    status: aliased ? 'REAL' : 'REAL',
    backing: '@cognitia/agents brain evalModelRouterSuite (model-router suite)',
    limitation: aliased
      ? 'No standalone gtm-routing-v1 dataset on this branch; aliases the real ' +
        'model-router suite (deterministic routing outcomes over the mock harness).'
      : 'Deterministic routing suite over the mock harness; correctness + determinism only.',
  });
  return report.passed === report.total ? 0 : 1;
}

async function cmdPolicyExplain() {
  const agents = await loadPkg('packages/agents/src/index.ts');
  const registry = new agents.TaskRegistry();

  line('Brain task policy (deterministic; high-risk tasks require approval)');
  line('');
  for (const spec of registry.list()) {
    line(`- ${spec.taskType}`);
    line(`    riskTier=${spec.riskTier}  requiresApproval=${spec.riskTier === 'high'}`);
    line(`    dataClassification=${spec.dataClassification}  ` +
      `requiredCapabilities=[${spec.requiredCapabilities.join(', ')}]`);
  }
  meta({
    status: 'REAL',
    backing: '@cognitia/agents brain TaskRegistry (DEFAULT_TASK_SPECS)',
    limitation:
      'Explains the deterministic V1 task policy. High-risk tasks (e.g. ' +
      'outreach.draft) always require explicit approval — there is no policy ' +
      'knob to waive it. Unknown task types fail closed at the router.',
  });
}

// ===========================================================================
// dispatch
// ===========================================================================

function usage() {
  line('Cognitia Brain CLI — mock-safe runner over the #206 brain harness');
  line('');
  line('Usage: pnpm brain <command> [flags]');
  line('');
  line('Commands:');
  line('  models:list');
  line('  providers:test --provider <mock|ollama|openai|...>');
  line('  run --task <prospect.research|gtm.routing|outreach.draft> --workspace budget_wheels_demo [--approve]');
  line('  eval --suite model-router');
  line('  policy:explain');
}

async function main() {
  const [command, ...rest] = process.argv.slice(2);
  const flags = parseFlags(rest);

  line('=== Cognitia Brain CLI — mock-safe (#206 harness) ===');
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
        await cmdPolicyExplain();
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
      meta({ status: 'BLOCKED', backing: 'n/a', limitation: err.message });
      return 1;
    }
    throw err;
  }
}

main().then((code) => {
  process.exitCode = code ?? 0;
});
