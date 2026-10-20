import type { PageSettings } from '../model/document';

export function pageDimensions(orientation: PageSettings['orientation']) {
  return orientation === 'portrait' ? { width: 210, height: 297 } : { width: 297, height: 210 };
}
export function safeArea(page: Readonly<PageSettings>) {
  const { width, height } = pageDimensions(page.orientation), m = page.marginMm;
  return { left: m, top: m, right: width-m, bottom: height-m, width: width-2*m, height: height-2*m };
}
export const mmToCssPx = (mm: number) => mm * 96 / 25.4;
export const cssPxToMm = (px: number) => px * 25.4 / 96;
export function screenToPage(point: { x: number; y: number }, origin: { x: number; y: number }, zoom: number) {
  if (!Number.isFinite(zoom) || zoom <= 0) throw new Error('확대 배율은 0보다 커야 합니다.');
  return { x: cssPxToMm((point.x-origin.x)/zoom), y: cssPxToMm((point.y-origin.y)/zoom) };
}
