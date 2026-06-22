// lib/adapters/ai.ts
import type { AiAgentAdapter, LeadContext } from './types';
import { generateSafeReplyDraft } from '../ai-drafts';

/**
 * Simulated AI agent. By design it can only DRAFT — `requiresHumanApproval` is a
 * literal `true`, so no code path can auto-send. The draft body is produced by the
 * shared, guardrail-scanned `generateSafeReplyDraft` generator so the adapter and
 * the store speak with one voice (no divergent copy). Production: implement against
 * an AI service (e.g. the Claude API) behind this interface, keeping the gate.
 */
export class MockAiAgentAdapter implements AiAgentAdapter {
  async draftReply(
    ctx: LeadContext,
  ): Promise<{ draft: string; requiresHumanApproval: true; rationale: string }> {
    const base = generateSafeReplyDraft(ctx.lead);
    return {
      draft: base.content,
      requiresHumanApproval: true,
      rationale: base.rationale,
    };
  }
}
