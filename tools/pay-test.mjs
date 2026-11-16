// 카드 결제 서버(api/pay/*) 자동 시험 — 실제 포트원·메일 업체에는 아무것도 보내지 않는다.
//   node tools/pay-test.mjs
// 이 컴퓨터 안에 가짜 포트원·가짜 메일 서버를 세우고, 금액 위조·미결제·서명 위조 같은 경우를 막는지 본다.
import http from "node:http";
import crypto from "node:crypto";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const payments = new Map(); // 가짜 포트원이 돌려줄 결제
const mails = []; // 가짜 메일 서버가 받은 메일

const fake = http.createServer((req, res) => {
  let body = "";
  req.on("data", (c) => (body += c));
  req.on("end", () => {
    const send = (code, data) => (res.writeHead(code, { "Content-Type": "application/json" }), res.end(JSON.stringify(data)));
    if (req.url.startsWith("/payments/")) {
      if (req.headers.authorization !== "PortOne secret-test") return send(401, {});
      const payment = payments.get(decodeURIComponent(req.url.slice("/payments/".length)));
      return payment ? send(200, payment) : send(404, { type: "PAYMENT_NOT_FOUND" });
    }
    if (req.url === "/emails") {
      mails.push({ key: req.headers["idempotency-key"], ...JSON.parse(body) });
      return send(200, { id: "mail" });
    }
    send(404, {});
  });
});
await new Promise((r) => fake.listen(0, "127.0.0.1", r));
const base = `http://127.0.0.1:${fake.address().port}`;

const WEBHOOK_SECRET = `whsec_${Buffer.from("webhook-test-key").toString("base64")}`;
const setEnv = (on) => {
  const values = { PORTONE_STORE_ID: "store-test", PORTONE_CHANNEL_KEY: "channel-key-test", PORTONE_API_SECRET: "secret-test", PORTONE_WEBHOOK_SECRET: WEBHOOK_SECRET, PORTONE_API_BASE: base, RESEND_API_KEY: "re_test", RESEND_API_BASE: base, MAIL_FROM: "서점 <orders@example.com>", MAIL_ADMIN: "admin@example.com" };
  for (const [k, v] of Object.entries(values)) on ? (process.env[k] = v) : delete process.env[k];
  delete process.env.PAY_MODE;
};

const prepare = require("../api/pay/prepare.js");
const complete = require("../api/pay/complete.js");
const webhook = require("../api/pay/webhook.js");
const { findBook } = require("../api/_lib/catalog.js");

async function call(handler, { method = "POST", body, headers = {}, rawBody } = {}) {
  const res = { code: 200, data: null, setHeader() {}, status(c) { this.code = c; return this; }, json(d) { this.data = d; return this; } };
  const req = { method, body, headers, rawBody, async *[Symbol.asyncIterator]() {} };
  await handler(req, res);
  return res;
}

let failed = 0;
const check = (name, ok, detail = "") => {
  if (!ok) failed += 1;
  console.log(`${ok ? "✓" : "✗"} ${name}${ok || !detail ? "" : ` — ${detail}`}`);
};
const quiet = async (fn) => {
  const { warn, error } = console;
  console.warn = console.error = () => {};
  try { return await fn(); } finally { console.warn = warn; console.error = error; }
};

const book = findBook("nofu3");
const good = { slug: "nofu3", name: "김시험", email: "buyer@example.com", agreeRefund: true, agreeTerms: true, news: true };
const paid = (id, over = {}) => ({ id, storeId: "store-test", status: "PAID", currency: "KRW", amount: { total: book.price }, channel: { type: "TEST" }, customer: { email: "buyer@example.com", name: "김시험" }, customData: JSON.stringify({ news: true }), receiptUrl: "https://example.com/receipt", method: { type: "PaymentMethodCard" }, ...over });

