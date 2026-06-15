import type { ReplyClass } from '@cognitia/core';

/**
 * Heuristic reply classifier (v0, no LLM). Order matters: unsubscribe and
 * wrong-person are checked first because they trigger suppression / re-targeting
 * and must never be misread as "interested".
 */
export function classifyReply(text: string): ReplyClass {
  const t = text.toLowerCase();

  if (
    /\b(unsubscribe|opt out|opt-out|remove me|stop emailing|take me off)\b/.test(t) ||
    /\bstop\b/.test(t)
  ) {
    return 'unsubscribe';
  }
  if (
    /\b(wrong person|not the right person|don'?t handle|not my (area|department)|no longer (work|with|at)|i'?m not who)\b/.test(
      t,
    )
  ) {
    return 'wrong_person';
  }
  if (/\b(out of office|on (vacation|leave|pto)|away until|annual leave)\b/.test(t)) {
    return 'out_of_office';
  }
  if (/\b(reach out to|talk to|connect you with|forward(ing)? (this )?to|cc'?ing)\b/.test(t)) {
    return 'referral';
  }
  if (
    /\b(not interested|no thanks|no thank you|we'?re (all )?set|already have|not a fit)\b/.test(t)
  ) {
    return 'not_interested';
  }
  if (
    /\b(interested|sounds good|let'?s (talk|chat|meet)|book|calendar|tell me more|happy to)\b/.test(
      t,
    )
  ) {
    return 'interested';
  }
  return 'other';
}

/** Side effects implied by a classification (for the FeedbackRecorder/orchestrator). */
export function replyOutcome(cls: ReplyClass): {
  suppress: boolean;
  haltSequence: boolean;
  retarget: boolean;
} {
  switch (cls) {
    case 'unsubscribe':
      return { suppress: true, haltSequence: true, retarget: false };
    case 'wrong_person':
      return { suppress: false, haltSequence: true, retarget: true };
    case 'not_interested':
      return { suppress: false, haltSequence: true, retarget: false };
    default:
      return { suppress: false, haltSequence: false, retarget: false };
  }
}
