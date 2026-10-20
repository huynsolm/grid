import { test, expect, type Page } from '@playwright/test';

async function model(page: Page) {
  return page.evaluate(async () =>
    structuredClone((await import('/src/state/app-document.ts')).store.getSnapshot()),
  );
}
async function changes(page: Page) {
  return page.evaluate(() => (window as any).__changes);
}
async function observe(page: Page) {
  await page.evaluate(async () => {
    (window as any).__changes = [];
    (await import('/src/state/app-document.ts')).store.subscribe((e) =>
      (window as any).__changes.push(structuredClone(e)),
    );
  });
}
async function add(page: Page, text = '한글과 English\n\n빈 줄 다음') {
  await page.getByRole('button', { name: '글상자 추가', exact: true }).click();
  await page.getByLabel('내용', { exact: true }).fill(text);
  await page.getByLabel('내용', { exact: true }).press('Control+Enter');
}

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await observe(page);
});

test('add, text draft, commit, duplicate and delete all pass through document commands', async ({ page }) => {
  await page.getByRole('button', { name: '글상자 추가', exact: true }).click();
  await page.getByLabel('내용', { exact: true }).fill('입력 중\n\n두 번째 문단');
  expect((await model(page)).items[0].text).toBe('');
  expect((await changes(page)).length).toBe(1);
  await page.getByLabel('내용', { exact: true }).press('Control+Enter');
  const events = await changes(page);
  expect(events).toHaveLength(2);
  expect(events[1].before.items[0].text).toBe('');
  expect(events[1].after.items[0].text).toContain('\n\n');
  expect(events[1].groupId).toBeTruthy();
  await page.getByRole('button', { name: '선택 글상자 복제' }).click();
  expect((await model(page)).items).toHaveLength(2);
  await page.getByRole('button', { name: '선택 글상자 삭제' }).click();
  expect((await model(page)).items).toHaveLength(1);
  expect((await changes(page)).map((e: any) => e.command.type)).toEqual([
    'add-item',
    'update-item',
    'add-item',
    'delete-item',
  ]);
});

test('double click or selected Enter edits, Escape cancels without a command, Ctrl+Enter commits', async ({
  page,
}) => {
  await add(page, '원래 내용');
  const box = page.locator('.paper [data-item-id]').first();
  await box.dblclick();
  const textarea = page.getByLabel('글상자 직접 편집');
  await expect(textarea).toBeFocused();
  await textarea.fill('취소할 내용');
  await expect(box).toHaveText('취소할 내용');
  const count = (await changes(page)).length;
  await textarea.press('Escape');
  expect((await model(page)).items[0].text).toBe('원래 내용');
  expect((await changes(page)).length).toBe(count);
  await box.click();
  await page.keyboard.press('Enter');
  await textarea.fill('확정\n\n다음 줄');
  await textarea.press('Control+Enter');
  await expect(textarea).toBeHidden();
  expect((await model(page)).items[0].text).toBe('확정\n\n다음 줄');
});

test('numeric properties bypass snapping, preview until commit and preserve bounds validation', async ({
  page,
}) => {
  await add(page);
  const x = page.getByLabel('가로 위치 (mm)', { exact: true });
  await x.fill('13');
  expect((await model(page)).items[0].xMm).toBe(5);
  await x.blur();
  expect((await model(page)).items[0].xMm).toBe(13);
  await x.fill('17');
  await x.press('Escape');
  expect((await model(page)).items[0].xMm).toBe(13);
  const width = page.getByLabel('폭 (mm)', { exact: true });
  await width.fill('33');
  await width.blur();
  expect((await model(page)).items[0].widthMm).toBe(33);
  await width.fill('9');
  await width.blur();
  expect((await model(page)).items[0].widthMm).toBe(33);
  await page.getByLabel('글자 굵기').selectOption('700');
  expect((await model(page)).items[0].fontWeight).toBe(700);
  await page.getByLabel('글자 색 (HEX)', { exact: true }).fill('#803355');
  await page.getByLabel('글자 색 (HEX)', { exact: true }).blur();
  await page.getByLabel('정렬').selectOption('right');
  await page.getByLabel('줄 간격', { exact: true }).fill('2.4');
  await page.getByLabel('줄 간격', { exact: true }).blur();
  expect((await model(page)).items[0]).toMatchObject({ color: '#803355', align: 'right', lineHeight: 2.4 });
});

