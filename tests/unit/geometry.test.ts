import { it, expect } from 'vitest';
import { pageDimensions, safeArea, cssPxToMm, mmToCssPx, screenToPage } from '../../src/paper/geometry';

it('uses A4 dimensions in mm and subtracts equal margins without rounding the grid', () => {
  expect(pageDimensions('portrait')).toEqual({ width: 210, height: 297 });
  expect(pageDimensions('landscape')).toEqual({ width: 297, height: 210 });
  expect(safeArea({ orientation: 'portrait', marginMm: 5 })).toEqual({ left: 5, top: 5, right: 205, bottom: 292, width: 200, height: 287 });
});
it('inverts only the display zoom, retaining mm precision', () => {
  for (const zoom of [0.5, 1, 2]) {
    const result = screenToPage({ x: 30 + mmToCssPx(20)*zoom, y: 40 + mmToCssPx(10)*zoom }, { x: 30, y: 40 }, zoom);
    expect(result.x).toBeCloseTo(20, 8); expect(result.y).toBeCloseTo(10, 8);
  }
  expect(cssPxToMm(mmToCssPx(100))).toBeCloseTo(100, 8);
  expect(() => screenToPage({ x: 0, y: 0 }, { x: 0, y: 0 }, 0)).toThrow();
});
