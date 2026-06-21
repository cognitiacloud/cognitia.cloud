/**
 * Proof-artifact primitives: the tamper-evident event chain and the artifact
 * shape that the harness emits. A proof shows *what happened* — it never claims
 * an outcome.
 */

import { createHash } from "node:crypto";
import type { BookingResult, Client, CrmWritebackResult } from "./schemas.ts";

export const PROOF_SCHEMA_VERSION = "1.0.0";
export const HARNESS_NAME = "cognitia-client-zero-proof";
export const GENESIS_HASH = "0".repeat(64);

/** The explicit no-guarantee statement every artifact must carry. */
export const REQUIRED_DISCLAIMER =
  "This artifact proves only that the documented process steps executed in the " +
  "order shown. It makes no claim or guarantee of sales, revenue, ROI, search " +
  "ranking, finance/credit approval, or lead volume. It records what happened, " +
  "not any promised outcome.";

export type Stage =
  | "lead_intake"
  | "consent_gate"
  | "compliance_gate"
  | "human_approval"
  | "appointment_booking"
  | "crm_writeback";

export type EventStatus = "ok" | "blocked" | "skipped";

export type Outcome = "completed" | "blocked";

/** Redacted, primitive-only detail map — never carries raw PII. */
export type EventDetail = Record<string, string | number | boolean>;

export interface ProofEvent {
  seq: number;
  stage: Stage;
  status: EventStatus;
  decision: string;
  detail: EventDetail;
  at: string;
  prevHash: string;
  eventHash: string;
}

export interface EventIndex {
  consent: string | null;
  compliance: string | null;
  approval: string | null;
  booking: string | null;
  writeback: string | null;
}

export interface PiiScanSummary {
  rawPiiFound: boolean;
  fieldsScanned: number;
  matches: Array<{ kind: string; redacted: string }>;
}

export interface ProofArtifact {
  proofSchemaVersion: string;
  harness: string;
  scenarioId: string;
  client: Client;
  generatedAt: string;
  /** Salted, irreversible identity reference — stands in for raw PII. */
  leadRef: string;
  outcome: Outcome;
  blockedAtStage: Stage | null;
  events: ProofEvent[];
  eventIndex: EventIndex;
  booking: BookingResult | null;
  crm: CrmWritebackResult | null;
  auditChainRoot: string;
  piiScan: PiiScanSummary;
  verification: { chainValid: boolean };
  disclaimers: string[];
}

/**
 * Stable, canonical JSON: object keys sorted recursively so the hash of an
 * event is independent of property insertion order.
 */
export function canonicalJson(value: unknown): string {
  const norm = (node: unknown): unknown => {
    if (Array.isArray(node)) return node.map(norm);
    if (node && typeof node === "object") {
      const out: Record<string, unknown> = {};
      for (const key of Object.keys(node as Record<string, unknown>).sort()) {
        out[key] = norm((node as Record<string, unknown>)[key]);
      }
      return out;
    }
    return node;
  };
  return JSON.stringify(norm(value));
}

/** Compute the hash for an event from its content + the previous hash. */
export function hashEvent(
  fields: Omit<ProofEvent, "eventHash">,
): string {
  return createHash("sha256")
    .update(canonicalJson(fields), "utf8")
    .digest("hex");
}

/**
 * Append a chained event to a list, computing prevHash/eventHash. Returns the
 * new event; mutates nothing the caller didn't pass.
 */
export function appendEvent(
  events: ProofEvent[],
  partial: {
    stage: Stage;
    status: EventStatus;
    decision: string;
    detail: EventDetail;
    at: string;
  },
): ProofEvent {
  const prevHash = events.length === 0 ? GENESIS_HASH : events[events.length - 1].eventHash;
  const seq = events.length;
  const base = {
    seq,
    stage: partial.stage,
    status: partial.status,
    decision: partial.decision,
    detail: partial.detail,
    at: partial.at,
    prevHash,
  };
  const event: ProofEvent = { ...base, eventHash: hashEvent(base) };
  events.push(event);
  return event;
}

/**
 * Recompute the whole chain and confirm every event hash and link is intact.
 * Any mutation of any event's content breaks verification.
 */
export function verifyChain(artifact: ProofArtifact): boolean {
  let prev = GENESIS_HASH;
  for (let i = 0; i < artifact.events.length; i += 1) {
    const e = artifact.events[i];
    if (e.seq !== i) return false;
    if (e.prevHash !== prev) return false;
    const { eventHash, ...rest } = e;
    if (hashEvent(rest) !== eventHash) return false;
    prev = eventHash;
  }
  const expectedRoot = artifact.events.length === 0
    ? GENESIS_HASH
    : artifact.events[artifact.events.length - 1].eventHash;
  return artifact.auditChainRoot === expectedRoot;
}

/** The structural definition of a "success proof". */
export function isSuccessProof(artifact: ProofArtifact): boolean {
  return (
    artifact.outcome === "completed" &&
    artifact.booking !== null &&
    artifact.booking.booked === true &&
    artifact.crm !== null &&
    artifact.crm.written === true
  );
}
