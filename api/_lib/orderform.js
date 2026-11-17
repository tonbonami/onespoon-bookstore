// 카드 주문을 계좌이체 주문서와 같은 구글폼에 한 줄로 남긴다 → '한스푼 주문 처리' 시트가 주문 기록 원본(5년 보관, 결정함 d07).
// 질문·선택지·폼 주소는 books/index.html 주문서와 한 글자도 달라지면 안 된다(다르면 구글폼이 그 주문을 받지 않는다).
// tools/pay-test.mjs가 주문서와 대조한다. 구글폼은 선택지 '추가'만 하고, 기존 선택지는 고치지도 지우지도 않는다.
const FORM_ACTION = "https://docs.google.com/forms/d/e/1FAIpQLSdETXW6feUq4w9xeZ7Ep1Ie25HNOVzS6WYr9TAe-HtsJVxnig/formResponse";

const ENTRY = {
  book: "entry.1833963440",
  name: "entry.133598618",
  gender: "entry.1450577507",
  age: "entry.272771426",
  email: "entry.1769994956",
  channel: "entry.219325845",
  level: "entry.260030586",
  device: "entry.614950738",
  memo: "entry.4057543",
  news: "entry.1055582079",
};

// 주문서와 같은 질문(라벨은 결제 화면에 그대로 쓴다)
const QUESTIONS = [
  { key: "gender", label: "성별", kind: "pills", choices: ["남자", "여자"] },
  { key: "age", label: "나이대", kind: "pills", choices: ["중학생", "고등학생", "대학생", "직장인"] },
  { key: "channel", label: "알게 된 매체", kind: "select", choices: ["YouTube", "Instagram", "네이버 블로그", "네이버 검색", "구글 검색", "지인 소개", "기타"] },
  { key: "level", label: "현재 프랑스어 수준", kind: "select", choices: ["프랑스어 이제 막 시작", "프랑스어 발음은 가능", "프랑스어 문법 공부한 적 있음", "프랑스어 회화도 가능", "프랑스어의 달인"] },
  { key: "device", label: "주로 사용할 기기", kind: "select", choices: ["아이폰", "안드로이드 폰", "아이패드", "안드로이드 태블릿", "PC", "기타"] },
];

// 구글폼에서 필수인 질문. 비우면 구글폼이 주문을 거절하므로 결제 화면에서도 필수로 받는다.
// 우댕이 구글폼에서 성별·나이대의 '필수'를 끄면 여기서 빼면 된다(결정함 d06: 선택 항목으로).
const REQUIRED = ["gender", "age", "channel", "level", "device"];

const NEWS_VALUE = "프랑스어 한스푼의 새 책·무료 자료 소식을 이메일로 받을게요";

// 손님이 보낸 답에서 주문서 선택지에 있는 값만 남긴다. 빠진 필수 질문의 key를 함께 돌려준다.
function cleanAnswers(input) {
  const src = input && typeof input === "object" ? input : {};
  const answers = {};
  for (const q of QUESTIONS) if (q.choices.includes(src[q.key])) answers[q.key] = src[q.key];
  const missing = REQUIRED.filter((key) => !answers[key]);
  return { answers, missing };
}

// 시트에 남길지: ORDER_LOG=on/off. 정하지 않으면 실결제만 남기고 테스트 결제는 남기지 않는다(진짜 주문과 섞이지 않게)
function logEnabled(mode) {
  const v = String(process.env.ORDER_LOG || "").toLowerCase();
  if (v === "on") return true;
  if (v === "off") return false;
  return mode === "live";
}

function memoOf(order) {
  const won = `${Number(order.amount).toLocaleString("ko-KR")}원`;
  return [
    order.test ? "[테스트 결제 · 교재 보내지 않음]" : "[카드 결제 완료]",
    `주문 번호 ${order.paymentId}`,
    won,
    order.method || "",
    order.upgrade ? `${order.book.upgrade.from} 구매자 할인 — 확인할 것: ${order.proof || "적지 않음"}` : "",
  ]
    .filter(Boolean)
    .join(" · ");
}

async function recordOrder(order) {
  const a = order.answers || {};
  const missing = REQUIRED.filter((key) => !a[key]);
  if (missing.length) return { recorded: false, reason: `주문서 필수 답 없음(${missing.join(",")})` };
  const body = new URLSearchParams();
  body.set(ENTRY.book, order.book.formValue);
  body.set(ENTRY.name, order.name || "이름 없음");
  body.set(ENTRY.email, order.email);
  for (const q of QUESTIONS) if (a[q.key]) body.set(ENTRY[q.key], a[q.key]);
  body.set(ENTRY.memo, memoOf(order));
  if (order.news) body.set(ENTRY.news, NEWS_VALUE);
  body.set("fvv", "1");
  body.set("pageHistory", "0");
  const response = await fetch(process.env.ORDER_FORM_ACTION || FORM_ACTION, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
    redirect: "manual",
  });
  // 구글폼은 받으면 200(또는 확인 화면으로 넘김)을 준다
  if (response.status >= 200 && response.status < 400) return { recorded: true };
  return { recorded: false, reason: `주문서 기록 실패 (${response.status})` };
}

module.exports = { FORM_ACTION, ENTRY, QUESTIONS, REQUIRED, NEWS_VALUE, cleanAnswers, logEnabled, memoOf, recordOrder };
