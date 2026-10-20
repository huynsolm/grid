import type { DeepReadonly, GridDocument, GridSettings, PageSettings, TextItem } from '../model/document';

type Group = { groupId?: string };
export type DocumentCommand = Group & (
  | { type: 'initialize' | 'restore'; document: unknown }
  | { type: 'set-page'; patch: Partial<PageSettings> }
  | { type: 'set-grid'; patch: Partial<GridSettings> }
  | { type: 'set-snap'; enabled: boolean }
  | { type: 'add-item'; item: TextItem }
  | { type: 'update-item'; id: string; patch: Partial<Omit<TextItem, 'id'>> }
  | { type: 'delete-item'; id: string }
);

/** Pure command application. The store validates the complete result before committing it. */
export function applyCommand(before: DeepReadonly<GridDocument> | null, command: DocumentCommand): unknown {
  if (command.type === 'initialize' || command.type === 'restore') return command.document;
  if (!before) throw new Error('문서 초기화가 필요합니다.');
  switch (command.type) {
    case 'set-page': return { ...before, page: { ...before.page, ...command.patch } };
    case 'set-grid': return { ...before, grid: { ...before.grid, ...command.patch } };
    case 'set-snap': return { ...before, snapToGrid: command.enabled };
    case 'add-item': return { ...before, items: [...before.items, command.item] };
    case 'update-item': {
      if (!before.items.some(item => item.id === command.id)) throw new Error('글상자를 찾을 수 없습니다.');
      return { ...before, items: before.items.map(item => item.id === command.id ? { ...item, ...command.patch, id: item.id } : item) };
    }
    case 'delete-item': {
      if (!before.items.some(item => item.id === command.id)) throw new Error('글상자를 찾을 수 없습니다.');
      return { ...before, items: before.items.filter(item => item.id !== command.id) };
    }
    default: throw new Error('지원하지 않는 문서 명령입니다.');
  }
}
