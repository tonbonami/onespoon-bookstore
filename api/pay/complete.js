// POST /api/pay/complete — 결제창이 닫힌 뒤 브라우저가 부른다.
// 브라우저의 "성공" 신호는 믿지 않고, 포트원 서버에 금액·상태를 다시 확인한 뒤에만 완료로 답한다.
// 주문 번호만으로는 남의 이메일·영수증을 볼 수 없다: 주문을 준비한 브라우저가 받은 확인값(token)이 맞을 때만 자세히 답한다.
const { verifyAndFulfill } = require("../_lib/fulfill");
const { ready, sameSign } = require("../_lib/portone");
const { FORMATS } = require("../_lib/catalog");

// de***@example.com 처럼 가린다
const maskEmail = (email) => email.replace(/^(.{0,2})[^@]*(@.*)$/, (_, head, tail) => `${head}***${tail}`);

module.exports = async (req, res) => {
  res.setHeader("Cache-Control", "no-store");
  if (req.method !== "POST") return res.status(405).json({ ok: false, message: "POST만 받아요." });
  if (!ready()) return res.status(503).json({ ok: false, ready: false, message: "카드 결제는 준비 중이에요." });

  const body = req.body && typeof req.body === "object" ? req.body : {};
  const paymentId = String(body.paymentId || "");
  if (!paymentId || paymentId.length > 64) return res.status(400).json({ ok: false, message: "주문 번호가 없어요." });

  try {
    const result = await verifyAndFulfill(paymentId);
    if (!result.ok) {
      console.warn("[pay/complete] 확인 실패", paymentId, result.code, result.status || "", result.paid ?? "", result.expected ?? "");
      return res.status(result.code === "NOT_PAID" ? 409 : 400).json({ ok: false, code: result.code, message: result.message });
    }
    const { order, mail, stale } = result;
    if (!stale && (!mail.buyer.sent || !mail.admin.sent)) console.warn("[pay/complete] 메일 미발송", paymentId, mail.buyer.reason || "", mail.admin.reason || "");
    const mine = sameSign(body.token, `view:${paymentId}`);
    return res.status(200).json({
      ok: true,
      test: order.test,
      paymentId,
      title: order.book.title,
      amount: order.amount,
      email: mine ? order.email : maskEmail(order.email),
      format: order.book.format,
      formatLabel: (FORMATS[order.book.format] || {}).label || "",
      deliveryNote: order.book.deliveryNote || "",
      receiptUrl: mine ? order.receiptUrl : "",
      mailSent: mail.buyer.sent || stale === true,
    });
  } catch (error) {
    console.error("[pay/complete] 오류", paymentId, error.message);
    return res.status(502).json({ ok: false, code: "CHECK_FAILED", message: "결제 확인이 늦어지고 있어요. 잠시 뒤 다시 확인해 주세요." });
  }
};
