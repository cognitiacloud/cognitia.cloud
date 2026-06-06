import { describe, it, expect } from 'vitest';
import {
  classifyRisk,
  decideApproval,
  idempotencyKey,
  contentFingerprint,
  isSuppressed,
} from './index.js';

describe('risk classification', () => {
  it('treats email sends as high risk', () => {
    expect(classifyRisk('email.draft.send')).toBe('high');
  });
  it('treats CRM task/note as low risk', () => {
    expect(classifyRisk('crm.task.create')).toBe('low');
    expect(classifyRisk('crm.note.create')).toBe('low');
  });
});

describe('approval decision', () => {
  it('blocks suppressed targets', () => {
    const d = decideApproval({
      actionType: 'email.draft.send',
      riskLevel: 'high',
      isSuppressed: true,
    });
    expect(d.blocked).toBe(true);
    expect(d.requiresApproval).toBe(true);
  });

  it('requires approval by default for high risk', () => {
    const d = decideApproval({
      actionType: 'email.draft.send',
      riskLevel: 'high',
      isSuppressed: false,
    });
    expect(d.requiresApproval).toBe(true);
    expect(d.blocked).toBe(false);
  });

  it('auto-approves low risk only when tenant opts in', () => {
    const optIn = decideApproval({
      actionType: 'crm.task.create',
      riskLevel: 'low',
      isSuppressed: false,
      settings: { auto_approve_low_risk: true },
    });
    expect(optIn.requiresApproval).toBe(false);

    const noOptIn = decideApproval({
      actionType: 'crm.task.create',
      riskLevel: 'low',
      isSuppressed: false,
    });
    expect(noOptIn.requiresApproval).toBe(true);
  });
});

describe('idempotency', () => {
  it('is deterministic for identical semantic input', () => {
    const parts = {
      tenant_id: 't',
      action_type: 'email.draft.send',
      target_ref: 'contact:x',
      content_fingerprint: contentFingerprint('Subject\nBody'),
    };
    expect(idempotencyKey(parts)).toBe(idempotencyKey(parts));
  });

  it('differs when content differs', () => {
    const a = idempotencyKey({
      tenant_id: 't',
      action_type: 'email.draft.send',
      target_ref: 'contact:x',
      content_fingerprint: contentFingerprint('A'),
    });
    const b = idempotencyKey({
      tenant_id: 't',
      action_type: 'email.draft.send',
      target_ref: 'contact:x',
      content_fingerprint: contentFingerprint('B'),
    });
    expect(a).not.toBe(b);
  });
});

describe('suppression', () => {
  it('matches email case-insensitively', () => {
    const supp = { emails: new Set(['person@acme.com']) };
    expect(isSuppressed({ email: 'Person@Acme.com' }, supp)).toBe(true);
    expect(isSuppressed({ email: 'other@acme.com' }, supp)).toBe(false);
  });
  it('matches contact refs', () => {
    const supp = { contactRefs: new Set(['contact:abc']) };
    expect(isSuppressed({ contactRef: 'contact:abc' }, supp)).toBe(true);
  });
});
