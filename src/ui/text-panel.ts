import type { DeepReadonly, TextItem } from '../model/document';

export type TextPatch = Partial<Omit<TextItem, 'id'>>;
type Callbacks = {
  preview(patch: TextPatch, kind: 'text' | 'properties'): void;
  commit(): void;
  cancel(): void;
  composing(active: boolean): void;
  select(id: string): void;
};
export function mountTextPanel(host: HTMLElement, callbacks: Callbacks) {
  host.innerHTML = `<h2>글상자</h2><label>글상자 선택<select id="item-list"><option value="">글상자 없음</option></select></label>
    <p id="text-empty" class="hint">글상자를 추가하거나 선택해 주세요.</p>
    <fieldset id="text-fields" disabled>
    <label>내용<textarea id="text-content" rows="5" placeholder="내용을 입력하세요"></textarea></label>
    <p class="hint">Ctrl/Cmd+Enter 완료 · Esc 취소<br>용지에서 더블클릭해도 편집할 수 있습니다.</p>
    <label>글꼴<input value="시스템 기본 · Malgun Gothic / sans-serif" readonly /></label>
    <label>글자 크기 (pt)<input id="text-size" type="number" min="6" max="200" step="1" /></label>
    <label>글자 색 (HEX)<input id="text-color" type="text" pattern="#[0-9a-fA-F]{6}" maxlength="7" /></label>
    <label>정렬<select id="text-align"><option value="left">왼쪽</option><option value="center">가운데</option><option value="right">오른쪽</option></select></label>
    <label>줄 간격<input id="text-line-height" type="number" min="1" max="3" step="0.1" /></label>
    <label>글자 굵기<select id="text-weight"><option value="400">보통 · 400</option><option value="700">굵게 · 700</option></select></label>
    <label>가로 위치 (mm)<input id="text-x" type="number" step="0.1" /></label>
    <label>세로 위치 (mm)<input id="text-y" type="number" step="0.1" /></label>
    <label>폭 (mm)<input id="text-width" type="number" min="10" step="0.1" /></label>
    </fieldset><p id="text-error" class="settings-error" role="alert"></p>`;
  const input = <T extends HTMLElement>(id: string) => host.querySelector<T>(id)!;
  const fields = input<HTMLFieldSetElement>('#text-fields');
  const content = input<HTMLTextAreaElement>('#text-content');
  const list = input<HTMLSelectElement>('#item-list');
  const controls: [
    HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement,
    keyof TextPatch,
    (el: HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement) => unknown,
  ][] = [
    [content, 'text', (el) => el.value],
    [input<HTMLInputElement>('#text-size'), 'fontSizePt', (el) => (el as HTMLInputElement).valueAsNumber],
    [input<HTMLInputElement>('#text-color'), 'color', (el) => el.value],
    [input<HTMLSelectElement>('#text-align'), 'align', (el) => el.value],
    [
      input<HTMLInputElement>('#text-line-height'),
      'lineHeight',
      (el) => (el as HTMLInputElement).valueAsNumber,
    ],
    [input<HTMLSelectElement>('#text-weight'), 'fontWeight', (el) => Number(el.value)],
    [input<HTMLInputElement>('#text-x'), 'xMm', (el) => (el as HTMLInputElement).valueAsNumber],
    [input<HTMLInputElement>('#text-y'), 'yMm', (el) => (el as HTMLInputElement).valueAsNumber],
    [input<HTMLInputElement>('#text-width'), 'widthMm', (el) => (el as HTMLInputElement).valueAsNumber],
  ];
  for (const [control, key, value] of controls) {
    control.addEventListener('input', () =>
      callbacks.preview({ [key]: value(control) }, key === 'text' ? 'text' : 'properties'),
    );
    control.addEventListener('change', () => {
      callbacks.preview({ [key]: value(control) }, key === 'text' ? 'text' : 'properties');
      if (control instanceof HTMLSelectElement) callbacks.commit();
    });
    control.addEventListener('blur', () => callbacks.commit());
    control.addEventListener('compositionstart', () => callbacks.composing(true));
    control.addEventListener('compositionend', () => {
      callbacks.composing(false);
      callbacks.preview({ [key]: value(control) }, key === 'text' ? 'text' : 'properties');
    });
  }
  list.addEventListener('change', () => callbacks.select(list.value));
  return {
    sync(
      items: readonly DeepReadonly<TextItem>[],
      selected: DeepReadonly<TextItem> | undefined,
      force = false,
    ) {
      const active = document.activeElement;
      if (active !== list) {
        list.replaceChildren();
        if (!items.length) list.add(new Option('글상자 없음', ''));
        for (const [index, item] of items.entries())
          list.add(
            new Option(
              `${index + 1}. ${item.text.slice(0, 16).replaceAll('\n', ' ') || '빈 글상자'}`,
              item.id,
            ),
          );
        list.value = selected?.id ?? '';
      }
      fields.disabled = !selected;
      input('#text-empty').hidden = !!selected;
      for (const [control, key] of controls)
        if (force || active !== control) control.value = selected ? String(selected[key]) : '';
    },
    error(message: string) {
      input('#text-error').textContent = message;
    },
    isInput(target: EventTarget | null) {
      return target instanceof Node && fields.contains(target);
    },
  };
}
