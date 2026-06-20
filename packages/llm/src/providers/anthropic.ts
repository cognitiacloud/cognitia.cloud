import { env } from '@cognitia/config';
import { buildBriefPrompt, buildScorePrompt } from '../prompts';
import type { BriefInput, BriefResult, LlmProvider, ScoreInput, ScoreResult } from '../types';
import { parseJsonResponse } from '../util';

/**
 * Anthropic Claude provider. Mirrors the env-driven pattern already used by
 * the hermes vision-skill: the model id comes from ANTHROPIC_MODEL, never
 * hardcoded.
 */
export class AnthropicLlmProvider implements LlmProvider {
  readonly name = 'anthropic';
  readonly model = env.ANTHROPIC_MODEL;

  private async call(system: string, user: string): Promise<string> {
    if (!env.ANTHROPIC_API_KEY) throw new Error('ANTHROPIC_API_KEY is required for the anthropic provider');
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: this.model,
        max_tokens: 1024,
        system,
        messages: [{ role: 'user', content: user }],
      }),
    });
    if (!res.ok) throw new Error(`Anthropic API error ${res.status}: ${await res.text()}`);
    const data = (await res.json()) as { content: { text: string }[] };
    return data.content.map((c) => c.text).join('');
  }

  async scoreAccount(input: ScoreInput): Promise<ScoreResult> {
    const { system, user } = buildScorePrompt(input);
    return parseJsonResponse<ScoreResult>(await this.call(system, user));
  }

  async generateBrief(input: BriefInput): Promise<BriefResult> {
    const { system, user } = buildBriefPrompt(input);
    return parseJsonResponse<BriefResult>(await this.call(system, user));
  }
}
