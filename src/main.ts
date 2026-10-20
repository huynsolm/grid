import './style.css';
import './paper/paper.css';
import './print/print.css';
import { renderPaper } from './paper/render';
import { dimensions, systemFont, type FixtureSettings } from './validation/print-fixture';
import { createDocumentStore } from './state/document-store';
import { mountPagePanel } from './ui/page-panel';
import { partialCells } from './paper/grid';

const isValidation = new URLSearchParams(location.search).has('validation');
const store = createDocumentStore();

document.querySelector<HTMLDivElement>('#app')!.innerHTML = `
  <header class="topbar screen-only"><div class="wordmark">모눈<small>${isValidation ? "PRINT STUDY" : "GRID PAPER"}</small></div><a class="stage-label" href="${isValidation ? "/" : "/?validation=1"}">${isValidation ? "모눈 설정으로 돌아가기" : "인쇄 검증 페이지"}</a></header>
  <main class="workspace">
    <aside class="controls" aria-label="검증 설정">
      <p class="eyebrow">PAPER / ${isValidation ? "001" : "002"}</p><h1>${isValidation ? "종이 위의 기준" : "나만의 모눈종이"}</h1>
      <p class="intro">${isValidation ? "화면의 한 줄이 종이에서도 같은 자리에.<br>편집기를 만들기 전, 출력부터 확인합니다." : "칸의 간격과 선의 농도를 정하세요.<br>용지 크기는 인쇄에서도 그대로 유지됩니다."}</p>
      <div class="settings">
        <div id="page-panel" class="settings-panel" ${isValidation ? 'hidden' : ''}></div>
        <div class="settings-panel" ${isValidation ? '' : 'hidden'}>
          <label>용지 방향<select id="validation-orientation"><option value="portrait">세로 · 210 × 297 mm</option><option value="landscape">가로 · 297 × 210 mm</option></select></label>
          <label>안전 여백<select id="validation-margin"><option value="0">0 mm</option><option value="5" selected>5 mm · 기본</option><option value="20">20 mm</option></select></label>
        </div>
        <label>출력 모드<select id="mode"><option value="with-text">글씨 포함</option><option value="grid-only">빈 모눈</option></select></label>
        <label ${isValidation ? "" : "hidden"}>테스트 폰트 파일<input id="font" type="file" accept=".woff,.woff2,.ttf,.otf" /></label>
        <p class="hint" id="font-name" ${isValidation ? "" : "hidden"}>시스템 기본 · Malgun Gothic / sans-serif<br>파일은 이 기기에만 머무릅니다. 최대 20 MiB.</p>
        <button class="font-reset" id="reset-font" ${isValidation ? "" : "hidden"}>시스템 기본 폰트로 돌아가기</button>
        <button class="primary" id="print">인쇄 / PDF로 저장</button>
      </div>
      <p class="screen-notice" id="status" role="status" aria-live="polite">폰트 준비 중…</p>
      <div class="save-info" ${isValidation ? "" : "hidden"}><strong>PDF 저장 안내</strong><label>검증 브라우저<select id="browser"><option value="chrome">Chrome</option><option value="edge">Edge</option></select></label>
        <code id="filename"></code><span>저장 위치</span><code>docs/qa/pdfs/u1/</code>
        <p>A4 · 배율 100% · 여백 없음<br>머리글/바닥글 끄기 · 페이지 맞춤 끄기</p>
        <p>U1 검증 기록은 보존됩니다. 새 설정의 결과는 별도의 재검증으로 기록합니다.</p>
      </div>
    </aside>
    <section class="preview" aria-label="A4 미리보기">
      <div class="preview-bar screen-only"><strong id="paper-summary"></strong><label>화면 확대<select id="zoom"><option value="0.5">50%</option><option value="0.75" selected>75%</option><option value="1">100%</option><option value="2">200%</option></select></label></div>
      <p class="screen-notice" id="grid-notice"></p>
      <div class="paper-scale"><div class="print-page"><div class="paper" aria-label="검증용 A4 용지"></div></div></div>
    </section>
  </main>`;

function required<T extends HTMLElement>(selector: string): T {
  const el = document.querySelector<T>(selector);
  if (!el) throw new Error(`Missing element: ${selector}`);
  return el;
}
if (!isValidation) {
  mountPagePanel(required('#page-panel'), store);
  required('#validation-orientation').parentElement!.parentElement!.remove();
}
const orientation = required<HTMLSelectElement>(isValidation ? '#validation-orientation' : '#orientation');
const margin = required<HTMLSelectElement | HTMLInputElement>(isValidation ? '#validation-margin' : '#margin');
const mode = required<HTMLSelectElement>('#mode');
const zoom = required<HTMLSelectElement>('#zoom');
const browser = required<HTMLSelectElement>('#browser');
const paper = required<HTMLDivElement>('.paper');
const scale = required<HTMLDivElement>('.paper-scale');
const printPage = required<HTMLDivElement>('.print-page');
const printButton = required<HTMLButtonElement>('#print');
const status = required<HTMLParagraphElement>('#status');
const pageStyle = document.createElement('style');
document.head.append(pageStyle);
let fontFamily = systemFont;
let uploadedFace: FontFace | undefined;
let fontKind = 'system';
let fontReady = false;
let fontFailed = false;
let revision = 0;
let uploadGeneration = 0;

