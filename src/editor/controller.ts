import { createTextItem, type DeepReadonly, type TextItem } from '../model/document';
import { validateDocument } from '../model/validate';
import type { DocumentStore } from '../state/document-store';
import { safeArea, screenToPage } from '../paper/geometry';
import { beginDraft, patchDraft, draftCommand, type EditDraft, type DraftKind } from './session';
import {
  shouldSnap,
  snapPosition,
  snapWidth,
  constrainPosition,
  constrainWidth,
  insideSafeArea,
} from './geometry';
import { measureTextHeight } from './measure';
import { applyTextStyle } from './text-style';
import { mountTextPanel, type TextPatch } from '../ui/text-panel';

type Options = {
  store: DocumentStore;
  paper: HTMLElement;
  overlay: HTMLElement;
  panel: HTMLElement;
  toolbar: HTMLElement;
  readiness: HTMLElement;
  warning: HTMLElement;
  zoom(): number;
  mode(): string;
  render(): void;
};
type PointerDraft = { id: number; x: number; y: number; normal: boolean; kind: 'move' | 'resize' };

export function createTextEditor(options: Options) {
  const { store, paper, overlay, toolbar, readiness, warning } = options;
  let selectedId = '',
    draft: EditDraft | null = null,
    pointer: PointerDraft | null = null;
  let textarea: HTMLTextAreaElement | null = null,
    composing = false,
    committing = false;
  let shortcut = '',
    measured = false;
  const panel = mountTextPanel(options.panel, {
    preview: (patch, kind) => preview(patch, kind),
    commit: () => finish(),
    cancel: () => cancel(),
    composing: (active) => setComposing(active),
    select: (id) => select(id),
  });
  toolbar.innerHTML =
    '<button type="button" id="add-text">글상자 추가</button><button type="button" id="duplicate-text" aria-label="선택 글상자 복제">복제</button><button type="button" id="delete-text" aria-label="선택 글상자 삭제">삭제</button><span class="hint">선택 후 Enter 또는 더블클릭으로 편집</span>';
  const frame = document.createElement('div');
  frame.className = 'selection-frame';
  frame.hidden = true;
  const handle = document.createElement('button');
  handle.className = 'resize-handle';
  handle.type = 'button';
  handle.setAttribute('aria-label', '글상자 폭 조절');
  frame.append(handle);
  overlay.append(frame);
  paper.tabIndex = 0;

  function items(): readonly DeepReadonly<TextItem>[] {
    return store.getSnapshot().items.map((item) => (draft?.item.id === item.id ? draft.item : item));
  }
  function selected() {
    return items().find((item) => item.id === selectedId);
  }
  function element(id: string) {
    return paper.querySelector<HTMLElement>(`[data-item-id="${CSS.escape(id)}"]`);
  }
  function zoom() {
    return matchMedia('print').matches ? 1 : options.zoom();
  }
  function setComposing(active: boolean) {
    composing = active;
    document.body.dataset.composing = String(active);
  }
  function height(
    item: DeepReadonly<TextItem>,
    available = safeArea(store.getSnapshot().page).bottom - item.yMm,
  ) {
    const el = element(item.id);
    return el ? measureTextHeight(el, zoom(), available, options.mode() === 'with-text') : null;
  }
  function checkOutput() {
    const area = safeArea(store.getSnapshot().page),
      visible = options.mode() === 'with-text';
    const overflow: string[] = [];
    measured = visible;
    if (visible)
      for (const item of items()) {
        const h = height(item);
        if (!h) measured = false;
        else if (!insideSafeArea(item, h.heightMm, area)) overflow.push(item.id);
      }
    readiness.dataset.withTextAllowed = measured ? String(overflow.length === 0) : 'unknown';
    readiness.dataset.gridOnlyAllowed = 'true';
    readiness.dataset.measured = String(measured);
    readiness.dataset.shortcut = shortcut;
    readiness.textContent = !visible
      ? '빈 모눈 출력 가능 · 글씨 포함 상태는 복귀 후 재측정'
      : overflow.length
        ? '글씨 포함 출력 불가 상태 · 빈 모눈 출력 가능'
        : measured
          ? '글씨 포함 출력 가능 상태 · 빈 모눈 출력 가능'
          : '글씨 높이 재측정 대기';
    warning.textContent = overflow.length
      ? `${overflow.length}개 글상자가 안전 영역을 벗어났습니다. 위치·폭·크기·내용을 조정해 주세요. 실제 출력 버튼 차단 연결은 후속 단계입니다.`
      : '';
    for (const item of items())
      element(item.id)?.setAttribute('data-overflow', String(overflow.includes(item.id)));
  }
  function paint(redraw = true, forcePanel = false) {
    if (redraw) options.render();
    const item = selected();
    panel.sync(items(), item, forcePanel);
    toolbar.querySelector<HTMLButtonElement>('#duplicate-text')!.disabled = !item;
    toolbar.querySelector<HTMLButtonElement>('#delete-text')!.disabled = !item;
    const h = item ? height(item) : null;
    frame.hidden = !item || !h || !!textarea;
    if (item && h)
      Object.assign(frame.style, {
        left: `${item.xMm}mm`,
        top: `${item.yMm}mm`,
        width: `${item.widthMm}mm`,
        height: `${h.heightMm}mm`,
      });
    if (textarea && item) {
      applyTextStyle(textarea, item);
      textarea.style.height = 'auto';
      textarea.style.height = `${Math.max(textarea.scrollHeight, element(item.id)?.offsetHeight ?? 0)}px`;
      textarea.hidden = options.mode() !== 'with-text';
    }
    checkOutput();
  }
  function dropTextarea() {
    const active = textarea;
    textarea = null;
    active?.remove();
  }
  function finish() {
    if (composing || pointer) return false;
    const command = draft ? draftCommand(draft) : null;
    draft = null;
    dropTextarea();
    if (command) {
      committing = true;
      try {
        store.dispatch(command);
      } catch (error) {
        panel.error(error instanceof Error ? error.message : '편집을 확정하지 못했습니다.');
      } finally {
        committing = false;
      }
    }
    paint(!!command, true);
    return true;
  }
  function cancel() {
    if (composing) return;
    const changed = !!draft && !!draftCommand(draft);
    draft = null;
    pointer = null;
    dropTextarea();
    panel.error('');
    paint(changed, true);
  }
  function select(id: string) {
    if (composing) return;
    finish();
    selectedId = id;
    paint(false, true);
  }
  function preview(patch: TextPatch, kind: DraftKind) {
    const item = selected();
    if (!item) return;
    if (!draft) draft = beginDraft(item, kind);
    const candidate = { ...draft.item, ...patch };
    try {
      const d = store.getSnapshot();
      validateDocument({ ...d, items: d.items.map((i) => (i.id === candidate.id ? candidate : i)) });
      patchDraft(draft, patch);
      panel.error('');
      paint();
    } catch (error) {
      panel.error(error instanceof Error ? error.message : '속성을 확인해 주세요.');
    }
  }
  function beginText() {
    if (composing || options.mode() !== 'with-text') return;
    finish();
    const item = selected();
    if (!item) return;
    draft = beginDraft(item, 'text');
    textarea = document.createElement('textarea');
    textarea.className = 'paper-text editor-textarea';
    textarea.setAttribute('aria-label', '글상자 직접 편집');
    textarea.spellcheck = false;
    textarea.value = item.text;
    textarea.addEventListener('input', () => preview({ text: textarea!.value }, 'text'));
    textarea.addEventListener('compositionstart', () => setComposing(true));
    textarea.addEventListener('compositionend', () => {
      setComposing(false);
      if (textarea) preview({ text: textarea.value }, 'text');
    });
    textarea.addEventListener('blur', () => {
      if (!composing) finish();
    });
    textarea.addEventListener('paste', (event) => {
      if (!event.clipboardData || !textarea) return;
      event.preventDefault();
      textarea.setRangeText(
        event.clipboardData.getData('text/plain'),
        textarea.selectionStart,
        textarea.selectionEnd,
        'end',
      );
      preview({ text: textarea.value }, 'text');
    });
    overlay.append(textarea);
    paint(false);
    textarea.focus();
    textarea.setSelectionRange(item.text.length, item.text.length);
  }
  function add() {
    if (composing) return;
    finish();
    const d = store.getSnapshot(),
      item = createTextItem({ xMm: d.page.marginMm, yMm: d.page.marginMm });
    store.dispatch({ type: 'add-item', item, groupId: crypto.randomUUID() });
    selectedId = item.id;
    paint(false, true);
  }
  function duplicate() {
    if (composing) return;
    finish();
    const item = selected();
    if (!item) return;
    const spacing = store.getSnapshot().grid.spacingMm;
    const copy = { ...item, id: crypto.randomUUID(), xMm: item.xMm + spacing, yMm: item.yMm + spacing };
    store.dispatch({ type: 'add-item', item: copy, groupId: crypto.randomUUID() });
    selectedId = copy.id;
    paint(false, true);
  }
  function remove() {
    if (composing) return;
    finish();
    const item = selected();
    if (!item) return;
    store.dispatch({ type: 'delete-item', id: item.id, groupId: crypto.randomUUID() });
    selectedId = '';
    paint(false, true);
  }
  toolbar.querySelector('#add-text')!.addEventListener('click', add);
  toolbar.querySelector('#duplicate-text')!.addEventListener('click', duplicate);
  toolbar.querySelector('#delete-text')!.addEventListener('click', remove);

  function startPointer(event: PointerEvent, kind: 'move' | 'resize', id: string) {
    if (composing || event.button !== 0 || options.mode() !== 'with-text') return;
    finish();
    selectedId = id;
    paper.focus({ preventScroll: true });
    const item = selected();
    if (!item) return;
    const h = height(item);
    if (!h) return;
    const rect = paper.getBoundingClientRect(),
      origin = { x: rect.left, y: rect.top };
    const p = screenToPage({ x: event.clientX, y: event.clientY }, origin, zoom());
    pointer = {
      id: event.pointerId,
      x: p.x,
      y: p.y,
      normal: insideSafeArea(item, h.heightMm, safeArea(store.getSnapshot().page)),
      kind,
    };
    draft = beginDraft(item, kind);
    paper.setPointerCapture(event.pointerId);
    event.preventDefault();
    paint(false);
  }
  paper.addEventListener('pointerdown', (event) => {
    if (!(event.target instanceof Element)) return;
    const target = event.target.closest<HTMLElement>('[data-item-id]');
    if (target) startPointer(event, 'move', target.dataset.itemId!);
    else if (!composing) {
      select('');
      paper.focus({ preventScroll: true });
    }
  });
  paper.addEventListener('dblclick', (event) => {
    if (!(event.target instanceof Element) || composing) return;
    const target = event.target.closest<HTMLElement>('[data-item-id]');
    const current = selectedId ? element(selectedId)?.getBoundingClientRect() : null;
    const capturedHit =
      current &&
      event.clientX >= current.left &&
      event.clientX <= current.right &&
      event.clientY >= current.top &&
      event.clientY <= current.bottom;
    if (target || capturedHit) {
      selectedId = target?.dataset.itemId ?? selectedId;
      beginText();
    }
  });
  handle.addEventListener('pointerdown', (event) => {
    event.stopPropagation();
    startPointer(event, 'resize', selectedId);
  });
  window.addEventListener('pointermove', (event) => {
    if (!pointer || !draft || composing || event.pointerId !== pointer.id) return;
    const d = store.getSnapshot(),
      area = safeArea(d.page),
      rect = paper.getBoundingClientRect();
    const p = screenToPage({ x: event.clientX, y: event.clientY }, { x: rect.left, y: rect.top }, zoom());
    const snap = shouldSnap(d.snapToGrid, event.altKey, 'pointer'),
      item = draft.before;
    if (pointer.kind === 'move') {
      let point = { x: item.xMm + p.x - pointer.x, y: item.yMm + p.y - pointer.y };
      if (snap) point = snapPosition(point, d.page.marginMm, d.grid.spacingMm);
      if (pointer.normal) {
        const h = height(draft.item, area.bottom - point.y);
        if (h) {
          point = constrainPosition(point, item.widthMm, h.heightMm, area, d.grid.spacingMm, snap);
          const precise = height(draft.item, area.bottom - point.y);
          if (precise)
            point = constrainPosition(point, item.widthMm, precise.heightMm, area, d.grid.spacingMm, snap);
        }
      }
      patchDraft(draft, { xMm: point.x, yMm: point.y });
    } else {
      let width = snapWidth(item.widthMm + p.x - pointer.x, d.grid.spacingMm, snap);
      if (pointer.normal) width = constrainWidth(width, item.xMm, area, d.grid.spacingMm, snap);
      patchDraft(draft, { widthMm: width });
    }
    paint();
  });
  window.addEventListener('pointerup', (event) => {
    if (pointer?.id === event.pointerId) {
      pointer = null;
      finish();
    }
  });
  window.addEventListener('pointercancel', () => {
    if (pointer) cancel();
  });
  window.addEventListener('blur', () => {
    if (pointer) cancel();
  });
  document.addEventListener(
    'pointerdown',
    (event) => {
      if (composing && event.target !== document.activeElement) {
        event.preventDefault();
        event.stopImmediatePropagation();
      }
    },
    true,
  );
  document.addEventListener('keydown', (event) => {
    const editable =
      event.target instanceof Element &&
      !!event.target.closest('input,textarea,select,[contenteditable="true"]');
    if (composing || event.isComposing || event.keyCode === 229) {
      if (
        !editable &&
        (event.key === 'Escape' ||
          event.key === 'Delete' ||
          (event.key === 'Enter' && (event.ctrlKey || event.metaKey)))
      )
        event.preventDefault();
      return;
    }
    if (event.key === 'Escape' && draft) {
      event.preventDefault();
      cancel();
      paper.focus({ preventScroll: true });
      return;
    }
    if (editable) {
      if (
        (event.ctrlKey || event.metaKey) &&
        event.key === 'Enter' &&
        (event.target === textarea || panel.isInput(event.target))
      ) {
        event.preventDefault();
        finish();
        paper.focus({ preventScroll: true });
      }
      return;
    }
    if ((event.ctrlKey || event.metaKey) && ['z', 'y'].includes(event.key.toLowerCase())) {
      event.preventDefault();
      shortcut = event.key.toLowerCase() === 'y' || event.shiftKey ? 'redo' : 'undo';
      checkOutput();
      return;
    }
    if (event.key === 'Delete' && selected()) {
      event.preventDefault();
      remove();
    }
    if (event.key === 'Enter' && event.target instanceof Element && event.target.closest('button,a')) return;
    if (event.key === 'Enter' && selected()) {
      event.preventDefault();
      beginText();
    }
  });
  store.subscribe(() => {
    if (!committing) {
      draft = null;
      pointer = null;
      dropTextarea();
    }
    if (!store.getSnapshot().items.some((i) => i.id === selectedId)) selectedId = '';
    paint();
  });
  document.fonts.addEventListener('loadingdone', () => paint(false));
  document.fonts.ready.then(() => paint(false));
  paint(false);
  return {
    previewItems: items,
    viewChanged() {
      if (!composing) {
        if (options.mode() !== 'with-text') finish();
        paint(false);
      }
    },
    isComposing: () => composing,
  };
}
