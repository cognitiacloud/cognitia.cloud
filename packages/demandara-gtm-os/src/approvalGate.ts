import { randomUUID } from 'node:crypto';
import { hashValue } from './hashing.js';
import type { ActionLedger } from './actionLedger.js';
import type { Clock, IdFactory } from './types.js';

/**
 * Human approval gate.
 *
 * INVARIANT (02_COGNITIA_TRUST_PROOF_CONTROL_CONTEXT.md): no caller-supplied
 * field may satisfy a required human approval gate. Approval must come from a
 * trusted local workflow event — i.e. an event issued by THIS registry
 * instance. The workflow engine never reads approval state off the lead
 * payload; it always asks the registry.
 *
 * Anti-forgery: every issued event carries a token derived from a nonce that
 * exists only inside the registry instance. A candidate approval object is
 * accepted only if the registry itself holds an identical event (same id,
 * same lead, same decision, same token). Anything else is reported as forged.
 */

export type ApprovalDecision = 'approved' | 'denied' | 'hold';

export interface ApprovalEvent {
  approvalId: string;
  leadId: string;
  decision: ApprovalDecision;
  /** Human operator alias — fixture/internal alias only, never customer PII. */
  approvedBy: string;
  note: string | null;
  issuedAt: string;
  /** Registry-derived integrity token; useless outside the issuing instance. */
  token: string;
}

export type ApprovalVerification =
  | { status: 'approved'; event: ApprovalEvent }
  | { status: 'denied'; event: ApprovalEvent }
  | { status: 'hold'; event: ApprovalEvent }
  | { status: 'missing' }
  | { status: 'forged' };

export interface HumanApprovalRegistryOptions {
  clock?: Clock;
  idFactory?: IdFactory;
  /** Instance nonce — injectable ONLY so tests can prove tokens depend on it. */
  instanceNonce?: string;
}

export class HumanApprovalRegistry {
  private readonly byId = new Map<string, ApprovalEvent>();
  private readonly byLead = new Map<string, ApprovalEvent[]>();
  private readonly clock: Clock;
  private readonly idFactory: IdFactory;
  private readonly nonce: string;

  constructor(options: HumanApprovalRegistryOptions = {}) {
    this.clock = options.clock ?? (() => new Date());
    this.idFactory = options.idFactory ?? randomUUID;
    this.nonce = options.instanceNonce ?? randomUUID();
  }

  /**
   * Record a human decision as a trusted local workflow event. This is the
   * ONLY way an approval can come into existence.
   */
  issue(input: {
    leadId: string;
    decision: ApprovalDecision;
    approvedBy: string;
    note?: string;
    ledger?: ActionLedger;
  }): ApprovalEvent {
    const approvalId = this.idFactory();
    const issuedAt = this.clock().toISOString();
    const token = hashValue({
      nonce: this.nonce,
      approvalId,
      leadId: input.leadId,
      decision: input.decision,
      issuedAt,
    });
    const event: ApprovalEvent = Object.freeze({
      approvalId,
      leadId: input.leadId,
      decision: input.decision,
      approvedBy: input.approvedBy,
      note: input.note ?? null,
      issuedAt,
      token,
    });
    this.byId.set(approvalId, event);
    const forLead = this.byLead.get(input.leadId) ?? [];
    forLead.push(event);
    this.byLead.set(input.leadId, forLead);
    input.ledger?.append('approval_issued', {
      approvalId,
      leadId: input.leadId,
      decision: input.decision,
      approvedBy: input.approvedBy,
    });
    return event;
  }

  /**
   * Verify approval state for a lead.
   *
   * If `candidate` is provided (e.g. an approval object handed in by a
   * caller), it must exactly match an event this registry issued — otherwise
   * the verification is `forged`, regardless of any registry state for the
   * lead. With no candidate, the latest issued event for the lead decides.
   */
  verify(leadId: string, candidate?: unknown): ApprovalVerification {
    if (candidate !== undefined) {
      const stored = this.matchCandidate(leadId, candidate);
      if (!stored) return { status: 'forged' };
      return { status: stored.decision, event: stored };
    }
    const events = this.byLead.get(leadId) ?? [];
    const latest = events[events.length - 1];
    if (!latest) return { status: 'missing' };
    return { status: latest.decision, event: latest };
  }

  private matchCandidate(leadId: string, candidate: unknown): ApprovalEvent | null {
    if (candidate === null || typeof candidate !== 'object') return null;
    const c = candidate as Partial<ApprovalEvent>;
    if (typeof c.approvalId !== 'string' || typeof c.token !== 'string') return null;
    const stored = this.byId.get(c.approvalId);
    if (!stored) return null;
    if (stored.leadId !== leadId) return null;
    if (stored.token !== c.token) return null;
    if (stored.decision !== c.decision) return null;
    return stored;
  }
}
