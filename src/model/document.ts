export type PageSettings = { orientation: 'portrait' | 'landscape'; marginMm: number };
export type GridSettings = {
  spacingMm: 1 | 2 | 5 | 10; color: string; opacity: number; strokeMm: number; majorEvery: 0 | 5 | 10;
};
export type TextItem = {
  id: string; text: string; xMm: number; yMm: number; widthMm: number;
  fontId: string; fontSizePt: number; color: string; fontWeight: 400 | 700;
  align: 'left' | 'center' | 'right'; lineHeight: number;
};
export type GridDocument = {
  version: 1; id: string; page: PageSettings; grid: GridSettings; snapToGrid: boolean; items: TextItem[];
};
export type FontRecord = { id: string; displayName: string } & (
  | { source: 'system'; id: 'system-sans'; fontStack: string; supportedWeights: readonly [400, 700] }
  | { source: 'builtin'; family: string; supportedWeights: readonly (400 | 700)[]; faces: { weight: 400 | 700; assetUrl: string }[] }
  | { source: 'upload'; family: string; supportedWeights: readonly [400]; blob: Blob }
);
export const SYSTEM_FONT = Object.freeze({
  id: 'system-sans', displayName: '시스템 기본', source: 'system',
  fontStack: '"Malgun Gothic", sans-serif', supportedWeights: Object.freeze([400, 700] as const),
}) satisfies FontRecord;
export type FontCatalog = ReadonlyMap<string, { supportedWeights: readonly (400 | 700)[] }>;
export function systemFontCatalog(): FontCatalog { return new Map([[SYSTEM_FONT.id, SYSTEM_FONT]]); }
export type DeepReadonly<T> = T extends object ? { readonly [K in keyof T]: DeepReadonly<T[K]> } : T;
export const DEFAULT_GRID: Readonly<GridSettings> = Object.freeze({ spacingMm: 5, color: '#6B7280', opacity: 0.35, strokeMm: 0.1, majorEvery: 0 });

export function createDocument(overrides: Partial<GridDocument> = {}): GridDocument {
  return {
    version: 1, id: crypto.randomUUID(), page: { orientation: 'portrait', marginMm: 5 },
    grid: { ...DEFAULT_GRID },
    snapToGrid: true, items: [], ...overrides,
  };
}
export function createTextItem(overrides: Partial<TextItem> = {}): TextItem {
  return {
    id: crypto.randomUUID(), text: '', xMm: 5, yMm: 5, widthMm: 100,
    fontId: SYSTEM_FONT.id, fontSizePt: 12, color: '#000000', fontWeight: 400,
    align: 'left', lineHeight: 1.5, ...overrides,
  };
}
