import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, it, expect, beforeEach } from 'vitest';
import { InMemoryRepository } from '@cognitia/db';
import {
  appointmentRequest,
  proofCreate,
  type AppointmentRequest,
  type ApprovedAgentAction,
} from '@cognitia/core';
import {
  appointmentNoteFingerprint,
  appointmentToNoteProposal,
  appointmentToProofInput,
  ingestAppointmentWriteback,
  recordAppointmentProof,
  MockCrmWritebackAdapter,
  type AppointmentNoteProposal,
  type AppointmentWritebackContext,
} from './appointmentWriteback.js';
import { toPublicProof } from './proofs.js';
import { scanTextForPii } from './redaction/scanner.js';

/**
 * Client Zero appointment → CRM writeback (MOCK-ONLY). Fixture-based, fakes-only,
 * no network. Proves: governed-action mapping, deterministic idempotency,
 * PII never leaking into the note/proof surface, an idempotent mock adapter,
 * and a Proof-Harness-consumable result whose public projection stays clean.
 */

const fixture = (name: string): AppointmentRequest => {
  const path = fileURLToPath(new URL(`./__fixtures__/appointments/${name}.json`, import.meta.url));
  return appointmentRequest.parse(JSON.parse(readFileSync(path, 'utf8')));
};

const ctx: AppointmentWritebackContext = {
  agentRunId: 'b0000000-0000-0000-0000-000000000001',
  agent: 'client-zero',
  traceId: 'trace-appt',
  approvedBy: 'user:operator',
};

const approvedActionFrom = (proposal: AppointmentNoteProposal): ApprovedAgentAction => ({
  id: 'd0000000-0000-0000-0000-000000000001',
  tenant_id: proposal.tenantId,
  agent_run_id: proposal.agentRunId,
  action_type: proposal.actionType,
  risk_level: proposal.riskLevel,
  idempotency_key: proposal.idempotencyKey,
  approval_status: 'approved',
  execution_status: 'pending',
  target_ref: proposal.targetRef,
  evidence_refs: proposal.evidenceRefs,
  payload_ref: proposal.payloadRef,
  guardrail_results: [],
  created_at: '2026-06-21T00:00:00.000Z',
  updated_at: '2026-06-21T00:00:00.000Z',
});

describe('appointment writeback — request model & fixtures', () => {
  it('all fixtures parse against appointmentRequest', () => {
    for (const name of ['appointment-test-drive', 'appointment-no-show', 'appointment-manual']) {
      expect(() => fixture(name)).not.toThrow();
    }
  });

  it('rejects an end before the start', () => {
    const bad = { ...fixture('appointment-test-drive'), scheduled_end: '2020-01-01T00:00:00.000Z' };
    expect(appointmentRequest.safeParse(bad).success).toBe(false);
  });
});

describe('appointment → governed crm.note.create proposal', () => {
  it('maps onto crm.note.create with the right target & evidence refs', () => {
    const req = fixture('appointment-test-drive');
    const p = appointmentToNoteProposal(req, ctx);
    expect(p.actionType).toBe('crm.note.create');
    expect(p.riskLevel).toBe('low');
    expect(p.targetRef).toBe(`contact:${req.contact_id}`);
    expect(p.evidenceRefs).toEqual([`appointment:${req.appointment_id}`]);
    expect(p.payloadRef).toBe(`appointment-summary:${req.appointment_id}`);
    expect(p.idempotencyKey).toMatch(/^[0-9a-f]{64}$/);
  });

  it('never leaks invitee PII into the proposal', () => {
    const req = fixture('appointment-test-drive');
    const serialized = JSON.stringify(appointmentToNoteProposal(req, ctx));
    expect(serialized).not.toContain(req.invitee_email);
    expect(serialized).not.toContain(req.invitee_name);
    expect(serialized).not.toContain('@');
  });
});

describe('idempotency', () => {
  it('same appointment ⇒ identical fingerprint & idempotency key', () => {
    const req = fixture('appointment-test-drive');
    const a = appointmentToNoteProposal(req, ctx);
    const b = appointmentToNoteProposal(req, { ...ctx, traceId: 'a-different-trace' });
    expect(appointmentNoteFingerprint(req.appointment_id)).toBe(a.contentFingerprint);
    // Key is stable across runs/contexts (provenance never participates).
    expect(a.idempotencyKey).toBe(b.idempotencyKey);
  });

  it('different appointment ⇒ different key', () => {
    const a = appointmentToNoteProposal(fixture('appointment-test-drive'), ctx);
    const b = appointmentToNoteProposal(fixture('appointment-no-show'), ctx);
    expect(a.idempotencyKey).not.toBe(b.idempotencyKey);
  });
});

