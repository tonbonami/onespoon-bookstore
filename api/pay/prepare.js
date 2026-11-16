// POST /api/pay/prepare — 결제창을 띄우기 전에 서버가 주문 번호와 금액을 정해 준다.
// 금액은 브라우저가 보낸 값이 아니라 books-data.js의 책값으로 서버가 정한다.
const { findBook, makePaymentId } = require("../_lib/catalog");
const { env, ready } = require("../_lib/portone");
const { EMAIL } = require("../_lib/fulfill");

module.exports = async (req, res) => {
  res.setHeader("Cache-Control", "no-store");
  if (req.method !== "POST") return res.status(405).json({ ok: false, message: "POST만 받아요." });

  const body = req.body && typeof req.body === "object" ? req.body : {};
  const book = findBook(String(body.slug || ""));
  if (!book) return res.status(400).json({ ok: false, field: "slug", message: "책을 골라 주세요." });

  const name = String(body.name || "").trim();
  const email = String(body.email || "").trim();
  if (!name || name.length > 40) return res.status(400).json({ ok: false, field: "name", message: "이름을 적어 주세요." });
  if (!EMAIL.test(email) || email.length > 120) return res.status(400).json({ ok: false, field: "email", message: "이메일 주소를 확인해 주세요." });

  // 청약철회 제한 확인과 약관 동의는 손님이 직접 체크해야 한다(화면에서 미리 체크해 두지 않고, 서버도 다시 본다)
  if (body.agreeRefund !== true) return res.status(400).json({ ok: false, field: "agreeRefund", message: "디지털 콘텐츠 환불 안내를 확인해 주세요." });
  if (body.agreeTerms !== true) return res.status(400).json({ ok: false, field: "agreeTerms", message: "이용약관과 개인정보 수집에 동의해 주세요." });

  const e = env();
  if (!ready()) return res.status(503).json({ ok: false, ready: false, mode: e.mode, message: "카드 결제는 준비 중이에요." });

  return res.status(200).json({
    ok: true,
    ready: true,
    mode: e.mode,
    storeId: e.storeId,
    channelKey: e.channelKey,
    paymentId: makePaymentId(book.slug),
    orderName: book.title,
    totalAmount: book.price,
    currency: "CURRENCY_KRW",
    customer: { fullName: name, email },
    customData: { slug: book.slug, name, email, news: body.news === true, agreedAt: new Date().toISOString() },
  });
};
