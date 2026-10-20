# 모눈 · U1 인쇄 검증

A4 모눈종이 편집기 개발에 앞서 같은 HTML 텍스트와 SVG 모눈이 화면·인쇄에서 유지되는지 확인하는 페이지다. 2026-10-21에 필수 PDF 17개와 Edge 추가 1개 및 사용자 최종 확인으로 U1 인쇄 검증을 완료했다. 후속 U2 구현 전 상태다. 편집 기능, 저장/복원, Undo/Redo는 아직 없다.

## 실행

Node.js 24와 npm 기준:

```powershell
npm ci
npm run dev
```

[로컬 미리보기](http://127.0.0.1:5173/)를 Chrome과 Edge에서 각각 연다. 개발 서버는 로컬 기기에서만 접근한다.

## 사용자가 진행할 PDF 검증

1. 용지 방향·안전 여백·출력 모드와 현재 사용하는 검증 브라우저를 고른다.
2. ‘인쇄 / PDF로 저장’을 눌러 실제 인쇄 대화상자에서 PDF로 저장한다. A4·선택 방향·100%·여백 없음·페이지 맞춤 해제·머리글/바닥글 해제를 확인한다.
3. 화면의 제안 파일명으로 `docs/qa/pdfs/u1/`에 저장한다. 재검증 파일은 마지막 `r1`을 `r2`처럼 올린다. 파일명과 저장 위치는 사용자가 지정한다.
4. [검증 기록](docs/qa/print-validation.md)의 절차대로 환경·설정과 육안 결과를 기록하고 파일을 제공한다.

붉은 100mm 기준선은 **검증 전용**이며 U1의 빈 모눈 모드에도 남는다. 완성 앱 출력의 기능이 아니다. 기본 5mm 모눈·0.1mm 선·35% 불투명도를 사용한다. 인쇄 래퍼 높이 여유는 아직 **0mm**이며 실제 PDF에서 빈 페이지가 재현된 경우에만 계획의 최대 0.1mm 완화를 검토한다.

테스트 폰트는 로컬 파일로 읽으며 서버로 전송하거나 저장하지 않는다. 사용자가 이용 권한을 확인한 woff/woff2/ttf/otf 파일(최대 20MiB)을 선택한다. 400만 사용하며 새로고침하면 해제된다. 기본 시스템 폰트는 기기에 따라 달라질 수 있다. Ctrl/Cmd+P는 가로채지 않으며 폰트 준비를 보장하려면 앱 출력 버튼을 사용한다. 경고와 도구 UI는 인쇄하지 않는다.

## 자동 검사

```powershell
npx playwright install chromium
npm test
npm run build
python -m pip install -r requirements-qa.txt
npm run test:qa
```

브라우저 검사는 Chromium과 설치된 Chrome·Edge를 사용한다. 둘 중 설치되지 않은 채널은 실행할 수 없다. 자동 검사는 실제 인쇄 대화상자 PDF 검증을 대체하지 않는다.

사용자 PDF의 치수 검사 예:

```powershell
python scripts/qa/measure_pdf.py docs/qa/pdfs/u1/chrome-portrait-margin5-system-with-text-r1.pdf --orientation portrait --output docs/qa/tmp/chrome-portrait-margin5.json
```

측정 종료 코드는 0(정량 통과), 1(실패), 2(미검증)이다. 정량 통과도 줄바꿈·하단 잘림 확인과 사용자 저장 여부를 대신하지 않는다. PDF 원본·임시 결과·스크린샷은 Git에서 제외되며 별도 로컬 보관이 필요하다. 기록 문서에는 해당 파일 경로와 측정값을 남긴다.

사용자 결과 확인 전에는 U1을 완료 처리하거나 U2를 시작하지 않는다.