test('IME guard blocks app commits, deletion and drag until composition ends', async ({ page }) => {
  await add(page, '원본');
  await page.locator('.paper [data-item-id]').first().dblclick();
  const textarea = page.getByLabel('글상자 직접 편집');
  await textarea.dispatchEvent('compositionstart');
  await textarea.fill('조합 중');
  await textarea.dispatchEvent('keydown', {
    key: 'Enter',
    ctrlKey: true,
    bubbles: true,
    cancelable: true,
    isComposing: true,
  });
  await page.getByRole('button', { name: '선택 글상자 삭제' }).dispatchEvent('click');
  await page
    .locator('.paper')
    .dispatchEvent('pointerdown', { pointerId: 77, button: 0, clientX: 400, clientY: 400 });
  expect((await model(page)).items[0].text).toBe('원본');
  expect((await model(page)).items).toHaveLength(1);
  await textarea.dispatchEvent('compositionend');
  await textarea.press('Control+Enter');
  expect((await model(page)).items[0].text).toBe('조합 중');
});

test('long mixed text, blank lines and HTML paste stay plain and display/editor styles match', async ({
  page,
}) => {
  await add(page);
  await page.locator('.paper [data-item-id]').first().dblclick();
  const input = page.getByLabel('글상자 직접 편집');
  await input.fill('긴한글과LongEnglishWordWithoutSpaces가섞인문장\n\n');
  await input.evaluate((el) => {
    const t = el as HTMLTextAreaElement;
    t.setSelectionRange(t.value.length, t.value.length);
    const data = new DataTransfer();
    data.setData('text/plain', '<img src=x onerror="window.__xss=1">');
    data.setData('text/html', '<img src=x onerror="window.__xss=1">');
    t.dispatchEvent(new ClipboardEvent('paste', { clipboardData: data, bubbles: true, cancelable: true }));
  });
  await expect(page.locator('.paper [data-item-id]').first()).toContainText('<img');
  expect(await page.locator('.paper img').count()).toBe(0);
  expect(await page.evaluate(() => (window as any).__xss)).toBeUndefined();
  const equal = await input.evaluate((el) => {
    const div = document.querySelector('.paper [data-item-id]')!;
    return [
      'width',
      'fontFamily',
      'fontWeight',
      'fontSize',
      'textAlign',
      'lineHeight',
      'padding',
      'borderWidth',
      'boxSizing',
      'whiteSpace',
      'overflowWrap',
      'letterSpacing',
    ].every((key) => getComputedStyle(el)[key as any] === getComputedStyle(div)[key as any]);
  });
  expect(equal).toBe(true);
  await input.press('Enter');
  await input.press('Meta+Enter');
  expect((await model(page)).items[0].text).toContain('\n\n');
  expect((await model(page)).items[0].text.endsWith('\n')).toBe(true);
});

test('input shortcuts retain browser behavior; outside input only classify undo/redo and Delete', async ({
  page,
}) => {
  await add(page);
  await page.evaluate(() =>
    window.addEventListener('keydown', (e) => {
      (window as any).__prevented = e.defaultPrevented;
    }),
  );
  await page.getByLabel('내용', { exact: true }).focus();
  await page.keyboard.press('Control+z');
  expect(await page.evaluate(() => (window as any).__prevented)).toBe(false);
  await page.getByLabel('내용', { exact: true }).press('Escape');
  await page.locator('.paper [data-item-id]').first().click();
  await page.keyboard.press('Control+z');
  expect(await page.evaluate(() => (window as any).__prevented)).toBe(true);
  await expect(page.locator('#editor-state')).toHaveAttribute('data-shortcut', 'undo');
  await page.keyboard.press('Delete');
  expect((await model(page)).items).toHaveLength(0);
});

