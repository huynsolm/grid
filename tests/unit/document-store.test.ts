import { describe, it, expect, vi } from 'vitest';
import { createDocument, createTextItem } from '../../src/model/document';
import { createDocumentStore } from '../../src/state/document-store';

describe('document state store', () => {
  it('protects state from snapshot and caller mutation', () => {
    const source = createDocument(); source.items = [createTextItem()];
    const store = createDocumentStore(source);
    source.page.marginMm = 20;
    expect(store.getSnapshot().page.marginMm).toBe(5);
    expect(() => { (store.getSnapshot().items as any).push(createTextItem()); }).toThrow();
    expect(() => { (store.getSnapshot().page as any).marginMm = 1; }).toThrow();
  });

  it('notifies exactly once per valid command, never for invalid commands', () => {
    const store = createDocumentStore(); const listener = vi.fn(); store.subscribe(listener);
    const before = store.getSnapshot();
    store.dispatch({ type: 'set-grid', patch: { spacingMm: 10 }, groupId: 'grid-control' });
    expect(listener).toHaveBeenCalledTimes(1);
    const event = listener.mock.calls[0][0];
    expect(event.before).toBe(before);
    expect(event.after.grid.spacingMm).toBe(10);
    expect(event.groupId).toBe('grid-control');
    expect(event.kind).toBe('edit');
    const current = store.getSnapshot();
    expect(() => store.dispatch({ type: 'set-page', patch: { marginMm: 21 } })).toThrow();
    expect(store.getSnapshot()).toBe(current);
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it('keeps initialization and restoration separate from editing history', () => {
    const store = createDocumentStore(); const listener = vi.fn();
    const unsubscribe = store.subscribe(listener);
    store.dispatch({ type: 'restore', document: createDocument({ id: 'restored' }) });
    expect(listener.mock.calls[0][0]).toMatchObject({ kind: 'restore', recordInHistory: false });
    store.dispatch({ type: 'initialize', document: createDocument() });
    expect(listener.mock.calls[1][0]).toMatchObject({ kind: 'initialize', recordInHistory: false });
    unsubscribe(); store.dispatch({ type: 'set-snap', enabled: false });
    expect(listener).toHaveBeenCalledTimes(2);
  });

  it('a faulty observer cannot prevent other observers from seeing a committed change', () => {
    const onError = vi.fn(); const store = createDocumentStore(undefined, { onSubscriberError: onError });
    store.subscribe(() => { throw new Error('observer'); });
    const listener = vi.fn(); store.subscribe(listener);
    store.dispatch({ type: 'set-snap', enabled: false });
    expect(store.getSnapshot().snapToGrid).toBe(false);
    expect(listener).toHaveBeenCalledTimes(1); expect(onError).toHaveBeenCalledTimes(1);
  });
});
