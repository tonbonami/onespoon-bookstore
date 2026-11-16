// POST /api/pay/webhook — 포트원이 결제 상태가 바뀔 때 부른다.
// 손님이 결제 뒤 창을 닫아 버려도 안내 메일이 나가게 하는 두 번째 길이다.
// 서명을 확인하고, 그래도 본문은 믿지 않고 포트원에 결제를 다시 조회한다(fulfill.js).
const { verifyWebhook, ready } = require("../_lib/portone");
const { verifyAndFulfill } = require("../_lib/fulfill");

async function readRaw(req) {
  if (typeof req.rawBody === "string") return req.rawBody;
  const chunks = [];
  for await (const chunk of req) chunks.push(typeof chunk === "string" ? Buffer.from(chunk) : chunk);
  if (chunks.length) return Buffer.concat(chunks).toString("utf8");
  if (Buffer.isBuffer(req.body)) return req.body.toString("utf8");
  if (typeof req.body === "string") return req.body;
  return "";
}

const handler = async (req, res) => {
  res.setHeader("Cache-Control", "no-store");
  if (req.method !== "POST") return res.status(405).json({ ok: false });
  if (!ready()) return res.status(503).json({ ok: false, ready: false });

  const raw = await readRaw(req);
  const checked = verifyWebhook(req.headers, raw);
  if (!checked.ok) {
    console.warn("[pay/webhook] 서명 확인 실패:", checked.reason);
    return res.status(400).json({ ok: false });
  }

  let message;
  try {
    message = JSON.parse(raw);
  } catch {
    return res.status(400).json({ ok: false });
  }
  // 결제 완료 알림만 처리한다. 모르는 종류는 조용히 넘긴다(포트원이 종류를 늘릴 수 있음).
  if (!message || message.type !== "Transaction.Paid" || !message.data || !message.data.paymentId) return res.status(200).json({ ok: true, ignored: true });

  try {
    const result = await verifyAndFulfill(String(message.data.paymentId));
    if (!result.ok) {
      console.warn("[pay/webhook] 확인 실패", message.data.paymentId, result.code);
      return res.status(200).json({ ok: true, fulfilled: false, code: result.code });
    }
    // 메일 열쇠가 아직 없으면(설정 전) 다시 불러도 소용없으니 그대로 받는다
    if (!result.mail.buyer.sent && result.mail.buyer.reason === "메일 열쇠 없음") return res.status(200).json({ ok: true, fulfilled: false, code: "MAIL_NOT_SET" });
    // 메일이 나가지 못했으면 500으로 답해 포트원이 다시 부르게 한다(멱등 키라 두 번 나가지 않는다)
    if (!result.mail.buyer.sent) return res.status(500).json({ ok: false, code: "MAIL_PENDING" });
    return res.status(200).json({ ok: true, fulfilled: true });
  } catch (error) {
    console.error("[pay/webhook] 오류", error.message);
    return res.status(500).json({ ok: false });
  }
};

module.exports = handler;
// 서명은 받은 글자 그대로에 대해 계산하므로, 본문을 미리 해석하지 않게 한다
module.exports.config = { api: { bodyParser: false } };
