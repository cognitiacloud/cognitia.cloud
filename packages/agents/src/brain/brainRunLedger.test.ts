import { describe, expect, it } from 'vitest';
import {
  BRAIN_PROOF_PREFIX,
  BrainRunLedger,
  brainRunInputFromExchange,
  sha256Hex,
  type AppendBrainRunInput,
} from './brainRunLedger.js';
import type { BrainRequest, BrainResponse } from './modelProvider.js';

const WS = 'budget_wheels_demo';
const PROOF_RE = /^brain-proof:[0-9a-f]{64}$/;

/** Deterministic clock + id factory so records are reproducible. */
function fixedDeps() {
  let tick = 0;
  let id = 0;
  return {
    now: () => new Date(Date.UTC(2026, 5, 23, 10, 0, tick++)),
    newId: () => `run-${++id}`,
  };
}

function allowedRun(over: Partial<AppendBrainRunInput> = {}): AppendBrainRunInput {
  return {
    workspaceId: WS,
    taskType: 'summarize',
    provider: 'mock',
    model: 'mock-deterministic-1',
    mode: 'mock',
    input: 'summarize the latest inventory snapshot',
    output: 'inventory looks healthy',
    costEstimate: 0,
    latencyMs: 12,
    fallbackUsed: false,
    policyDecision: 'allow',
    ...over,
  };
}

describe('BrainRunLedger', () => {
  it('hashes the same input to the same hash (deterministic SHA-256)', () => {
    const ledger = new BrainRunLedger(fixedDeps());
    const a = ledger.append(allowedRun());
    const b = ledger.append(allowedRun());

    expect(a.inputHash).toBe(b.inputHash);
    expect(a.outputHash).toBe(b.outputHash);
    // Hashes are SHA-256 hex (64 chars) of the raw text — independent of the id.
    expect(a.inputHash).toMatch(/^[0-9a-f]{64}$/);
    expect(a.inputHash).toBe(sha256Hex('summarize the latest inventory snapshot'));
    expect(a.id).not.toBe(b.id);
  });

  it('stores hashes only — raw email/phone never reach the ledger', () => {
    const ledger = new BrainRunLedger(fixedDeps());
    // Synthetic, reserved PII forms only: `.example` email + `555-01xx` phone.
    const rawInput = 'reply to buyer@dealer.example or call 555-0142 about the quote';
    ledger.append(allowedRun({ input: rawInput, output: 'drafted a reply' }));

    const serialized = JSON.stringify(ledger.list());
    expect(serialized).not.toContain('buyer@dealer.example');
    expect(serialized).not.toContain('555-0142');
    expect(serialized).not.toContain('@');
    // The hash of the raw input IS present — provenance without the content.
    expect(serialized).toContain(sha256Hex(rawInput));
  });

  it('records a blocked outcome with its reason and a valid proofRef', () => {
    const ledger = new BrainRunLedger(fixedDeps());
    const blocked = ledger.append(
      allowedRun({
        policyDecision: 'block',
        blockedReason: 'policy:disabled_provider',
        output: undefined,
      }),
    );

    expect(ledger.size).toBe(1);
    expect(blocked.policyDecision).toBe('block');
    expect(blocked.blockedReason).toBe('policy:disabled_provider');
    // Output omitted → still a deterministic hash of the empty string.
    expect(blocked.outputHash).toBe(sha256Hex(''));
    expect(blocked.proofRef).toMatch(PROOF_RE);
    expect(ledger.list()[0]?.blockedReason).toBe('policy:disabled_provider');
  });

  it('derives a stable proofRef that resists cross-workspace/task collisions', () => {
    const ledger = new BrainRunLedger(fixedDeps());
    const first = ledger.append(allowedRun());
    const again = ledger.append(allowedRun());
    // Same identity inputs → identical proofRef.
    expect(first.proofRef).toBe(again.proofRef);
    expect(first.proofRef).toMatch(PROOF_RE);
    expect(first.proofRef.startsWith(BRAIN_PROOF_PREFIX)).toBe(true);

    // Same prompt/output but a different workspace → different proofRef.
    const otherWs = ledger.append(allowedRun({ workspaceId: 'tenant_zero_sandbox' }));
    expect(otherWs.proofRef).not.toBe(first.proofRef);
    // Same prompt/output but a different task type → different proofRef.
    const otherTask = ledger.append(allowedRun({ taskType: 'classify' }));
    expect(otherTask.proofRef).not.toBe(first.proofRef);
  });

  it('is append-only — list() returns a copy that cannot mutate state', () => {
    const ledger = new BrainRunLedger(fixedDeps());
    ledger.append(allowedRun());

    const snapshot = ledger.list();
    snapshot.push(allowedRunRecordShape());
    if (snapshot[0]) snapshot[0].blockedReason = 'tampered';

    expect(ledger.size).toBe(1);
    expect(ledger.list()).toHaveLength(1);
    expect(ledger.list()[0]?.blockedReason).toBeNull();
  });

  it('lists all records and filters byWorkspace in insertion order', () => {
    const ledger = new BrainRunLedger(fixedDeps());
    ledger.append(allowedRun({ taskType: 'a' }));
    ledger.append(allowedRun({ workspaceId: 'tenant_zero_sandbox', taskType: 'b' }));
    ledger.append(allowedRun({ taskType: 'c' }));

    expect(ledger.list().map((r) => r.taskType)).toEqual(['a', 'b', 'c']);
    expect(ledger.byWorkspace(WS).map((r) => r.taskType)).toEqual(['a', 'c']);
    expect(ledger.byWorkspace('tenant_zero_sandbox').map((r) => r.taskType)).toEqual(['b']);
    expect(ledger.byWorkspace('nobody')).toEqual([]);
  });

  it('builds a ledger input from a Brain Core request/response, keeping SHA-256', () => {
    const request: BrainRequest = { model: 'mock-deterministic-1', prompt: 'hello', system: 'sys' };
    const response: BrainResponse = {
      providerId: 'mock',
      model: 'mock-deterministic-1',
      content: 'mock:mock-deterministic-1:abcd1234',
      promptHash: 'fnv-not-used',
      outputHash: 'fnv-not-used',
      finishReason: 'stop',
      deterministic: true,
    };
    const ledger = new BrainRunLedger(fixedDeps());
    const rec = ledger.append(
      brainRunInputFromExchange(request, response, {
        workspaceId: WS,
        taskType: 'draft',
        mode: 'mock',
        latencyMs: 3,
      }),
    );

    expect(rec.provider).toBe('mock');
    expect(rec.model).toBe('mock-deterministic-1');
    // Ledger hashes the raw system+prompt and content itself (not the FNV hash).
    expect(rec.inputHash).toBe(sha256Hex('sys\nhello'));
    expect(rec.outputHash).toBe(sha256Hex('mock:mock-deterministic-1:abcd1234'));
  });
});

/** A throwaway record shape used to prove that pushing onto list() is a no-op. */
function allowedRunRecordShape() {
  return {
    id: 'tamper',
    createdAt: '2026-06-23T10:00:00.000Z',
    workspaceId: WS,
    taskType: 'tamper',
    provider: 'mock',
    model: 'mock-deterministic-1',
    mode: 'mock' as const,
    inputHash: sha256Hex('x'),
    outputHash: sha256Hex('y'),
    costEstimate: 0,
    latencyMs: 0,
    fallbackUsed: false,
    policyDecision: 'allow' as const,
    blockedReason: null,
    proofRef: `${BRAIN_PROOF_PREFIX}${sha256Hex('z')}`,
  };
}
