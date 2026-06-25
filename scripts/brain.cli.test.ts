import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

/**
 * Source-level safety scan for the Brain CLI (`scripts/brain.mjs`).
 *
 * The CLI is dev-only tooling (run via `tsx`) and lives OUTSIDE `brain/`, so the
 * brain source scan does not cover it. This test mirrors that scan over the CLI
 * source to prove the runner performs no live egress, imports no vendor SDK, and
 * reads no secret/credential — it only orchestrates the mock-safe `@cognitia/agents`
 * brain API.
 */
const CLI_PATH = fileURLToPath(new URL('./brain.mjs', import.meta.url));
const src = readFileSync(CLI_PATH, 'utf8');

const NETWORK_TOKENS = [
  'fetch(',
  'globalThis.fetch',
  'node-fetch',
  'axios',
  'undici',
  'node:http',
  'node:https',
  'node:net',
  'node:tls',
  'XMLHttpRequest',
  'WebSocket',
  'EventSource',
  'https://',
  'http://',
];

const VENDOR_IMPORT_TOKENS = [
  "from 'openai'",
  "from 'anthropic'",
  '@anthropic-ai/sdk',
  '@ai-sdk/',
  "from 'ollama'",
  "require('openai'",
  "require('axios'",
];

const SECRET_PATTERNS: readonly { name: string; re: RegExp }[] = [
  { name: 'process.env read of a key', re: /process\.env\.[A-Z_]*(KEY|TOKEN|SECRET)/i },
  { name: 'api_key', re: /api[_-]?key/i },
  { name: 'credential', re: /credential/i },
  { name: 'secret', re: /secret/i },
  { name: 'bearer', re: /bearer/i },
];

function stripComments(s: string): string {
  return s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
}

describe('brain CLI source scan (scripts/brain.mjs)', () => {
  it('contains no network call or network builtin', () => {
    for (const token of NETWORK_TOKENS) {
      expect(src.includes(token), `CLI must not contain "${token}"`).toBe(false);
    }
  });

  it('imports no vendor SDK', () => {
    for (const token of VENDOR_IMPORT_TOKENS) {
      expect(src.includes(token), `CLI must not import "${token}"`).toBe(false);
    }
  });

  it('reads no secret/credential in runtime code (comments exempt)', () => {
    const code = stripComments(src);
    for (const { name, re } of SECRET_PATTERNS) {
      expect(re.test(code), `CLI must not read "${name}"`).toBe(false);
    }
  });

  it('routes only through the mock-safe @cognitia/agents brain API', () => {
    // Sanity: the CLI loads the agents barrel and uses the #206 surface.
    expect(src).toContain('packages/agents/src/index.ts');
    expect(src).toMatch(/listModels|runTask|testProvider|evalModelRouterSuite|runGtmBrainTask/);
    // And fences mutations to the sandbox tenant.
    expect(src).toContain('budget_wheels_demo');
  });
});
