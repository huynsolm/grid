import { test, expect } from '@playwright/test';

test('document settings update real grid geometry through the command boundary', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('.paper')).toHaveAttribute('data-validation', 'false');
  await expect(page.locator('[data-calibration]')).toHaveCount(0);
  await expect(page.locator('.paper-text')).toHaveCount(0);
  await page.getByLabel('모눈 간격').selectOption('10');
  await page.getByLabel('강조선').selectOption('5');
  const lines = page.locator('[data-grid-line]');
  const first = await lines.first().getAttribute('x1');
  expect(first).toBe('5');
  await expect(page.locator('[data-major="true"]').first()).toHaveAttribute('stroke-width', '0.2');
  await expect(page.locator('#grid-notice')).toContainText('7 mm');
  await page.getByLabel('안전 여백').fill('21');
  await page.getByLabel('안전 여백').blur();
  await expect(page.locator('.paper')).toHaveAttribute('data-margin', '5');
  await expect(page.locator('#settings-error')).not.toBeEmpty();
  await page.getByLabel('안전 여백').fill('7');
  await page.getByLabel('안전 여백').blur();
  await expect(page.locator('.paper')).toHaveAttribute('data-margin', '7');
  await page.getByLabel('용지 방향').selectOption('landscape');
  await expect(page.locator('.paper')).toHaveAttribute('data-orientation', 'landscape');
  await page.getByLabel('격자 스냅').uncheck();
  await page.getByLabel('선 색').fill('#3488aa');
  await page.getByLabel('선 색').dispatchEvent('change');
  await expect(page.locator('[data-grid-group]')).toHaveAttribute('stroke', '#3488aa');
});

test('print keeps the configured SVG grid and excludes settings and guidance', async ({ page }) => {
  await page.goto('/');
  await page.getByLabel('모눈 간격').selectOption('2');
  for (let i = 0; i < 3; i++) await page.getByLabel('선 불투명도').press('PageUp');
  for (let i = 0; i < 5; i++) await page.getByLabel('선 굵기').press('ArrowRight');
  const count = await page.locator('[data-grid-line]').count();
  await page.emulateMedia({ media: 'print' });
  expect(await page.locator('[data-grid-line]').count()).toBe(count);
  await expect(page.locator('.controls')).toBeHidden();
  await expect(page.locator('#grid-notice')).toBeHidden();
  await expect(page.locator('[data-grid-group]')).toHaveAttribute('stroke-opacity', '0.65');
  await expect(page.locator('[data-grid-line]').first()).toHaveAttribute('stroke-width', '0.15');
});
