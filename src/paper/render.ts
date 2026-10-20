import { dimensions, mixedText, type FixtureSettings } from '../validation/print-fixture';
import { gridLines } from './grid';
import { DEFAULT_GRID } from '../model/document';

const NS = 'http://www.w3.org/2000/svg';
function line(x1: number, y1: number, x2: number, y2: number) {
  const el = document.createElementNS(NS, 'line');
  Object.entries({ x1, y1, x2, y2 }).forEach(([key, value]) => el.setAttribute(key, String(value)));
  return el;
}

/** Shared paper DOM; screen zoom never changes internal layout. */
export function renderPaper(paper: HTMLElement, settings: FixtureSettings) {
  const { width, height } = dimensions(settings.orientation);
  const m = settings.margin;
  const validation = settings.validation !== false;
  const gridSettings = settings.grid ?? DEFAULT_GRID;
  paper.dataset.orientation = settings.orientation;
  paper.dataset.margin = String(m);
  paper.dataset.mode = settings.mode;
  paper.dataset.validation = String(validation);
  paper.style.width = `${width}mm`;
  paper.style.height = `${height}mm`;
  paper.style.fontFamily = settings.fontFamily;
  paper.replaceChildren();

  const svg = document.createElementNS(NS, 'svg');
  svg.setAttribute('viewBox', `0 0 ${width} ${height}`);
  svg.setAttribute('class', 'grid-layer');
  svg.setAttribute('aria-hidden', 'true');
  const defs = document.createElementNS(NS, 'defs');
  const clip = document.createElementNS(NS, 'clipPath');
  clip.id = 'safe-grid-clip';
  const rect = document.createElementNS(NS, 'rect');
  Object.entries({ x: m, y: m, width: width - 2*m, height: height - 2*m }).forEach(([key, value]) => rect.setAttribute(key, String(value)));
  clip.append(rect); defs.append(clip); svg.append(defs);
  const grid = document.createElementNS(NS, 'g');
  grid.setAttribute('clip-path', 'url(#safe-grid-clip)');
  grid.setAttribute('data-grid-group', '');
  grid.setAttribute('stroke', gridSettings.color);
  grid.setAttribute('stroke-opacity', String(gridSettings.opacity));
  grid.setAttribute('stroke-width', String(gridSettings.strokeMm));
  for (const entry of gridLines({ orientation: settings.orientation, marginMm: m }, gridSettings)) {
    const el = entry.axis === 'x' ? line(entry.positionMm, m, entry.positionMm, height-m) : line(m, entry.positionMm, width-m, entry.positionMm);
    el.setAttribute('data-grid-line', entry.axis);
    el.setAttribute('data-major', String(entry.major));
    el.setAttribute('stroke-width', String(entry.strokeMm));
    grid.append(el);
  }
  svg.append(grid);

  // Deliberate U1-only calibration, also visible in the grid-only test case.
  const calibration = line(m+5, m+12, m+105, m+12);
  calibration.setAttribute('stroke', '#d00000');
  calibration.setAttribute('stroke-width', '0.25');
  calibration.setAttribute('stroke-linecap', 'butt');
  calibration.setAttribute('data-calibration', '100mm');
  if (validation) svg.append(calibration);
  paper.append(svg);

  const textLayer = document.createElement('div');
  textLayer.className = 'text-layer';
  const addText = (name: string, text: string, x: number, y: number, w: number) => {
    const el = document.createElement('div');
    el.className = 'paper-text'; el.dataset.fixture = name;
    el.textContent = text;
    Object.assign(el.style, { left: `${x}mm`, top: `${y}mm`, width: `${w}mm` });
    textLayer.append(el);
  };
  if (validation) {
    addText('mixed', mixedText, m+5, m+24, 100);
    addText('bottom', '하단 확인 · 마지막 줄 / Bottom edge', m+5, height-m-10, width-2*m-10);
  } else {
    for (const item of settings.items ?? []) {
      addText(item.id, item.text, item.xMm, item.yMm, item.widthMm);
      const el = textLayer.lastElementChild as HTMLElement;
      el.dataset.itemId = item.id;
      Object.assign(el.style, { fontSize: `${item.fontSizePt}pt`, fontWeight: String(item.fontWeight), color: item.color, textAlign: item.align, lineHeight: String(item.lineHeight) });
    }
  }
  paper.append(textLayer);
}
