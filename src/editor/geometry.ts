import type { DeepReadonly, TextItem } from '../model/document';
import type { safeArea } from '../paper/geometry';

type Point = { x: number; y: number };
type Area = ReturnType<typeof safeArea>;
export function shouldSnap(enabled: boolean, alt: boolean, source: 'pointer' | 'numeric') {
  return enabled && !alt && source === 'pointer';
}
export function snapPosition(point: Point, origin: number, spacing: number): Point {
  return {
    x: origin + Math.round((point.x - origin) / spacing) * spacing,
    y: origin + Math.round((point.y - origin) / spacing) * spacing,
  };
}
export function snapWidth(width: number, spacing: number, snap: boolean) {
  return snap
    ? Math.max(Math.ceil(10 / spacing), Math.round(width / spacing)) * spacing
    : Math.max(10, width);
}
export function constrainPosition(
  point: Point,
  width: number,
  height: number,
  area: Area,
  spacing: number,
  snap: boolean,
): Point {
  const maxX = snap ? area.left + Math.floor((area.width - width) / spacing) * spacing : area.right - width;
  const maxY = snap
    ? area.top + Math.floor((area.height - height) / spacing) * spacing
    : area.bottom - height;
  return { x: Math.max(area.left, Math.min(point.x, maxX)), y: Math.max(area.top, Math.min(point.y, maxY)) };
}
export function constrainWidth(width: number, x: number, area: Area, spacing: number, snap: boolean) {
  const maximum = snap ? Math.floor((area.right - x) / spacing) * spacing : area.right - x;
  return Math.max(snap ? Math.ceil(10 / spacing) * spacing : 10, Math.min(width, maximum));
}
export function insideSafeArea(
  item: Pick<DeepReadonly<TextItem>, 'xMm' | 'yMm' | 'widthMm'>,
  height: number,
  area: Area,
) {
  const epsilon = 0.0001;
  return (
    item.xMm >= area.left - epsilon &&
    item.yMm >= area.top - epsilon &&
    item.xMm + item.widthMm <= area.right + epsilon &&
    item.yMm + height <= area.bottom + epsilon
  );
}