test('trailing blank lines occupy the same height in display and textarea, including native IME editing keys', async ({
  page,
}) => {
  await add(page, '첫 줄\n\n');
  await page.locator('.paper [data-item-id]').dblclick();
  const input = page.getByLabel('글상자 직접 편집');
  const metrics = await input.evaluate((el) => {
    const display = document.querySelector<HTMLElement>('.paper [data-item-id]')!;
    return {
      display: display.offsetHeight,
      textarea: (el as HTMLTextAreaElement).scrollHeight,
      line: parseFloat(getComputedStyle(display).lineHeight),
    };
  });
  expect(metrics.display).toBeCloseTo(metrics.line * 3, 0);
  expect(metrics.textarea).toBeCloseTo(metrics.display, 0);
  await input.dispatchEvent('compositionstart');
  const nativeAllowed = await input.evaluate((el) =>
    el.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Delete', isComposing: true, bubbles: true, cancelable: true }),
    ),
  );
  expect(nativeAllowed).toBe(true);
  await input.dispatchEvent('compositionend');
  await input.press('Escape');
});

test('overflow is a state independent of actual print-button wiring, and is remeasured after changes', async ({
  page,
}) => {
  await add(page, '한글\n'.repeat(25));
  const y = page.getByLabel('세로 위치 (mm)', { exact: true });
  await y.fill('250');
  await y.blur();
  await expect(page.locator('#editor-state')).toHaveAttribute('data-with-text-allowed', 'false');
  await expect(page.locator('#editor-warning')).not.toBeEmpty();
  await expect(page.getByRole('button', { name: '인쇄 / PDF로 저장' })).toBeEnabled();
  await page.getByLabel('출력 모드').selectOption('grid-only');
  await expect(page.locator('#editor-state')).toHaveAttribute('data-grid-only-allowed', 'true');
  await expect(page.locator('#editor-state')).toHaveAttribute('data-with-text-allowed', 'unknown');
  await y.fill('5');
  await y.blur();
  await page.getByLabel('출력 모드').selectOption('with-text');
  await expect(page.locator('#editor-state')).toHaveAttribute('data-with-text-allowed', 'true');
  await page.getByLabel('안전 여백').fill('20');
  await page.getByLabel('안전 여백').blur();
  expect((await model(page)).items[0].xMm).toBe(5);
  await expect(page.locator('#editor-state')).toHaveAttribute('data-with-text-allowed', 'false');
  await page.getByLabel('안전 여백').fill('5');
  await page.getByLabel('안전 여백').blur();
  await expect(page.locator('#editor-state')).toHaveAttribute('data-with-text-allowed', 'true');
  await page.getByLabel('글자 크기 (pt)', { exact: true }).fill('200');
  await page.getByLabel('글자 크기 (pt)', { exact: true }).blur();
  await expect(page.locator('#editor-state')).toHaveAttribute('data-with-text-allowed', 'false');
});

test('page changes preserve coordinates and print excludes overlays, handles and warnings', async ({
  page,
}) => {
  await add(page, '인쇄할 문장');
  await page.getByLabel('세로 위치 (mm)', { exact: true }).fill('270');
  await page.getByLabel('세로 위치 (mm)', { exact: true }).blur();
  await page.getByLabel('용지 방향').selectOption('landscape');
  expect((await model(page)).items[0].yMm).toBe(270);
  await expect(page.locator('#editor-state')).toHaveAttribute('data-with-text-allowed', 'false');
  await page.locator('.paper [data-item-id]').first().dblclick({ force: true });
  await page.emulateMedia({ media: 'print' });
  await expect(page.getByLabel('글상자 직접 편집')).toBeHidden();
  await expect(page.locator('.resize-handle')).toBeHidden();
  await expect(page.locator('#editor-warning')).toBeHidden();
  await expect(page.locator('.paper [data-item-id]').first()).toContainText('인쇄할 문장');
});
