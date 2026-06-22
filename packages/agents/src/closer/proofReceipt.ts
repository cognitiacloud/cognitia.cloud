import { createHash } from 'node:crypto';
import type {
  GtmEvidenceTag,
  GtmProofEvent,
  GtmProspect,
  IsoTimestamp,
  Uuid,
} from '@cognitia/core';
import type {
  SalesCloserState,
  TransitionVia,
  WorkflowRun,
  WorkflowStatus,
  WorkflowTransition,
} from './salesCloserWorkflow.js';

/**
 * Formal proof receipt + report for the Sales Closer mock spine.
 *
 * This is a PURE, read-only projection of a {@link WorkflowRun} produced by
 * `SalesCloserWorkflow.run` — a single run-level receipt that summarizes every
 * major transition (lead intake → compliance → approval → mock appointment →
 * mock CRM writeback → proof report → completed, plus rejected/blocked
 * terminals). It is NOT a second runtime, NOT a persisted proof backend, and
 * NOT a live proof service: nothing here does IO, network, DB, or vendor calls.
 *
 * The canonical per-action proof events remain the workflow's existing
 * `GtmProofEvent`s (`run.proofs`); this receipt references and hashes them, it
 * does not replace or re-emit them.
 *
 * Redaction: only PII-safe fields ever enter the receipt. Business identity
 * (company/region/source) and the already-PII-free `summaryPublic` are copied
 * verbatim; a proof event's `detailsPrivate` is NEVER copied — only a
 * `detailsHash` (sha256 over its canonical form) appears.
 *
 * Tamper-evidence: a sha256 hash-chain links the ordered transitions, and a
 * `receiptHash` digests the whole receipt. This is an integrity digest computed
 * with safe local hashing (the same `node:crypto` sha256 the core uses for PII
 * hashing) — it detects modification of an emitted receipt; it is not a signed
 * MAC and carries no secret.
 */

export const PROOF_RECEIPT_VERSION = 'closer.proof-receipt.v1' as const;

/** Derived approval outcome for the run. `not_reached` = the run halted earlier. */
export type ReceiptApprovalState = 'approved' | 'rejected' | 'pending' | 'not_reached';
/** Derived compliance outcome for the run. */
export type ReceiptComplianceState = 'pass' | 'blocked' | 'not_reached';
/** Derived (mock) appointment outcome for the run. */
export type ReceiptAppointmentState = 'requested' | 'failed' | 'not_reached';
/** Derived (mock) CRM writeback outcome for the run. */
export type ReceiptWritebackState = 'written' | 'failed' | 'not_reached';

/** Business-only, PII-safe identity of the lead the run acted on. */
export interface ProofReceiptSubject {
  leadId: Uuid;
  companyName: string;
  region: string | null;
  businessType: string | null;
  source: string;
  sourceRisk: string;
  consentStatus: string;
  doNotContact: boolean;
}

/** One emitted receipt entry per major workflow transition. */
export interface ProofReceiptEntry {
  index: number;
  from: SalesCloserState;
  to: SalesCloserState;
  via: TransitionVia;
  at: IsoTimestamp;
  /** Human-readable description of the transition. */
  label: string;
  detail: string | null;
  /** sha256 hash-chain link (folds in the prior entry's hash). */
  entryHash: string;
}

/**
 * Redacted/synthetic view of one canonical `GtmProofEvent` collected during the
 * run. `summaryPublic` is already PII-free; `detailsHash` stands in for the raw
 * `detailsPrivate`, which is never included.
 */
export interface ProofReceiptEvidence {
  proofId: Uuid;
  kind: GtmProofEvent['kind'];
  evidenceTag: GtmEvidenceTag;
  subjectType: string;
  subjectId: Uuid;
  occurredAt: IsoTimestamp;
  summaryPublic: string | null;
  /** sha256 of the canonical `detailsPrivate`. The raw details never appear. */
  detailsHash: string;
}

