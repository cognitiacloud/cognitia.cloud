import { z } from 'zod';

/**
 * Zod-validated environment loader shared across the monorepo.
 *
 * Every package imports `env` from here rather than reading `process.env`
 * directly, so misconfiguration fails fast and in one place.
 */

const boolish = z
  .union([z.boolean(), z.string()])
  .transform((v) => v === true || v === 'true' || v === '1');

const EnvSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  MOCK_MODE: boolish.default('true'),

  DATABASE_URL: z.string().default('postgres://postgres:postgres@localhost:5432/sales_closer'),
  SUPABASE_URL: z.string().optional(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().optional(),

  VENDOR_NAME: z.enum(['mock', 'salescloser', 'vapi', 'retell', 'twilio']).default('mock'),
  SALESCLOSER_API_KEY: z.string().optional(),
  SALESCLOSER_BASE_URL: z.string().default('https://api.salescloser.ai'),
  SALESCLOSER_WEBHOOK_SECRET: z.string().optional(),

  APIFY_TOKEN: z.string().optional(),

  LLM_PROVIDER: z.enum(['mock', 'anthropic', 'openai']).default('mock'),
  ANTHROPIC_API_KEY: z.string().optional(),
  ANTHROPIC_MODEL: z.string().default('claude-sonnet-4-6'),
  OPENAI_API_KEY: z.string().optional(),

  HERMES_VISION_SKILL_PATH: z
    .string()
    .default('hermes/skills/vision-skill/vision_skill.py'),
});

export type Env = z.infer<typeof EnvSchema>;

let cached: Env | undefined;

/** Parse and cache the environment. Throws a readable error if invalid. */
export function loadEnv(source: NodeJS.ProcessEnv = process.env): Env {
  if (cached) return cached;
  const parsed = EnvSchema.safeParse(source);
  if (!parsed.success) {
    const issues = parsed.error.issues.map((i) => `  - ${i.path.join('.')}: ${i.message}`);
    throw new Error(`Invalid environment configuration:\n${issues.join('\n')}`);
  }
  cached = parsed.data;
  return cached;
}

/** Reset the cache — used by tests that mutate the environment. */
export function resetEnvCache(): void {
  cached = undefined;
}

/**
 * Lazily-evaluated environment. Reads through to the current parse on every
 * access, so tests can `vi.stubEnv(...)` + `resetEnvCache()` and have callers
 * that imported `env` see the new values.
 */
export const env: Env = new Proxy({} as Env, {
  get: (_t, prop: string) => loadEnv()[prop as keyof Env],
  has: (_t, prop: string) => prop in loadEnv(),
  ownKeys: () => Reflect.ownKeys(loadEnv()),
  getOwnPropertyDescriptor: (_t, prop) =>
    Object.getOwnPropertyDescriptor(loadEnv(), prop),
});

export const SCORE_TIERS = ['A', 'B', 'C', 'D'] as const;
export type ScoreTier = (typeof SCORE_TIERS)[number];

/** Map a 0–100 fit score to a tier. Shared so UI and core agree. */
export function tierForScore(score: number): ScoreTier {
  if (score >= 80) return 'A';
  if (score >= 60) return 'B';
  if (score >= 40) return 'C';
  return 'D';
}
