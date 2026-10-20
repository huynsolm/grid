import './style.css';
import './paper/paper.css';
import './print/print.css';
import { renderPaper } from './paper/render';
import { dimensions, systemFont, type FixtureSettings } from './validation/print-fixture';

document.querySelector<HTMLDivElement>('#app')!.innerHTML = `
  <header class="topbar screen-only"><div class="wordmark">모눈<small>PRINT STUDY</small></div><span class="stage-label">U1 · 인쇄 검증</span></header>
  <main class="workspace">
    <aside class="controls" aria-label="검증 설정">
      <p class="eyebrow">PAPER / 001</p><h1>종이 위의 기준</h1>
      <p class="intro">화면의 한 줄이 종이에서도 같은 자리에.<br>편집기를 만들기 전, 출력부터 확인합니다.</p>
      <div class="settings">
        <label>용지 방향<select id="orientation"><option value="portrait">세로 · 210 × 297 mm</option><option value="landscape">가로 · 297 × 210 mm</option></select></label>
        <label>안전 여백<select id="margin"><option value="0">0 mm</option><option value="5" selected>5 mm · 기본</option><option value="20">20 mm</option></select></label>
        <label>출력 모드<select id="mode"><option value="with-text">글씨 포함</option><option value="grid-only">빈 모눈</option></select></label>
        <label>테스트 폰트 파일<input id="font" type="file" accept=".woff,.woff2,.ttf,.otf" /></label>
        <p class="hint" id="font-name">시스템 기본 · Malgun Gothic / sans-serif<br>파일은 이 기기에만 머무릅니다. 최대 20 MiB.</p>
        <button class="font-reset" id="reset-font">시스템 기본 폰트로 돌아가기</button>
        <button class="primary" id="print">인쇄 / PDF로 저장</button>
      </div>
      <p class="screen-notice" id="status" role="status" aria-live="polite">폰트 준비 중…</p>
      <div class="save-info"><strong>PDF 저장 안내</strong><p>검증 브라우저</p><label>검증 브라우저<select id="browser"><option value="chrome">Chrome</option><option value="edge">Edge</option></select></label>
        <code id="filename"></code><span>저장 위치</span><code>docs/qa/pdfs/u1/</code>
        <p>A4 · 배율 100% · 여백 없음<br>머리글/바닥글 끄기 · 페이지 맞춤 끄기</p>
        <p>브라우저·OS 버전과 설정을 함께 기록해 주세요. 두 브라우저의 결과 확인 전까지 U1은 대기 상태입니다.</p>
      </div>
    </aside>
    <section class="preview" aria-label="A4 미리보기">
      <div class="preview-bar screen-only"><strong id="paper-summary"></strong><label>화면 확대<select id="zoom"><option value="0.5">50%</option><option value="0.75" selected>75%</option><option value="1">100%</option><option value="2">200%</option></select></label></div>
      <p class="screen-notice">붉은 선은 100 mm 측정용입니다. 빈 모눈에도 남는 검증 전용 표시입니다.<br>5 mm 간격을 유지하므로 끝 칸은 일부만 보일 수 있습니다. 0 mm 여백은 프린터에서 잘릴 수 있습니다.</p>
      <div class="paper-scale"><div class="print-page"><div class="paper" aria-label="검증용 A4 용지"></div></div></div>
    </section>
  </main>`;

function required<T extends HTMLElement>(selector: string): T {
  const el = document.querySelector<T>(selector);
  if (!el) throw new Error(`Missing element: ${selector}`);
  return el;
}
const orientation = required<HTMLSelectElement>('#orientation');
const margin = required<HTMLSelectElement>('#margin');
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
  return { orientation: orientation.value as FixtureSettings['orientation'], margin: Number(margin.value) as FixtureSettings['margin'], mode: mode.value as FixtureSettings['mode'], fontFamily };
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
  required('#paper-summary').textContent = `A4 ${width} × ${height} mm / 모눈 5 mm`;
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
  message('출력 준비 완료 · 실제 PDF 결과는 아직 미검증입니다.');
}
function refresh() { redraw(); void ready().catch(() => { message('폰트를 준비하지 못했습니다. 시스템 기본 폰트로 돌아가 주세요.', true); }); }
for (const input of [orientation, margin, mode]) input.addEventListener('change', refresh);
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
