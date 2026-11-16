// /api/pay/prepare
//   GET  — 결제 화면이 처음 열릴 때 묻는 공개 설정(준비 여부, 테스트 여부, 켜진 결제 수단). 열쇠는 주지 않는다.
//   POST — 결제창을 띄우기 전에 서버가 주문 번호와 금액을 정해 준다.
//          금액은 브라우저가 보낸 값이 아니라 books-data.js의 책값으로 서버가 정한다.
const { findBook, makePaymentId } = require("../_lib/catalog");
const { env, ready, sign } = require("../_lib/portone");
const { EMAIL } = require("../_lib/fulfill");

module.exports = async (req, res) => {
  res.setHeader("Cache-Control", "no-store");
  const e = env();
  const methods = ["CARD", ...e.easy];
  if (req.method === "GET") return res.status(200).json({ ok: true, ready: ready(), mode: e.mode, methods });
  if (req.method !== "POST") return res.status(405).json({ ok: false, message: "GET·POST만 받아요." });

  const body = req.body && typeof req.body === "object" ? req.body : {};
  const book = findBook(String(body.slug || ""));
  if (!book) return res.status(400).json({ ok: false, field: "slug", message: "책을 골라 주세요." });

  const name = String(body.name || "").trim();
  const email = String(body.email || "").trim();
  if (!name || name.length > 40) return res.status(400).json({ ok: false, field: "name", message: "이름을 적어 주세요." });
  if (!EMAIL.test(email) || email.length > 120) return res.status(400).json({ ok: false, field: "email", message: "이메일 주소를 확인해 주세요." });

  // 청약철회 제한 확인과 약관 동의는 손님이 직접 체크해야 한다(화면에서 미리 체크해 두지 않고, 서버도 다시 본다)
  if (body.agreeRefund !== true) return res.status(400).json({ ok: false, field: "agreeRefund", message: "디지털 콘텐츠 환불 안내를 확인해 주세요." });
  if (body.agreeTerms !== true) return res.status(400).json({ ok: false, field: "agreeTerms", message: "이용약관에 동의해 주세요." });

  const method = methods.includes(body.method) ? body.method : "CARD";
  if (!ready()) return res.status(503).json({ ok: false, ready: false, mode: e.mode, message: "카드 결제는 준비 중이에요." });

  const paymentId = makePaymentId(book.slug);
  return res.status(200).json({
    ok: true,
    ready: true,
    mode: e.mode,
    storeId: e.storeId,
    channelKey: e.channelKey,
    paymentId,
    orderName: book.title,
    totalAmount: book.price,
    currency: "KRW",
    payMethod: method === "CARD" ? "CARD" : "EASY_PAY",
    ...(method === "CARD" ? {} : { easyPay: { easyPayProvider: method } }),
    customer: { fullName: name, email },
    // amount·sig: 지금 책값을 서버가 서명해 둔다(결제창을 열어 둔 사이 가격이 바뀌어도 2시간 안에는 이 값으로 받음)
    customData: { slug: book.slug, name, email, news: body.news === true, agreedAt: new Date().toISOString(), amount: book.price, sig: sign(`amount:${paymentId}:${book.price}`) },
    // 완료 화면을 이 브라우저만 자세히 볼 수 있게 하는 확인값
    viewToken: sign(`view:${paymentId}`),
  });
};
