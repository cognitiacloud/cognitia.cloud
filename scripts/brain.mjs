#!/usr/bin/env node
/**
 * Cognitia Brain Harness — mock-safe CLI.
 *
 * Thin presentation layer over the compiled brain harness
 * (`packages/agents/dist/brain`). The brain module is self-contained (only
 * `node:crypto`), so its emitted JS is runnable by raw Node — no vendor SDK,
 * no network, no secrets. The root `pnpm brain` script builds the agents
 * package first, then runs this file.
 *
 * Commands (all mock-safe; nothing here can make a real provider call):
 *   pnpm brain models:list
 *   pnpm brain providers:test --provider mock
 *   pnpm brain providers:test --provider ollama
 *   pnpm brain run --task prospect.research --workspace budget_wheels_demo --provider mock
 *   pnpm brain eval --suite gtm-routing-v1
 *   pnpm brain policy:explain --workspace budget_wheels_demo
 */

import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { existsSync } from 'node:fs';

const here = dirname(fileURLToPath(import.meta.url));
const distEntry = join(here, '..', 'packages', 'agents', 'dist', 'brain', 'index.js');

if (!existsSync(distEntry)) {
  console.error(
    'brain CLI: compiled harness not found.\n' +
      '  Build it first:  tsc -p packages/agents/tsconfig.brain.json\n' +
      '  (the `pnpm brain` script does this automatically).',
  );
  process.exit(1);
}

const brain = await import(distEntry);

/** Parse `--key value` / `--key=value` flags. */
function parseFlags(argv) {
  const flags = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (!a.startsWith('--')) continue;
    const key = a.slice(2);
    if (key.includes('=')) {
      const [k, v] = key.split(/=(.*)/s);
      flags[k] = v;
    } else if (i + 1 < argv.length && !argv[i + 1].startsWith('--')) {
      flags[key] = argv[++i];
    } else {
      flags[key] = true;
    }
  }
  return flags;
}

function print(obj) {
  console.log(JSON.stringify(obj, null, 2));
}

const [command, ...rest] = process.argv.slice(2);
const flags = parseFlags(rest);

async function main() {
  switch (command) {
    case 'models:list': {
      const rows = Object.values(brain.PROVIDER_REGISTRY).flatMap((p) =>
        p.models.map((m) => ({
          provider: p.id,
          kind: p.kind,
          locality: p.locality,
          enabled: p.enabled,
          model: m.id,
          capabilities: m.capabilities.join(','),
          costPer1kTokensUsd: m.costPer1kTokensUsd,
          latencyTier: m.latencyTier,
          maxPrivacy: m.maxPrivacyLevel,
          envVars: p.envVarNames.join(',') || '-',
        })),
      );
      console.log('Cognitia Brain — provider/model registry (V1: only "mock" is enabled)\n');
      console.table(rows);
      break;
    }

    case 'providers:test': {
      const providerId = flags.provider ?? 'mock';
      const desc = brain.PROVIDER_REGISTRY[providerId];
      if (!desc) {
        console.error(`unknown provider "${providerId}"`);
        process.exit(1);
      }
      if (!desc.enabled) {
        print({
          provider: providerId,
          status: 'DISABLED in V1',
          locality: desc.locality,
          envVarNames: desc.envVarNames,
          enableHint:
            `rename packages/agents/src/brain/providers/${providerId}Provider.disabled.ts → .ts, ` +
            `implement generate(), set PROVIDER_REGISTRY.${providerId}.enabled = true, ` +
            `then add "${providerId}" to a workspace allowedProviders/fallbackChain.`,
        });
        break;
      }
      // Enabled (mock): run a deterministic canned request.
      const provider = new brain.MockBrainProvider();
      const response = await provider.generate({
        taskType: 'gtm.routing',
        input: 'providers:test canned input',
        model: flags.model,
      });
      print({ provider: providerId, status: 'OK (mock, deterministic)', response });
      break;
    }

    case 'run': {
      const taskType = flags.task ?? 'gtm.routing';
      const workspaceId = flags.workspace ?? 'demo';
      const provider = flags.provider ?? 'mock';
      const wp = {
        ...brain.defaultWorkspacePolicy(workspaceId),
        preferredProvider: provider,
        fallbackChain: [provider, 'mock'],
      };
      const router = new brain.BrainRouter();
      const res = await router.route({
        taskType,
        input: flags.input ?? `canned input for ${taskType} @ ${workspaceId}`,
        workspacePolicy: wp,
        approvalGranted: flags.approve === true || flags.approve === 'true',
      });
      print({
        executed: res.executed,
        provider: res.provider,
        model: res.model,
        mode: res.mode,
        fallbackUsed: res.fallbackUsed,
        requiresApproval: res.requiresApproval,
        policyDecision: res.policyDecision,
        ledgerRecord: res.ledgerRecord,
      });
      break;
    }

    case 'eval': {
      const suite = flags.suite ?? 'gtm-routing-v1';
      const summary = await brain.runBrainEvalSuite(suite);
      console.log(`Brain eval suite "${summary.suite}": ${summary.passed}/${summary.total} passed`);
      console.table(
        summary.results.map((r) => ({
          scenario: r.scenarioId,
          passed: r.passed,
          failures: r.failures.join('; ') || '-',
        })),
      );
      if (summary.failed > 0) process.exit(1);
      break;
    }

    case 'policy:explain': {
      const workspaceId = flags.workspace ?? 'demo';
      const explanation = brain.explainWorkspacePolicy(brain.defaultWorkspacePolicy(workspaceId));
      print(explanation);
      break;
    }

    default:
      console.log(
        [
          'Cognitia Brain Harness — mock-safe CLI',
          '',
          'Usage:',
          '  pnpm brain models:list',
          '  pnpm brain providers:test --provider mock',
          '  pnpm brain providers:test --provider ollama',
          '  pnpm brain run --task prospect.research --workspace budget_wheels_demo --provider mock',
          '  pnpm brain eval --suite gtm-routing-v1',
          '  pnpm brain policy:explain --workspace budget_wheels_demo',
        ].join('\n'),
      );
      if (command && command !== 'help' && command !== '--help') process.exit(1);
  }
}

await main();
