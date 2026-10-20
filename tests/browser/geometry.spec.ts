import { test, expect } from '@playwright/test';

for (const zoom of [0.5, 1, 2]) {
  test(`drag/resize are one command and safe boundaries/measurement are stable at ${zoom * 100}%`, async ({
    page,
  }) => {
    await page.goto('/');
    await page.getByLabel('화면 확대').selectOption(String(zoom));
    await page.getByRole('button', { name: '글상자 추가', exact: true }).click();
    await page.getByLabel('내용', { exact: true }).fill('한글과 English\n\n같은 높이');
    await page.getByLabel('내용', { exact: true }).press('Control+Enter');
    await page.evaluate(async () => {
      (window as any).__events = [];
      (await import('/src/state/app-document.ts')).store.subscribe((e) =>
        (window as any).__events.push(structuredClone(e)),
      );
    });
    let rect = (await page.locator('.paper [data-item-id]').first().boundingBox())!;
    await page.mouse.move(rect.x + 3 * zoom, rect.y + 3 * zoom);
    await page.mouse.down();
    await page.mouse.move(
      rect.x + 3 * zoom + ((20 * 96) / 25.4) * zoom,
      rect.y + 3 * zoom + ((10 * 96) / 25.4) * zoom,
    );
    let data = await page.evaluate(
      async () => (await import('/src/state/app-document.ts')).store.getSnapshot().items[0],
    );
    expect(data.xMm).toBe(5);
    await page.mouse.up();
    data = await page.evaluate(
      async () => (await import('/src/state/app-document.ts')).store.getSnapshot().items[0],
    );
    expect(data.xMm).toBe(25);
    expect(data.yMm).toBe(15);
    const events = await page.evaluate(() => (window as any).__events);
    expect(events).toHaveLength(1);
    expect(events[0].groupId).toBeTruthy();
    const handle = page.getByRole('button', { name: '글상자 폭 조절' });
    await handle.scrollIntoViewIfNeeded();
    const h = (await handle.boundingBox())!;
    await page.mouse.move(h.x + h.width / 2, h.y + h.height / 2);
    await page.mouse.down();
    await page.mouse.move(h.x + h.width / 2 - ((17 * 96) / 25.4) * zoom, h.y + h.height / 2);
    await page.mouse.up();
    data = await page.evaluate(
      async () => (await import('/src/state/app-document.ts')).store.getSnapshot().items[0],
    );
    expect(data.widthMm).toBe(85);
    const after = await page.evaluate(() => (window as any).__events);
    expect(after).toHaveLength(2);
    expect(after[0].groupId).not.toBe(after[1].groupId);
    await page.locator('.paper [data-item-id]').first().scrollIntoViewIfNeeded();
    rect = (await page.locator('.paper [data-item-id]').first().boundingBox())!;
    const mmHeight = await page
      .locator('.paper [data-item-id]')
      .first()
      .evaluate((el) => ((el as HTMLElement).offsetHeight * 25.4) / 96);
    expect(mmHeight).toBeCloseTo(19.05, 0);
    await page.mouse.move(rect.x + 3 * zoom, rect.y + 3 * zoom);
    await page.mouse.down();
    await page.mouse.move(rect.x + 3 * zoom + 1000 * zoom, rect.y + 3 * zoom + 1500 * zoom);
    await page.mouse.up();
    await expect(page.locator('#editor-state')).toHaveAttribute('data-with-text-allowed', 'true');
    data = await page.evaluate(
      async () => (await import('/src/state/app-document.ts')).store.getSnapshot().items[0],
    );
    expect(data.xMm + data.widthMm).toBeLessThanOrEqual(205);
    expect(data.yMm + mmHeight).toBeLessThanOrEqual(292.1);
    expect(205 - data.xMm - data.widthMm).toBeLessThan(5.1);
    expect(292 - data.yMm - mmHeight).toBeLessThan(5.1);
  });
}

test('Alt pointer move bypasses snap and cancelled drag leaves the document untouched', async ({ page }) => {
  await page.goto('/');
  await page.getByLabel('화면 확대').selectOption('1');
  await page.getByRole('button', { name: '글상자 추가', exact: true }).click();
  const before = await page.evaluate(async () =>
    structuredClone((await import('/src/state/app-document.ts')).store.getSnapshot().items[0]),
  );
  let rect = (await page.locator('.paper [data-item-id]').boundingBox())!;
  await page.mouse.move(rect.x + 2, rect.y + 2);
  await page.mouse.down();
  await page.mouse.move(rect.x + 2 + (13 * 96) / 25.4, rect.y + 2);
  await page.keyboard.press('Escape');
  await page.mouse.up();
  expect(
    await page.evaluate(
      async () => (await import('/src/state/app-document.ts')).store.getSnapshot().items[0],
    ),
  ).toEqual(before);
  rect = (await page.locator('.paper [data-item-id]').boundingBox())!;
  await page.keyboard.down('Alt');
  await page.mouse.move(rect.x + 2, rect.y + 2);
  await page.mouse.down();
  await page.mouse.move(rect.x + 2 + (13 * 96) / 25.4, rect.y + 2);
  await page.mouse.up();
  await page.keyboard.up('Alt');
  const after = await page.evaluate(
    async () => (await import('/src/state/app-document.ts')).store.getSnapshot().items[0],
  );
  expect(after.xMm).toBeCloseTo(18, 1);
});
