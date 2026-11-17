// /api/pay/prepare
//   GET  — 결제 화면이 처음 열릴 때 묻는 공개 설정(준비 여부, 테스트 여부, 켜진 결제 수단). 열쇠는 주지 않는다.
//   POST — 결제창을 띄우기 전에 서버가 주문 번호와 금액을 정해 준다.
//          금액은 브라우저가 보낸 값이 아니라 books-data.js의 책값으로 서버가 정한다.
const { findBook, makePaymentId, priceOf } = require("../_lib/catalog");
const { QUESTIONS, REQUIRED, cleanAnswers } = require("../_lib/orderform");
const { env, ready, sign } = require("../_lib/portone");
const { EMAIL } = require("../_lib/fulfill");

// 받침에 맞춰 '을/를'(성별을, 나이대를)
const eulReul = (word) => {
  const code = String(word).charCodeAt(String(word).length - 1) - 0xac00;
  return code >= 0 && code <= 11171 && code % 28 !== 0 ? `${word}을` : `${word}를`;
};

module.exports = async (req, res) => {
  res.setHeader("Cache-Control", "no-store");
  const e = env();
  const methods = ["CARD", ...e.easy];
  // 질문 목록도 서버가 준다(주문서와 같은 선택지를 한 곳에서)
  if (req.method === "GET") return res.status(200).json({ ok: true, ready: ready(), mode: e.mode, methods, questions: QUESTIONS.map((q) => ({ ...q, required: REQUIRED.includes(q.key) })) });
  if (req.method !== "POST") return res.status(405).json({ ok: false, message: "GET·POST만 받아요." });

  const body = req.body && typeof req.body === "object" ? req.body : {};
  const book = findBook(String(body.slug || ""));
  if (!book) return res.status(400).json({ ok: false, field: "slug", message: "책을 골라 주세요." });

  const name = String(body.name || "").trim();
  const email = String(body.email || "").trim();
  if (!name || name.length > 40) return res.status(400).json({ ok: false, field: "name", message: "이름을 적어 주세요." });
  if (!EMAIL.test(email) || email.length > 120) return res.status(400).json({ ok: false, field: "email", message: "이메일 주소를 확인해 주세요." });

  const { answers, missing } = cleanAnswers(body.answers);
  if (missing.length) {
    const q = QUESTIONS.find((x) => x.key === missing[0]);
    return res.status(400).json({ ok: false, field: missing[0], message: `${eulReul(q.label)} 골라 주세요.` });
  }

  // 이전 판 구매자 할인: 그 책에 할인이 있을 때만. 확인할 수 있게 이전 판을 살 때 쓴 이메일이나 입금자명을 받는다
  const upgrade = body.upgrade === true && Boolean(book.upgrade && Number.isInteger(book.upgrade.price));
  const proof = upgrade ? String(body.proof || "").trim() : "";
  if (upgrade && (!proof || proof.length > 120)) return res.status(400).json({ ok: false, field: "proof", message: `${book.upgrade.from}을 살 때 쓴 이메일이나 입금자명을 적어 주세요.` });

  // 청약철회 제한 확인과 약관 동의는 손님이 직접 체크해야 한다(화면에서 미리 체크해 두지 않고, 서버도 다시 본다)
  if (body.agreeRefund !== true) return res.status(400).json({ ok: false, field: "agreeRefund", message: "디지털 콘텐츠 환불 안내를 확인해 주세요." });
  if (body.agreeTerms !== true) return res.status(400).json({ ok: false, field: "agreeTerms", message: "이용약관에 동의해 주세요." });

  const method = methods.includes(body.method) ? body.method : "CARD";
  if (!ready()) return res.status(503).json({ ok: false, ready: false, mode: e.mode, message: "카드 결제는 준비 중이에요." });

  const paymentId = makePaymentId(book.slug, { upgrade });
  const amount = priceOf(book, upgrade);
  return res.status(200).json({
    ok: true,
    ready: true,
    mode: e.mode,
    storeId: e.storeId,
    channelKey: e.channelKey,
    paymentId,
    orderName: book.title,
    totalAmount: amount,
    currency: "KRW",
    payMethod: method === "CARD" ? "CARD" : "EASY_PAY",
    ...(method === "CARD" ? {} : { easyPay: { easyPayProvider: method } }),
    customer: { fullName: name, email },
    // amount·sig: 지금 책값을 서버가 서명해 둔다(결제창을 열어 둔 사이 가격이 바뀌어도 2시간 안에는 이 값으로 받음)
    customData: { slug: book.slug, name, email, news: body.news === true, agreedAt: new Date().toISOString(), q: answers, ...(upgrade ? { upgrade: true, proof } : {}), amount, sig: sign(`amount:${paymentId}:${amount}`) },
    // 완료 화면을 이 브라우저만 자세히 볼 수 있게 하는 확인값
    viewToken: sign(`view:${paymentId}`),
  });
};
