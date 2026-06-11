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
    exclude: ['**/node_modules/**', '**/dist/**', 'hermes/**'],
  },
});
