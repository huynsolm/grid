import { it, expect } from 'vitest';
import { createDocument, createTextItem } from '../../src/model/document';
import { createDocumentStore } from '../../src/state/document-store';

it('page changes preserve text coordinates and formatting even when items go outside the new page', () => {
  const doc = createDocument(); doc.items = [createTextItem({ xMm: 190, yMm: 270, widthMm: 50 })];
  const store = createDocumentStore(doc);
  store.dispatch({ type: 'set-page', patch: { orientation: 'landscape', marginMm: 20 } });
  expect(store.getSnapshot().items).toEqual(doc.items);
});

it('provides one immutable command path for upcoming add/update/delete text edits', () => {
  const store = createDocumentStore(); const item = createTextItem({ id: 'text-1' });
  store.dispatch({ type: 'add-item', item, groupId: 'add' });
  const event = store.dispatch({ type: 'update-item', id: item.id, patch: { text: '한글', widthMm: 100, xMm: 20 }, groupId: 'edit-1' });
  expect(event.before?.items[0].text).toBe('');
  expect(event.after.items[0]).toMatchObject({ text: '한글', widthMm: 100, xMm: 20 });
  expect(event.recordInHistory).toBe(true);
  expect(() => store.dispatch({ type: 'update-item', id: 'missing', patch: { text: 'x' } })).toThrow();
  store.dispatch({ type: 'delete-item', id: item.id });
  expect(store.getSnapshot().items).toEqual([]);
});
