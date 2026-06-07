import { test, expect } from '@playwright/test';

test.describe('mobile viewport smoke', () => {
  test('home loads without horizontal overflow', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('body')).toBeVisible();
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 2);
    expect(overflow).toBe(false);
  });

  test('pricing loads', async ({ page }) => {
    await page.goto('/pricing');
    await expect(page.getByRole('heading', { name: /выберите свой план/i })).toBeVisible();
  });

  test('ide lite loads and mobile dock visible', async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem('nexus_ide_lite_tour_done', '1');
    });
    await page.goto('/ide/lite');
    await expect(page.locator('.ide-mobile-dock')).toBeVisible();
    await page.locator('.ide-mobile-dock').getByRole('button', { name: 'Agent' }).click();
    await expect(page.locator('.ide-side-panel')).toBeVisible();
  });
});
