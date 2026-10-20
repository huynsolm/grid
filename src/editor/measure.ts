import { cssPxToMm, mmToCssPx } from '../paper/geometry';

type Measurable = { offsetHeight: number; getBoundingClientRect(): { height: number } };
export function measureTextHeight(
  element: Measurable,
  zoom: number,
  availableHeightMm: number,
  measurable?: true,
): { heightMm: number; precise: boolean };
export function measureTextHeight(
  element: Measurable,
  zoom: number,
  availableHeightMm: number,
  measurable: boolean,
): { heightMm: number; precise: boolean } | null;
export function measureTextHeight(
  element: Measurable,
  zoom: number,
  availableHeightMm: number,
  measurable = true,
) {
  if (!measurable) return null;
  if (!Number.isFinite(zoom) || zoom <= 0) throw new Error('올바른 확대 배율이 필요합니다.');
  const height = element.offsetHeight;
  if (Math.abs(height - mmToCssPx(availableHeightMm)) <= 1) {
    return { heightMm: cssPxToMm(element.getBoundingClientRect().height / zoom), precise: true };
  }
  return { heightMm: cssPxToMm(height), precise: false };
}
