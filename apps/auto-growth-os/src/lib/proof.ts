// lib/proof.ts
// Pure factories for proof events and action-ledger entries (Cognitia core).
// Deterministic when id/now are injected — that's how tests and SSR-safe actions
// call them; the store passes makeId(...) + nowIso().
import type { ActionLedgerEntry, ProofEvent } from '../types';
import { makeId, nowIso } from './id';

export function createProofEvent(
  input: Omit<ProofEvent, 'id' | 'createdAt'>,
  id: string = makeId('proof'),
  now: string = nowIso(),
): ProofEvent {
  return { id, createdAt: now, ...input };
}

export function createLedgerEntry(
  input: Omit<ActionLedgerEntry, 'id' | 'createdAt'>,
  id: string = makeId('act'),
  now: string = nowIso(),
): ActionLedgerEntry {
  return { id, createdAt: now, ...input };
}
