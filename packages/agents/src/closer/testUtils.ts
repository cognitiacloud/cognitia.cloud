import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import type { GtmProofEvent, RawGtmProspectInput } from '@cognitia/core';
import type {
  CrmPort,
  CrmWritebackRequest,
  CrmWritebackResult,
  ProofPort,
  ProofRecordResult,
} from './ports.js';

/**
 * Test-only helpers for the Sales Closer end-to-end harness
 * (`clientZeroEndToEnd.test.ts`).
 *
 * This module is NOT exported from `index.ts` and is never imported by runtime
 * code — it exists purely to give tests deterministic clocks/ids, observable
 * port fakes (a recording proof port, a stateful idempotent CRM port), and a
 * synthetic PII-bearing fixture used to prove redaction.
 *
 * It deliberately contains NO live-egress primitives. The banned-egress pattern
 * literals live in the `.test.ts` file (so the egress scan never matches its own
 * declarations); this module only exposes the list of runtime source files to
 * scan and a reader for them.
 */

/** Frozen wall clock for deterministic runs. */
export const FIXED_NOW = new Date('2026-06-22T00:00:00.000Z');

/** A clock that always returns the same instant. */
export function fixedClock(now: Date = FIXED_NOW): () => Date {
  return () => now;
}

/**
 * Deterministic, uuid-shaped id factory. Each call yields the next id; a fresh
 * factory restarts the sequence, so two independent runs produce identical ids
 * (used to prove determinism and CRM idempotency under a stable prospect id).
 */
export function seqId(): () => string {
  let n = 0;
  return () => `00000000-0000-4000-8000-${String(n++).padStart(12, '0')}`;
}

/** A {@link ProofPort} that captures every event it is asked to record. */
export interface RecordingProofPort extends ProofPort {
  /** Events recorded, in order. Empty on halted paths that never reach proof. */
  readonly recorded: GtmProofEvent[];
}

export function createRecordingProofPort(
  result: ProofRecordResult = { status: 'ok' },
): RecordingProofPort {
  const recorded: GtmProofEvent[] = [];
  return {
    recorded,
    async record(event: GtmProofEvent): Promise<ProofRecordResult> {
      recorded.push(event);
      return result;
    },
  };
}

/** A stateful, idempotent {@link CrmPort} fake with observable counters. */
export interface StatefulCrmPort {
  /** The port to inject into the workflow. */
  readonly port: CrmPort;
  /** Distinct persisted records, keyed by prospect + appointment. */
  readonly records: ReadonlyMap<string, string>;
  /** How many times `writeback` was invoked (including idempotent repeats). */
  calls(): number;
  /** How many distinct records were actually persisted. */
  persisted(): number;
}

/**
 * An in-memory CRM that upserts by `${prospectId}::${appointmentRef}`. Repeat
 * writebacks for the same key return the same `recordRef` and never create a
 * second record — the contract a real CRM upsert must honor. `recordRef` is
 * derived deterministically from the key so it is stable across runs.
 */
export function createStatefulCrmPort(recordRefPrefix = 'crm-record'): StatefulCrmPort {
  const records = new Map<string, string>();
  let calls = 0;
  const port: CrmPort = {
    async writeback(request: CrmWritebackRequest): Promise<CrmWritebackResult> {
      calls += 1;
      const key = `${request.prospectId}::${request.appointmentRef ?? ''}`;
      let recordRef = records.get(key);
      if (recordRef === undefined) {
        recordRef = `${recordRefPrefix}:${key}`;
        records.set(key, recordRef);
      }
      return { status: 'ok', recordRef };
    },
  };
  return {
    port,
    records,
    calls: () => calls,
    persisted: () => records.size,
  };
}

/* ---------------------------------------------------- synthetic PII fixture */

/**
 * Raw contact values for the synthetic lead. They use only safe, fictional
 * ranges: an `.example` reserved domain (RFC 6761) and a `555-01xx` reserved
 * phone number (NANP fictional range). The harness asserts these are present in
 * the RAW input but absent from the normalized prospect and from every receipt.
 */
export const SYNTHETIC_PII_RAW_EMAIL = 'gm@lakeside-motors.example';
export const SYNTHETIC_PII_RAW_PHONE = '+1-555-0142';
/** Digits-only form the normalizer would hash; must never appear in receipts. */
export const SYNTHETIC_PII_PHONE_DIGITS = '15550142';

/**
 * A contactable synthetic lead that DOES carry raw PII, so the harness can prove
 * `normalizeGtmProspect` hashes/masks/drops it and that nothing leaks into the
 * proof/transition receipts.
 */
export const SYNTHETIC_PII_LEAD: RawGtmProspectInput = {
  companyName: 'Lakeside Motors',
  website: 'https://lakeside-motors.example',
  city: 'Calgary',
  provinceOrState: 'AB',
  country: 'CA',
  businessType: 'auto_dealership',
  source: 'public_registry',
  sourceUrl: 'https://registry.example/lakeside-motors',
  sourceRisk: 'low',
  contactRole: 'General Manager',
  contactEmail: SYNTHETIC_PII_RAW_EMAIL,
  contactPhone: SYNTHETIC_PII_RAW_PHONE,
  contactBasis: 'conspicuously_published_business_contact',
  consentStatus: 'implied_possible',
  unsubscribeStatus: 'subscribed',
  doNotContact: false,
};

/* --------------------------------------------------------- source scanning */

/**
 * The closer RUNTIME source files (everything under `closer/` except the test
 * and this helper). The egress scan in the harness reads these and asserts they
 * contain no live-egress primitives.
 */
export const CLOSER_RUNTIME_SOURCE_FILES = [
  'ports.ts',
  'salesCloserWorkflow.ts',
  'mockPorts.ts',
  'index.ts',
  '__fixtures__/lead.fixture.ts',
] as const;

/** Read a closer source file relative to this directory. */
export function readCloserSource(relativePath: string): string {
  const here = dirname(fileURLToPath(import.meta.url));
  return readFileSync(join(here, relativePath), 'utf8');
}
