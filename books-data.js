// 한스푼 서점 상품 데이터 — 책 정보·가격·구글폼 선택값은 이 파일 한 곳에서만 고친다.
// 서가, 책 상세, 주문서의 책 카드, 입금 금액, 완료 화면이 모두 여기서 나온다.
//
// 지킬 것
// - formValue: 구글폼 '주문하실 책 이름' 선택지와 한 글자도 달라지면 안 된다(다르면 주문이 조용히 사라짐).
//   새 책은 구글폼에 선택지를 먼저 '추가'한 뒤 여기 넣는다. 기존 선택지는 고치지도 지우지도 않는다.
// - id, slug: 한번 정하면 바꾸지 않는다(서가·책별 주소가 이걸로 찾는다).
// - ?v= 캐시 번호는 배포 때 자동으로 붙으니 손으로 올리지 않아도 된다(tools/build-pages.mjs).
// - 배포 뒤에는 운영 화면에서 바뀐 가격이 보이는지 한 번 확인한다. 데이터가 틀리면 배포가 실패하고 이전 화면이 그대로 남는다.
//
// 칸 설명
//   price       입금 금액(원). 없으면 주문서에 나오지 않는다(출시 예정 책).
//   priceText   책 상세의 가격 줄을 따로 쓸 때만(예: 출시 기념가). 없으면 price로 쓴다.
//   listPrice   정가. price(지금 받는 금액)보다 크면 정가에 취소선을 긋고 price를 함께 보인다(미리 구매가 등).
//   priceNote   가격 아래 작은 글(예: "11월 30일까지 미리 구매가"). 입금 금액 아래 안내에도 나온다.
//   priceUntil  지금 가격이 끝나는 날 "2026-11-30". 검색엔진 상품 정보에 들어가고, 지나면 배포 때 주의가 뜬다
//               (그날이 지나면 price를 정가로 바꾸고 listPrice·priceNote·priceUntil을 지운다).
//   deliveryNote 받는 방법 아래와 주문 완료 화면에 함께 나오는 발송 안내(예: 미리 구매 발송 일정).
//   previewWide 미리보기 그림이 가로로 긴 책(다이어리 등)이면 true — 미리보기 창의 칸도 가로로 보인다.
//   banner      서가 '책 고르기' 바로 아래 띠 { tag: "NOUVEAU", kind: "굿노트 다이어리", free: { label, href } }.
//               가격은 price·listPrice·priceNote를 그대로 쓴다. 판매 중인 책 하나에만 두고, 빼면 띠가 사라진다(그 책 페이지에서는 숨김).
//   listenPreview 다이어리 '듣기는 이렇게 연결돼요' 아래 미리 듣기 버튼 { from, to, label, note }. 배포 빌드가 /listen/에서
//               from~to 문장만 담은 /listen-preview/를 만든다(그 밖의 달로는 넘어가지 않음). 달을 바꿀 땐 이 네 칸만 고친다.
//   badge       출시 예정 책의 서가 카드에 표시할 파스텔 배지 문구. 없으면 "출시 예정".
//   upgrade     이전 판 구매자 할인 { from: "2.0", price: 15000 } — 입금 안내와 메모 칸 안내에 쓰인다.
//   pickLabel   주문서 책 카드의 작은 글. 뒤에 " · 가격"이 붙는다.
//   lang        서가 카드의 언어 칩: "fr" 프랑스어 · "es" 스페인어 · "en" 영어 · "ko" 한국어
//   status      "판매중" · "출시예정"(주문서 대신 출시 알림) · "판매중지"(서가·주문서에서 빠지고, 책 주소는 열리되
//               주문 버튼 자리에 pausedText만 뜬다. 데이터·표지는 그대로 두고 "판매중"으로 되돌리면 다시 팔린다).
//   pausedText  판매중지 책의 짧은 안내. 없으면 "개정판 준비 중이에요".
//   slug        책별 주소 /books/<slug>/ (영어 소문자·숫자·-만). 배포할 때 tools/build-pages.mjs가 페이지를 만든다.
//   format      "notion"(노션 교재) · "pdf"(PDF 책) · "goodnotes"(굿노트 다이어리). 책 소개의 '종류'와 '받는 방법' 줄이 여기서 나온다.
//   shareText   카톡·인스타로 책 주소를 보낼 때 공유 카드에 나오는 한 줄. 가격은 넣지 않는다(카드가 오래 남음).
//   searchTitle 검색 결과에 뜨는 책별 페이지 제목. 뒤에 " | 한스푼 서점"이 붙는다. 없으면 title.
//   reviews     책 소개 아래 후기 칸. 구글폼으로 받은 후기 중 우댕이 고른 것만, 많아야 6개.
//               { stars: 5, text: "후기 글", who: "직장인 김○○", date: "2026.11" } — stars는 1~5 정수, date는 "연.월".
//               비어 있으면 후기 칸이 아예 안 보인다. 별점 평균은 내지 않는다(후기 수가 적어서).

