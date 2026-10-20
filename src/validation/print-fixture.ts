import type { DeepReadonly, GridSettings, TextItem } from '../model/document';
export { pageDimensions as dimensions } from '../paper/geometry';

export type FixtureSettings = {
  orientation: 'portrait' | 'landscape';
  margin: number;
  mode: 'with-text' | 'grid-only';
  fontFamily: string;
  grid?: Readonly<GridSettings>;
  items?: readonly DeepReadonly<TextItem>[];
  validation?: boolean;
};

export const mixedText = '한글과 English, 같은 줄 위에서\n가나다라마바사 ABCDEFG 0123456789\n\n빈 줄 다음에도 간격은 그대로입니다.\n긴한글문장과LongEnglishWordWithoutSpaces가함께있을때줄바꿈을확인합니다.';
export const systemFont = '"Malgun Gothic", sans-serif';
