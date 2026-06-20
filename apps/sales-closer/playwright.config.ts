import { defineConfig, devices } from '@playwright/test';

/**
 * E2E config. Runs against the app in MOCK_MODE. Requires a seeded database
 * and browsers installed (`npx playwright install chromium`):
 *
 *   DATABASE_URL=postgres://... pnpm --filter @cognitia/sales-closer db... # via root
 *   pnpm --filter @cognitia/sales-closer e2e
 */
export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: 0,
  reporter: 'list',
  use: {
    baseURL: process.env.E2E_BASE_URL ?? 'http://localhost:3001',
    trace: 'on-first-retry',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: process.env.E2E_BASE_URL
    ? undefined
    : {
        command: 'pnpm start',
        url: 'http://localhost:3001/prospects',
        reuseExistingServer: !process.env.CI,
        env: { MOCK_MODE: 'true', VENDOR_NAME: 'mock', LLM_PROVIDER: 'mock' },
        timeout: 60_000,
      },
});
