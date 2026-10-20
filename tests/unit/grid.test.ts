import { describe, it, expect } from 'vitest';
import { createDocument } from '../../src/model/document';
import { gridLines, partialCells } from '../../src/paper/grid';

describe('grid geometry', () => {
  it.each([1, 2, 5, 10] as const)('keeps %s mm spacing and draws no duplicate lines', spacingMm => {
    const doc = createDocument(); doc.grid.spacingMm = spacingMm;
    const lines = gridLines(doc.page, doc.grid);
    expect(new Set(lines.map(l => `${l.axis}:${l.positionMm}`)).size).toBe(lines.length);
    const vertical = lines.filter(l => l.axis === 'x');
    expect(vertical[1].positionMm - vertical[0].positionMm).toBe(spacingMm);
  });
  it.each([0, 5, 10] as const)('draws every %s-cell major line once at twice the normal stroke', majorEvery => {
    const doc = createDocument(); doc.grid.majorEvery = majorEvery;
    const lines = gridLines(doc.page, doc.grid);
    const majors = lines.filter(l => l.major);
    if (majorEvery === 0) expect(majors).toHaveLength(0);
    else {
      expect(majors.length).toBeGreaterThan(0);
      expect(majors.every(l => l.strokeMm === 0.2)).toBe(true);
      expect(majors.find(l => l.axis === 'x')?.positionMm).toBe(5 + 5*majorEvery);
    }
  });
  it('retains the final 7mm partial cell for a 287mm safe height with 10mm spacing', () => {
    const doc = createDocument(); doc.grid.spacingMm = 10;
    expect(partialCells(doc.page, doc.grid).heightMm).toBe(7);
    const horizontal = gridLines(doc.page, doc.grid).filter(l => l.axis === 'y');
    expect(horizontal.at(-1)?.positionMm).toBe(285);
  });
});