// 책 소개의 '종류'·'받는 방법' 줄 (책마다 format으로 고른다). 화면(script.js)과 배포 빌드가 함께 쓴다.
window.HANSPOON_FORMATS = {
  notion: { label: "노션 교재 · 휴대폰·태블릿·PC", delivery: "입금 확인 후 6시간 안에 노션 가입 이메일로 초대" },
  pdf: { label: "PDF 책 · 노션 필요 없음", delivery: "입금 확인 후 6시간 안에 메일로 PDF" },
  goodnotes: { label: "굿노트 다이어리 · 하이퍼링크 PDF · 아이패드·갤럭시 태블릿", delivery: "입금 확인 후 6시간 안에 메일로 PDF" },
};

window.HANSPOON_BOOKS = [
  {
    id: 5,
    slug: "nofu3",
    format: "notion",
    shareText: "알파벳부터 『어린 왕자』 원문까지, 한 권으로. 휴대폰 노션으로 보는 프랑스어 입문서",
    lang: "fr",
    status: "판매중",
    title: "나의 첫 프랑스어 책 3.0",
    searchTitle: "나의 첫 프랑스어 책 3.0 · 프랑스어 입문 노션 교재",
    category: "프랑스어 입문 · 노션 기반 종합 교재",
    description:
      "알파벳부터 『어린 왕자』 원문까지, 한 권으로. 발음 · 문법 · 어휘 · 회화 · 동사 변화 · 읽기 6영역, 프랑스어 음성 900개 이상. 휴대폰 노션으로 바로 보는 프랑스어 입문서 (A1~B1).",
    descriptionHtml:
      '<strong class="lede-head">알파벳부터 『어린 왕자』 원문까지, 한 권으로.</strong><br>발음 · 문법 · 어휘 · 회화 · 동사 변화 · 읽기 6영역<br>프랑스어 음성 900개 이상 · 휴대폰 노션으로 바로',
    audience: "한국어로 프랑스어를 처음 시작하는 입문자 (A1~B1)",
    reviews: [],
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
    id: 8,
    slug: "diary-2027",
    format: "goodnotes",
    shareText: "하루하루 쓰는 다이어리 안에서 프랑스어 한 문장을 만나고, 듣고, 써 보는 굿노트 다이어리",
    lang: "fr",
    status: "판매중",
    title: "한스푼 다이어리 2027",
    searchTitle: "한스푼 다이어리 2027 · 프랑스어 굿노트 다이어리",
    category: "굿노트 다이어리 · 하이퍼링크 PDF · 프랑스어 · 아이패드·갤럭시 태블릿",
    description: "하루하루 쓰는 다이어리 안에서 프랑스어 한 문장을 만나고, 듣고, 써 보는 굿노트 다이어리.",
    audience: "프랑스어를 시작했는데 따로 공부할 시간을 내기 어려운 분 · 굿노트로 다이어리를 쓰고 꾸미는 걸 좋아하는 분 · 하루에 한 문장씩 꾸준히 쌓고 싶은 분",
    reviews: [],
    color: "#f6f1e8",
    cover: "/assets/web/diary-2027-cover.webp",
    coverSize: [840, 1192],
    formValue: "한스푼 다이어리 2027",
    price: 9900,
    listPrice: 12000,
    priceNote: "11월 30일까지 미리 구매가",
    priceUntil: "2026-11-30",
    deliveryNote: "입금 확인 후 「미리 쓰는 두 달」과 2027판(날짜판 + 날짜 없는 판)을 함께 보내 드려요.",
    pickLabel: "굿노트 다이어리 PDF",
    banner: { tag: "NOUVEAU", kind: "굿노트 다이어리", free: { label: "11·12월판 무료로 먼저 받기", href: "/free/hanspoon-diary-2026-novdec.pdf" } },
    listenPreview: { from: "2026-11-01", to: "2026-11-30", label: "11월 문장 미리 들어 보기", note: "2026년 11월 문장을 니꼴라 목소리로 미리 들어 볼 수 있어요." },
    featured: "#featuredDiary",
    previewWide: true,
    previewPages: [
      "/assets/preview-pages/diary-2027-preview-01.jpg",
      "/assets/preview-pages/diary-2027-preview-02.jpg",
      "/assets/preview-pages/diary-2027-preview-03.jpg",
      "/assets/preview-pages/diary-2027-preview-04.jpg",
      "/assets/preview-pages/diary-2027-preview-05.jpg",
      "/assets/preview-pages/diary-2027-preview-06.jpg",
    ],
  },
  {
    id: 7,
    slug: "firstspanish",
    format: "notion",
    shareText: "알파벳부터 『어린 왕자』까지, 라틴아메리카 스페인어를 한 권으로.",
    lang: "es",
    status: "출시예정",
    title: "나의 첫 스페인어 책 1.0",
    searchTitle: "나의 첫 스페인어 책 1.0 · 스페인어 입문 노션 교재",
    category: "스페인어 입문 · 노션 기반 종합 교재",
    description:
      "알파벳부터 『어린 왕자』까지, 라틴아메리카 스페인어를 한 권으로. 발음 · 문법 · 동사 변화 · 회화 · 어휘 · 읽기 6영역, 문법 단원마다 「프랑스어와 비교」. 『어린 왕자』 27장 전체를 이 책만의 스페인어 번역과 음성으로.",
    descriptionHtml:
      '<strong class="lede-head">알파벳부터 『어린 왕자』까지, 라틴아메리카 스페인어를 한 권으로.</strong><br>발음 · 문법 · 동사 변화 · 회화 · 어휘 · 읽기 6영역 · 문법 단원마다 「프랑스어와 비교」<br>『어린 왕자』 27장 전체를 이 책만의 스페인어 번역과 음성으로 · 휴대폰 노션으로 바로',
    audience: "스페인어를 처음 시작하는 분 · 프랑스어를 배운 뒤 두 번째 외국어를 찾는 분 (A1~B2)",
    reviews: [],
    color: "#e9f2fb",
    cover: "/assets/web/firstspanish-1-cover.webp",
    coverSize: [420, 596],
    badge: "11월 중순 출시",
    priceText: "11월 중순 출시 예정입니다. 가격은 출시 때 함께 알려 드릴게요.",
  },
  {
    id: 1,
    slug: "30days-in-paris",
    format: "pdf",
    shareText: "파리에서 보내는 30일, 듣고 따라 말하며 익히는 프랑스어 표현 600개 · PDF 책",
    lang: "fr",
    status: "판매중지", // 2026-11-01 우댕 결정: 판매 0건이라 내리고, 개정판으로 다시 팔 예정
    pausedText: "개정판 준비 중이에요",
    title: "30 Days in Paris",
    category: "PDF 책 · 노션 필요 없음 · 듣고 따라 말하는 어휘책",
    description:
      "30일 동안 파리에 머무는 한 사람의 시점을 따라가며, 카페·시장·사무실·행정 창구에서 실제로 쓰이는 프랑스어를 한 스푼씩 떠먹는 책. 외워야 한다는 부담 없이, 들으면서 따라 말하는 사이에 600개의 표현이 자연스럽게 자리 잡습니다.",
    audience: "프랑스어 입문 · 파리 여행 · 유학 · 일상 회화 준비자",
    reviews: [],
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
    slug: "verbs-100", // 2026-11-01 『필수 동사 150』 개정판으로 바꿈. 옛 주소 유지를 위해 slug는 그대로
    format: "pdf",
    shareText: "가장 많이 쓰는 프랑스어 동사 150개를 빈도순으로 · 예문 600개와 프랑스어 음성 750개 · PDF 책",
    lang: "fr",
    status: "판매중",
    title: "프랑스어 필수 동사 150",
    searchTitle: "프랑스어 필수 동사 150 · PDF 책",
    category: "PDF 책 · 노션 필요 없음 · 빈도순 필수 동사",
    description:
      "프랑스어 영화·드라마 자막에서 가장 많이 쓰는 동사 150개를 빈도순으로. 현재형 6인칭, 과거분사·복합과거, 동사마다 예문 4개(모두 600개)와 프랑스어 음성 750개. 🔊 듣기를 누르거나 QR을 찍으면 휴대폰에서 바로 들을 수 있어요.",
    audience: "프랑스어 입문 ~ 초중급 · 동사 활용을 빠르게 익히고 싶은 분",
    reviews: [],
    color: "#f5f0e8",
    cover: "/assets/web/verbs-150-cover.webp",
    coverSize: [420, 595],
    formValue: "프랑스어 필수 동사 150",
    price: 12000,
    pickLabel: "PDF · 노션 필요 없음",
    previewPages: [
      "/assets/preview-pages/verbs-150-preview-01.png",
      "/assets/preview-pages/verbs-150-preview-02.png",
      "/assets/preview-pages/verbs-150-preview-03.png",
    ],
  },
];
