// 결제 확인의 한가운데: 포트원에 다시 물어 금액·상태를 대조하고, 맞을 때만 안내 메일을 보낸다.
// 결제 완료 화면(/api/pay/complete)과 웹훅(/api/pay/webhook)이 같은 길을 쓴다.
const { orderOfPaymentId, priceOf, createdAtOf } = require("./catalog");
const { cleanAnswers } = require("./orderform");
const { env, getPayment, sameSign } = require("./portone");
const { sendOrderMails } = require("./mail");

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const HOUR = 3600 * 1000;
// 주문을 준비한 때의 책값을 인정해 주는 시간. 결제창을 열어 둔 사이 가격이 바뀌어도 이 안에 결제하면 준비한 때 값으로 받는다.
const PRICE_HOLD = 2 * HOUR;
// 결제한 지 이만큼 지난 건은 안내 메일을 다시 보내지 않는다(메일 업체의 중복 방지가 하루뿐이라, 오래된 주문 번호로 메일을 다시 쏘는 것을 막음)
const MAIL_WINDOW = 12 * HOUR;

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

// 포트원이 돌려주는 구매자 이름은 글자일 수도, { full } 또는 { separated: { first, last } } 꼴일 수도 있다
function nameOf(value) {
  if (!value) return "";
  if (typeof value === "string") return value;
  if (typeof value === "object") {
    if (typeof value.full === "string") return value.full;
    const s = value.separated || value;
    if (s && (s.last || s.first)) return `${s.last || ""}${s.first || ""}`;
  }
  return "";
}

// 받아야 할 금액: 주문을 준비할 때 서버가 서명해 둔 값이 있고 아직 2시간이 안 지났으면 그 값, 아니면 지금 값(할인 주문은 할인가)
function expectedAmount(paymentId, book, upgrade, custom, now) {
  const pinned = custom.amount;
  const fresh = now - createdAtOf(paymentId) < PRICE_HOLD;
  if (fresh && Number.isInteger(pinned) && pinned > 0 && sameSign(custom.sig, `amount:${paymentId}:${pinned}`)) return pinned;
  return priceOf(book, upgrade);
}

function methodLabel(method) {
  const type = (method && method.type) || "";
  if (/EasyPay/i.test(type)) return "간편결제";
  if (/Card/i.test(type)) return "카드";
  if (/Transfer/i.test(type)) return "계좌이체";
  return "";
}

// 돌려주는 값: { ok: true, order, mail } 또는 { ok: false, code, message }
async function verifyAndFulfill(paymentId, now = Date.now()) {
  const ordered = orderOfPaymentId(paymentId);
  if (!ordered) return { ok: false, code: "UNKNOWN_ORDER", message: "주문 번호를 확인할 수 없어요." };
  const { book, upgrade } = ordered;

  const payment = await getPayment(paymentId);
  if (!payment) return { ok: false, code: "NOT_FOUND", message: "결제 기록을 찾지 못했어요." };

  const e = env();
  if (payment.storeId && payment.storeId !== e.storeId) return { ok: false, code: "WRONG_STORE", message: "결제 기록을 확인할 수 없어요." };
  if (payment.status !== "PAID") return { ok: false, code: "NOT_PAID", status: payment.status, message: "결제가 아직 끝나지 않았어요." };

  // 테스트 기간에는 테스트 채널 결제만, 실결제를 연 뒤에는 실결제 채널만 받는다(섞이지 않게)
  const channelType = payment.channel && payment.channel.type;
  if (e.mode === "test" && channelType !== "TEST") return { ok: false, code: "LIVE_BLOCKED", message: "지금은 테스트 결제만 받고 있어요." };
  if (e.mode === "live" && channelType !== "LIVE") return { ok: false, code: "TEST_BLOCKED", message: "테스트 결제는 주문으로 처리하지 않아요." };

  const custom = parseCustomData(payment.customData);
  const total = payment.amount && payment.amount.total;
  const expected = expectedAmount(paymentId, book, upgrade, custom, now);
  if (payment.currency && payment.currency !== "KRW") return { ok: false, code: "WRONG_CURRENCY", message: "결제 금액을 확인할 수 없어요." };
  if (total !== expected) return { ok: false, code: "AMOUNT_MISMATCH", paid: total, expected, message: "결제 금액이 책값과 달라요. 서점에서 확인 뒤 연락드릴게요." };

  const customer = payment.customer || {};
  const email = String(customer.email || custom.email || "").trim();
  if (!EMAIL.test(email)) return { ok: false, code: "NO_EMAIL", message: "받는 이메일을 확인할 수 없어요. 서점에서 확인 뒤 연락드릴게요." };
  const name = String(nameOf(customer.name) || custom.name || "").trim().slice(0, 40);

  const order = {
    paymentId,
    book,
    amount: total,
    email,
    name,
    news: custom.news === true,
    upgrade,
    proof: upgrade ? String(custom.proof || "").slice(0, 120) : "",
    answers: cleanAnswers(custom.q).answers,
    method: methodLabel(payment.method),
    receiptUrl: /^https:\/\//.test(payment.receiptUrl || "") ? payment.receiptUrl : "",
    paidAt: payment.paidAt || "",
    test: channelType === "TEST",
  };
  const paidAt = Date.parse(payment.paidAt || "");
  if (Number.isFinite(paidAt) && now - paidAt > MAIL_WINDOW) {
    const old = { sent: false, reason: "오래된 결제" };
    return { ok: true, order, mail: { buyer: old, admin: old }, stale: true };
  }
  const mail = await sendOrderMails(order);
  return { ok: true, order, mail, stale: false };
}

module.exports = { verifyAndFulfill, EMAIL };
