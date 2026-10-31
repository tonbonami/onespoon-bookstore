// 한스푼 서점 보호 목록 자동 점검
//
//   node tools/guard/guard.mjs                     운영본을 기준값과 비교
//   node tools/guard/guard.mjs --base http://localhost:4174
//   node tools/guard/guard.mjs --save              지금 값을 기준값(baseline.json)으로 저장
//
// 실제 손님처럼 폰 화면으로 페이지를 열어, 주문이 구글폼에 닿는 데 필요한 것들을 모은다.
// 주문은 절대 보내지 않는다: 구글폼 주소는 DNS부터 막고(브라우저 실행 옵션), 한 번 더 브라우저 안에서 막은 뒤
// "보내려던 내용"만 읽는다. Vercel 방문자 통계도 막아서 점검이 방문자로 잡히지 않는다.
import { spawn, spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, writeFileSync, existsSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

// Node 20은 WebSocket을 옵션으로 켜야 한다
if (!globalThis.WebSocket) {
  const r = spawnSync(process.execPath, ["--experimental-websocket", "--no-warnings", ...process.argv.slice(1)], { stdio: "inherit" });
  process.exit(r.status ?? 1);
}

const HERE = dirname(fileURLToPath(import.meta.url));
const BASELINE = join(HERE, "baseline.json");
const args = process.argv.slice(2);
const argValue = (flag, fallback) => (args.includes(flag) ? args[args.indexOf(flag) + 1] : fallback);
const BASE = argValue("--base", "https://onespoon-studio.vercel.app").replace(/\/$/, "");
const SAVE = args.includes("--save");
const CHROME = argValue("--chrome", "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome");

// 주소가 그대로 열려야 하는 곳 (블로그·인스타·메일에 걸린 링크)
const PATHS = ["/", "/books/", "/books", "/apps/", "/apps", "/francespoon/", "/francespoon"];
// 공유 미리보기를 볼 페이지
const PAGES = ["/", "/books/", "/apps/", "/francespoon/"];
// 서점에서 바로가기로 쓰일 수 있는 칸. 사이트 안 링크가 가리키는 칸은 자동으로 더한다.
const BOOKS_ANCHORS = ["orderFormSection", "notifySection", "bookDetail", "featuredNoFu3", "featured30Days", "bookShelf"];
const BOOK_ENTRY = "entry.1833963440";

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ── 브라우저 ───────────────────────────────────
function launchChrome() {
  const dir = mkdtempSync(join(tmpdir(), "hanspoon-guard-"));
  const proc = spawn(
    CHROME,
    [
      "--headless=new",
      "--remote-debugging-port=0",
      `--user-data-dir=${dir}`,
      "--no-first-run",
      "--no-default-browser-check",
      "--disable-extensions",
      // 1차 차단: 구글폼 주소는 아예 찾지 못하게
      "--host-resolver-rules=MAP docs.google.com ~NOTFOUND",
      "about:blank",
    ],
    { stdio: "ignore" },
  );
  return { proc, dir };
}

async function devtoolsPort(dir) {
  const file = join(dir, "DevToolsActivePort");
  for (let i = 0; i < 100; i++) {
    if (existsSync(file)) {
      const port = readFileSync(file, "utf8").split("\n")[0].trim();
      if (port) return port;
    }
    await sleep(100);
  }
  throw new Error("크롬이 열리지 않았어요");
}

async function openTab(port) {
  const target = await (await fetch(`http://127.0.0.1:${port}/json/new?about:blank`, { method: "PUT" })).json();
  const ws = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((r, j) => {
    ws.onopen = r;
    ws.onerror = j;
  });
  let id = 0;
  const pending = new Map();
  const listeners = [];
  ws.onmessage = (m) => {
    const msg = JSON.parse(m.data);
    if (msg.id && pending.has(msg.id)) {
      const { resolve, reject } = pending.get(msg.id);
      pending.delete(msg.id);
      msg.error ? reject(new Error(`${msg.error.message}`)) : resolve(msg.result);
    } else if (msg.method) listeners.forEach((fn) => fn(msg));
  };
  const send = (method, params = {}) =>
    new Promise((resolve, reject) => {
      const i = ++id;
      pending.set(i, { resolve, reject });
      ws.send(JSON.stringify({ id: i, method, params }));
    });
  const tab = {
    send,
    on: (fn) => listeners.push(fn),
    off: (fn) => listeners.splice(listeners.indexOf(fn), 1),
    close: async () => {
      ws.close();
      await fetch(`http://127.0.0.1:${port}/json/close/${target.id}`).catch(() => {});
    },
    async eval(expression) {
      const r = await send("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true });
      if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description || r.exceptionDetails.text);
      return r.result.value;
    },
    async go(url) {
      let loaded = false;
      const onLoad = (e) => e.method === "Page.loadEventFired" && (loaded = true);
      tab.on(onLoad);
      await send("Page.navigate", { url });
      for (let i = 0; i < 300 && !loaded; i++) await sleep(100);
      tab.off(onLoad);
      if (!loaded) throw new Error(`열리지 않음: ${url}`);
      await sleep(600);
    },
  };
  await send("Page.enable");
  await send("Runtime.enable");
  await send("Network.enable");
  await send("Network.setCacheDisabled", { cacheDisabled: true });
  // 2차 차단: 구글폼 + 방문자 통계
  await send("Network.setBlockedURLs", { urls: ["*docs.google.com/forms*", "*/_vercel/insights*"] });
  await send("Emulation.setDeviceMetricsOverride", { width: 390, height: 844, deviceScaleFactor: 2, mobile: true });
  return tab;
}

// ── 모으기 ─────────────────────────────────────
async function collectStatus() {
  const out = {};
  for (const path of PATHS) {
    const res = await fetch(BASE + path, { redirect: "follow" });
    // 끝의 / 차이는 같은 페이지로 본다 (Vercel은 /books를 바로 열고, 로컬 서버는 /books/로 넘긴다)
    out[path] = `${res.status} → ${new URL(res.url).pathname.replace(/(.)\/$/, "$1")}`;
  }
  return out;
}

async function collectMeta(tab) {
  const meta = {};
  const links = new Set();
  for (const path of PAGES) {
    await tab.go(BASE + path);
    meta[path] = await tab.eval(`(() => {
      const pick = (sel, attr) => [...document.querySelectorAll(sel)].map((el) => [el.getAttribute("property") || el.getAttribute("name") || el.getAttribute("rel"), el.getAttribute(attr)]);
      return Object.fromEntries([
        ["title", document.title],
        ...pick('meta[name="description"], meta[property^="og:"], meta[name^="twitter:"]', "content"),
        ...pick('link[rel="canonical"], link[rel="icon"], link[rel="apple-touch-icon"]', "href"),
      ]);
    })()`);
    const hrefs = await tab.eval(`[...document.querySelectorAll("a[href*='#']")].map((a) => a.href)`);
    hrefs.forEach((h) => {
      const u = new URL(h);
      if (u.pathname === "/books/" && u.hash.length > 1) links.add(u.hash.slice(1));
    });
  }
  return { meta, linkedAnchors: [...links].sort() };
}

// 주문서 구조: 폼 주소, 칸 이름, 고를 수 있는 값
const FORMS_JS = `(() => Object.fromEntries([...document.forms].filter((f) => /docs\\.google\\.com\\/forms/.test(f.action)).map((f) => [f.id || f.action, {
  action: f.action,
  method: (f.getAttribute("method") || "").toUpperCase(),
  target: f.target,
  targetFrame: !!document.querySelector('iframe[name="' + f.target + '"]'),
  fields: [...f.elements].filter((el) => el.name).map((el) => {
    if (el.tagName === "SELECT") return el.name + " | 고르기 | " + [...el.options].map((o) => o.value).join(" / ") + (el.required ? " | 필수" : "");
    const kind = el.tagName === "TEXTAREA" ? "textarea" : el.type;
    const val = ["radio", "checkbox", "hidden"].includes(kind) && el.value ? " = " + el.value : "";
    return el.name + " | " + kind + val + (el.required ? " | 필수" : "");
  }).sort(),
}])))()`;

async function collectBooks(tab) {
  await tab.go(BASE + "/books/");
  const forms = await tab.eval(FORMS_JS);
  const choices = await tab.eval(`[...document.querySelectorAll('input[name="${BOOK_ENTRY}"]')].map((r) => r.value).sort()`);

  // 책마다 화면에 뜨는 입금 금액
  const amounts = await tab.eval(`(async () => {
    const out = {};
    for (const r of document.querySelectorAll('input[name="${BOOK_ENTRY}"]')) {
      r.click();
      await new Promise((ok) => setTimeout(ok, 50));
      const amount = document.querySelector("#depositAmount");
      const note = document.querySelector("#depositAmountNote");
      out[r.value] = { 금액: amount ? amount.textContent.trim() : "(금액 칸 없음)", 안내: note && !note.hidden ? note.textContent.trim() : "" };
    }
    return out;
  })()`);

  // 계좌 상자와 복사 버튼 (복사 버튼은 실제로 눌러 본다)
  const account = await tab.eval(`(async () => {
    const text = (sel) => document.querySelector(sel)?.textContent.trim() ?? "(없음)";
    const press = async (sel) => {
      const b = document.querySelector(sel);
      if (!b) return "(버튼 없음)";
      b.click();
      await new Promise((ok) => setTimeout(ok, 200));
      return b.textContent.trim() === "복사됨" ? "눌림 → 복사됨" : "눌러도 반응 없음: " + b.textContent.trim();
    };
    return {
      주문서_계좌: text("#depositAccount"),
      주문서_은행예금주: text(".deposit-account small"),
      주문서_복사버튼: await press("#depositCopy"),
      완료화면_계좌: text("#doneAccount"),
      완료화면_복사버튼: await press("#doneCopy"),
    };
  })()`);

  // 서가의 책을 누르면 주문서가 그 책으로 맞춰지는지
  const shelf = await tab.eval(`(async () => {
    const out = {};
    for (const card of document.querySelectorAll(".book-card")) {
      card.click();
      await new Promise((ok) => setTimeout(ok, 80));
      const checked = document.querySelector('input[name="${BOOK_ENTRY}"]:checked');
      const shown = (sel) => { const el = document.querySelector(sel); return !!el && getComputedStyle(el).display !== "none"; };
      out[card.querySelector(".book-title")?.textContent.trim() || card.dataset.id] = {
        고른값: checked ? checked.value : "",
        주문서: shown("#orderFormSection") ? "보임" : "숨김",
        출시알림: shown("#notifySection") ? "보임" : "숨김",
      };
    }
    return out;
  })()`);
  return { forms, choices, amounts, account, shelf };
}

async function collectAnchors(tab, linked) {
  await tab.go(BASE + "/books/");
  const ids = [...new Set([...BOOKS_ANCHORS, ...linked])].sort();
  return tab.eval(`Object.fromEntries(${JSON.stringify(ids)}.map((id) => [id, document.getElementById(id) ? "있음" : "없음"]))`);
}

// 실제 손님처럼 채워서 보내 보되, 요청은 막고 보내려던 내용만 읽는다
const FILL_JS = (formSel) => `(() => {
  const f = document.querySelector(${JSON.stringify(formSel)});
  const done = new Set();
  for (const el of f.elements) {
    if (!el.name || el.disabled) continue;
    if (el.type === "radio") {
      if (done.has(el.name)) continue;
      done.add(el.name);
      const group = f.querySelectorAll('input[name="' + el.name + '"]');
      if (![...group].some((r) => r.checked)) el.click();
    } else if (el.type === "checkbox") {
      if (!el.checked) el.click();
    } else if (el.tagName === "SELECT") {
      const opt = [...el.options].find((o) => o.value);
      if (opt) el.value = opt.value;
    } else if (el.type === "email") {
      el.value = "guard-check@example.com";
    } else if (el.type !== "hidden") {
      el.value = "가드 점검";
    }
    el.dispatchEvent(new Event("input", { bubbles: true }));
    el.dispatchEvent(new Event("change", { bubbles: true }));
  }
  f.requestSubmit();
  return true;
})()`;

async function trySubmit(tab, formSel, before) {
  const seen = [];
  const watch = (e) => {
    const url = e.params?.request?.url || e.params?.response?.url || "";
    if (e.method === "Network.requestWillBeSent" && /docs\.google\.com\/forms/.test(url)) seen.push({ id: e.params.requestId, url, body: e.params.request.postData || "", state: "보냄 시도" });
    if (e.method === "Network.loadingFailed") seen.filter((s) => s.id === e.params.requestId).forEach((s) => (s.state = "막힘"));
    if (e.method === "Network.responseReceived" && /docs\.google\.com\/forms/.test(url)) seen.filter((s) => s.id === e.params.requestId).forEach((s) => (s.state = "새어 나감!"));
  };
  tab.on(watch);
  await tab.go(BASE + "/books/");
  if (before) await tab.eval(before);
  await tab.eval(FILL_JS(formSel));
  for (let i = 0; i < 50 && !seen.length; i++) await sleep(100);
  await sleep(1600); // 완료 화면이 뜨는 시간(900ms) + 여유
  tab.off(watch);
  if (seen.some((s) => s.state === "새어 나감!")) throw new Error("구글폼 요청이 막히지 않았어요. 점검을 멈춥니다.");
  if (!seen.length) return { 전송: "보내려는 요청이 없음(필수 칸 막힘?)" };
  const s = seen[0];
  const params = new URLSearchParams(s.body);
  const keys = [...params.keys()].sort();
  return {
    전송: s.state,
    주소: s.url,
    칸: keys,
    책: params.get(BOOK_ENTRY),
    이메일복사칸: ["entry.1769994956", "entry.680763611"].filter((k) => params.has(k)).map((k) => `${k}=${params.get(k) === "guard-check@example.com" ? "이메일과 같음" : "다름: " + params.get(k)}`),
    완료화면: await tab.eval(`(() => {
      const box = document.querySelector("#orderDone");
      if (!box || box.hidden) return null;
      const t = (s) => document.querySelector(s)?.textContent.trim() ?? "(없음)";
      return { 책: t("#doneBook"), 금액: t("#doneAmount"), 계좌: t("#doneAccount") };
    })()`),
  };
}

async function collectSubmits(tab, choices) {
  const out = {};
  for (const value of choices) {
    out[`주문: ${value}`] = await trySubmit(tab, "#orderForm", `document.querySelector('input[name="${BOOK_ENTRY}"][value="${value}"]').click()`);
  }
  // 출시 알림: 곧 나올 책을 눌러 알림 양식을 띄운 뒤
  out["출시 알림"] = await trySubmit(tab, "#notifyForm", `(() => {
    const card = [...document.querySelectorAll(".book-card")].find((c) => { c.click(); return getComputedStyle(document.querySelector("#notifySection")).display !== "none"; });
    return !!card;
  })()`);
  return out;
}

// ── 비교 ───────────────────────────────────────
const LABELS = {
  status: "주소가 열리는지",
  meta: "공유 미리보기·제목",
  forms: "구글폼 주소와 칸 이름",
  choices: "책 선택값",
  amounts: "입금 금액",
  account: "계좌 상자·복사 버튼",
  shelf: "서가 → 주문서 연결",
  anchors: "바로가기 칸(/books/#…)",
  submits: "보내려던 내용(전송은 막음)",
};

const short = (v) => {
  const s = JSON.stringify(v);
  return s.length > 140 ? s.slice(0, 140) + "…" : s;
};

function diff(a, b, path, out) {
  if (JSON.stringify(a) === JSON.stringify(b)) return;
  if (a === undefined) return out.push(`${path}: 새로 생김 → ${short(b)}`);
  if (b === undefined) return out.push(`${path}: 사라짐 (전에는 ${short(a)})`);
  if (a && b && typeof a === "object" && typeof b === "object" && !Array.isArray(a) && !Array.isArray(b)) {
    for (const k of new Set([...Object.keys(a), ...Object.keys(b)])) diff(a[k], b[k], `${path} › ${k}`, out);
    return;
  }
  if (Array.isArray(a) && Array.isArray(b)) {
    const gone = a.filter((x) => !b.some((y) => JSON.stringify(y) === JSON.stringify(x)));
    const added = b.filter((x) => !a.some((y) => JSON.stringify(y) === JSON.stringify(x)));
    if (!gone.length && !added.length) {
      if (a.length === b.length) return; // 순서만 다름
      out.push(`${path}: 같은 항목의 개수가 달라짐 (${a.length} → ${b.length})`);
      return;
    }
    gone.forEach((x) => out.push(`${path}: 사라짐 → ${JSON.stringify(x)}`));
    added.forEach((x) => out.push(`${path}: 새로 생김 → ${JSON.stringify(x)}`));
    return;
  }
  out.push(`${path}: ${JSON.stringify(a)} → ${JSON.stringify(b)}`);
}

// ── 실행 ───────────────────────────────────────
const { proc, dir } = launchChrome();
let tab;
try {
  const port = await devtoolsPort(dir);
  tab = await openTab(port);
  const status = await collectStatus();
  const { meta, linkedAnchors } = await collectMeta(tab);
  const books = await collectBooks(tab);
  const anchors = await collectAnchors(tab, linkedAnchors);
  const submits = await collectSubmits(tab, books.choices);
  const now = { status, meta, forms: books.forms, choices: books.choices, amounts: books.amounts, account: books.account, shelf: books.shelf, anchors, submits };

  if (SAVE) {
    // 기준값은 운영본에서 뜨므로 운영 중인 main의 커밋을 적는다
    const git = spawnSync("git", ["rev-parse", "--short", "origin/main"], { cwd: HERE, encoding: "utf8" }).stdout.trim();
    writeFileSync(BASELINE, JSON.stringify({ 저장한때: new Date().toISOString(), 주소: BASE, 커밋: git, ...now }, null, 2) + "\n");
    console.log(`기준값을 저장했어요: ${BASELINE}`);
    process.exitCode = 0;
  } else {
    const base = JSON.parse(readFileSync(BASELINE, "utf8"));
    console.log(`점검 대상: ${BASE}\n기준값: ${base.저장한때} (${base.주소}, ${base.커밋})\n`);
    let failed = 0;
    for (const [key, label] of Object.entries(LABELS)) {
      const out = [];
      diff(base[key], now[key], label, out);
      console.log(`${out.length ? "✗" : "✓"} ${label}`);
      out.forEach((line) => console.log(`    ${line}`));
      failed += out.length;
    }
    console.log(failed ? `\n다른 곳 ${failed}개 — 합치지 마세요.` : "\n모두 기준값과 같아요.");
    process.exitCode = failed ? 1 : 0;
  }
} catch (e) {
  console.error(`점검 실패: ${e.message}`);
  process.exitCode = 2;
} finally {
  if (tab) await tab.close();
  proc.kill();
  await sleep(300);
  rmSync(dir, { recursive: true, force: true });
}
