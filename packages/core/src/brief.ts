import { desc, eq } from 'drizzle-orm';
import type { Database } from '@cognitia/db';
import {
  closerBriefs,
  closerScores,
  prospectAccounts,
  prospectSignals,
  type CloserBrief,
} from '@cognitia/db';
import { getLlm, type LlmProvider, PROMPT_VERSIONS, type SignalInput } from '@cognitia/llm';
import { scoreAccount } from './scoring';

/**
 * Generate a closer brief from the account's latest score. If no score exists
 * yet, one is computed first. Each call creates a new versioned brief.
 */
export async function generateBrief(
  db: Database,
  accountId: string,
  llm: LlmProvider = getLlm(),
): Promise<CloserBrief> {
  const [account] = await db
    .select()
    .from(prospectAccounts)
    .where(eq(prospectAccounts.id, accountId))
    .limit(1);
  if (!account) throw new Error(`Account ${accountId} not found`);

  let [latestScore] = await db
    .select()
    .from(closerScores)
    .where(eq(closerScores.accountId, accountId))
    .orderBy(desc(closerScores.scoredAt))
    .limit(1);
  if (!latestScore) latestScore = await scoreAccount(db, accountId, llm);

  const signals = await db
    .select()
    .from(prospectSignals)
    .where(eq(prospectSignals.accountId, accountId));
  const llmSignals: SignalInput[] = signals.map((s) => ({
    type: s.type,
    value: s.value,
    weight: Number(s.weight),
  }));

  const result = await llm.generateBrief({
    account: {
      domain: account.domain,
      displayName: account.displayName,
      industry: account.industry,
      employeeRange: account.employeeRange,
    },
    score: {
      score: Number(latestScore.score),
      breakdown: latestScore.breakdown,
      rationale: latestScore.rationale ?? '',
    },
    signals: llmSignals,
  });

  const [prev] = await db
    .select({ version: closerBriefs.version })
    .from(closerBriefs)
    .where(eq(closerBriefs.accountId, accountId))
    .orderBy(desc(closerBriefs.version))
    .limit(1);
  const nextVersion = (prev?.version ?? 0) + 1;

  const [row] = await db
    .insert(closerBriefs)
    .values({
      accountId,
      scoreId: latestScore.id,
      version: nextVersion,
      summary: result.summary,
      painPoints: result.painPoints,
      valueProps: result.valueProps,
      talkTrack: result.talkTrack,
      objections: result.objections,
      recommendedChannel: result.recommendedChannel,
      model: `${llm.name}:${llm.model}`,
      promptVersion: PROMPT_VERSIONS.brief,
    })
    .returning();

  if (!row) throw new Error('Failed to persist brief');
  return row;
}
