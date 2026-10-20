import { SYSTEM_FONT, type DeepReadonly, type TextItem } from '../model/document';

/** Exactly the same text metrics for the display div and the textarea overlay. */
export function applyTextStyle(element: HTMLElement, item: DeepReadonly<TextItem>) {
  Object.assign(element.style, {
    left: `${item.xMm}mm`,
    top: `${item.yMm}mm`,
    width: `${item.widthMm}mm`,
    fontFamily: SYSTEM_FONT.fontStack,
    fontSize: `${item.fontSizePt}pt`,
    fontWeight: String(item.fontWeight),
    color: item.color,
    textAlign: item.align,
    lineHeight: String(item.lineHeight),
    minHeight: `${item.fontSizePt * item.lineHeight}pt`,
    whiteSpace: 'pre-wrap',
    overflowWrap: 'anywhere',
    wordBreak: 'normal',
    letterSpacing: '0px',
    padding: '0px',
    border: '0px',
    boxSizing: 'border-box',
    fontSynthesis: 'none',
  });
}