/** Machine-readable, run-level proof receipt. All timestamps are ISO strings. */
export interface ProofReceipt {
  version: typeof PROOF_RECEIPT_VERSION;
  runId: string;
  leadId: Uuid;
  status: WorkflowStatus;
  finalState: SalesCloserState;
  blockedReason: string | null;
  complianceState: ReceiptComplianceState;
  approvalState: ReceiptApprovalState;
  appointmentState: ReceiptAppointmentState;
  writebackState: ReceiptWritebackState;
  subject: ProofReceiptSubject;
  startedAt: IsoTimestamp | null;
  completedAt: IsoTimestamp | null;
  generatedAt: IsoTimestamp;
  transitions: ProofReceiptEntry[];
  evidence: ProofReceiptEvidence[];
  /** sha256 digest over the whole receipt (excluding this field). */
  receiptHash: string;
}

export interface BuildProofReceiptOptions {
  /** Stable run identifier. Defaults to a deterministic id derived from the run. */
  runId?: string;
  /** When the receipt was generated. Injectable for deterministic tests. */
  generatedAt?: Date;
}

/* --------------------------------------------------------------- hashing core */

/**
 * Deterministic, canonical JSON serialization: object keys are sorted and
 * `undefined`-valued keys are dropped, so the same logical content always
 * hashes identically regardless of construction order.
 */
function canonicalize(value: unknown): string {
  if (value === null || typeof value !== 'object') {
    return JSON.stringify(value) ?? 'null';
  }
  if (Array.isArray(value)) {
    return `[${value.map(canonicalize).join(',')}]`;
  }
  const obj = value as Record<string, unknown>;
  const keys = Object.keys(obj)
    .filter((key) => obj[key] !== undefined)
    .sort();
  return `{${keys.map((key) => `${JSON.stringify(key)}:${canonicalize(obj[key])}`).join(',')}}`;
}

/** Safe local hash — the same `node:crypto` sha256 the core uses for PII hashes. */
function sha256Hex(input: string): string {
  return createHash('sha256').update(input).digest('hex');
}

/** Seed for the transition hash-chain; binds the chain to this run + lead. */
function chainSeed(version: string, runId: string, leadId: string): string {
  return sha256Hex(canonicalize({ version, runId, leadId }));
}

/** The entry content the `entryHash` is computed over (everything but the hash). */
function entryCore(entry: Omit<ProofReceiptEntry, 'entryHash'>): Record<string, unknown> {
  return {
    index: entry.index,
    from: entry.from,
    to: entry.to,
    via: entry.via,
    at: entry.at,
    label: entry.label,
    detail: entry.detail,
  };
}

/* ------------------------------------------------------------------ derivation */

function findTransition(run: WorkflowRun, via: TransitionVia): WorkflowTransition | undefined {
  return run.transitions.find((transition) => transition.via === via);
}

function deriveComplianceState(run: WorkflowRun): ReceiptComplianceState {
  const compliance = findTransition(run, 'compliance');
  if (!compliance) return 'not_reached';
  return compliance.to === 'blocked_compliance' ? 'blocked' : 'pass';
}

function deriveApprovalState(run: WorkflowRun): ReceiptApprovalState {
  const approval = findTransition(run, 'approval');
  if (!approval) return 'not_reached';
  if (approval.to === 'appointment_requested') return 'approved';
  if (approval.to === 'blocked_approval') return 'rejected';
  return 'pending';
}

function deriveAppointmentState(run: WorkflowRun): ReceiptAppointmentState {
  const appointment = findTransition(run, 'appointment');
  if (!appointment) return 'not_reached';
  return appointment.to === 'blocked_appointment' ? 'failed' : 'requested';
}

function deriveWritebackState(run: WorkflowRun): ReceiptWritebackState {
  const crm = findTransition(run, 'crm');
  if (!crm) return 'not_reached';
  return crm.to === 'blocked_crm' ? 'failed' : 'written';
}

