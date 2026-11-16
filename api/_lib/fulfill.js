// 결제 확인의 한가운데: 포트원에 다시 물어 금액·상태를 대조하고, 맞을 때만 안내 메일을 보낸다.
// 결제 완료 화면(/api/pay/complete)과 웹훅(/api/pay/webhook)이 같은 길을 쓴다.
const { bookOfPaymentId } = require("./catalog");
const { env, getPayment } = require("./portone");
const { sendOrderMails } = require("./mail");

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

function parseCustomData(value) {
  if (!value) return {};
  if (typeof value === "object") return value;
  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

// 돌려주는 값: { ok: true, order, mail } 또는 { ok: false, code, message }
async function verifyAndFulfill(paymentId) {
  const book = bookOfPaymentId(paymentId);
  if (!book) return { ok: false, code: "UNKNOWN_ORDER", message: "주문 번호를 확인할 수 없어요." };

  const payment = await getPayment(paymentId);
  if (!payment) return { ok: false, code: "NOT_FOUND", message: "결제 기록을 찾지 못했어요." };

  const e = env();
  if (payment.storeId && payment.storeId !== e.storeId) return { ok: false, code: "WRONG_STORE", message: "결제 기록을 확인할 수 없어요." };
  if (payment.status !== "PAID") return { ok: false, code: "NOT_PAID", status: payment.status, message: "결제가 아직 끝나지 않았어요." };

  // 테스트 기간에는 테스트 채널 결제만, 실결제를 연 뒤에는 실결제 채널만 받는다(섞이지 않게)
  const channelType = payment.channel && payment.channel.type;
  if (e.mode === "test" && channelType !== "TEST") return { ok: false, code: "LIVE_BLOCKED", message: "지금은 테스트 결제만 받고 있어요." };
  if (e.mode === "live" && channelType !== "LIVE") return { ok: false, code: "TEST_BLOCKED", message: "테스트 결제는 주문으로 처리하지 않아요." };

  const total = payment.amount && payment.amount.total;
  if (payment.currency && payment.currency !== "KRW") return { ok: false, code: "WRONG_CURRENCY", message: "결제 금액을 확인할 수 없어요." };
  if (total !== book.price) return { ok: false, code: "AMOUNT_MISMATCH", paid: total, expected: book.price, message: "결제 금액이 책값과 달라요. 서점에서 확인 뒤 연락드릴게요." };

  const custom = parseCustomData(payment.customData);
  const customer = payment.customer || {};
  const email = String(customer.email || custom.email || "").trim();
  if (!EMAIL.test(email)) return { ok: false, code: "NO_EMAIL", message: "받는 이메일을 확인할 수 없어요. 서점에서 확인 뒤 연락드릴게요." };
  const name = String(customer.name || custom.name || "").trim().slice(0, 40);

  const order = {
    paymentId,
    book,
    amount: total,
    email,
    name,
    news: custom.news === true,
    method: (payment.method && (payment.method.type || payment.method.provider)) || "",
    receiptUrl: payment.receiptUrl || "",
    test: channelType === "TEST",
  };
  const mail = await sendOrderMails(order);
  return { ok: true, order, mail };
}

module.exports = { verifyAndFulfill, EMAIL };
