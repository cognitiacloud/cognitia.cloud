import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { describe, expect, it } from 'vitest';

import {
  ProviderDisabledError,
  selectProviders,
  type LocalBrainProviderDescriptor,
} from './localProviderContract.js';
import { ollamaLocalProvider } from './ollamaProvider.disabled.js';
import { openAiCompatibleLocalProvider } from './openAiCompatibleLocal.disabled.js';

const here = dirname(fileURLToPath(import.meta.url));

const PROVIDERS: LocalBrainProviderDescriptor[] = [
  ollamaLocalProvider,
  openAiCompatibleLocalProvider,
];

describe('local Brain providers (DISABLED in V1)', () => {
  it('every local provider is disabled and never ready', () => {
    for (const p of PROVIDERS) {
      expect(p.enabled).toBe(false);
      expect(p.local).toBe(true);
      // Even with all config env vars present, a disabled provider is not ready.
      const env: NodeJS.ProcessEnv = {};
      for (const name of p.configEnvVars) env[name] = `value-for-${name}`;
      const status = p.readiness(env);
      expect(status.enabled).toBe(false);
      expect(status.configured).toBe(true);
      expect(status.ready).toBe(false);
      expect(status.missing).toEqual([]);
    }
  });

  it('generate() always throws ProviderDisabledError — providers cannot execute', async () => {
    for (const p of PROVIDERS) {
      await expect(p.generate({ prompt: 'hello' })).rejects.toBeInstanceOf(ProviderDisabledError);
      await expect(p.generate({ prompt: 'hello' })).rejects.toMatchObject({
        code: 'PROVIDER_DISABLED',
        providerId: p.id,
      });
    }
  });

  it('readiness reports config status only and never leaks env var values', () => {
    const secret = 'http://secret-host.local:11434/THIS_SHOULD_NEVER_LEAK';
    const env: NodeJS.ProcessEnv = { OLLAMA_BASE_URL: secret };
    const status = ollamaLocalProvider.readiness(env);
    // OLLAMA_MODEL is absent → reported by NAME only.
    expect(status.missing).toContain('OLLAMA_MODEL');
    expect(status.configured).toBe(false);
    // The serialized status must contain only booleans + env var NAMES, no value.
    const serialized = JSON.stringify(status);
    expect(serialized).not.toContain(secret);
    expect(serialized).not.toContain('secret-host');
  });

  it('readiness reports missing env var NAMES when config is absent', () => {
    const status = openAiCompatibleLocalProvider.readiness({});
    expect(status.configured).toBe(false);
    expect(status.ready).toBe(false);
    expect([...status.missing].sort()).toEqual(['LOCAL_OPENAI_BASE_URL', 'LOCAL_OPENAI_MODEL']);
  });

  describe('localOnly selection policy', () => {
    it('selects local providers only (future-ready), but execution is still blocked', async () => {
      const chosen = selectProviders('localOnly', PROVIDERS);
      expect(chosen.map((p) => p.id).sort()).toEqual(
        ['ollama-local', 'openai-compatible-local'].sort(),
      );
      expect(chosen.every((p) => p.local === true)).toBe(true);
      // Selecting a local provider does not let it run in V1.
      for (const p of chosen) {
        await expect(p.generate({ prompt: 'x' })).rejects.toBeInstanceOf(ProviderDisabledError);
      }
    });

    it('default policy keeps local providers available but still blocks execution', async () => {
      const chosen = selectProviders('default', PROVIDERS);
      expect(chosen).toHaveLength(PROVIDERS.length);
      await expect(chosen[0]!.generate({ prompt: 'x' })).rejects.toBeInstanceOf(
        ProviderDisabledError,
      );
    });
  });

  describe('source scan: no network / vendor-SDK reachability', () => {
    // Banned module specifiers, assembled at runtime so this test's own prose
    // never trips the scan. We match these as IMPORT SOURCES, not bare words,
    // so the providers' safety comments cannot cause a false positive.
    const bannedImports = [
      ['node:', 'http'].join(''),
      'http',
      ['node:', 'https'].join(''),
      'https',
      ['node:', 'net'].join(''),
      'net',
      ['node:', 'tls'].join(''),
      ['node:', 'dgram'].join(''),
      ['ax', 'ios'].join(''),
      ['node-', 'fetch'].join(''),
      'undici',
      'ws',
      ['open', 'ai'].join(''),
      ['oll', 'ama'].join(''),
      ['@anthropic-ai/', 'sdk'].join(''),
    ];

    const sourceFiles = [
      'localProviderContract.ts',
      'ollamaProvider.disabled.ts',
      'openAiCompatibleLocal.disabled.ts',
    ];

    // Extract module specifiers from static imports, dynamic import(), require().
    function importSpecifiers(src: string): string[] {
      const specs: string[] = [];
      const patterns = [
        /\bfrom\s*['"]([^'"]+)['"]/g,
        /\bimport\s*\(\s*['"]([^'"]+)['"]\s*\)/g,
        /\brequire\s*\(\s*['"]([^'"]+)['"]\s*\)/g,
      ];
      for (const re of patterns) {
        let m: RegExpExecArray | null;
        while ((m = re.exec(src)) !== null) specs.push(m[1]!);
      }
      return specs;
    }

    for (const file of sourceFiles) {
      it(`${file} imports no network or vendor-SDK module`, () => {
        const src = readFileSync(join(here, file), 'utf8');
        const specs = importSpecifiers(src);
        const offenders = specs.filter((s) => bannedImports.includes(s));
        expect(offenders).toEqual([]);
      });

      it(`${file} contains no direct network call syntax`, () => {
        const src = readFileSync(join(here, file), 'utf8');
        // The global network call, XHR, and WebSocket constructors. Assembled so
        // this file's literals never appear verbatim in the scanned sources.
        const networkCall = ['fetch', '('].join('');
        expect(src.includes(networkCall)).toBe(false);
        expect(src.includes('XMLHttpRequest')).toBe(false);
        expect(src.includes('new WebSocket')).toBe(false);
      });
    }
  });
});