function labelFor(transition: WorkflowTransition): string {
  switch (transition.via) {
    case 'init':
      return 'Lead intake — entered compliance review';
    case 'compliance':
      return transition.to === 'blocked_compliance'
        ? 'Compliance check — blocked'
        : 'Compliance check — passed';
    case 'approval':
      if (transition.to === 'appointment_requested') return 'Human approval — approved';
      if (transition.to === 'blocked_approval') return 'Human approval — rejected';
      return 'Human approval — pending (awaiting human)';
    case 'appointment':
      return transition.to === 'blocked_appointment'
        ? 'Mock appointment — failed'
        : 'Mock appointment — requested';
    case 'crm':
      return transition.to === 'blocked_crm'
        ? 'Mock CRM writeback — failed'
        : 'Mock CRM writeback — written';
    case 'proof':
      return transition.to === 'blocked_proof'
        ? 'Proof report — failed'
        : 'Proof report — completed';
    default:
      return `${transition.from} → ${transition.to}`;
  }
}

function subjectFromProspect(prospect: GtmProspect): ProofReceiptSubject {
  const region =
    [prospect.city, prospect.provinceOrState, prospect.country]
      .filter((part): part is string => Boolean(part))
      .join(', ') || null;
  return {
    leadId: prospect.id,
    companyName: prospect.companyName,
    region,
    businessType: prospect.businessType,
    source: prospect.source,
    sourceRisk: prospect.sourceRisk,
    consentStatus: prospect.consentStatus,
    doNotContact: prospect.doNotContact,
  };
}

function deriveRunId(leadId: string, startedAt: IsoTimestamp | null, finalState: string): string {
  return `closer-run-${sha256Hex(`${leadId}|${startedAt ?? ''}|${finalState}`).slice(0, 24)}`;
}

/* -------------------------------------------------------------------- builder */

/**
 * Build a formal proof receipt from a completed/halted {@link WorkflowRun}.
 * Pure and deterministic: no IO, ISO-string timestamps only, stable hashing.
 */
export function buildProofReceipt(
  run: WorkflowRun,
  opts: BuildProofReceiptOptions = {},
): ProofReceipt {
  const leadId = run.prospect.id;
  const finalState = run.state;
  const startedAt = run.transitions[0]?.at ?? null;
  const completedAt = run.transitions[run.transitions.length - 1]?.at ?? null;
  const runId = opts.runId ?? deriveRunId(leadId, startedAt, finalState);
  const generatedAt = (opts.generatedAt ?? new Date()).toISOString();

  // One receipt entry per major transition, linked into a sha256 hash-chain.
  const seed = chainSeed(PROOF_RECEIPT_VERSION, runId, leadId);
  let previousHash = seed;
  const transitions: ProofReceiptEntry[] = run.transitions.map((transition, index) => {
    const core: Omit<ProofReceiptEntry, 'entryHash'> = {
      index,
      from: transition.from,
      to: transition.to,
      via: transition.via,
      at: transition.at,
      label: labelFor(transition),
      detail: transition.detail ?? null,
    };
    const entryHash = sha256Hex(`${previousHash}:${canonicalize(entryCore(core))}`);
    previousHash = entryHash;
    return { ...core, entryHash };
  });

  // Redacted evidence: reference each canonical proof event, hash its private
  // details, and copy only the already-PII-free public summary.
  const evidence: ProofReceiptEvidence[] = run.proofs.map((proof) => ({
    proofId: proof.id,
    kind: proof.kind,
    evidenceTag: proof.evidenceTag,
    subjectType: proof.subjectType,
    subjectId: proof.subjectId,
    occurredAt: proof.occurredAt,
    summaryPublic: proof.summaryPublic,
    detailsHash: sha256Hex(canonicalize(proof.detailsPrivate)),
  }));

  const withoutHash: Omit<ProofReceipt, 'receiptHash'> = {
    version: PROOF_RECEIPT_VERSION,
    runId,
    leadId,
    status: run.status,
    finalState,
    blockedReason: run.blockedReason ?? null,
    complianceState: deriveComplianceState(run),
    approvalState: deriveApprovalState(run),
    appointmentState: deriveAppointmentState(run),
    writebackState: deriveWritebackState(run),
    subject: subjectFromProspect(run.prospect),
    startedAt,
    completedAt,
    generatedAt,
    transitions,
    evidence,
  };

  const receiptHash = sha256Hex(canonicalize(withoutHash));
  return { ...withoutHash, receiptHash };
}

