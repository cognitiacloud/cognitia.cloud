import { z } from 'zod';
import {
  uuid,
  isoTimestamp,
  entityRef,
  riskLevel,
  approvalStatus,
  executionStatus,
  agentRunStatus,
} from './common.js';

/** Evidence item backing a personalization claim. */
export const evidenceItem = z.object({
  id: z.string().min(1),
  claim: z.string().min(1),
  source_ref: z.string().min(1),
  /** Hash, not raw text, when the source is PII-sensitive. */
  snippet_hash: z.string().optional(),
  score: z.number().min(0).max(1).default(0),
});

/** ContextPack: deterministic SQL context first, vector retrieval second. */
export const contextPack = z.object({
  tenant_id: uuid,
  trace_id: z.string().min(1),
  account: z.object({
    ref: entityRef,
    facts: z.array(z.record(z.unknown())).default([]),
  }),
  contacts: z
    .array(
      z.object({
        ref: entityRef,
        persona: z.string().optional(),
        facts: z.array(z.record(z.unknown())).default([]),
      }),
    )
    .default([]),
  playbook: z
    .object({
      ref: entityRef,
      icp: z.record(z.unknown()).default({}),
    })
    .optional(),
  signals: z
    .array(
      z.object({
        ref: entityRef,
        type: z.string(),
        occurred_at: isoTimestamp.optional(),
      }),
    )
    .default([]),
  evidence: z.array(evidenceItem).default([]),
  retrieval: z.array(z.object({ chunk_ref: entityRef, score: z.number() })).default([]),
});

/** An agent run: one execution with objective + input refs. */
export const agentRun = z.object({
  id: uuid,
  tenant_id: uuid,
  agent: z.enum(['mira', 'echo', 'atlas', 'beacon']),
  objective: z.string().min(1),
  input_refs: z.array(z.string()).default([]),
  status: agentRunStatus,
  trace_id: z.string().min(1),
  created_at: isoTimestamp,
  updated_at: isoTimestamp,
});

/** Action types Mira v1 may propose. */
export const actionType = z.enum(['email.draft.send', 'crm.task.create', 'crm.note.create']);

/**
 * A proposed/approved/executed side-effect action — the audit unit. Every
 * external mutation carries the four required fields: agent_action_id,
 * idempotency_key, approval_status, execution_status.
 */
export const agentAction = z.object({
  id: uuid,
  tenant_id: uuid,
  agent_run_id: uuid,
  action_type: actionType,
  risk_level: riskLevel,
  idempotency_key: z.string().min(1),
  approval_status: approvalStatus,
  execution_status: executionStatus,
  target_ref: entityRef,
  /** Non-empty for personalized sends (evidence-grounding guardrail). */
  evidence_refs: z.array(z.string()).default([]),
  /** Pointer to draft content; never inlines raw PII. */
  payload_ref: z.string().optional(),
  guardrail_results: z
    .array(
      z.object({
        name: z.string(),
        passed: z.boolean(),
        detail: z.string().optional(),
      }),
    )
    .default([]),
  result: z.record(z.unknown()).optional(),
  created_at: isoTimestamp,
  updated_at: isoTimestamp,
});

/** An approved action ready for the adapter. Execution requires this shape. */
export const approvedAgentAction = agentAction.extend({
  approval_status: z.literal('approved'),
});

export type EvidenceItem = z.infer<typeof evidenceItem>;
export type ContextPack = z.infer<typeof contextPack>;
export type AgentRun = z.infer<typeof agentRun>;
export type AgentAction = z.infer<typeof agentAction>;
export type ApprovedAgentAction = z.infer<typeof approvedAgentAction>;
export type ActionType = z.infer<typeof actionType>;
