import { createDocument, systemFontCatalog, type DeepReadonly, type FontCatalog, type GridDocument } from '../model/document';
import { validateDocument } from '../model/validate';
import { applyCommand, type DocumentCommand } from '../history/commands';

export type DocumentChange = {
  readonly before: DeepReadonly<GridDocument> | null;
  readonly after: DeepReadonly<GridDocument>;
  readonly command: DeepReadonly<DocumentCommand>;
  readonly kind: 'initialize' | 'restore' | 'edit';
  readonly groupId: string;
  readonly recordInHistory: boolean;
};
type StoreOptions = { fontCatalog?: () => FontCatalog; onSubscriberError?: (error: unknown) => void };
function freeze<T>(value: T): DeepReadonly<T> {
  if (value !== null && typeof value === 'object') {
    for (const child of Object.values(value)) freeze(child);
    Object.freeze(value);
  }
  return value as DeepReadonly<T>;
}

export function createDocumentStore(initial: unknown = createDocument(), options: StoreOptions = {}) {
  const catalog = options.fontCatalog ?? systemFontCatalog;
  let current = freeze(validateDocument(applyCommand(null, { type: 'initialize', document: initial }), catalog()));
  const listeners = new Set<(change: DocumentChange) => void>();
  let dispatching = false;
  return {
    getSnapshot: () => current,
    subscribe(listener: (change: DocumentChange) => void) { listeners.add(listener); return () => { listeners.delete(listener); }; },
    dispatch(command: DocumentCommand): DocumentChange {
      if (dispatching) throw new Error('명령 처리 중 중첩 변경은 허용하지 않습니다.');
      const after = freeze(validateDocument(applyCommand(current, command), catalog()));
      const kind = command.type === 'initialize' || command.type === 'restore' ? command.type : 'edit';
      const event: DocumentChange = freeze({ before: current, after, command: structuredClone(command), kind,
        groupId: command.groupId ?? crypto.randomUUID(), recordInHistory: kind === 'edit' });
      current = after;
      dispatching = true;
      try {
        for (const listener of [...listeners]) {
          try { listener(event); } catch (error) { (options.onSubscriberError ?? console.error)(error); }
        }
      } finally { dispatching = false; }
      return event;
    },
  };
}
export type DocumentStore = ReturnType<typeof createDocumentStore>;