/**
 * Verify a receipt's tamper-evidence: recompute the transition hash-chain and
 * the whole-receipt digest from the same canonical form and compare. Returns
 * false if any field was altered after the receipt was built.
 */
export function verifyProofReceipt(receipt: ProofReceipt): boolean {
  const { receiptHash, ...rest } = receipt;

  // 1) Recompute the transition hash-chain.
  let previousHash = chainSeed(rest.version, rest.runId, rest.leadId);
  for (const entry of rest.transitions) {
    const { entryHash, ...core } = entry;
    const expected = sha256Hex(`${previousHash}:${canonicalize(entryCore(core))}`);
    if (expected !== entryHash) return false;
    previousHash = expected;
  }

  // 2) Recompute the whole-receipt digest.
  return sha256Hex(canonicalize(rest)) === receiptHash;
}

/* --------------------------------------------------------------- human report */

function formatState(label: string, state: string): string {
  return `  ${label.padEnd(14)} ${state}`;
}

/**
 * Render a human-readable proof report from a {@link ProofReceipt}. Plain text,
 * PII-safe (sources only redacted/synthetic fields), suitable for logs or an
 * operator hand-off. Contains no raw `detailsPrivate`.
 */
export function renderProofReport(receipt: ProofReceipt): string {
  const lines: string[] = [];
  lines.push('Sales Closer — Proof Receipt');
  lines.push('============================');
  lines.push(`Version:    ${receipt.version}`);
  lines.push(`Run ID:     ${receipt.runId}`);
  lines.push(`Lead ID:    ${receipt.leadId}`);
  lines.push(`Status:     ${receipt.status}`);
  lines.push(`Final state:${receipt.finalState}`);
  if (receipt.blockedReason) {
    lines.push(`Blocked:    ${receipt.blockedReason}`);
  }
  lines.push('');
  lines.push('Outcomes');
  lines.push(formatState('Compliance:', receipt.complianceState));
  lines.push(formatState('Approval:', receipt.approvalState));
  lines.push(formatState('Appointment:', receipt.appointmentState));
  lines.push(formatState('CRM writeback:', receipt.writebackState));
  lines.push('');
  lines.push('Lead (business-only, PII-safe)');
  lines.push(`  Company:  ${receipt.subject.companyName}`);
  lines.push(`  Region:   ${receipt.subject.region ?? '—'}`);
  lines.push(`  Type:     ${receipt.subject.businessType ?? '—'}`);
  lines.push(`  Source:   ${receipt.subject.source} (risk: ${receipt.subject.sourceRisk})`);
  lines.push(
    `  Consent:  ${receipt.subject.consentStatus}, do-not-contact: ${receipt.subject.doNotContact}`,
  );
  lines.push('');
  lines.push('Timeline');
  lines.push(`  Started:   ${receipt.startedAt ?? '—'}`);
  lines.push(`  Completed: ${receipt.completedAt ?? '—'}`);
  lines.push(`  Generated: ${receipt.generatedAt}`);
  for (const entry of receipt.transitions) {
    lines.push(`  [${entry.index}] ${entry.at}  ${entry.label}`);
    if (entry.detail) {
      lines.push(`        ↳ ${entry.detail}`);
    }
  }
  lines.push('');
  if (receipt.evidence.length === 0) {
    lines.push('Evidence: none (run halted before any proof event)');
  } else {
    lines.push('Evidence (redacted — synthetic proof events)');
    for (const item of receipt.evidence) {
      lines.push(`  • ${item.kind} [${item.evidenceTag}]  ${item.summaryPublic ?? ''}`.trimEnd());
      lines.push(`      detailsHash: ${item.detailsHash}`);
    }
  }
  lines.push('');
  lines.push(`receiptHash: ${receipt.receiptHash}`);
  return lines.join('\n');
}
