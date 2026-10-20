import { test, expect } from '@playwright/test';

test('initial fixture has fixed A4 size and preserves Korean newlines', async ({ page }) => {
  await page.goto('/');
  const paper = page.locator('.paper');
  await expect(paper).toHaveAttribute('data-orientation', 'portrait');
  const size = await paper.evaluate(el => ({ w: getComputedStyle(el).width, h: getComputedStyle(el).height }));
  expect(parseFloat(size.w)).toBeCloseTo(210 * 96 / 25.4, 1);
  expect(parseFloat(size.h)).toBeCloseTo(297 * 96 / 25.4, 1);
  await expect(page.locator('[data-fixture="mixed"]')).toContainText('한글과 English');
  expect(await page.locator('[data-fixture="mixed"]').textContent()).toContain('\n\n');
});

test('print uses same paper and hides controls, warnings, and zoom transform', async ({ page }) => {
  await page.goto('/');
  await page.locator('.paper').evaluate(el => el.setAttribute('data-identity', 'original'));
  await page.getByLabel('화면 확대').selectOption('0.5');
  await page.emulateMedia({ media: 'print' });
  await expect(page.locator('.paper')).toHaveAttribute('data-identity', 'original');
  await expect(page.locator('.controls')).toBeHidden();
  for (const notice of await page.locator('.screen-notice').all()) await expect(notice).toBeHidden();
  expect(await page.locator('.paper-scale').evaluate(el => getComputedStyle(el).transform)).toBe('none');
  expect(await page.locator('.print-page').evaluate(el => getComputedStyle(el).overflow)).toBe('hidden');
  await expect(page.locator('[data-fixture="mixed"]')).toBeVisible();
});

test('orientation, margin and grid-only mode do not discard fixture text', async ({ page }) => {
  await page.goto('/');
  await page.getByLabel('용지 방향').selectOption('landscape');
  await page.getByLabel('안전 여백').selectOption('20');
  await page.getByLabel('출력 모드').selectOption('grid-only');
  await expect(page.locator('.paper')).toHaveAttribute('data-orientation', 'landscape');
  await expect(page.locator('.paper')).toHaveAttribute('data-margin', '20');
  await expect(page.locator('.text-layer')).toBeHidden();
  await expect(page.locator('#filename')).toContainText('landscape-margin20-system-grid-only-r1.pdf');
  await page.getByLabel('출력 모드').selectOption('with-text');
  await expect(page.locator('[data-fixture="mixed"]')).toContainText('한글과 English');
  expect(await page.locator('[data-calibration]').getAttribute('x2')).toBe('125');
});

test('print button waits for fonts and invokes native print without duplicating paper', async ({ page }) => {
  await page.goto('/');
  await page.evaluate(() => { window.print = () => { document.body.dataset.printCalled = 'yes'; }; });
  await page.getByRole('button', { name: '인쇄 / PDF로 저장' }).click();
  await expect(page.locator('body')).toHaveAttribute('data-print-called', 'yes');
  await expect(page.locator('.paper')).toHaveCount(1);
});

test('invalid font leaves a warning and native-print warning stays off paper', async ({ page }) => {
  await page.goto('/');
  await page.getByLabel('테스트 폰트 파일').setInputFiles({ name: 'broken.woff2', mimeType: 'font/woff2', buffer: Buffer.from('not-a-font') });
  await expect(page.getByRole('button', { name: '인쇄 / PDF로 저장' })).toBeDisabled();
  await expect(page.locator('#status')).toContainText('불러오지 못했습니다');
  await page.getByLabel('용지 방향').selectOption('landscape');
  await expect(page.getByRole('button', { name: '인쇄 / PDF로 저장' })).toBeDisabled();
  await page.emulateMedia({ media: 'print' });
  await expect(page.locator('#status')).toBeHidden();
  await expect(page.locator('.paper #status')).toHaveCount(0);
});

test('all margin and orientation fixtures retain fixed print dimensions', async ({ page }) => {
  await page.goto('/');
  for (const orientation of ['portrait', 'landscape']) {
    for (const margin of ['0', '5', '20']) {
      await page.getByLabel('용지 방향').selectOption(orientation);
      await page.getByLabel('안전 여백').selectOption(margin);
      await page.emulateMedia({ media: 'print' });
      const dims = await page.locator('.print-page').evaluate(el => ({ width: el.getBoundingClientRect().width, height: el.getBoundingClientRect().height }));
      expect(dims.width).toBeCloseTo((orientation === 'portrait' ? 210 : 297)*96/25.4, 1);
      expect(dims.height).toBeCloseTo((orientation === 'portrait' ? 297 : 210)*96/25.4, 1);
      await page.emulateMedia({ media: 'screen' });
    }
  }
});
