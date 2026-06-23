import { readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

/**
 * Safety scan: brain runtime code must contain no live IO and no vendor SDK
 * imports. Mirrors the channels `source-level network/vendor scan`, recursing
 * the brain tree. Test files are excluded (this file references the forbidden
 * tokens on purpose).
 */

const brainDir = fileURLToPath(new URL('.', import.meta.url));

function collectSources(dir: string): { path: string; text: string }[] {
  const out: { path: string; text: string }[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = `${dir}${entry.name}`;
    if (entry.isDirectory()) {
      out.push(...collectSources(`${full}/`));
    } else if (entry.name.endsWith('.ts') && !entry.name.endsWith('.test.ts')) {
      out.push({ path: full, text: readFileSync(full, 'utf8') });
    }
  }
  return out;
}

const sources = collectSources(brainDir);

// Plain tokens that would indicate live IO or a leaked network primitive.
const forbiddenTokens = [
  'fetch(',
  'axios',
  'node:http',
  'node:https',
  'node:net',
  'node:tls',
  'node:dgram',
  'child_process',
  'XMLHttpRequest',
  'WebSocket',
  'https://',
  'http://',
];

// Vendor SDK imports — matched on import/require forms so descriptor ids like
// `id: 'openai'` are NOT false positives.
const forbiddenSdkImport =
  /(?:from\s*|require\(\s*)['"](openai|@anthropic-ai\/[\w-]+|@deepseek\/[\w-]+|@ai-sdk\/[\w-]+|ollama|groq-sdk|@openrouter\/[\w-]+|@google\/[\w-]+|cohere-ai)['"]/;

describe('brain source-level network/vendor scan', () => {
  it('scans at least the contract, registry, mock and seven disabled files', () => {
    // 1 contract + 1 registry + 1 barrel + 1 mock + 7 disabled = 11 files.
    expect(sources.length).toBeGreaterThanOrEqual(11);
  });

  it('contains no network primitives or hardcoded URLs', () => {
    for (const { path, text } of sources) {
      for (const token of forbiddenTokens) {
        expect(text.includes(token), `${path} must not contain "${token}"`).toBe(false);
      }
    }
  });

  it('imports no vendor model SDK', () => {
    for (const { path, text } of sources) {
      expect(forbiddenSdkImport.test(text), `${path} must not import a vendor SDK`).toBe(false);
    }
  });
});
