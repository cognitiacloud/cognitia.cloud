import type { ContextPack } from '@cognitia/core';

export interface MessageCandidate {
  subject_line: string;
  body: string;
  /** Evidence ids (from the context pack) backing each personalization claim. */
  evidence_refs: string[];
  risk_level: 'low' | 'medium' | 'high';
}

export interface GenerateMessageInput {
  contextPack: ContextPack;
  contactRef: string;
  brandVoice?: Record<string, unknown>;
}

/**
 * Message generation interface. LLM-backed implementations slot in later; the
 * contract guarantees every candidate carries evidence_refs so guardrails can
 * verify grounding.
 */
export interface MessageGenerator {
  generate(input: GenerateMessageInput): Promise<MessageCandidate>;
}

/**
 * Deterministic, template-based generator for the MVP (no LLM call). It only
 * makes claims it can ground: each sentence is derived from an evidence item,
 * and the evidence ids are attached. This keeps the evidence guardrail green
 * and gives us reproducible tests.
 */
export class TemplateMessageGenerator implements MessageGenerator {
  async generate(input: GenerateMessageInput): Promise<MessageCandidate> {
    const { contextPack } = input;
    const accountName =
      (contextPack.account.facts[0]?.['name'] as string | undefined) ?? 'your team';

    const lines: string[] = [];
    const refs: string[] = [];
    for (const ev of contextPack.evidence) {
      lines.push(`I noticed that ${ev.claim}.`);
      refs.push(ev.id);
    }
    if (lines.length === 0) {
      // No evidence => no personalized claims. Body stays generic; guardrail
      // will flag the lack of grounding for any personalized intent.
      lines.push(`Reaching out to ${accountName}.`);
    }

    const body = [
      `Hi there,`,
      ``,
      ...lines,
      ``,
      `If improving top-of-funnel is on your radar this quarter, would a short`,
      `conversation be worth 15 minutes?`,
      ``,
      `Reply STOP to opt out.`,
    ].join('\n');

    return {
      subject_line: `A quick idea for ${accountName}`,
      body,
      evidence_refs: refs,
      risk_level: 'high', // outbound email is always high risk => needs approval
    };
  }
}
