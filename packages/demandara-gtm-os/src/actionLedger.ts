import { randomUUID } from 'node:crypto';
import { hashValue, sha256Hex } from './hashing.js';
import type { Clock, IdFactory } from './types.js';

/**
 * Local append-only action ledger (02_COGNITIA_TRUST_PROOF_CONTROL_CONTEXT.md).
 *
 * Records workflow events AND blocked attempts. In-memory only — persistence
 * is a future authorized lane. Events are hash-chained so any tampering with
 * an earlier event invalidates every later hash.
 */

export type LedgerEventType =
  | 'lead_received'
  | 'lead_intake_rejected'
  | 'source_rights_checked'
  | 'consent_checked'
  | 'lead_qualified'
  | 'lead_disqualified'
  | 'trust_gap_identified'
  | 'next_step_recommended'
  | 'approval_checked'
  | 'approval_issued'
  | 'connector_writeback_recorded'
  | 'connector_blocked'
  | 'model_route_decided'
  | 'model_route_blocked'
  | 'proof_receipt_generated'
  | 'monthly_report_updated'
  | 'workflow_blocked'
  | 'agent_work_event';

export interface LedgerEvent {
  /** 0-based position in the chain. */
  seq: number;
  id: string;
  type: LedgerEventType;
  occurredAt: string;
  payload: Record<string, unknown>;
  prevHash: string;
  hash: string;
}

export interface ActionLedgerOptions {
  clock?: Clock;
  idFactory?: IdFactory;
}

const GENESIS_HASH = sha256Hex('demandara-gtm-os.action-ledger.genesis.v1');

export class ActionLedger {
  private readonly chain: LedgerEvent[] = [];
  private readonly clock: Clock;
  private readonly idFactory: IdFactory;

  constructor(options: ActionLedgerOptions = {}) {
    this.clock = options.clock ?? (() => new Date());
    this.idFactory = options.idFactory ?? randomUUID;
  }

  append(type: LedgerEventType, payload: Record<string, unknown>): LedgerEvent {
    const seq = this.chain.length;
    const prevHash = seq === 0 ? GENESIS_HASH : (this.chain[seq - 1]?.hash ?? GENESIS_HASH);
    const occurredAt = this.clock().toISOString();
    const id = this.idFactory();
    const hash = hashValue({ seq, id, type, occurredAt, payload, prevHash });
    const event: LedgerEvent = Object.freeze({
      seq,
      id,
      type,
      occurredAt,
      payload,
      prevHash,
      hash,
    });
    this.chain.push(event);
    return event;
  }

  /** Read-only view of the chain. */
  events(): readonly LedgerEvent[] {
    return [...this.chain];
  }

  eventsOfType(type: LedgerEventType): readonly LedgerEvent[] {
    return this.chain.filter((event) => event.type === type);
  }

  /** Verify the whole hash chain; true only if untampered. */
  verifyChain(): boolean {
    let prevHash = GENESIS_HASH;
    for (const event of this.chain) {
      if (event.prevHash !== prevHash) return false;
      const expected = hashValue({
        seq: event.seq,
        id: event.id,
        type: event.type,
        occurredAt: event.occurredAt,
        payload: event.payload,
        prevHash: event.prevHash,
      });
      if (event.hash !== expected) return false;
      prevHash = event.hash;
    }
    return true;
  }
}
