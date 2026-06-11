import { randomUUID } from 'node:crypto';
import type { Repository, ProofRow } from '@cognitia/db';
import { proofCreate, type ProofCreate } from '@cognitia/core';
import { scanTextForPii, describeFindings, type PiiScanResult } from './redaction/scanner.js';

/**
 * Proof Registry service (COG-003). Doctrine
 * (docs/cognitia/ARCHITECTURE_LOCK_V1_1.md §7):
 *   - proofs are append-only; corrections supersede, never edit;
 *   - verified_fact requires evidence_ref + verifier_ref (zod here, CHECK in 0009);
 *   - public_safe is default-deny and only flips after a clean PII scan;
 *   - details_private NEVER leaves the operator surface.
 *
 * Every write emits an immutable `events` row and an `audit_events` row.
 */

/** The projection a public (non-operator) surface may ever see. */
export interface PublicProof {
  id: string;
  kind: string;
  evidence_tag: string;
  summary_public: string | null;
  supersedes_proof_id: string | null;
  created_at: string;
}

export function toPublicProof(row: ProofRow): PublicProof {
  return {
    id: row.id,
    kind: row.kind,
    evidence_tag: row.evidence_tag,
    summary_public: row.summary_public,
    supersedes_proof_id: row.supersedes_proof_id,
    created_at: row.created_at,
  };
}

function rowFromInput(input: ProofCreate, supersedesId: string | null): ProofRow {
  return {
    id: randomUUID(),
    tenant_id: input.tenant_id,
    kind: input.kind,
    subject_type: input.subject_type,
    subject_id: input.subject_id,
    evidence_tag: input.evidence_tag,
    evidence_ref: input.evidence_ref ?? null,
    verifier_ref: input.verifier_ref ?? null,
    summary_public: input.summary_public ?? null,
    details_private: input.details_private,
    public_safe: false,
    redaction_check_passed_at: null,
    supersedes_proof_id: supersedesId ?? input.supersedes_proof_id ?? null,
    external_attestation_ref: null,
    created_at: new Date().toISOString(),
  };
}

async function emitProofEvents(
  repo: Repository,
  row: ProofRow,
  actorRef: string,
  eventName: string,
  traceId: string,
): Promise<void> {
  const ts = new Date().toISOString();
  await repo.insertEvent({
    id: randomUUID(),
    tenant_id: row.tenant_id,
    event_name: eventName,
    entity_type: 'proof',
    entity_id: row.id,
    source: 'api',
    occurred_at: ts,
    ingested_at: ts,
    // Refs only — never summary text or details (PII rule for event payloads).
    payload: { kind: row.kind, evidence_tag: row.evidence_tag, subject_type: row.subject_type },
    trace_id: traceId,
    created_at: ts,
  });
  await repo.insertAuditEvent({
    id: randomUUID(),
    tenant_id: row.tenant_id,
    actor_ref: actorRef,
    action: eventName,
    subject_ref: `proof:${row.id}`,
    detail: { evidence_tag: row.evidence_tag, kind: row.kind },
    occurred_at: ts,
    created_at: ts,
  });
}

/** Create a proof (validated; append-only insert + event/audit emission). */
export async function createProof(
  repo: Repository,
  tenantId: string,
  body: unknown,
  actorRef: string,
  traceId: string,
): Promise<ProofRow> {
  const input = proofCreate.parse({ ...(body as Record<string, unknown>), tenant_id: tenantId });
  const row = rowFromInput(input, null);
  if (row.supersedes_proof_id) {
    const prior = await repo.getProof(tenantId, row.supersedes_proof_id);
    if (!prior) throw new ProofNotFoundError(row.supersedes_proof_id);
  }
  const created = await repo.insertProof(row);
  await emitProofEvents(repo, created, actorRef, 'proof.created.v1', traceId);
  return created;
}

/** Correct a proof by superseding it with a new row (never editing). */
export async function supersedeProof(
  repo: Repository,
  tenantId: string,
  priorId: string,
  body: unknown,
  actorRef: string,
  traceId: string,
): Promise<ProofRow> {
  const prior = await repo.getProof(tenantId, priorId);
  if (!prior) throw new ProofNotFoundError(priorId);
  const input = proofCreate.parse({ ...(body as Record<string, unknown>), tenant_id: tenantId });
  const row = rowFromInput(input, priorId);
  const created = await repo.insertProof(row);
  await emitProofEvents(repo, created, actorRef, 'proof.superseded.v1', traceId);
  return created;
}

export interface RedactionCheckOutcome {
  proof: ProofRow;
  scan: PiiScanResult;
  /** Audit-safe finding labels (counts + pattern names, never matched PII). */
  findings: string[];
}

/**
 * Run the PII scan over the proof's public summary and set publish state
 * accordingly. Default-deny: any finding forces public_safe=false.
 */
export async function runRedactionCheck(
  repo: Repository,
  tenantId: string,
  proofId: string,
  actorRef: string,
  traceId: string,
): Promise<RedactionCheckOutcome> {
  const proof = await repo.getProof(tenantId, proofId);
  if (!proof) throw new ProofNotFoundError(proofId);

  const scan = scanTextForPii(proof.summary_public);
  const findings = describeFindings(scan);
  const ts = new Date().toISOString();
  const updated = await repo.setProofPublishState(
    tenantId,
    proofId,
    scan.publish_safe,
    scan.publish_safe ? ts : null,
  );
  if (!updated) throw new ProofNotFoundError(proofId);

  await repo.insertAuditEvent({
    id: randomUUID(),
    tenant_id: tenantId,
    actor_ref: actorRef,
    action: scan.publish_safe ? 'proof.redaction.passed.v1' : 'proof.redaction.failed.v1',
    subject_ref: `proof:${proofId}`,
    detail: { findings },
    occurred_at: ts,
    created_at: ts,
  });
  await repo.insertEvent({
    id: randomUUID(),
    tenant_id: tenantId,
    event_name: scan.publish_safe ? 'proof.published.v1' : 'proof.redaction_blocked.v1',
    entity_type: 'proof',
    entity_id: proofId,
    source: 'api',
    occurred_at: ts,
    ingested_at: ts,
    payload: { findings_count: findings.length },
    trace_id: traceId,
    created_at: ts,
  });

  return { proof: updated, scan, findings };
}

export class ProofNotFoundError extends Error {
  constructor(id: string) {
    super(`proof not found: ${id}`);
    this.name = 'ProofNotFoundError';
  }
}