// ── 준비(prepare)
setEnv(false);
let r = await call(prepare, { body: good });
check("열쇠가 없으면 '준비 중'(503)으로 답한다", r.code === 503 && r.data.ready === false);
setEnv(true);
r = await call(prepare, { body: { ...good, agreeRefund: false } });
check("청약철회 제한 확인을 체크하지 않으면 막는다", r.code === 400 && r.data.field === "agreeRefund");
r = await call(prepare, { body: { ...good, agreeTerms: "true" } });
check("약관 동의는 true 값만 인정한다", r.code === 400 && r.data.field === "agreeTerms");
r = await call(prepare, { body: { ...good, slug: "없는책" } });
check("없는 책은 막는다", r.code === 400 && r.data.field === "slug");
r = await call(prepare, { body: { ...good, email: "주소아님" } });
check("이메일 꼴이 아니면 막는다", r.code === 400 && r.data.field === "email");
r = await call(prepare, { body: { ...good, totalAmount: 100, price: 100 } });
check("금액은 서버가 책값으로 정한다(브라우저가 보낸 금액 무시)", r.code === 200 && r.data.totalAmount === book.price && /^hs-nofu3-[a-z0-9]+-[a-f0-9]{8}$/.test(r.data.paymentId), JSON.stringify(r.data));
r = await call(prepare, { method: "GET" });
check("GET은 받지 않는다", r.code === 405);
const paymentId = (await call(prepare, { body: good })).data.paymentId;

// ── 완료(complete)
payments.set(paymentId, paid(paymentId));
r = await call(complete, { body: { paymentId } });
check("정상 결제는 완료로 답한다", r.code === 200 && r.data.ok && r.data.amount === book.price && r.data.test === true, JSON.stringify(r.data));
check("구매자·서점에 한 통씩 메일이 나간다", mails.length === 2 && mails[0].to[0] === "buyer@example.com" && mails[1].to[0] === "admin@example.com");
check("노션 교재 메일에 '6시간 안 초대' 안내가 있다", /6시간 안에 buyer@example\.com 주소로 노션 초대/.test(mails[0]?.text || ""));
check("테스트 결제 메일 제목에 [테스트]가 붙는다", (mails[0]?.subject || "").startsWith("[테스트]"));
await call(complete, { body: { paymentId } });
check("같은 결제로 다시 불려도 멱등 키가 같다(메일 업체가 한 통만 보냄)", mails.length === 4 && mails[2].key === mails[0].key && mails[3].key === mails[1].key && mails[0].key === `buyer-${paymentId}`);

const before = mails.length;
const cheap = (await call(prepare, { body: good })).data.paymentId;
payments.set(cheap, paid(cheap, { amount: { total: 100 } }));
r = await quiet(() => call(complete, { body: { paymentId: cheap } }));
check("금액이 책값과 다르면 막고 메일을 보내지 않는다", r.code === 400 && r.data.code === "AMOUNT_MISMATCH" && mails.length === before);

const pending = (await call(prepare, { body: good })).data.paymentId;
payments.set(pending, paid(pending, { status: "READY" }));
r = await quiet(() => call(complete, { body: { paymentId: pending } }));
check("결제가 끝나지 않았으면 막는다", r.code === 409 && r.data.code === "NOT_PAID" && mails.length === before);

const live = (await call(prepare, { body: good })).data.paymentId;
payments.set(live, paid(live, { channel: { type: "LIVE" } }));
r = await quiet(() => call(complete, { body: { paymentId: live } }));
check("테스트 기간에는 실결제 채널을 막는다", r.code === 400 && r.data.code === "LIVE_BLOCKED" && mails.length === before);

const other = (await call(prepare, { body: good })).data.paymentId;
payments.set(other, paid(other, { storeId: "store-other" }));
r = await quiet(() => call(complete, { body: { paymentId: other } }));
check("다른 상점의 결제는 막는다", r.code === 400 && r.data.code === "WRONG_STORE");

r = await quiet(() => call(complete, { body: { paymentId: "payment-남이만든번호" } }));
check("서점이 만들지 않은 주문 번호는 막는다", r.code === 400 && r.data.code === "UNKNOWN_ORDER");
const missing = (await call(prepare, { body: good })).data.paymentId;
r = await quiet(() => call(complete, { body: { paymentId: missing } }));
check("포트원에 없는 결제는 막는다", r.code === 400 && r.data.code === "NOT_FOUND");

