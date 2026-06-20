import { and, eq } from 'drizzle-orm';
import { tierForScore } from '@cognitia/config';
import type { Database } from '@cognitia/db';
import { closerScores, prospectAccounts, prospectSignals, type CloserScore } from '@cognitia/db';
import { getLlm, type LlmProvider, PROMPT_VERSIONS, type SignalInput } from '@cognitia/llm';
import { signalsHash } from './normalize';

/**
 * Score one account. Idempotent on the signals hash: if an identical signal
 * set was already scored, the existing row is returned instead of re-calling
 * the LLM.
 */
export async function scoreAccount(
  db: Database,
  accountId: string,
  llm: LlmProvider = getLlm(),
): Promise<CloserScore> {
  const [account] = await db
    .select()
    .from(prospectAccounts)
    .where(eq(prospectAccounts.id, accountId))
    .limit(1);
  if (!account) throw new Error(`Account ${accountId} not found`);

  const signals = await db
    .select()
    .from(prospectSignals)
    .where(eq(prospectSignals.accountId, accountId));

  const hash = signalsHash(signals.map((s) => ({ type: s.type, value: s.value, weight: s.weight })));

  const [existing] = await db
    .select()
    .from(closerScores)
    .where(and(eq(closerScores.accountId, accountId), eq(closerScores.signalsHash, hash)))
    .limit(1);
  if (existing) return existing;

  const llmInput: SignalInput[] = signals.map((s) => ({
    type: s.type,
    value: s.value,
    weight: Number(s.weight),
  }));

  const result = await llm.scoreAccount({
    account: {
      domain: account.domain,
      displayName: account.displayName,
      industry: account.industry,
      employeeRange: account.employeeRange,
    },
    signals: llmInput,
  });

  const [row] = await db
    .insert(closerScores)
    .values({
      accountId,
      model: `${llm.name}:${llm.model}`,
      promptVersion: PROMPT_VERSIONS.score,
      score: String(result.score),
      tier: tierForScore(result.score),
      rationale: result.rationale,
      breakdown: result.breakdown,
      signalsHash: hash,
    })
    .returning();

  if (!row) throw new Error('Failed to persist score');
  return row;
}
