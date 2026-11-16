// 결제 뒤 안내 메일: 구매자에게 한 통, 서점(우댕)에게 한 통.
// 발송은 Resend(HTTP)로 한다. 같은 결제로 두 번 불려도(완료 화면 + 웹훅) 멱등 키가 같아 한 통만 나간다.
const { sellerLine } = require("./seller");

const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
const won = (n) => `${Number(n).toLocaleString("ko-KR")}원`;

const env = () => ({
  key: process.env.RESEND_API_KEY || "",
  from: process.env.MAIL_FROM || "",
  admin: process.env.MAIL_ADMIN || "",
  apiBase: (process.env.RESEND_API_BASE || "https://api.resend.com").replace(/\/$/, ""),
  site: (process.env.SITE_URL || "https://hanspoonbooks.com").replace(/\/$/, ""),
});

// 받는 방법 안내: 노션 교재는 '초대' 방식이라 링크를 바로 보내지 않고 6시간 안 초대를 알린다
function deliveryLines(book, email) {
  if (book.format === "notion") {
    return [
      `6시간 안에 ${email} 주소로 노션 초대 메일을 보내 드려요.`,
      "노션에 가입한 이메일이 이 주소와 다르면, 이 메일에 답장으로 노션 가입 이메일을 알려 주세요.",
      "초대 메일의 버튼을 누르면 휴대폰·태블릿·PC 어디서나 교재가 열려요.",
    ];
  }
  return [`6시간 안에 ${email} 주소로 PDF를 보내 드려요.`, "메일이 보이지 않으면 스팸함도 한 번 확인해 주세요."];
}

function buyerMail(order) {
  const e = env();
  const { book, email, name, amount, paymentId, receiptUrl, test, method } = order;
  const lines = deliveryLines(book, email);
  // 환불 안내 요약(계약 내용 안내의 일부). 자세한 기준은 /refund/
  const refund = [
    "교재를 받기 전(초대·발송 전)에는 언제든 전액 환불해요.",
    "받은 뒤에는 디지털 콘텐츠라 단순 변심으로는 환불되지 않아요.",
    "열리지 않거나 설명과 다르면 받은 날부터 3개월 안, 그 사실을 안 날부터 30일 안에 환불을 요청할 수 있어요.",
    "환불은 이 메일에 답장으로 요청해 주세요. 요청을 받은 날부터 3영업일 안에 결제를 취소해 드려요.",
  ];
  if (book.deliveryNote) lines.push(book.deliveryNote.replace(/^입금 확인 후\s*/, ""));
  const subject = `${test ? "[테스트] " : ""}[한스푼 서점] 결제가 확인됐어요 · ${book.title}`;
  const text = [
    `${name || "구매자"} 님, 주문해 주셔서 고맙습니다.`,
    "",
    `주문한 책: ${book.title}`,
    `결제 금액: ${won(amount)}${method ? ` (${method})` : ""}`,
    `주문 번호: ${paymentId}`,
    "",
    "받는 방법",
    ...lines.map((l) => `- ${l}`),
    "",
    "환불 안내",
    ...refund.map((l) => `- ${l}`),
    `자세히: ${e.site}/refund/`,
    "",
    receiptUrl ? `영수증: ${receiptUrl}` : "",
    "궁금한 점은 이 메일에 답장하거나 인스타그램 @tonbonami 로 알려 주세요.",
    "",
    "Merci beaucoup ! — 한스푼 스튜디오",
    "",
    `판매자: ${sellerLine()}`,
  ]
    .filter((l, i, all) => l !== "" || (i > 0 && all[i - 1] !== ""))
    .join("\n");
  const html = `<!doctype html><html lang="ko"><body style="margin:0;background:#fcfbf4;font-family:'Apple SD Gothic Neo','Noto Sans KR',sans-serif;color:#433f3e">
<div style="max-width:520px;margin:0 auto;padding:28px 20px">
  <p style="margin:0 0 6px;font-size:13px;letter-spacing:.08em;color:#2f7fc1">${test ? "테스트 결제 · " : ""}한스푼 서점</p>
  <h1 style="margin:0 0 14px;font-size:21px;line-height:1.4">결제가 확인됐어요</h1>
  <p style="margin:0 0 18px;font-size:15px;line-height:1.7">${esc(name || "구매자")} 님, 주문해 주셔서 고맙습니다.</p>
  <table role="presentation" style="width:100%;border-collapse:collapse;background:#ffffff;border:1px solid rgba(67,63,62,.1);border-radius:14px;font-size:14.5px">
    <tr><td style="padding:12px 16px;color:#8a8580;width:92px">주문한 책</td><td style="padding:12px 16px;font-weight:700">${esc(book.title)}</td></tr>
    <tr><td style="padding:12px 16px;color:#8a8580;border-top:1px solid rgba(67,63,62,.08)">결제 금액</td><td style="padding:12px 16px;border-top:1px solid rgba(67,63,62,.08)">${won(amount)}${method ? ` · ${esc(method)}` : ""}</td></tr>
    <tr><td style="padding:12px 16px;color:#8a8580;border-top:1px solid rgba(67,63,62,.08)">주문 번호</td><td style="padding:12px 16px;border-top:1px solid rgba(67,63,62,.08);font-size:13px">${esc(paymentId)}</td></tr>
  </table>
  <div style="margin:18px 0;padding:16px 18px;background:#eef5fc;border-radius:14px;font-size:14.5px;line-height:1.75">
    <strong style="display:block;margin-bottom:6px">받는 방법</strong>
    ${lines.map((l) => `<div>· ${esc(l)}</div>`).join("\n    ")}
  </div>
  <div style="margin:0 0 18px;padding:14px 18px;background:#f3eff7;border-radius:14px;font-size:13.5px;line-height:1.75">
    <strong style="display:block;margin-bottom:4px">환불 안내</strong>
    ${refund.map((l) => `<div>· ${esc(l)}</div>`).join("\n    ")}
    <div style="margin-top:4px"><a href="${esc(e.site)}/refund/" style="color:#2f7fc1">환불정책 자세히 보기</a>${receiptUrl ? ` · <a href="${esc(receiptUrl)}" style="color:#2f7fc1">영수증 보기</a>` : ""}</div>
  </div>
  <p style="margin:0 0 18px;font-size:13.5px;line-height:1.7;color:#6f6a66">궁금한 점은 이 메일에 답장하거나 인스타그램 @tonbonami 로 알려 주세요.</p>
  <p style="margin:0 0 16px;font-size:13.5px;color:#8a8580">Merci beaucoup ! — 한스푼 스튜디오</p>
  <p style="margin:0;padding-top:12px;border-top:1px solid rgba(67,63,62,.1);font-size:11.5px;line-height:1.7;color:#8a8580">${esc(sellerLine())}</p>
</div></body></html>`;
  return { subject, text, html };
}

