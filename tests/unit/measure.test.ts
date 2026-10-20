import { it, expect, vi } from 'vitest';
import { measureTextHeight } from '../../src/editor/measure';
import { cssPxToMm } from '../../src/paper/geometry';

it('uses untransformed offsetHeight and avoids rect measurement away from a boundary', () => {
  const rect = vi.fn(() => ({ height: 20.4 }));
  const result = measureTextHeight({ offsetHeight: 40, getBoundingClientRect: rect }, 0.5, 100);
  expect(result).toEqual({ heightMm: cssPxToMm(40), precise: false });
  expect(rect).not.toHaveBeenCalled();
});
it.each([0.5, 1, 2])('only refines within one CSS px, removing zoom %s from rect height', (zoom) => {
  const rect = vi.fn(() => ({ height: 40.4 * zoom }));
  const result = measureTextHeight({ offsetHeight: 40, getBoundingClientRect: rect }, zoom, cssPxToMm(40.6));
  expect(result.precise).toBe(true);
  expect(result.heightMm).toBeCloseTo(cssPxToMm(40.4), 9);
  expect(rect).toHaveBeenCalledTimes(1);
});
it('does not reuse a previous height when the layer cannot be measured', () => {
  const rect = vi.fn(() => ({ height: 10 }));
  expect(measureTextHeight({ offsetHeight: 40, getBoundingClientRect: rect }, 1, 10, false)).toBeNull();
  expect(rect).not.toHaveBeenCalled();
});
