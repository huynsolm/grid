import { dimensions, mixedText, type FixtureSettings } from '../validation/print-fixture';

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
  paper.dataset.orientation = settings.orientation;
  paper.dataset.margin = String(m);
  paper.dataset.mode = settings.mode;
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
  grid.setAttribute('stroke', '#6B7280');
  grid.setAttribute('stroke-opacity', '0.35');
  grid.setAttribute('stroke-width', '0.1');
  for (let x = m; x <= width-m; x += 5) grid.append(line(x, m, x, height-m));
  for (let y = m; y <= height-m; y += 5) grid.append(line(m, y, width-m, y));
  svg.append(grid);

  // Deliberate U1-only calibration, also visible in the grid-only test case.
  const calibration = line(m+5, m+12, m+105, m+12);
  calibration.setAttribute('stroke', '#d00000');
  calibration.setAttribute('stroke-width', '0.25');
  calibration.setAttribute('stroke-linecap', 'butt');
  calibration.setAttribute('data-calibration', '100mm');
  svg.append(calibration);
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
  addText('mixed', mixedText, m+5, m+24, 100);
  addText('bottom', '하단 확인 · 마지막 줄 / Bottom edge', m+5, height-m-10, width-2*m-10);
  paper.append(textLayer);
}
