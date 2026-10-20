import { describe, it, expect } from 'vitest';
import {
  snapPosition,
  snapWidth,
  shouldSnap,
  constrainPosition,
  constrainWidth,
  insideSafeArea,
} from '../../src/editor/geometry';

const area = { left: 5, top: 5, right: 205, bottom: 292, width: 200, height: 287 };
describe('editor geometry in mm', () => {
  it('rounds from the safe-area origin, including half-grid ties', () => {
    expect(snapPosition({ x: 12.4, y: 12.5 }, 5, 5)).toEqual({ x: 10, y: 15 });
    expect(snapPosition({ x: 24, y: 9 }, 7, 10)).toEqual({ x: 27, y: 7 });
  });
  it.each([1, 2, 5, 10])('keeps width >=10mm and a grid multiple for spacing %s', (spacing) => {
    expect(snapWidth(1, spacing, true)).toBeGreaterThanOrEqual(10);
    expect(snapWidth(13, spacing, true) % spacing).toBe(0);
  });
  it('temporarily disables snapping for Alt and always bypasses it for numeric inputs', () => {
    expect(shouldSnap(true, false, 'pointer')).toBe(true);
    expect(shouldSnap(true, true, 'pointer')).toBe(false);
    expect(shouldSnap(true, false, 'numeric')).toBe(false);
    expect(snapWidth(13, 5, false)).toBe(13);
    expect(snapWidth(3, 5, false)).toBe(10);
  });
  it('limits a normal box to safe boundaries without breaking the snapped grid', () => {
    expect(constrainPosition({ x: 500, y: 500 }, 31, 17.2, area, 5, true)).toEqual({ x: 170, y: 270 });
    const free = constrainPosition({ x: -5, y: 500 }, 31, 17.2, area, 5, false);
    expect(free.x).toBe(5);
    expect(free.y).toBeCloseTo(274.8);
    expect(constrainWidth(500, 18, area, 5, true)).toBe(185);
  });
  it('detects overflow without relocating or resizing the original box', () => {
    expect(insideSafeArea({ xMm: 5, yMm: 5, widthMm: 200 }, 287, area)).toBe(true);
    expect(insideSafeArea({ xMm: 5, yMm: 5, widthMm: 201 }, 287, area)).toBe(false);
    expect(insideSafeArea({ xMm: 5, yMm: 280, widthMm: 100 }, 20, area)).toBe(false);
  });
});
