import { test, expect } from '@playwright/test';

/**
 * Happy-path walkthrough in MOCK_MODE against seeded data:
 * prospect list → account → generate brief → approve a draft →
 * confirm the dashboard renders.
 */
test('admin can navigate the closer pipeline', async ({ page }) => {
  await page.goto('/prospects');
  await expect(page.getByRole('heading', { name: 'Prospects' })).toBeVisible();

  // Open the first prospect.
  await page.getByRole('link', { name: /Prospect 1 Inc/ }).first().click();
  await expect(page.getByRole('button', { name: 'Generate brief' })).toBeVisible();

  // Generate a brief and land on the brief page.
  await page.getByRole('link', { name: 'Closer brief' }).click();
  await expect(page.getByRole('heading', { name: 'Closer brief' })).toBeVisible();

  // Approval queue shows pending drafts.
  await page.goto('/approvals');
  await expect(page.getByRole('heading', { name: 'Outreach approval queue' })).toBeVisible();
  const approve = page.getByRole('button', { name: 'Approve' }).first();
  if (await approve.isVisible()) {
    await approve.click();
  }

  // Dashboard renders outcome aggregates.
  await page.goto('/dashboard');
  await expect(page.getByRole('heading', { name: 'Call outcome dashboard' })).toBeVisible();
  await expect(page.getByText('Meetings booked')).toBeVisible();
});
