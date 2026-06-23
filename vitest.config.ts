import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';

const r = (p: string) => fileURLToPath(new URL(p, import.meta.url));

export default defineConfig({
  // Use the automatic JSX runtime so React server components (e.g. the GTM
  // Command Center page) can be rendered in smoke tests without importing React.
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
      'apps/**/*.test.tsx',
      'scripts/**/*.test.ts',
    ],
    exclude: ['**/node_modules/**', '**/dist/**', 'hermes/**'],
  },
});
