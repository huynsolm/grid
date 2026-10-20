import type { DeepReadonly, TextItem } from '../model/document';
import type { DocumentCommand } from '../history/commands';

export type DraftKind = 'text' | 'properties' | 'move' | 'resize';
export type EditDraft = { before: TextItem; item: TextItem; kind: DraftKind; groupId: string };
export function beginDraft(
  item: DeepReadonly<TextItem>,
  kind: DraftKind,
  group = () => crypto.randomUUID(),
): EditDraft {
  return { before: structuredClone(item), item: structuredClone(item), kind, groupId: group() };
}
export function patchDraft(draft: EditDraft, patch: Partial<Omit<TextItem, 'id'>>) {
  Object.assign(draft.item, patch);
}
export function draftCommand(draft: EditDraft): DocumentCommand | null {
  if (JSON.stringify(draft.before) === JSON.stringify(draft.item)) return null;
  const { id, ...patch } = draft.item;
  return { type: 'update-item', id, patch, groupId: draft.groupId };
}
