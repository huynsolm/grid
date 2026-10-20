import type { DocumentStore } from '../state/document-store';
import type { DocumentCommand } from '../history/commands';
import type { GridSettings, PageSettings } from '../model/document';

export function mountPagePanel(host: HTMLElement, store: DocumentStore) {
  host.innerHTML = `
    <label>용지 방향<select id="orientation"><option value="portrait">세로 · 210 × 297 mm</option><option value="landscape">가로 · 297 × 210 mm</option></select></label>
    <label>안전 여백<input id="margin" type="number" min="0" max="20" step="1" /> <span class="hint">0~20 mm · 사방 동일</span></label>
    <label>모눈 간격<select id="spacing"><option value="1">1 mm</option><option value="2">2 mm</option><option value="5">5 mm</option><option value="10">10 mm</option></select></label>
    <label>선 색<input id="grid-color" type="color" /></label>
    <label for="opacity">선 불투명도 <output id="opacity-value"></output><input id="opacity" type="range" min="0" max="100" step="1" /></label>
    <label for="stroke">선 굵기 <output id="stroke-value"></output><input id="stroke" type="range" min="0.05" max="0.2" step="0.01" /></label>
    <label>강조선<select id="major"><option value="0">없음</option><option value="5">5칸마다 · 2배 굵기</option><option value="10">10칸마다 · 2배 굵기</option></select></label>
    <label class="check-label"><input id="snap" type="checkbox" />격자 스냅</label>
    <p id="settings-error" class="settings-error" role="alert"></p>`;
  const get = <T extends HTMLElement>(selector: string) => host.querySelector<T>(selector)!;
  const orientation = get<HTMLSelectElement>('#orientation'), margin = get<HTMLInputElement>('#margin');
  const spacing = get<HTMLSelectElement>('#spacing'), color = get<HTMLInputElement>('#grid-color');
  const opacity = get<HTMLInputElement>('#opacity'), stroke = get<HTMLInputElement>('#stroke');
  const major = get<HTMLSelectElement>('#major'), snap = get<HTMLInputElement>('#snap');
  const error = get('#settings-error');
  function sync() {
    const d = store.getSnapshot();
    orientation.value = d.page.orientation; margin.value = String(d.page.marginMm); spacing.value = String(d.grid.spacingMm);
    color.value = d.grid.color; opacity.value = String(Math.round(d.grid.opacity*100)); stroke.value = String(d.grid.strokeMm);
    major.value = String(d.grid.majorEvery); snap.checked = d.snapToGrid;
    get('#opacity-value').textContent = `${Math.round(d.grid.opacity*100)}%`;
    get('#stroke-value').textContent = `${d.grid.strokeMm.toFixed(2)} mm`;
  }
  const bindings: [HTMLElement, () => DocumentCommand][] = [
    [orientation, () => ({ type: 'set-page', patch: { orientation: orientation.value as PageSettings['orientation'] } })],
    [margin, () => ({ type: 'set-page', patch: { marginMm: margin.valueAsNumber } })],
    [spacing, () => ({ type: 'set-grid', patch: { spacingMm: Number(spacing.value) as GridSettings['spacingMm'] } })],
    [color, () => ({ type: 'set-grid', patch: { color: color.value } })],
    [opacity, () => ({ type: 'set-grid', patch: { opacity: opacity.valueAsNumber/100 } })],
    [stroke, () => ({ type: 'set-grid', patch: { strokeMm: stroke.valueAsNumber } })],
    [major, () => ({ type: 'set-grid', patch: { majorEvery: Number(major.value) as GridSettings['majorEvery'] } })],
    [snap, () => ({ type: 'set-snap', enabled: snap.checked })],
  ];
  const removers = bindings.map(([control, command]) => {
    const listener = () => {
      try { store.dispatch(command()); error.textContent = ''; }
      catch (e) { error.textContent = e instanceof Error ? e.message : '설정을 적용하지 못했습니다.'; sync(); }
    };
    const event = control instanceof HTMLInputElement && control.type === 'range' ? 'input' : 'change';
    control.addEventListener(event, listener);
    return () => { control.removeEventListener(event, listener); };
  });
  const unsubscribe = store.subscribe(sync); sync();
  return () => { unsubscribe(); removers.forEach(remove => remove()); };
}
