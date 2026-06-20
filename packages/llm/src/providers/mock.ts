import type { BriefInput, BriefResult, LlmProvider, ScoreInput, ScoreResult } from '../types';
import { clamp } from '../util';

/**
 * Deterministic, network-free provider used in MOCK_MODE and tests.
 * The same input always yields the same score/brief so snapshots are stable.
 */
export class MockLlmProvider implements LlmProvider {
  readonly name = 'mock';
  readonly model = 'mock-llm-v1';

  async scoreAccount(input: ScoreInput): Promise<ScoreResult> {
    const weightSum = input.signals.reduce((acc, s) => acc + s.weight, 0);
    const hiring = input.signals.find((s) => s.type === 'hiring');
    const openRoles = Number((hiring?.value as { openSalesRoles?: number })?.openSalesRoles ?? 0);

    const fit = clamp(40 + weightSum * 5);
    const intent = clamp(30 + openRoles * 12);
    const reachability = input.account.employeeRange ? 70 : 50;
    const score = clamp(Math.round(fit * 0.5 + intent * 0.3 + reachability * 0.2));

    return {
      score,
      breakdown: { fit, intent, reachability },
      rationale: `Mock score from ${input.signals.length} signals (weight ${weightSum}, ${openRoles} open roles).`,
    };
  }

  async generateBrief(input: BriefInput): Promise<BriefResult> {
    const { account } = input;
    return {
      summary: `${account.displayName} (${account.industry ?? 'unknown industry'}) shows buying intent for automated pipeline.`,
      painPoints: ['Manual prospecting', 'Slow follow-up', 'Low connect rates'],
      valueProps: ['Automated qualified pipeline', 'Human-approved outreach', 'Faster rep ramp'],
      talkTrack: [
        `Open by referencing ${account.displayName}'s growth signals`,
        'Quantify cost of slow follow-up',
        'Offer a 15-minute pilot',
      ],
      objections: [
        { objection: 'We already have a tool', response: 'We sit upstream and feed it qualified, consented leads.' },
      ],
      recommendedChannel: 'voice',
    };
  }
}
