// 포트원(V2) 서버 쪽: 결제 한 건 다시 조회, 웹훅 서명 확인.
// 열쇠는 모두 Vercel 환경 변수로만 받는다(코드·저장소에 적지 않는다).
const crypto = require("node:crypto");

const env = () => ({
  storeId: process.env.PORTONE_STORE_ID || "",
  channelKey: process.env.PORTONE_CHANNEL_KEY || "",
  apiSecret: process.env.PORTONE_API_SECRET || "",
  webhookSecret: process.env.PORTONE_WEBHOOK_SECRET || "",
  apiBase: (process.env.PORTONE_API_BASE || "https://api.portone.io").replace(/\/$/, ""),
  // "test"(기본): 테스트 채널 결제만 받는다. 실결제를 열 때만 "live"로 바꾼다(우댕 승인 뒤).
  mode: process.env.PAY_MODE === "live" ? "live" : "test",
  // 간편결제는 토스페이먼츠와 따로 계약한 것만 켠다. 예: PAY_EASY="KAKAOPAY,NAVERPAY,TOSSPAY" (비우면 카드만)
  easy: (process.env.PAY_EASY || "").split(",").map((s) => s.trim().toUpperCase()).filter((s) => EASY_PROVIDERS.includes(s)),
});

const EASY_PROVIDERS = ["KAKAOPAY", "NAVERPAY", "TOSSPAY"];

// 서버만 만들 수 있는 짧은 서명. 쓰는 곳: ① 주문을 준비한 때의 책값을 묶어 둠 ② 완료 화면을 그 손님만 보게 함
function sign(text) {
  return crypto.createHmac("sha256", env().apiSecret).update(String(text)).digest("hex").slice(0, 40);
}

function sameSign(given, text) {
  const expected = Buffer.from(sign(text));
  const actual = Buffer.from(String(given || ""));
  return actual.length === expected.length && crypto.timingSafeEqual(actual, expected);
}

// 결제창을 띄울 준비가 됐는지(브라우저에 줄 값 + 서버 확인용 열쇠)
function ready() {
  const e = env();
  return Boolean(e.storeId && e.channelKey && e.apiSecret);
}

// 포트원 서버에 그 결제를 직접 물어본다. 브라우저가 "성공했다"고 한 말은 믿지 않는다.
async function getPayment(paymentId) {
  const e = env();
  const response = await fetch(`${e.apiBase}/payments/${encodeURIComponent(paymentId)}`, {
    headers: { Authorization: `PortOne ${e.apiSecret}` },
  });
  if (response.status === 404) return null;
  if (!response.ok) {
    const error = new Error(`포트원 결제 조회 실패 (${response.status})`);
    error.status = response.status;
    throw error;
  }
  return response.json();
}

// 웹훅 서명 확인(Standard Webhooks 규격): `${id}.${timestamp}.${본문}`을 HMAC-SHA256으로 서명한 값과 비교.
// 5분보다 오래됐거나 앞선 요청은 받지 않는다(다시 보내기 공격 막기).
function verifyWebhook(headers, rawBody, now = Date.now()) {
  const secret = env().webhookSecret;
  if (!secret) return { ok: false, reason: "웹훅 시크릿 없음" };
  const id = headers["webhook-id"];
  const timestamp = headers["webhook-timestamp"];
  const signatures = headers["webhook-signature"];
  if (!id || !timestamp || !signatures) return { ok: false, reason: "서명 헤더 없음" };
  const seconds = Number(timestamp);
  if (!Number.isFinite(seconds) || Math.abs(now / 1000 - seconds) > 300) return { ok: false, reason: "시각이 맞지 않음" };
  const key = Buffer.from(secret.startsWith("whsec_") ? secret.slice(6) : secret, "base64");
  const expected = crypto.createHmac("sha256", key).update(`${id}.${timestamp}.${rawBody}`).digest();
  const match = String(signatures)
    .split(" ")
    .some((part) => {
      const [version, value] = part.split(",");
      if (version !== "v1" || !value) return false;
      const given = Buffer.from(value, "base64");
      return given.length === expected.length && crypto.timingSafeEqual(given, expected);
    });
  return match ? { ok: true } : { ok: false, reason: "서명이 다름" };
}

module.exports = { env, ready, getPayment, verifyWebhook, sign, sameSign, EASY_PROVIDERS };
