import { systemFontCatalog, type FontCatalog, type GridDocument, type TextItem } from './document';

function record(value: unknown, label: string): Record<string, unknown> {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) throw new Error(`${label}: 객체가 필요합니다.`);
  return value as Record<string, unknown>;
}
function string(value: unknown, label: string, nonempty = false): string {
  if (typeof value !== 'string' || (nonempty && !value.trim())) throw new Error(`${label}: 올바른 문자열이 필요합니다.`);
  return value;
}
function number(value: unknown, label: string, min = -Infinity, max = Infinity): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < min || value > max) throw new Error(`${label}: ${min}~${max} 범위의 유한수를 입력해 주세요.`);
  return value;
}
function choice<T extends string | number>(value: unknown, values: readonly T[], label: string): T {
  if (!values.includes(value as T)) throw new Error(`${label}: 지원하지 않는 값입니다.`);
  return value as T;
}
function bool(value: unknown, label: string): boolean {
  if (typeof value !== 'boolean') throw new Error(`${label}: 참/거짓 값이 필요합니다.`);
  return value;
}
function color(value: unknown, label: string): string {
  if (typeof value !== 'string' || !/^#[0-9a-f]{6}$/i.test(value)) throw new Error(`${label}: #RRGGBB 색상을 입력해 주세요.`);
  return value;
}

/** Validate unknown persisted/command data; build a clean model without UI/runtime properties. */
export function validateDocument(input: unknown, fonts: FontCatalog = systemFontCatalog()): GridDocument {
  const d = record(input, '문서'), page = record(d.page, '용지'), grid = record(d.grid, '모눈');
  if (d.version !== 1) throw new Error('지원하지 않는 문서 버전입니다.');
  const marginMm = number(page.marginMm, '안전 여백', 0, 20);
  if (!Number.isInteger(marginMm)) throw new Error('안전 여백은 정수 mm로 입력해 주세요.');
  if (!Array.isArray(d.items)) throw new Error('글상자 목록이 필요합니다.');
  const ids = new Set<string>();
  const items: TextItem[] = d.items.map(inputItem => {
    const item = record(inputItem, '글상자');
    const id = string(item.id, '글상자 ID', true);
    if (ids.has(id)) throw new Error('글상자 ID가 중복됩니다.');
    ids.add(id);
    const fontId = string(item.fontId, '글꼴 ID', true);
    const fontWeight = choice(item.fontWeight, [400, 700] as const, '굵기');
    if (!fonts.get(fontId)?.supportedWeights.includes(fontWeight)) throw new Error('사용할 수 없는 글꼴 또는 굵기입니다.');
    return {
      id, text: string(item.text, '내용'), xMm: number(item.xMm, '가로 위치'), yMm: number(item.yMm, '세로 위치'),
      widthMm: number(item.widthMm, '너비', 10), fontId, fontWeight,
      fontSizePt: number(item.fontSizePt, '글자 크기', 6, 200), color: color(item.color, '글자 색'),
      align: choice(item.align, ['left', 'center', 'right'] as const, '정렬'), lineHeight: number(item.lineHeight, '줄 간격', 1, 3),
    };
  });
  return {
    version: 1, id: string(d.id, '문서 ID', true),
    page: { orientation: choice(page.orientation, ['portrait', 'landscape'] as const, '방향'), marginMm },
    grid: {
      spacingMm: choice(grid.spacingMm, [1, 2, 5, 10] as const, '모눈 간격'), color: color(grid.color, '선 색'),
      opacity: number(grid.opacity, '불투명도', 0, 1), strokeMm: number(grid.strokeMm, '선 굵기', 0.05, 0.2),
      majorEvery: choice(grid.majorEvery, [0, 5, 10] as const, '강조선'),
    },
    snapToGrid: bool(d.snapToGrid, '격자 스냅'), items,
  };
}
