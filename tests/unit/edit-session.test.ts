import { it, expect } from 'vitest';
import { createTextItem } from '../../src/model/document';
import { beginDraft, patchDraft, draftCommand } from '../../src/editor/session';

it('keeps previews detached from the model, then commits one command carrying the operation group', () => {
  const item = createTextItem({ id: 'a', text: '원본' });
  const draft = beginDraft(item, 'text', () => 'edit-group');
  patchDraft(draft, { text: '초안' });
  patchDraft(draft, { text: '최종\n\n내용' });
  expect(item.text).toBe('원본');
  expect(draft.before.text).toBe('원본');
  expect(draftCommand(draft)).toMatchObject({
    type: 'update-item',
    id: 'a',
    groupId: 'edit-group',
    patch: { text: '최종\n\n내용' },
  });
});
it('a discarded or unchanged draft cannot mutate the document', () => {
  const item = createTextItem();
  const draft = beginDraft(item, 'move');
  expect(draftCommand(draft)).toBeNull();
  patchDraft(draft, { xMm: 100 });
  expect(item.xMm).toBe(5);
});
it('allocates one fresh group for each drag, resize and edit, retaining it across preview updates', () => {
  const item = createTextItem();
  const groups = new Set<string>();
  for (const kind of ['move', 'resize', 'text', 'properties'] as const) {
    const draft = beginDraft(item, kind);
    const group = draft.groupId;
    patchDraft(draft, { widthMm: 120 });
    patchDraft(draft, { widthMm: 130 });
    expect(draftCommand(draft)?.groupId).toBe(group);
    groups.add(group);
  }
  expect(groups.size).toBe(4);
});
