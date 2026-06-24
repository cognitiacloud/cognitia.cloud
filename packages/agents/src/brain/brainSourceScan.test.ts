import { readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { createDefaultModelRegistry } from './modelRegistry.js';

/**
 * Source-level safety scan (mirrors `channels/dryRunChannels.test.ts`).
 * Proves the Brain Harness performs no live model egress, imports no vendor SDK,
 * and reads no secret/credential: it reads every non-test `.ts` file under
 * `brain/` and asserts none contain a network call, a network builtin, a
 * vendor-SDK import specifier, or a secret/env read.
 *
 * NOTE: provider ids like `openai` / `anthropic` legitimately appear as plain
 * string *values* in descriptors, so we forbid IMPORT-style specifiers
 * (`from 'openai'`) and network tokens — never the bare provider name.
 *
 * Secret/env tokens (`process.env`, `apiKey`, `secret`, …) are checked against a
 * COMMENT-STRIPPED copy of each source, so the documented `*_API_KEY` placeholder
 * names that live only in `*.disabled.ts` doc comments (a deliberate
 * readiness-only carve-out) and reassuring "no secret" prose are exempt, while a
 * real `process.env.OPENAI_API_KEY`-style read in code is still caught.
 */
const here = fileURLToPath(new URL('.', import.meta.url));

function collectSources(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = `${dir}${entry.name}`;
    if (entry.isDirectory()) {
      out.push(...collectSources(`${full}/`));
    } else if (entry.name.endsWith('.ts') && !entry.name.endsWith('.test.ts')) {
      out.push(full);
    }
  }
  return out;
}

const sources = collectSources(here).map((path) => ({ path, src: readFileSync(path, 'utf8') }));

/** Network calls, network builtins, and dynamic-network import specifiers. */
const NETWORK_TOKENS = [
  'fetch(',
  'fetch (',
  'globalThis.fetch',
  'node-fetch',
  'axios',
  'undici',
  'node:http',
  'node:https',
  'node:net',
  'node:tls',
  'node:dgram',
  'child_process',
  'XMLHttpRequest',
  'WebSocket',
  'EventSource',
  'https://',
  'http://',
];

/** Vendor-SDK import specifiers (single + double quote + spaced variants). */
const VENDOR_IMPORT_TOKENS = [
  "from 'openai'",
  'from "openai"',
  "from 'anthropic'",
  'from "anthropic"',
  '@anthropic-ai/sdk',
  '@ai-sdk/',
  "from 'groq'",
  "from 'together-ai'",
  "from 'cohere-ai'",
  "from 'ollama'",
  "from '@google/generative-ai'",
  "require('openai'",
  'require("openai"',
  'require( "openai"',
  "require('axios'",
  'require("axios"',
];

/** Combined raw-source token list (substring match, comments included). */
const RAW_FORBIDDEN = [...NETWORK_TOKENS, ...VENDOR_IMPORT_TOKENS];

/**
 * Secret / credential / env patterns. Checked against comment-stripped source so
 * documented placeholder names in `*.disabled.ts` comments are exempt. We do NOT
 * forbid the bare word `token` — `tokensIn` / `tokensOut` / `estimateTokens` are
 * legitimate identifiers; the `*_token` patterns below target credential tokens.
 */
const SECRET_PATTERNS: readonly { name: string; re: RegExp }[] = [
  { name: 'process.env', re: /process\.env/i },
  { name: 'api_key', re: /api[_-]?key/i },
  { name: 'credential', re: /credential/i },
  { name: 'secret', re: /secret/i },
  { name: 'bearer', re: /bearer/i },
  { name: 'authorization', re: /authorization/i },
  { name: 'access_token', re: /access[_-]?token/i },
  { name: 'auth_token', re: /auth[_-]?token/i },
];

/** Remove block and line comments before secret scanning. */
function stripComments(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
}

/** Return every forbidden token/pattern found in a source string. */
function scanSource(src: string): string[] {
  const violations: string[] = [];
  for (const token of RAW_FORBIDDEN) {
    if (src.includes(token)) violations.push(token);
  }
  const code = stripComments(src);
  for (const { name, re } of SECRET_PATTERNS) {
    if (re.test(code)) violations.push(name);
  }
  return violations;
}

