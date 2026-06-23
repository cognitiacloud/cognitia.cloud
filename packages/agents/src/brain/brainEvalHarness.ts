/**
 * Cognitia Brain Harness — Eval Harness.
 *
 * A deterministic, mock-only suite that exercises the router's policy/routing
 * behaviour against fixed scenarios and asserts the expected outcome (executed
 * vs blocked vs approval-required, which provider, whether a fallback fired).
 * It is the model-comparison/regression seam: today it scores routing
 * invariants with the mock provider; once real providers are enabled, the same
 * shape can compare models on golden tasks.
 *
 * No network, no secrets, no vendor SDK — it builds its own mock router.
 */

import { BrainRouter } from './brainRouter.js';
import { BrainRunLedger } from './brainRunLedger.js';
import {
  defaultWorkspacePolicy,
  type BrainPolicyDecisionCode,
  type WorkspaceBrainPolicy,
} from './brainPolicy.js';
import { mockBrainProvider } from './providers/mockProvider.js';
import type { BrainTaskType } from './taskRegistry.js';

interface BrainEvalScenario {
  id: string;
  description: string;
  taskType: BrainTaskType;
  policy: WorkspaceBrainPolicy;
  input: string;
  approvalGranted?: boolean;
  expect: {
    executed: boolean;
    requiresApproval?: boolean;
    provider?: string;
    decisionCode?: BrainPolicyDecisionCode;
    fallbackUsed?: boolean;
  };
}

export interface BrainEvalItemResult {
  scenarioId: string;
  description: string;
  passed: boolean;
  failures: string[];
}

export interface BrainEvalSummary {
  suite: string;
  total: number;
  passed: number;
  failed: number;
  results: BrainEvalItemResult[];
}

const WS = 'budget_wheels_demo';

/** Helper: a workspace policy that permits an (otherwise blocked) provider. */
function policy(overrides: Partial<WorkspaceBrainPolicy>): WorkspaceBrainPolicy {
  return { ...defaultWorkspacePolicy(WS), ...overrides };
}

const SUITES: Record<string, BrainEvalScenario[]> = {
  'gtm-routing-v1': [
    {
      id: 'routing-classification-mock',
      description: 'gtm.routing on mock executes under default policy',
      taskType: 'gtm.routing',
      policy: policy({}),
      input: 'inbound: "interested in a fleet quote for 12 vans"',
      expect: { executed: true, provider: 'mock', decisionCode: 'allow', fallbackUsed: false },
    },
    {
      id: 'research-mock-large',
      description: 'prospect.research routes to mock and executes',
      taskType: 'prospect.research',
      policy: policy({}),
      input: 'account: Budget Wheels — research public buying signals',
      expect: { executed: true, provider: 'mock', decisionCode: 'allow' },
    },
    {
      id: 'outreach-high-risk-blocks-without-approval',
      description: 'outreach.draft (high-risk) requires approval; not executed',
      taskType: 'outreach.draft',
      policy: policy({}),
      input: 'draft a follow-up to the fleet lead',
      expect: { executed: false, requiresApproval: true, decisionCode: 'requires_approval' },
    },
    {
      id: 'outreach-high-risk-runs-with-approval',
      description: 'outreach.draft executes once human approval is granted',
      taskType: 'outreach.draft',
      policy: policy({}),
      input: 'draft a follow-up to the fleet lead',
      approvalGranted: true,
      expect: { executed: true, provider: 'mock', decisionCode: 'allow' },
    },
    {
      id: 'local-only-falls-back-to-mock',
      description: 'local-only with a disabled local preferred provider falls back to mock',
      taskType: 'gtm.routing',
      // Prefer ollama (local but disabled); local-only mode still lets mock run.
      policy: policy({
        mode: 'local-only',
        preferredProvider: 'ollama',
        fallbackChain: ['ollama', 'mock'],
      }),
      input: 'route this inbound',
      expect: { executed: true, provider: 'mock', fallbackUsed: true },
    },
    {
      id: 'external-blocked-in-mock-mode',
      description: 'external openrouter blocked in mock mode; mock serves instead',
      taskType: 'gtm.routing',
      policy: policy({ preferredProvider: 'openrouter', fallbackChain: ['openrouter', 'mock'] }),
      input: 'route this inbound',
      expect: { executed: true, provider: 'mock', fallbackUsed: true },
    },
  ],
};

export function listBrainEvalSuites(): string[] {
  return Object.keys(SUITES).sort();
}

/** Run a suite against a fresh mock-only router. Deterministic. */
export async function runBrainEvalSuite(suite: string): Promise<BrainEvalSummary> {
  const scenarios = SUITES[suite];
  if (!scenarios) {
    throw new Error(
      `unknown brain eval suite "${suite}". Known: ${listBrainEvalSuites().join(', ')}`,
    );
  }

  const results: BrainEvalItemResult[] = [];
  for (const sc of scenarios) {
    const router = new BrainRouter({
      providers: { mock: mockBrainProvider },
      ledger: new BrainRunLedger(),
    });
    const res = await router.route({
      taskType: sc.taskType,
      input: sc.input,
      workspacePolicy: sc.policy,
      approvalGranted: sc.approvalGranted,
    });

    const failures: string[] = [];
    const e = sc.expect;
    if (res.executed !== e.executed) failures.push(`executed ${res.executed} != ${e.executed}`);
    if (e.requiresApproval !== undefined && res.requiresApproval !== e.requiresApproval) {
      failures.push(`requiresApproval ${res.requiresApproval} != ${e.requiresApproval}`);
    }
    if (e.provider !== undefined && res.provider !== e.provider) {
      failures.push(`provider ${res.provider} != ${e.provider}`);
    }
    if (e.decisionCode !== undefined && res.policyDecision.decisionCode !== e.decisionCode) {
      failures.push(`decisionCode ${res.policyDecision.decisionCode} != ${e.decisionCode}`);
    }
    if (e.fallbackUsed !== undefined && res.fallbackUsed !== e.fallbackUsed) {
      failures.push(`fallbackUsed ${res.fallbackUsed} != ${e.fallbackUsed}`);
    }

    results.push({
      scenarioId: sc.id,
      description: sc.description,
      passed: failures.length === 0,
      failures,
    });
  }

  const passed = results.filter((r) => r.passed).length;
  return {
    suite,
    total: results.length,
    passed,
    failed: results.length - passed,
    results,
  };
}