describe('proof input (Proof-Harness-consumable)', () => {
  it('is a valid proofCreate body: kind booking, verified_fact with both refs', () => {
    const proof = appointmentToProofInput(fixture('appointment-test-drive'));
    expect(proofCreate.safeParse(proof).success).toBe(true);
    expect(proof.kind).toBe('booking');
    expect(proof.subject_type).toBe('appointment');
    expect(proof.evidence_tag).toBe('verified_fact');
    expect(proof.evidence_ref).toBeTruthy();
    expect(proof.verifier_ref).toBe('verifier:client-zero-mock');
  });

  it('carries an explicit mock/simulated flag and no PII in summary_public', () => {
    const req = fixture('appointment-test-drive');
    const proof = appointmentToProofInput(req);
    expect(proof.details_private).toMatchObject({ mock: true, simulated: true });
    expect(proof.summary_public).toBeTruthy();
    expect(scanTextForPii(proof.summary_public ?? null).publish_safe).toBe(true);
    expect(proof.summary_public).not.toContain(req.invitee_email);
  });
});

describe('ingestAppointmentWriteback', () => {
  it('returns a mock-only envelope and writes/sends nothing', () => {
    const req = fixture('appointment-no-show');
    const result = ingestAppointmentWriteback(req, ctx);
    expect(result.mock).toBe(true);
    expect(result.idempotency_key).toBe(result.proposed_action.idempotencyKey);
    expect(result.proof_input.kind).toBe('booking');
  });
});

describe('MockCrmWritebackAdapter — idempotency key behavior', () => {
  let adapter: MockCrmWritebackAdapter;
  beforeEach(() => {
    adapter = new MockCrmWritebackAdapter();
  });

  it('handles crm.note.create only', () => {
    expect(adapter.handles('crm.note.create')).toBe(true);
    expect(adapter.handles('crm.task.create')).toBe(false);
    expect(adapter.handles('email.draft.send')).toBe(false);
  });

  it('writes once, then collapses replays to a no-op', async () => {
    const action = approvedActionFrom(
      appointmentToNoteProposal(fixture('appointment-test-drive'), ctx),
    );

    const first = await adapter.execute(action);
    expect(first.idempotent_replay).toBe(false);
    expect(first.external_ref).toMatch(/^mock-crm:notes:/);
    expect(adapter.size).toBe(1);

    const second = await adapter.execute(action);
    expect(second.idempotent_replay).toBe(true);
    expect(second.external_ref).toBe(first.external_ref);
    expect(adapter.size).toBe(1);
    expect(adapter.writeLog).toHaveLength(1);
  });

  it('refuses an unapproved action (defense in depth)', async () => {
    const action = {
      ...approvedActionFrom(appointmentToNoteProposal(fixture('appointment-manual'), ctx)),
      approval_status: 'proposed',
    } as unknown as ApprovedAgentAction;
    await expect(adapter.execute(action)).rejects.toThrow(/not approved/i);
  });

  it('rollback is idempotent', async () => {
    const action = approvedActionFrom(
      appointmentToNoteProposal(fixture('appointment-manual'), ctx),
    );
    const written = await adapter.execute(action);
    const ref = written.external_ref!;
    const r1 = await adapter.rollback(action.tenant_id, ref);
    const r2 = await adapter.rollback(action.tenant_id, ref);
    expect(r1.ok).toBe(true);
    expect(r2.ok).toBe(true);
    expect(adapter.size).toBe(0);
  });
});

describe('recordAppointmentProof — persisted projection stays clean', () => {
  it('persists a booking proof whose public projection leaks no private fields', async () => {
    const repo = new InMemoryRepository();
    const req = fixture('appointment-test-drive');
    const row = await recordAppointmentProof(repo, req, 'user:operator', 'trace-appt');

    expect(row.kind).toBe('booking');
    expect(row.public_safe).toBe(false); // default-deny until a redaction check runs

    const pub = toPublicProof(row);
    const publicKeys = Object.keys(pub);
    for (const leaked of [
      'details_private',
      'evidence_ref',
      'verifier_ref',
      'subject_id',
      'tenant_id',
    ]) {
      expect(publicKeys).not.toContain(leaked);
    }
    const serialized = JSON.stringify(pub);
    expect(serialized).not.toContain(req.invitee_email);
    expect(serialized).not.toContain(req.appointment_id); // subject_id not in projection
  });
});