describe('brain source-level network/vendor/secret scan', () => {
  it('scans more than one source file', () => {
    expect(sources.length).toBeGreaterThan(5);
  });

  it('contains no network call or network builtin', () => {
    for (const { path, src } of sources) {
      for (const token of NETWORK_TOKENS) {
        expect(src.includes(token), `${path} must not contain "${token}"`).toBe(false);
      }
    }
  });

  it('contains no vendor SDK import', () => {
    for (const { path, src } of sources) {
      for (const token of VENDOR_IMPORT_TOKENS) {
        expect(src.includes(token), `${path} must not import "${token}"`).toBe(false);
      }
    }
  });

  it('reads no secret/credential/env in runtime code (comments exempt)', () => {
    for (const { path, src } of sources) {
      const code = stripComments(src);
      for (const { name, re } of SECRET_PATTERNS) {
        expect(re.test(code), `${path} must not read "${name}"`).toBe(false);
      }
    }
  });

  it('every real source is clean under the combined scan', () => {
    for (const { path, src } of sources) {
      expect(scanSource(src), `${path} tripped the scan`).toEqual([]);
    }
  });
});

/**
 * Proof the scanner actually DETECTS each forbidden pattern: feed synthetic code
 * samples (one per pattern family) and assert each yields at least one violation.
 * These live in a `.test.ts` file, which `collectSources` excludes, so they never
 * trip the real-source scan above.
 */
const SCAN_POSITIVE_SAMPLES: readonly string[] = [
  'const r = await globalThis.fetch(url);',
  'const r = await fetch(url);',
  'const r = await fetch (url);',
  "import fetch from 'node-fetch';",
  "import axios from 'axios';",
  "import { request } from 'undici';",
  "import http from 'node:http';",
  "import https from 'node:https';",
  'const u = "https://api.openai.com/v1";',
  "import OpenAI from 'openai';",
  'import OpenAI from "openai";',
  "import Anthropic from '@anthropic-ai/sdk';",
  "import { openai } from '@ai-sdk/openai';",
  'const sdk = require("openai");',
  "const sdk = require('axios');",
  'const k = process.env.OPENAI_API_KEY;',
  'const k = config.apiKey;',
  'const k = loadApiKey();',
  'const c = readCredential();',
  'const s = getSecret();',
  'headers.Authorization = `Bearer ${t}`;',
  'const t = resp.access_token;',
  'const t = resp.auth_token;',
];

describe('brain source scan — detection proof', () => {
  it.each(SCAN_POSITIVE_SAMPLES)('flags forbidden pattern in: %s', (sample) => {
    expect(scanSource(sample).length).toBeGreaterThan(0);
  });

  it('passes clean code with no forbidden patterns', () => {
    const clean = 'export function add(a: number, b: number): number {\n  return a + b;\n}\n';
    expect(scanSource(clean)).toEqual([]);
  });

  it('exempts forbidden names that appear only in comments', () => {
    const commented =
      '// configured via OPENAI_API_KEY and process.env (documented only)\nexport const x = 1;\n';
    expect(scanSource(commented)).toEqual([]);
  });
});

describe('brain provider registry composition', () => {
  it('registers exactly one executable provider (mock) and eight disabled', () => {
    const registry = createDefaultModelRegistry();
    const enabled = registry.listEnabled();
    const disabled = registry.list().filter((d) => !d.enabled);
    expect(enabled.map((d) => d.providerId)).toEqual(['mock']);
    expect(disabled.map((d) => d.providerId).sort()).toEqual(
      [
        'anthropic',
        'deepseek',
        'local',
        'local-openai',
        'ollama',
        'openai',
        'openrouter',
        'xai',
      ].sort(),
    );
  });

  it('disabled providers all carry a non-mock disabled mode', () => {
    const registry = createDefaultModelRegistry();
    for (const d of registry.list().filter((m) => !m.enabled)) {
      expect(['external_disabled', 'local_disabled']).toContain(d.mode);
    }
  });
});
