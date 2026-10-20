export type FixtureSettings = {
  orientation: 'portrait' | 'landscape';
  margin: 0 | 5 | 20;
  mode: 'with-text' | 'grid-only';
  fontFamily: string;
};

export const mixedText = '한글과 English, 같은 줄 위에서\n가나다라마바사 ABCDEFG 0123456789\n\n빈 줄 다음에도 간격은 그대로입니다.\n긴한글문장과LongEnglishWordWithoutSpaces가함께있을때줄바꿈을확인합니다.';
export const systemFont = '"Malgun Gothic", sans-serif';

export function dimensions(orientation: FixtureSettings['orientation']) {
  return orientation === 'portrait' ? { width: 210, height: 297 } : { width: 297, height: 210 };
}
