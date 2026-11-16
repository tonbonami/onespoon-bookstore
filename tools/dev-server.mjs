// 이 컴퓨터에서 서점 + 카드 결제 서버(api/pay/*)를 같이 돌려 보는 개발용 서버. 배포에는 쓰이지 않는다.
//   node tools/dev-server.mjs            정적 파일 + /api (열쇠는 환경 변수에서. 없으면 '준비 중'으로 답함)
//   node tools/dev-server.mjs --demo     가짜 결제사·가짜 메일을 이 컴퓨터 안에 세워 완료 화면까지 본다
//                                        (/pay/?paymentId=hs-nofu3-demo-1234567890abcdef 처럼 열면 '결제 완료'가 뜬다. 실제 결제·메일 없음)
import http from "node:http";
import { readFile, stat } from "node:fs/promises";
import { join, extname, dirname, normalize } from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const PORT = Number(process.env.PORT || 4175);
const require = createRequire(import.meta.url);
const TYPES = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".mjs": "text/javascript; charset=utf-8", ".css": "text/css; charset=utf-8", ".json": "application/json", ".webp": "image/webp", ".jpg": "image/jpeg", ".png": "image/png", ".svg": "image/svg+xml", ".ico": "image/x-icon", ".pdf": "application/pdf", ".mp3": "audio/mpeg" };

if (process.argv.includes("--demo")) {
  const { findBook } = require("../api/_lib/catalog.js");
  const demo = http.createServer((req, res) => {
    let body = "";
    req.on("data", (c) => (body += c));
    req.on("end", () => {
      const send = (code, data) => (res.writeHead(code, { "Content-Type": "application/json" }), res.end(JSON.stringify(data)));
      const m = /^\/payments\/(hs-([a-z0-9-]+)-[a-z0-9]+-[a-f0-9]{16})$/.exec(decodeURIComponent(req.url));
      const book = m && findBook(m[2]);
      if (book) return send(200, { id: m[1], storeId: "store-demo", status: "PAID", currency: "KRW", amount: { total: book.price }, channel: { type: "TEST" }, customer: { name: { full: "김시험" }, email: "demo@example.com" }, method: { type: "PaymentMethodCard" }, paidAt: new Date().toISOString(), receiptUrl: "" });
      if (req.url === "/emails") return console.log("[가짜 메일]", JSON.parse(body).subject), send(200, { id: "demo" });
      send(404, {});
    });
  });
  await new Promise((r) => demo.listen(0, "127.0.0.1", r));
  const base = `http://127.0.0.1:${demo.address().port}`;
  Object.assign(process.env, { PORTONE_STORE_ID: "store-demo", PORTONE_CHANNEL_KEY: "channel-key-demo", PORTONE_API_SECRET: "demo", PORTONE_API_BASE: base, RESEND_API_KEY: "demo", RESEND_API_BASE: base, MAIL_FROM: "demo@example.com", MAIL_ADMIN: "admin@example.com" });
  console.log("가짜 결제사·메일 서버 켬 (실제 결제·메일 없음)");
}

const handlers = { "/api/pay/prepare": "../api/pay/prepare.js", "/api/pay/complete": "../api/pay/complete.js", "/api/pay/webhook": "../api/pay/webhook.js" };

http
  .createServer(async (req, res) => {
    const url = new URL(req.url, "http://localhost");
    if (handlers[url.pathname]) {
      const chunks = [];
      for await (const c of req) chunks.push(c);
      const raw = Buffer.concat(chunks).toString("utf8");
      req.rawBody = raw;
      try {
        req.body = raw ? JSON.parse(raw) : {};
      } catch {
        req.body = {};
      }
      res.status = (code) => ((res.statusCode = code), res);
      res.json = (data) => (res.setHeader("Content-Type", "application/json; charset=utf-8"), res.end(JSON.stringify(data)), res);
      return require(handlers[url.pathname])(req, res);
    }
    let file = normalize(join(ROOT, decodeURIComponent(url.pathname)));
    if (!file.startsWith(ROOT)) return res.writeHead(403).end();
    try {
      if ((await stat(file)).isDirectory()) {
        if (!url.pathname.endsWith("/")) return res.writeHead(308, { Location: `${url.pathname}/${url.search}` }).end();
        file = join(file, "index.html");
      }
      const data = await readFile(file);
      res.writeHead(200, { "Content-Type": TYPES[extname(file)] || "application/octet-stream", "Cache-Control": "no-store" }).end(data);
    } catch {
      res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" }).end("없는 주소");
    }
  })
  .listen(PORT, () => console.log(`http://localhost:${PORT}`));
