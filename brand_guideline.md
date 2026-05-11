# 한스푼 서점 · 브랜드 가이드라인

> *A Spoonful of French* — 작은 숟가락으로 떠먹듯, 오늘의 한 권을 천천히 떠 보세요.

## 1. 브랜드 정체성

- **브랜드명**: 한스푼 서점 (Hanspoon Bookstore)
- **영문 슬로건**: A Spoonful of French
- **한글 슬로건**: 작은 숟가락으로 떠먹듯, 오늘의 한 권을 천천히 떠 보세요.
- **핵심 컨셉**: 한 번에 다 외우는 학습이 아니라, 매일 한 스푼씩 떠먹는 학습.
- **저자/운영**: 김우수 (Nicolas) · 프랑스어한스푼

## 2. 톤 & 보이스

선호:
- 모던하고 귀여운 느낌
- 다채로운 파스텔 색감
- 모바일/아이폰에서 시원하게 읽히는 레이아웃
- 짧고 단단한 카피, 긴 문장보다 호흡이 짧은 한 줄

기피:
- 명조 계열 한글 서체
- 전통적·고전적·딱딱한 인상
- 시각성이 떨어지는 단색 UI
- "표지를 누르면 ~" 같은 불필요한 설명/안내 문구

## 3. 컬러 시스템

핵심:
- 배경 (cream): `#fcfbf4`
- 잉크 (본문): `#433f3e`
- 포인트 (blue): `#3b82f6`
- 라인 (subtle): `rgba(67, 63, 62, 0.08)`

파스텔 액센트 (선택지·카드·Phase 라벨에 일관 사용):
- Blue `#dbeafe` / border `#93c5fd`
- Red `#ffe4e6` / border `#fda4af`
- Mint `#d1fae5` / border `#86efac`
- Yellow `#fef3c7` / border `#facc15`
- Lavender `#ede9fe` / border `#c4b5fd`
- Peach `#ffedd5` / border `#fdba74`

용도 매핑:
- 성별 — 남자: blue / 여자: red
- 나이대 — 중학생: mint / 고등학생: yellow / 대학생: lavender / 직장인: peach
- 하루의 흐름 4단계 — Context: blue / Deconstruction: peach / Expansion: lavender / Recall: mint
- 30일의 여정 6 Phase — 1: blue / 2: peach / 3: red / 4: lavender / 5: mint / 6: yellow

## 4. 타이포그래피

본문 (한글 + 라틴):
- `"Apple SD Gothic Neo", "Pretendard", "Noto Sans KR", system-ui, sans-serif`

영문/숫자/제목 강조:
- `Georgia, "Times New Roman", serif`
- macOS·iOS에서 한글은 시스템 fallback으로 Gothic 계열로 렌더링되므로 명조처럼 보이지 않음.

크기·굵기 가이드:
- 페이지 H2 (섹션 제목): `font-size: 1.35rem`, `font-weight: 800~900`, Georgia 계열
- 상품 H2 (제목): `clamp(1.6rem, 7vw, 2.1rem)`, Georgia 계열
- 본문: `0.9~0.95rem`, `line-height: 1.7~1.8`
- eyebrow 라벨: `11px`, `letter-spacing: 0.2em`, `text-transform: uppercase`, blue

## 5. 컴포넌트 룰

- 카드: `border-radius: 18~24px`, `box-shadow: 0 6~12px 14~26px rgba(67,63,62,0.04~0.08)`
- 버튼/CTA: `border-radius: 999px` (필 모양), 본 CTA는 잉크 배경에 흰 텍스트
- 책 표지 박스: `aspect-ratio: 1055 / 1491` (실제 표지 비율 유지), 좌측만 직각, 우측 둥근 모서리 — 책등 느낌
- 로고 박스: PNG 자체에 흰 박스가 포함되어 있으므로 `aspect-ratio: 10/3` + `object-fit: cover`로 위·아래 여백을 잘라 콘텐츠에 타이트하게 맞춤
- 라벨 (Phase tag, level 등): `padding: 4px 10px`, `border-radius: 999px`

## 6. 카피 원칙

- 안내 문구는 가급적 두지 않는다. (예: "표지를 누르면 미리보기가 열립니다." → 삭제, 글래스 "미리 보기" 버튼이 그 역할)
- 명령형보다 청유형/제안형: "~ 해보세요", "~ 받아보고 결정하세요"
- 영어 표현은 이탤릭(`<em>`)으로 강조: *kiffer, ouf, mec/meuf*
- 가운뎃점(·)은 카테고리·구성 요소를 묶는 용도로 일관 사용

## 7. 첫 상품 — 30 Days in Paris

| 항목 | 값 |
|---|---|
| 카테고리 | 프랑스어 입문 · 듣고 따라 말하는 어휘책 |
| 분량 | 136페이지 · A4 |
| 구성 | 30일 × 4페이지 + 6 Phase 속표지 + 학습 기록판 + 알파벳 색인 |
| 형식 | PDF · 즉시 발송 |
| 보너스 | 노션 오디오 컴패니언 — Day 01~30 발음 듣기 무료 |
| 발행 | 2026년 5월 · 프랑스어한스푼 vol.1 |
| 가격 | 20,000원 |
| 추천 독자층 | 프랑스어 입문 · 파리 여행 · 유학 · 일상 회화 준비자 |

샘플 링크 (PDF + 오디오 통합):
`https://tonbonami.notion.site/30-days-in-Paris-Sample-35bb1658e7ec808a9811fdc4b47f9dd0`

주문 폼 (Google Form 응답):
`https://docs.google.com/forms/d/e/1FAIpQLSdETXW6feUq4w9xeZ7Ep1Ie25HNOVzS6WYr9TAe-HtsJVxnig/formResponse`

Form `entry.*` 매핑은 `index.html`의 `<input>` `name` 속성으로 관리.

## 8. 변경 이력

- 2026-05-10: 가격 정책 업데이트 — 30 Days in Paris 20,000원, 프랑스어 필수 동사 100 9,000원, 나의 첫 프랑스어 책 3.0 28,000원(예상). 샘플 책 3권(어린 왕자 · 달러구트 · 아무튼 여름) 제거. 셸프에는 실제 책 3권만.
- 2026-05-09: 단일 상품 랜딩으로 시작, 오디오 컴패니언 · 6 Phase · FAQ · 저자 섹션 추가. 이후 셸프 복원 + 나의 첫 프랑스어 책 3.0 · 프랑스어 필수 동사 100 추가.
