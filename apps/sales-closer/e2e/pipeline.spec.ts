import { test, expect } from '@playwright/test';

/**
 * Happy-path walkthrough in MOCK_MODE against seeded data:
 * prospect list → account → generate brief → approve a draft →
 * confirm the dashboard renders.
 */
test('admin can navigate the closer pipeline', async ({ page }) => {
  await page.goto('/prospects');
  await expect(page.getByRole('heading', { name: 'Prospect dashboard' })).toBeVisible();

  // Open the top-scored prospect.
  await page.getByRole('link', { name: /Sunrise Toyota/ }).first().click();
  await expect(page.getByRole('button', { name: 'Generate brief' })).toBeVisible();

  // Open the closer brief page (the eyebrow labels it; the heading is the account name).
  await page.getByRole('link', { name: 'Closer brief' }).click();
  await expect(page.getByText('Closer brief')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Sunrise Toyota' })).toBeVisible();

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
