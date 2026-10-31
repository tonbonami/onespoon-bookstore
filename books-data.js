// 한스푼 서점 상품 데이터 — 책 정보·가격·구글폼 선택값은 이 파일 한 곳에서만 고친다.
// 서가, 책 상세, 주문서의 책 카드, 입금 금액, 완료 화면이 모두 여기서 나온다.
//
// 지킬 것
// - formValue: 구글폼 '주문하실 책 이름' 선택지와 한 글자도 달라지면 안 된다(다르면 주문이 조용히 사라짐).
//   새 책은 구글폼에 선택지를 먼저 '추가'한 뒤 여기 넣는다. 기존 선택지는 고치지도 지우지도 않는다.
// - id, slug: 한번 정하면 바꾸지 않는다(서가·책별 주소가 이걸로 찾는다).
// - 고친 뒤에는 books/index.html의 books-data.js?v= 숫자를 1 올린다.
//
// 칸 설명
//   price       입금 금액(원). 없으면 주문서에 나오지 않는다(출시 예정 책).
//   priceText   책 상세의 가격 줄을 따로 쓸 때만(예: 출시 기념가). 없으면 price로 쓴다.
//   upgrade     이전 판 구매자 할인 { from: "2.0", price: 15000 } — 입금 안내와 메모 칸 안내에 쓰인다.
//   pickLabel   주문서 책 카드의 작은 글. 뒤에 " · 가격"이 붙는다.
//   status      "판매중" 또는 "출시예정"(출시예정이면 주문서 대신 출시 알림이 뜬다).
window.HANSPOON_BOOKS = [
  {
    id: 5,
    slug: "nofu3",
    lang: "fr",
    status: "판매중",
    title: "나의 첫 프랑스어 책 3.0",
    category: "프랑스어 입문 · 노션 기반 종합 교재",
    description:
      "알파벳부터 『어린 왕자』 원문까지, 한 권으로. 발음 · 문법 · 어휘 · 회화 · 동사 변화 · 읽기 6영역, 프랑스어 음성 900개 이상. 휴대폰 노션으로 바로 보는 프랑스어 입문서 (A1~B1).",
    descriptionHtml:
      '<strong class="lede-head">알파벳부터 『어린 왕자』 원문까지, 한 권으로.</strong><br>발음 · 문법 · 어휘 · 회화 · 동사 변화 · 읽기 6영역<br>프랑스어 음성 900개 이상 · 휴대폰 노션으로 바로',
    audience: "한국어로 프랑스어를 처음 시작하는 입문자 (A1~B1)",
    color: "#f5ede0",
    cover: "/assets/web/nofu-book-3-cover.webp",
    coverSize: [420, 596],
    formValue: "나의 첫 프랑스어 책 3.0",
    price: 29000,
    upgrade: { from: "2.0", price: 15000 },
    pickLabel: "A1~B1 종합 노션 교재",
    featured: "#featuredNoFu3",
    previewPages: [
      "/assets/preview-pages/nofu3-preview-01.png",
      "/assets/preview-pages/nofu3-preview-02.png",
      "/assets/preview-pages/nofu3-preview-03.png",
      "/assets/preview-pages/nofu3-preview-04.png",
      "/assets/preview-pages/nofu3-preview-05.png",
    ],
  },
  {
    id: 7,
    slug: "firstspanish",
    lang: "es",
    status: "출시예정",
    title: "나의 첫 스페인어 책 1.0",
    category: "스페인어 입문 · 노션 기반 종합 교재",
    description:
      "알파벳부터 『어린 왕자』까지, 라틴아메리카 스페인어를 한 권으로. 발음 · 문법 · 동사 변화 · 회화 · 어휘 · 읽기 6영역, 문법 단원마다 「프랑스어와 비교」. 『어린 왕자』 27장 전체를 이 책만의 스페인어 번역과 음성으로.",
    descriptionHtml:
      '<strong class="lede-head">알파벳부터 『어린 왕자』까지, 라틴아메리카 스페인어를 한 권으로.</strong><br>발음 · 문법 · 동사 변화 · 회화 · 어휘 · 읽기 6영역 · 문법 단원마다 「프랑스어와 비교」<br>『어린 왕자』 27장 전체를 이 책만의 스페인어 번역과 음성으로 · 휴대폰 노션으로 바로',
    audience: "스페인어를 처음 시작하는 분 · 프랑스어를 배운 뒤 두 번째 외국어를 찾는 분 (A1~B2)",
    color: "#e9f2fb",
    cover: "/assets/web/firstspanish-1-cover.webp",
    coverSize: [420, 596],
    priceText: "11월 중순 출시 예정입니다. 가격은 출시 때 함께 알려 드릴게요.",
  },
  {
    id: 1,
    slug: "30days-in-paris",
    lang: "fr",
    status: "판매중",
    title: "30 Days in Paris",
    category: "PDF 책 · 노션 필요 없음 · 듣고 따라 말하는 어휘책",
    description:
      "30일 동안 파리에 머무는 한 사람의 시점을 따라가며, 카페·시장·사무실·행정 창구에서 실제로 쓰이는 프랑스어를 한 스푼씩 떠먹는 책. 외워야 한다는 부담 없이, 들으면서 따라 말하는 사이에 600개의 표현이 자연스럽게 자리 잡습니다.",
    audience: "프랑스어 입문 · 파리 여행 · 유학 · 일상 회화 준비자",
    color: "#E8F0FE",
    cover: "/assets/web/30daysinparis-cover.webp",
    coverSize: [420, 594],
    formValue: "30 Days in Paris",
    price: 20000,
    pickLabel: "PDF · 노션 필요 없음",
    featured: "#featured30Days",
    previewPages: [
      "/assets/preview-pages/paris-preview-01.jpg",
      "/assets/preview-pages/paris-preview-02.jpg",
      "/assets/preview-pages/paris-preview-03.jpg",
      "/assets/preview-pages/paris-preview-04.jpg",
      "/assets/preview-pages/paris-preview-05.jpg",
      "/assets/preview-pages/paris-preview-06.jpg",
      "/assets/preview-pages/paris-preview-07.jpg",
      "/assets/preview-pages/paris-preview-08.jpg",
      "/assets/preview-pages/paris-preview-09.jpg",
      "/assets/preview-pages/paris-preview-10.jpg",
    ],
  },
  {
    id: 6,
    slug: "verbs-100",
    lang: "fr",
    status: "판매중",
    title: "프랑스어 필수 동사 100",
    category: "PDF 책 · 노션 필요 없음 · 빈도순 필수 동사",
    description:
      "가장 많이 사용하는 프랑스어 동사 100개를 빈도순으로. 주요 동사 변화표와 예문 300개를 수록한 핵심 동사 학습서. être · avoir · aller · faire 부터 시작합니다.",
    audience: "프랑스어 입문 ~ 초중급 · 동사 활용을 빠르게 익히고 싶은 분",
    color: "#f5f0e8",
    cover: "/assets/web/verbs-100-cover.webp",
    coverSize: [420, 595],
    formValue: "프랑스어 필수동사 100",
    price: 9000,
    pickLabel: "PDF · 노션 필요 없음",
    previewPages: [
      "/assets/preview-pages/verbs-100-preview-01.png",
      "/assets/preview-pages/verbs-100-preview-02.png",
      "/assets/preview-pages/verbs-100-preview-03.png",
    ],
  },
];