function adminMail(order) {
  const { book, email, name, amount, paymentId, receiptUrl, test, news, method } = order;
  const todo = book.format === "notion" ? `6시간 안에 ${email} 로 노션 초대` : `6시간 안에 ${email} 로 PDF 발송`;
  const subject = `${test ? "[테스트] " : ""}[카드 결제] ${book.title} · ${won(amount)} · ${name || "이름 없음"}`;
  const rows = [
    ["할 일", todo],
    ["책", book.title],
    ["금액", won(amount)],
    ["이름", name || "-"],
    ["이메일", email],
    ["결제 수단", method || "-"],
    ["소식 받기", news ? "동의" : "동의 안 함"],
    ["주문 번호", paymentId],
    ["영수증", receiptUrl || "-"],
  ];
  const text = rows.map(([k, v]) => `${k}: ${v}`).join("\n");
  const html = `<!doctype html><html lang="ko"><body style="font-family:'Apple SD Gothic Neo','Noto Sans KR',sans-serif;color:#433f3e">
<table style="border-collapse:collapse;font-size:14.5px">${rows.map(([k, v]) => `<tr><td style="padding:6px 14px 6px 0;color:#8a8580">${esc(k)}</td><td style="padding:6px 0">${esc(v)}</td></tr>`).join("")}</table>
</body></html>`;
  return { subject, text, html };
}

async function send({ to, subject, text, html, replyTo, idempotencyKey }) {
  const e = env();
  if (!e.key || !e.from) return { sent: false, reason: "메일 열쇠 없음" };
  const response = await fetch(`${e.apiBase}/emails`, {
    method: "POST",
    headers: { Authorization: `Bearer ${e.key}`, "Content-Type": "application/json", "Idempotency-Key": idempotencyKey },
    body: JSON.stringify({ from: e.from, to: [to], subject, text, html, ...(replyTo ? { reply_to: replyTo } : {}) }),
  });
  if (!response.ok) return { sent: false, reason: `메일 발송 실패 (${response.status})` };
  return { sent: true };
}

// 구매자·서점 두 통을 보낸다. 한쪽이 실패해도 다른 쪽은 보낸다.
async function sendOrderMails(order) {
  const e = env();
  const buyer = await send({ to: order.email, ...buyerMail(order), replyTo: e.admin || undefined, idempotencyKey: `buyer-${order.paymentId}` }).catch((error) => ({ sent: false, reason: String(error.message || error) }));
  const admin = e.admin
    ? await send({ to: e.admin, ...adminMail(order), replyTo: order.email, idempotencyKey: `admin-${order.paymentId}` }).catch((error) => ({ sent: false, reason: String(error.message || error) }))
    : { sent: false, reason: "서점 메일 주소 없음" };
  return { buyer, admin };
}

module.exports = { buyerMail, adminMail, sendOrderMails, won };
