// lib/adapters/ai.ts
import type { AiAgentAdapter, LeadContext } from './types';

/**
 * Simulated AI agent. By design it can only DRAFT — `requiresHumanApproval` is a
 * literal `true`, so no code path can auto-send. Production: implement against an
 * AI service (e.g. the Claude API) behind this interface, keeping the gate.
 */
export class MockAiAgentAdapter implements AiAgentAdapter {
  async draftReply(
    ctx: LeadContext,
  ): Promise<{ draft: string; requiresHumanApproval: true; rationale: string }> {
    const { lead } = ctx;
    const vehicle = lead.vehicleInterest || "the vehicle you're considering";
    const draft =
      `Hi ${lead.name.split(' ')[0]}, thanks for reaching out about ${vehicle}. ` +
      `I'd love to help — are you free for a quick test drive this week? ` +
      `I can also outline financing options so the numbers are clear before you visit.`;
    return {
      draft,
      requiresHumanApproval: true,
      rationale:
        'Drafted from lead context. No pricing, financing terms, or promises are committed — a human must review and send.',
    };
  }
}
