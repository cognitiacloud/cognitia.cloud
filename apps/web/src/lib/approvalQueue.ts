import type { AgentActionView } from './apiClient.js';

/**
 * View-model for the approval queue UI. Pure transforms so the eventual Next.js
 * components stay thin and rendering logic is unit-tested here.
 */

export interface ApprovalRow {
  id: string;
  channel: 'Email' | 'CRM task' | 'CRM note' | string;
  risk: string;
  target: string;
  evidenceCount: number;
  subject: string | null;
  /** True when the action can be approved (proposed + not blocked by a guardrail). */
  approvable: boolean;
  /** Human-readable status, e.g. "Awaiting approval", "Approved", "Sent". */
  status: string;
}

const CHANNEL_LABELS: Record<string, ApprovalRow['channel']> = {
  'email.draft.send': 'Email',
  'crm.task.create': 'CRM task',
  'crm.note.create': 'CRM note',
};

export function toApprovalRow(action: AgentActionView): ApprovalRow {
  return {
    id: action.id,
    channel: CHANNEL_LABELS[action.action_type] ?? action.action_type,
    risk: action.risk_level,
    target: action.target_ref,
    evidenceCount: action.evidence_refs.length,
    subject: action.draft?.subject_line ?? null,
    approvable: action.approval_status === 'proposed',
    status: statusLabel(action),
  };
}

export function toApprovalQueueView(actions: AgentActionView[]): ApprovalRow[] {
  // Highest-risk first so reviewers see the consequential items at the top.
  const order: Record<string, number> = { high: 0, medium: 1, low: 2, none: 3 };
  return actions.map(toApprovalRow).sort((a, b) => (order[a.risk] ?? 9) - (order[b.risk] ?? 9));
}

function statusLabel(a: AgentActionView): string {
  if (a.approval_status === 'rejected') return 'Rejected';
  if (a.execution_status === 'executed') return 'Sent';
  if (a.approval_status === 'approved') return 'Approved — ready to execute';
  return 'Awaiting approval';
}
