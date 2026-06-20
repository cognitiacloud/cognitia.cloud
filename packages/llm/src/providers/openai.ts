import { env } from '@cognitia/config';
import { buildBriefPrompt, buildScorePrompt } from '../prompts';
import type { BriefInput, BriefResult, LlmProvider, ScoreInput, ScoreResult } from '../types';
import { parseJsonResponse } from '../util';

/** OpenAI provider (optional alternative to Anthropic). */
export class OpenAiLlmProvider implements LlmProvider {
  readonly name = 'openai';
  readonly model = 'gpt-4o-mini';

  private async call(system: string, user: string): Promise<string> {
    if (!env.OPENAI_API_KEY) throw new Error('OPENAI_API_KEY is required for the openai provider');
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${env.OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: this.model,
        temperature: 0,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: user },
        ],
      }),
    });
    if (!res.ok) throw new Error(`OpenAI API error ${res.status}: ${await res.text()}`);
    const data = (await res.json()) as { choices: { message: { content: string } }[] };
    return data.choices[0]?.message.content ?? '';
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
