import type { BriefInput, ScoreInput } from './types';

/** Versioned prompt registry. Bump the version string when prompts change. */
export const PROMPT_VERSIONS = {
  score: 'score@1',
  brief: 'brief@1',
} as const;

export function buildScorePrompt(input: ScoreInput): { system: string; user: string } {
  return {
    system:
      'You are a B2B sales qualification engine. Given an account and enrichment ' +
      'signals, return STRICT JSON {"score":0-100,"breakdown":{...},"rationale":"..."} ' +
      'estimating fit for an automated voice-closer outreach program.',
    user: JSON.stringify(input),
  };
}

export function buildBriefPrompt(input: BriefInput): { system: string; user: string } {
  return {
    system:
      'You are a senior SDR coach. Produce a closer brief as STRICT JSON with keys ' +
      'summary, painPoints[], valueProps[], talkTrack[], objections[{objection,response}], ' +
      'recommendedChannel (email|linkedin|voice|sms).',
    user: JSON.stringify(input),
  };
}