function settings(): FixtureSettings {
  const d = store.getSnapshot();
  return {
    orientation: isValidation ? orientation.value as FixtureSettings['orientation'] : d.page.orientation,
    margin: isValidation ? Number(margin.value) : d.page.marginMm,
    mode: mode.value as FixtureSettings['mode'], fontFamily,
    grid: isValidation ? undefined : d.grid, items: d.items, validation: isValidation,
  };
}
function message(text: string, error = false) {
  status.textContent = text; status.dataset.error = String(error);
}
function updateFilename() {
  required('#filename').textContent = `${browser.value}-${orientation.value}-margin${margin.value}-${fontKind}-${mode.value}-r1.pdf`;
}
function redraw() {
  revision++;
  const current = settings();
  const { width, height } = dimensions(current.orientation);
  renderPaper(paper, current);
  printPage.style.width = `${width}mm`; printPage.style.height = `${height}mm`;
  pageStyle.textContent = `@page { size: A4 ${current.orientation}; margin: 0; }`;
  scale.style.transform = `scale(${zoom.value})`;
  scale.style.width = `${width}mm`;
  scale.style.height = `${height * Number(zoom.value)}mm`;
  required('#paper-summary').textContent = `A4 ${width} × ${height} mm / 모눈 ${current.grid?.spacingMm ?? 5} mm`;
  const cells = partialCells({ orientation: current.orientation, marginMm: current.margin }, current.grid ?? store.getSnapshot().grid);
  const notice = [isValidation ? '붉은 선은 100 mm 측정용입니다. 빈 모눈에도 남는 검증 전용 표시입니다.' : '글쓰기·저장은 다음 구현 단계에서 연결됩니다. 현재 설정은 새로고침하면 초기화됩니다.'];
  if (cells.widthMm || cells.heightMm) notice.push(`간격을 유지하므로 끝 칸은 일부만 보일 수 있습니다. 가로 ${cells.widthMm} mm / 세로 ${cells.heightMm} mm.`);
  if (current.margin === 0) notice.push('0 mm 여백은 실제 프린터에서 잘릴 수 있습니다.');
  if (current.grid?.spacingMm === 1) notice.push('촘촘한 1 mm 모눈은 불투명도 20%를 권장합니다. 설정은 자동 변경하지 않습니다.');
  required('#grid-notice').textContent = notice.join(' ');
  updateFilename();
}
async function ready() {
  const version = revision;
  fontReady = false; printButton.disabled = true;
  if (fontFailed && mode.value === 'with-text') {
    message('폰트를 불러오지 못했습니다. 다른 파일 또는 시스템 기본 폰트를 선택해 주세요.', true);
    return;
  }
  await document.fonts.load(`12pt ${fontFamily}`, '한글과 English');
  await document.fonts.ready;
  if (version !== revision) return;
  fontReady = true; printButton.disabled = false;
  message(isValidation ? '출력 준비 완료 · 검증 페이지' : '출력 준비 완료 · A4 / 실제 크기 100%로 인쇄해 주세요.');
}
function refresh() { redraw(); void ready().catch(() => { message('폰트를 준비하지 못했습니다. 시스템 기본 폰트로 돌아가 주세요.', true); }); }
if (isValidation) for (const input of [orientation, margin]) input.addEventListener('change', refresh);
else store.subscribe(refresh);
mode.addEventListener('change', refresh);
zoom.addEventListener('change', () => { scale.style.transform = `scale(${zoom.value})`; scale.style.height = `${dimensions(settings().orientation).height * Number(zoom.value)}mm`; });
browser.addEventListener('change', updateFilename);
required<HTMLInputElement>('#font').addEventListener('change', async (event) => {
  const file = (event.currentTarget as HTMLInputElement).files?.[0];
  if (!file) return;
  const generation = ++uploadGeneration;
  fontFailed = true;
  revision++; fontReady = false; printButton.disabled = true;
  message('테스트 폰트 불러오는 중…');
  try {
    if (!/\.(woff2?|ttf|otf)$/i.test(file.name) || file.size > 20 * 1024 * 1024) throw new Error('Unsupported font');
    const family = `u1-${crypto.randomUUID()}`;
    const face = new FontFace(family, await file.arrayBuffer(), { weight: '400' });
    await face.load();
    if (generation !== uploadGeneration) return;
    if (uploadedFace) document.fonts.delete(uploadedFace);
    uploadedFace = face; document.fonts.add(face);
    fontFamily = `"${family}"`; fontKind = 'upload';
    required('#font-name').textContent = `${file.name} · 400 · 새로고침하면 해제됩니다. 파일 이용 권한을 확인해 주세요.`;
    fontFailed = false;
    redraw(); await ready();
  } catch {
    if (generation === uploadGeneration) message('폰트를 불러오지 못했습니다. 다른 파일 또는 시스템 기본 폰트를 선택해 주세요.', true);
  }
});
required('#reset-font').addEventListener('click', () => {
  uploadGeneration++;
  if (uploadedFace) document.fonts.delete(uploadedFace);
  uploadedFace = undefined; fontFamily = systemFont; fontKind = 'system';
  fontFailed = false;
  required<HTMLInputElement>('#font').value = '';
  required('#font-name').textContent = '시스템 기본 · Malgun Gothic / sans-serif';
  refresh();
});
printButton.addEventListener('click', async () => {
  const version = revision;
  printButton.disabled = true;
  try {
    await document.fonts.ready;
    await new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
    if (version !== revision || !fontReady) { message('설정이 바뀌었습니다. 준비 후 다시 인쇄해 주세요.'); return; }
    window.print();
  } finally { printButton.disabled = !fontReady; }
});
window.addEventListener('beforeprint', () => {
  if (!fontReady) message('검증 준비가 끝나지 않았습니다. 앱 인쇄 버튼을 사용해 주세요.', true);
});
refresh();
