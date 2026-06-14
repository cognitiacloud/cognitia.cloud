import { randomUUID } from 'node:crypto';

/**
 * Shadow-mode self-improvement scaffolding (Item 4).
 *
 * A SANDBOXED proposal ledger for internal improvement ideas (prompt/rule/
 * workflow/threshold changes). It is deliberately INERT:
 *   - proposals are DATA records; this module has NO executor and applies NOTHING;
 *   - nothing is ever auto-promoted (`auto_applied` is the literal `false`);
 *   - promotion to `approved` requires an explicit human decision (the API layer
 *     gates that owner-only), and even an approved proposal is NOT executed here
 *     — applying a change is a separate, deliberate human/operator action;
 *   - every state transition is recorded with who/when for evidence.
 *
 * This keeps any future self-improvement loop evidence-backed and human-gated by
 * construction; it cannot weaken a security control because it changes nothing.
 */

export type ProposalKind = 'prompt' | 'rule' | 'workflow' | 'threshold' | 'other';
export type ProposalStatus = 'proposed' | 'evaluated' | 'approved' | 'rejected' | 'rolled_back';

export interface ImprovementProposal {
  id: string;
  tenant_id: string;
  kind: ProposalKind;
  /** Reference to what would change (e.g. 'rule:scoring.v1') — NOT executable. */
  target: string;
  rationale: string;
  /** Human-readable description of the change. NEVER applied by this module. */
  proposed_change: string;
  /** Evaluation evidence attached before a decision (eval results, metrics). */
  evidence: Record<string, unknown> | null;
  status: ProposalStatus;
  created_by: string;
  created_at: string;
  decided_by: string | null;
  decided_at: string | null;
  /** Invariant: ALWAYS false. This module never auto-applies a proposal. */
  auto_applied: false;
}

export class SelfImprovementError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SelfImprovementError';
  }
}

/** Allowed transitions. Anything else throws (no skipping human review). */
const TRANSITIONS: Record<ProposalStatus, ProposalStatus[]> = {
  proposed: ['evaluated', 'rejected'],
  evaluated: ['approved', 'rejected'],
  approved: ['rolled_back'],
  rejected: [],
  rolled_back: [],
};

function transition(
  p: ImprovementProposal,
  to: ProposalStatus,
  by: string,
  at: string,
): ImprovementProposal {
  if (!TRANSITIONS[p.status].includes(to)) {
    throw new SelfImprovementError(`illegal transition ${p.status} -> ${to} for proposal ${p.id}`);
  }
  const decided = to === 'approved' || to === 'rejected' || to === 'rolled_back';
  return {
    ...p,
    status: to,
    decided_by: decided ? by : p.decided_by,
    decided_at: decided ? at : p.decided_at,
  };
}

export function createProposal(input: {
  tenantId: string;
  kind: ProposalKind;
  target: string;
  rationale: string;
  proposed_change: string;
  createdBy: string;
  now?: string;
}): ImprovementProposal {
  return {
    id: randomUUID(),
    tenant_id: input.tenantId,
    kind: input.kind,
    target: input.target,
    rationale: input.rationale,
    proposed_change: input.proposed_change,
    evidence: null,
    status: 'proposed',
    created_by: input.createdBy,
    created_at: input.now ?? new Date().toISOString(),
    decided_by: null,
    decided_at: null,
    auto_applied: false,
  };
}

/** Attach evaluation evidence (proposed -> evaluated). */
export function evaluateProposal(
  p: ImprovementProposal,
  evidence: Record<string, unknown>,
  by: string,
  now?: string,
): ImprovementProposal {
  const next = transition(p, 'evaluated', by, now ?? new Date().toISOString());
  return { ...next, evidence };
}

/** Approve (evaluated -> approved). Records the decider; applies NOTHING. */
export function approveProposal(p: ImprovementProposal, by: string, now?: string) {
  return transition(p, 'approved', by, now ?? new Date().toISOString());
}
export function rejectProposal(p: ImprovementProposal, by: string, now?: string) {
  return transition(p, 'rejected', by, now ?? new Date().toISOString());
}
/** Roll back an approved-but-applied proposal (approved -> rolled_back). */
export function rollbackProposal(p: ImprovementProposal, by: string, now?: string) {
  return transition(p, 'rolled_back', by, now ?? new Date().toISOString());
}

export interface ProposalStore {
  put(p: ImprovementProposal): Promise<void>;
  get(tenantId: string, id: string): Promise<ImprovementProposal | null>;
  list(tenantId: string): Promise<ImprovementProposal[]>;
}

/**
 * In-memory store — scaffolding + tests only. Production persists proposals
 * behind this same interface (its own table / store). Tenant-scoped reads.
 */
export class InMemoryProposalStore implements ProposalStore {
  private readonly byId = new Map<string, ImprovementProposal>();
  async put(p: ImprovementProposal): Promise<void> {
    this.byId.set(p.id, p);
  }
  async get(tenantId: string, id: string): Promise<ImprovementProposal | null> {
    const p = this.byId.get(id);
    return p && p.tenant_id === tenantId ? p : null;
  }
  async list(tenantId: string): Promise<ImprovementProposal[]> {
    return [...this.byId.values()].filter((p) => p.tenant_id === tenantId);
  }
}
