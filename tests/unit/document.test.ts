import { describe, it, expect } from 'vitest';
import { createDocument, createTextItem, SYSTEM_FONT } from '../../src/model/document';
import { validateDocument } from '../../src/model/validate';

describe('document boundary', () => {
  it('starts at model version 1 with an always available system font and approved defaults', () => {
    const doc = createDocument();
    expect(doc.version).toBe(1);
    expect(doc.page).toEqual({ orientation: 'portrait', marginMm: 5 });
    expect(doc.grid).toEqual({ spacingMm: 5, color: '#6B7280', opacity: 0.35, strokeMm: 0.1, majorEvery: 0 });
    expect(doc.snapToGrid).toBe(true);
    expect(doc.items).toEqual([]);
    expect(createTextItem().fontId).toBe(SYSTEM_FONT.id);
    expect(validateDocument(doc)).toEqual(doc);
  });

  it.each([
    (d: any) => { d.version = 2; },
    (d: any) => { d.page.marginMm = 21; },
    (d: any) => { d.page.marginMm = 0.5; },
    (d: any) => { d.grid.spacingMm = 3; },
    (d: any) => { d.grid.color = 'url(javascript:bad)'; },
    (d: any) => { d.grid.opacity = NaN; },
    (d: any) => { d.grid.strokeMm = 0.21; },
    (d: any) => { d.grid.majorEvery = 4; },
    (d: any) => { d.items = [createTextItem({ id: 'x' }), createTextItem({ id: 'x' })]; },
    (d: any) => { d.items = [createTextItem({ fontId: 'missing' })]; },
    (d: any) => { d.items = [createTextItem({ widthMm: 9 })]; },
    (d: any) => { d.items = [createTextItem({ xMm: Infinity })]; },
    (d: any) => { d.items = [createTextItem({ fontSizePt: 201 })]; },
    (d: any) => { d.items = [createTextItem({ lineHeight: 0.9 })]; },
  ])('rejects invalid documents before entering state', mutate => {
    const doc = createDocument(); mutate(doc);
    expect(() => validateDocument(doc)).toThrow();
  });

  it('checks supported font weights without silently replacing fonts', () => {
    const doc = createDocument(); doc.items = [createTextItem({ fontId: 'upload', fontWeight: 700 })];
    const fonts = new Map([['upload', { supportedWeights: [400] as const }]]);
    expect(() => validateDocument(doc, fonts)).toThrow();
    doc.items[0].fontWeight = 400;
    expect(validateDocument(doc, fonts).items[0].fontId).toBe('upload');
  });

  it.each([0, 20])('accepts the inclusive margin limit %s and approved numeric endpoints', margin => {
    const doc = createDocument(); doc.page.marginMm = margin;
    doc.grid.opacity = margin === 0 ? 0 : 1;
    doc.grid.strokeMm = margin === 0 ? 0.05 : 0.2;
    doc.items = [createTextItem({ fontSizePt: margin === 0 ? 6 : 200, lineHeight: margin === 0 ? 1 : 3 })];
    expect(validateDocument(doc)).toEqual(doc);
  });
});
