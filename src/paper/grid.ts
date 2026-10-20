import type { GridSettings, PageSettings } from '../model/document';
import { safeArea } from './geometry';

export type GridLine = { axis: 'x' | 'y'; positionMm: number; major: boolean; strokeMm: number };
export function gridLines(page: Readonly<PageSettings>, grid: Readonly<GridSettings>): GridLine[] {
  const area = safeArea(page), lines: GridLine[] = [];
  if (!Number.isFinite(grid.spacingMm) || grid.spacingMm <= 0) throw new Error('모눈 간격이 올바르지 않습니다.');
  for (const axis of ['x', 'y'] as const) {
    const length = axis === 'x' ? area.width : area.height;
    for (let index = 0; index <= Math.floor(length/grid.spacingMm); index++) {
      const major = grid.majorEvery !== 0 && index > 0 && index % grid.majorEvery === 0;
      lines.push({ axis, positionMm: page.marginMm + index*grid.spacingMm, major, strokeMm: grid.strokeMm*(major ? 2 : 1) });
    }
  }
  return lines;
}
export function partialCells(page: Readonly<PageSettings>, grid: Readonly<GridSettings>) {
  const area = safeArea(page);
  return { widthMm: area.width % grid.spacingMm, heightMm: area.height % grid.spacingMm };
}
