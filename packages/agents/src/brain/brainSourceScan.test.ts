import { readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { createDefaultModelRegistry } from './modelRegistry.js';

/**
 * Source-level safety scan (mirrors `channels/dryRunChannels.test.ts`).
 * Proves the Brain Harness performs no live model egress and imports no vendor
 * SDK: it reads every non-test `.ts` file under `brain/` and asserts none contain
 * a network call, a network builtin, or a vendor-SDK import specifier.
 *
 * NOTE: provider ids like `openai` / `anthropic` legitimately appear as plain
 * string *values* in descriptors, so we forbid IMPORT-style specifiers
 * (`from 'openai'`) and network tokens — never the bare provider name.
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

const NETWORK_TOKENS = [
  'fetch(',
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

const VENDOR_IMPORT_TOKENS = [
  "from 'openai'",
  'from "openai"',
  "from 'anthropic'",
  '@anthropic-ai/sdk',
  "from 'groq'",
  "from 'together-ai'",
  "from 'cohere-ai'",
  "from 'ollama'",
  "from '@google/generative-ai'",
  "require('openai'",
  "require('axios'",
];

describe('brain source-level network/vendor scan', () => {
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
});

describe('brain provider registry composition', () => {
  it('registers exactly one executable provider (mock) and six disabled', () => {
    const registry = createDefaultModelRegistry();
    const enabled = registry.listEnabled();
    const disabled = registry.list().filter((d) => !d.enabled);
    expect(enabled.map((d) => d.providerId)).toEqual(['mock']);
    expect(disabled.map((d) => d.providerId).sort()).toEqual(
      ['anthropic', 'deepseek', 'local', 'openai', 'openrouter', 'xai'].sort(),
    );
  });

  it('disabled providers all carry a non-mock disabled mode', () => {
    const registry = createDefaultModelRegistry();
    for (const d of registry.list().filter((m) => !m.enabled)) {
      expect(['external_disabled', 'local_disabled']).toContain(d.mode);
    }
  });
});
