import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';

const r = (p: string) => fileURLToPath(new URL(p, import.meta.url));

export default defineConfig({
  // The web app (and its tests) use the automatic JSX runtime; the page
  // components do not import React. Keep this here so .tsx tests transform.
  esbuild: { jsx: 'automatic' },
  resolve: {
    alias: {
      '@cognitia/core': r('./packages/core/src/index.ts'),
      '@cognitia/db': r('./packages/db/src/index.ts'),
      '@cognitia/agents': r('./packages/agents/src/index.ts'),
      '@cognitia/integrations': r('./packages/integrations/src/index.ts'),
    },
  },
  test: {
    globals: true,
    environment: 'node',
    include: [
      'packages/**/*.test.ts',
      'apps/**/*.test.ts',
      'packages/**/*.test.tsx',
      'apps/**/*.test.tsx',
    ],
    exclude: ['**/node_modules/**', '**/dist/**'],
    coverage: {
      provider: 'v8',
      reporter: ['text-summary', 'json-summary'],
      // Application + library source only. Tests, configs, barrels, type-only
      // and generated/scaffold surfaces are excluded so the floor measures
      // logic coverage, not boilerplate.
      include: ['packages/*/src/**/*.ts', 'apps/*/src/**/*.ts'],
      exclude: [
        '**/*.test.ts',
        '**/*.test.tsx',
        '**/*.contract.ts',
        '**/index.ts',
        '**/*.d.ts',
        'apps/web/**', // Next.js UI: covered by the a11y smoke, not unit coverage
        'apps/worker/src/index.ts', // process-entry scaffold
      ],
      // Floor set a few points below measured reality (stmts 91.9 / branch 84 /
      // funcs 93.7 / lines 91.9 at adoption) so it catches regressions without
      // being brittle. Ratchet upward over time; never down to pass a PR.
      thresholds: {
        statements: 88,
        branches: 80,
        functions: 90,
        lines: 88,
      },
    },
  },
});