// 다른 책 값을 내고 비싼 책 번호로 바꿔치기: 다이어리 값(9,900원)을 내고 3.0 번호를 댐
const swap = (await call(prepare, { body: good })).data.paymentId;
payments.set(swap, paid(swap, { amount: { total: findBook("diary-2027").price }, customData: JSON.stringify({ slug: "diary-2027" }) }));
r = await quiet(() => call(complete, { body: { paymentId: swap } }));
check("싼 책 값을 내고 비싼 책을 받으려는 바꿔치기를 막는다", r.code === 400 && r.data.code === "AMOUNT_MISMATCH");

// PDF 책 메일
const diary = (await call(prepare, { body: { ...good, slug: "diary-2027" } })).data.paymentId;
payments.set(diary, paid(diary, { amount: { total: findBook("diary-2027").price } }));
r = await call(complete, { body: { paymentId: diary } });
check("PDF 책은 'PDF를 보내 드려요'로 안내한다", r.code === 200 && /주소로 PDF를 보내 드려요/.test(mails.at(-2)?.text || ""));

// ── 웹훅
const sign = (id, ts, body, secret = WEBHOOK_SECRET) => `v1,${crypto.createHmac("sha256", Buffer.from(secret.slice(6), "base64")).update(`${id}.${ts}.${body}`).digest("base64")}`;
const hook = (await call(prepare, { body: good })).data.paymentId;
payments.set(hook, paid(hook));
const rawBody = JSON.stringify({ type: "Transaction.Paid", timestamp: new Date().toISOString(), data: { storeId: "store-test", paymentId: hook, transactionId: "tx" } });
const ts = String(Math.floor(Date.now() / 1000));
const count = mails.length;
r = await quiet(() => call(webhook, { rawBody, headers: { "webhook-id": "msg1", "webhook-timestamp": ts, "webhook-signature": "v1,AAAA" } }));
check("서명이 틀린 웹훅은 막는다", r.code === 400 && mails.length === count);
r = await quiet(() => call(webhook, { rawBody, headers: { "webhook-id": "msg1", "webhook-timestamp": String(Number(ts) - 3600), "webhook-signature": sign("msg1", String(Number(ts) - 3600), rawBody) } }));
check("한 시간 전 웹훅(다시 보내기)은 막는다", r.code === 400 && mails.length === count);
r = await quiet(() => call(webhook, { rawBody: rawBody.replace(hook, paymentId), headers: { "webhook-id": "msg1", "webhook-timestamp": ts, "webhook-signature": sign("msg1", ts, rawBody) } }));
check("본문을 고친 웹훅은 막는다", r.code === 400 && mails.length === count);
r = await call(webhook, { rawBody, headers: { "webhook-id": "msg1", "webhook-timestamp": ts, "webhook-signature": sign("msg1", ts, rawBody) } });
check("서명이 맞는 결제 완료 웹훅은 메일을 보낸다", r.code === 200 && r.data.fulfilled === true && mails.length === count + 2);
const other2 = JSON.stringify({ type: "Transaction.Ready", data: { paymentId: hook } });
r = await call(webhook, { rawBody: other2, headers: { "webhook-id": "msg2", "webhook-timestamp": ts, "webhook-signature": sign("msg2", ts, other2) } });
check("결제 완료가 아닌 알림은 조용히 넘긴다", r.code === 200 && r.data.ignored === true && mails.length === count + 2);

// ── 실결제 모드에서는 테스트 결제를 주문으로 치지 않는다
process.env.PAY_MODE = "live";
r = await quiet(() => call(complete, { body: { paymentId } }));
check("실결제 모드에서는 테스트 결제를 막는다", r.code === 400 && r.data.code === "TEST_BLOCKED");
delete process.env.PAY_MODE;

fake.close();
console.log(failed ? `\n${failed}개 실패` : "\n모두 통과");
process.exit(failed ? 1 : 0);
