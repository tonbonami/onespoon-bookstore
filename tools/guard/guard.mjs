// 한스푼 서점 보호 목록 자동 점검
//
//   node tools/guard/guard.mjs                     운영본을 기준값과 비교
//   node tools/guard/guard.mjs --base http://localhost:4174
//   node tools/guard/guard.mjs --save              지금 값을 기준값(baseline.json)으로 저장
//
// 실제 손님처럼 폰 화면으로 페이지를 열어, 주문이 구글폼에 닿는 데 필요한 것들을 모은다.
// 주문은 절대 보내지 않는다. 세 겹으로 막는다:
//   1) 크롬이 점검 대상 사이트 말고는 어떤 주소도 찾지 못한다(DNS 허용 목록).
//   2) 사이트 밖으로 가는 요청과 GET이 아닌 요청은 브라우저가 보내기 전에 끊는다(Fetch 가로채기).
//   3) 그래도 사이트 밖에서 응답이 오면 그 자리에서 점검을 멈춘다.
// 구글폼 쪽 질문 구조는 공개 양식 페이지(viewform)를 읽기만 해서 대조한다.
// Vercel 방문자 통계도 막아서 점검이 방문자로 잡히지 않는다.
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
const BASE_URL = new URL(BASE);
const SAVE = args.includes("--save");
const CHROME = argValue("--chrome", "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome");

// 주소가 그대로 열려야 하는 곳 (블로그·인스타·메일에 걸린 링크)
const PATHS = ["/", "/books/", "/books", "/apps/", "/apps", "/francespoon/", "/francespoon"];
// 공유 미리보기를 볼 페이지
const PAGES = ["/", "/books/", "/apps/", "/francespoon/"];
// 서점에서 바로가기로 쓰일 수 있는 칸. 사이트 안 링크가 가리키는 칸은 자동으로 더한다.
const BOOKS_ANCHORS = ["orderFormSection", "notifySection", "bookDetail", "featuredNoFu3", "featured30Days", "bookShelf"];
const BOOK_ENTRY = "entry.1833963440";
const TEST_EMAIL = "guard-check@example.com";

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const isSite = (url) => {
  try {
    const u = new URL(url);
    return u.host === BASE_URL.host || u.protocol === "data:" || u.protocol === "blob:";
  } catch {
    return false;
  }
};

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
      // 1겹: 점검 대상 사이트 말고는 어떤 주소도 찾지 못하게
      `--host-resolver-rules=MAP * ~NOTFOUND, EXCLUDE ${BASE_URL.hostname}`,
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
    blocked: [], // 보내기 전에 끊은 요청 (주소·방식·본문)
    leaked: [], // 사이트 밖에서 응답이 온 요청 — 하나라도 있으면 점검 중단
    on: (fn) => listeners.push(fn),
    off: (fn) => listeners.splice(listeners.indexOf(fn), 1),
    close: async () => {
      ws.close();
      await fetch(`http://127.0.0.1:${port}/json/close/${target.id}`).catch(() => {});
    },
    async eval(expression) {
      const r = await send("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true, userGesture: true });
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

  // 2겹: 모든 요청을 보내기 전에 세워서, 사이트 안의 GET만 보낸다
  tab.on((e) => {
    if (e.method === "Fetch.requestPaused") {
      const { requestId, request } = e.params;
      const allow = ["GET", "HEAD"].includes(request.method) && isSite(request.url) && !request.url.includes("/_vercel/insights");
      if (allow) {
        send("Fetch.continueRequest", { requestId }).catch(() => {});
      } else {
        tab.blocked.push({ url: request.url, method: request.method, body: request.postData || "" });
        send("Fetch.failRequest", { requestId, errorReason: "BlockedByClient" }).catch(() => {});
      }
    }
    // 3겹: 사이트 밖에서 응답이 왔다면 무엇인가 새어 나간 것
    if (e.method === "Network.responseReceived" && !isSite(e.params.response.url)) tab.leaked.push(e.params.response.url);
  });
  await send("Fetch.enable", { patterns: [{ urlPattern: "*", requestStage: "Request" }] });
  await send("Page.enable");
  await send("Runtime.enable");
  await send("Network.enable");
  await send("Network.setCacheDisabled", { cacheDisabled: true });
  await send("Emulation.setDeviceMetricsOverride", { width: 390, height: 844, deviceScaleFactor: 2, mobile: true });
  await send("Emulation.setFocusEmulationEnabled", { enabled: true });
  await send("Browser.grantPermissions", { origin: BASE_URL.origin, permissions: ["clipboardReadWrite", "clipboardSanitizedWrite"] }).catch(() => {});
  return tab;
}

function assertNoLeak(tab) {
  if (tab.leaked.length) throw new Error(`사이트 밖으로 요청이 나갔어요: ${tab.leaked.join(", ")} — 점검을 멈춥니다.`);
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

// 주문서 구조: 폼 주소, 칸 이름, 고를 수 있는 값. 라디오·체크 칸은 이름별 한 무리로 본다.
const FORMS_JS = `(() => Object.fromEntries([...document.forms].filter((f) => /docs\\.google\\.com\\/forms/.test(f.action)).map((f) => {
  const groups = new Map();
  for (const el of f.elements) {
    if (!el.name) continue;
    const kind = el.tagName === "SELECT" ? "고르기" : el.tagName === "TEXTAREA" ? "textarea" : el.type;
    const g = groups.get(el.name) || { kinds: new Set(), values: [], required: false };
    g.kinds.add(kind);
    if (kind === "고르기") g.values.push(...[...el.options].map((o) => o.value));
    else if (["radio", "checkbox", "hidden"].includes(kind) && el.value) g.values.push(el.value);
    g.required = g.required || el.required;
    groups.set(el.name, g);
  }
  const frames = document.querySelectorAll('iframe[name="' + f.target + '"]');
  return [f.id || f.action, {
    action: f.action,
    method: (f.getAttribute("method") || "").toUpperCase(),
    target: f.target,
    targetFrame: frames.length === 1 ? "하나 있음" : "iframe " + frames.length + "개",
    fields: [...groups].map(([name, g]) => [name, [...g.kinds].join("+"), g.values.sort().join(" / "), g.required ? "필수" : ""].filter(Boolean).join(" | ")).sort(),
  }];
})))()`;

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

  // 계좌 상자와 복사 버튼: 실제로 눌러 보고, 클립보드에 무엇이 들어갔는지 읽는다
  const account = await tab.eval(`(async () => {
    const text = (sel) => document.querySelector(sel)?.textContent.trim() ?? "(없음)";
    const press = async (sel) => {
      const b = document.querySelector(sel);
      if (!b) return "(버튼 없음)";
      try { await navigator.clipboard.writeText(""); } catch {}
      b.click();
      await new Promise((ok) => setTimeout(ok, 250));
      let copied = "(클립보드를 읽지 못함)";
      try { copied = await navigator.clipboard.readText(); } catch {}
      return (b.textContent.trim() === "복사됨" ? "눌림 → 복사됨" : "반응 없음: " + b.textContent.trim()) + " · 복사된 값 " + copied;
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
  assertNoLeak(tab);
  return { forms, choices, amounts, account, shelf };
}

async function collectAnchors(tab, linked) {
  await tab.go(BASE + "/books/");
  const ids = [...new Set([...BOOKS_ANCHORS, ...linked])].sort();
  return tab.eval(`Object.fromEntries(${JSON.stringify(ids)}.map((id) => [id, document.getElementById(id) ? "있음" : "없음"]))`);
}

// 실제 손님처럼 채워서 제출해 보되, 요청은 보내기 전에 끊고 보내려던 내용만 읽는다.
// checkboxes: true면 선택 체크 칸을 모두 체크, false면 모두 비운 채로.
const FILL_JS = (formSel, checkboxes) => `(() => {
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
      if (el.checked !== ${checkboxes}) el.click();
    } else if (el.tagName === "SELECT") {
      const opt = [...el.options].find((o) => o.value);
      if (opt) el.value = opt.value;
    } else if (el.type === "email") {
      el.value = ${JSON.stringify(TEST_EMAIL)};
    } else if (el.type !== "hidden") {
      el.value = "가드 점검";
    }
    el.dispatchEvent(new Event("input", { bubbles: true }));
    el.dispatchEvent(new Event("change", { bubbles: true }));
  }
  f.requestSubmit();
  return true;
})()`;

async function trySubmit(tab, formSel, before, checkboxes, path = "/books/") {
  await tab.go(BASE + path);
  tab.blocked.length = 0;
  if (before) await tab.eval(before);
  await tab.eval(FILL_JS(formSel, checkboxes));
  const isForm = (b) => b.method === "POST" || /google\.com|forms\.gle/.test(b.url);
  for (let i = 0; i < 50 && !tab.blocked.some(isForm); i++) await sleep(100);
  await sleep(1600); // 완료 화면이 뜨는 시간(900ms) + 여유
  assertNoLeak(tab);
  const sent = tab.blocked.filter(isForm);
  if (!sent.length) return { 전송: "보내려는 요청이 없음(필수 칸 막힘?)" };
  const s = sent[0];
  const params = new URLSearchParams(s.body);
  return {
    전송: sent.length === 1 ? `${s.method} 한 번 · 보내기 전에 막음` : `${sent.length}번 보내려 함 · 모두 막음`,
    주소: s.url,
    칸: [...params.keys()].sort(),
    책: params.get(BOOK_ENTRY),
    이메일복사칸: ["entry.1769994956", "entry.680763611"].filter((k) => params.has(k)).map((k) => `${k}=${params.get(k) === TEST_EMAIL ? "이메일과 같음" : "다름: " + params.get(k)}`),
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
  const pick = (value) => `document.querySelector('input[name="${BOOK_ENTRY}"][value="${value}"]').click()`;
  for (const value of choices) out[`주문: ${value}`] = await trySubmit(tab, "#orderForm", pick(value), true);
  // 선택 체크 칸을 비운 손님도 주문이 되는지
  out[`주문: ${choices[0]} (선택 칸 비움)`] = await trySubmit(tab, "#orderForm", pick(choices[0]), false);
  // 출시 알림: 곧 나올 책을 눌러 알림 양식을 띄운 뒤
  out["출시 알림"] = await trySubmit(tab, "#notifyForm", `(() => {
    const card = [...document.querySelectorAll(".book-card")].find((c) => { c.click(); return getComputedStyle(document.querySelector("#notifySection")).display !== "none"; });
    return !!card;
  })()`, true);
  return out;
}

// 책별 페이지(/books/<slug>/): 기준값과 비교하지 않고, /books/와 똑같이 주문이 되는지만 본다.
// 책별 페이지가 아직 없는 운영본(개편 전)에서는 건너뛴다.
async function collectBookPages(tab, books, submits) {
  await tab.go(BASE + "/books/");
  const list = await tab.eval(`(window.HANSPOON_BOOKS || []).map((b) => ({ slug: b.slug, title: b.title, formValue: b.formValue || "", soon: b.status === "출시예정" }))`);
  const issues = [];
  for (const b of list) {
    const path = `/books/${b.slug}/`;
    const res = await fetch(BASE + path);
    if (res.status !== 200) {
      issues.push(`${path}: 열리지 않음 (${res.status})`);
      continue;
    }
    await tab.go(BASE + path);
    const page = await tab.eval(`(() => {
      const og = (p) => document.querySelector('meta[property="' + p + '"]')?.content || "";
      const checked = document.querySelector('input[name="${BOOK_ENTRY}"]:checked');
      const shown = (sel) => { const el = document.querySelector(sel); return !!el && getComputedStyle(el).display !== "none"; };
      return { title: document.title, ogTitle: og("og:title"), ogUrl: og("og:url"), ogImage: og("og:image"), checked: checked ? checked.value : "", order: shown("#orderFormSection"), notify: shown("#notifySection") };
    })()`);
    const forms = await tab.eval(FORMS_JS);
    if (JSON.stringify(forms) !== JSON.stringify(submits.forms)) issues.push(`${path}: 주문서 구조가 /books/와 다름`);
    if (!page.title.includes(b.title) || page.ogTitle !== b.title) issues.push(`${path}: 제목·공유 제목이 책과 다름 (${page.title} / ${page.ogTitle})`);
    if (!page.ogUrl.endsWith(path)) issues.push(`${path}: og:url이 이 주소가 아님 (${page.ogUrl})`);
    const img = page.ogImage ? await fetch(page.ogImage.replace(/^https:\/\/onespoon-studio\.vercel\.app/, BASE)).then((r) => r.status).catch(() => 0) : 0;
    if (img !== 200) issues.push(`${path}: 공유 그림이 열리지 않음 (${page.ogImage})`);
    if (b.soon && !(page.notify && !page.order)) issues.push(`${path}: 출시 예정 책인데 출시 알림이 먼저 뜨지 않음`);
    if (!b.soon && (page.checked !== b.formValue || !page.order)) issues.push(`${path}: 주문서에 이 책(${b.formValue})이 골라져 있지 않음 (${page.checked})`);
    // 책별 페이지에서 주문해도 /books/에서 주문한 것과 똑같이 보내지는지
    if (!b.soon) {
      const sent = await trySubmit(tab, "#orderForm", null, true, path);
      const same = submits.sent[`주문: ${b.formValue}`];
      if (!same) issues.push(`${path}: /books/에서 이 책 주문 기록을 찾지 못함`);
      else if (JSON.stringify(sent) !== JSON.stringify(same)) issues.push(`${path}: 보내려던 내용이 /books/와 다름 ${short(sent)}`);
    }
  }
  assertNoLeak(tab);
  return issues;
}

// 구글폼 쪽: 공개 양식 페이지를 읽기만 해서(제출 없음) 지금 질문 구조를 가져온다
async function readGoogleForm(action) {
  const url = action.replace(/\/formResponse$/, "/viewform");
  const html = await (await fetch(url, { headers: { "user-agent": "Mozilla/5.0", "accept-language": "ko" } })).text();
  const at = html.indexOf("FB_PUBLIC_LOAD_DATA_ = ");
  if (at < 0) return null;
  const start = at + "FB_PUBLIC_LOAD_DATA_ = ".length;
  let depth = 0;
  let end = start;
  let inStr = false;
  for (; end < html.length; end++) {
    const c = html[end];
    if (inStr) {
      if (c === "\\") end++;
      else if (c === '"') inStr = false;
    } else if (c === '"') inStr = true;
    else if (c === "[") depth++;
    else if (c === "]" && --depth === 0) break;
  }
  const data = JSON.parse(html.slice(start, end + 1));
  const out = {};
  for (const item of data[1][1] || []) {
    for (const q of item[4] || []) {
      const options = (q[1] || []).map((o) => (o[4] ? "(기타 직접 입력)" : o[0]));
      out[`entry.${q[0]}`] = { 질문: item[1], 필수: q[2] === 1, 선택지: options };
    }
  }
  return out;
}

async function collectGoogleForms(forms, submits) {
  const structure = {};
  const mismatch = [];
  for (const [id, form] of Object.entries(forms)) {
    const gf = await readGoogleForm(form.action);
    if (!gf) {
      structure[id] = "구글폼 공개 페이지를 읽지 못함";
      continue;
    }
    structure[id] = Object.entries(gf).map(([entry, q]) => [entry, q.질문, q.필수 ? "필수" : "", q.선택지.join(" / ")].filter(Boolean).join(" | ")).sort();
    // 사이트가 보내는 칸·값이 구글폼에 실제로 있는지
    for (const line of form.fields) {
      const [name, kind, values] = line.split(" | ");
      if (!name.startsWith("entry.")) continue;
      if (!gf[name]) {
        mismatch.push(`${id}: 사이트의 ${name} 칸이 구글폼에 없음`);
        continue;
      }
      if (/radio|checkbox|고르기/.test(kind) && gf[name].선택지.length) {
        for (const v of (values || "").split(" / ").filter(Boolean)) {
          if (!gf[name].선택지.includes(v)) mismatch.push(`${id}: ${name} 값 "${v}"이 구글폼 선택지에 없음`);
        }
      }
    }
    // 구글폼 필수 질문을 사이트가 실제로 보내는지 (선택 칸 비운 주문 기준)
    const sample = Object.entries(submits).find(([k, v]) => v.주소 === form.action && k.includes("비움")) || Object.entries(submits).find(([, v]) => v.주소 === form.action);
    for (const [entry, q] of Object.entries(gf)) {
      if (q.필수 && sample && !sample[1].칸.includes(entry)) mismatch.push(`${id}: 구글폼 필수 질문 "${q.질문}"(${entry})을 사이트가 보내지 않음`);
    }
  }
  return { structure, mismatch };
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
  googleForms: "구글폼 쪽 질문 구조",
  googleMismatch: "사이트 ↔ 구글폼 어긋남",
};

const ADDITIVE = ["status", "meta", "anchors"];

const short = (v) => {
  const s = JSON.stringify(v);
  return s.length > 140 ? s.slice(0, 140) + "…" : s;
};

// 배열은 순서는 보지 않고, 같은 값이 몇 번 들어 있는지까지 비교한다
function countOf(list) {
  const m = new Map();
  for (const x of list) m.set(JSON.stringify(x), (m.get(JSON.stringify(x)) || 0) + 1);
  return m;
}

function diff(a, b, path, out) {
  if (JSON.stringify(a) === JSON.stringify(b)) return;
  if (a === undefined) return out.push(`${path}: 새로 생김 → ${short(b)}`);
  if (b === undefined) return out.push(`${path}: 사라짐 (전에는 ${short(a)})`);
  if (Array.isArray(a) && Array.isArray(b)) {
    const ca = countOf(a);
    const cb = countOf(b);
    for (const k of new Set([...ca.keys(), ...cb.keys()])) {
      const x = ca.get(k) || 0;
      const y = cb.get(k) || 0;
      if (x === y) continue;
      if (!y) out.push(`${path}: 사라짐 → ${k}`);
      else if (!x) out.push(`${path}: 새로 생김 → ${k}`);
      else out.push(`${path}: ${k} 개수 ${x} → ${y}`);
    }
    return;
  }
  if (a && b && typeof a === "object" && typeof b === "object") {
    for (const k of new Set([...Object.keys(a), ...Object.keys(b)])) diff(a[k], b[k], `${path} › ${k}`, out);
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
  const google = await collectGoogleForms(books.forms, submits);
  const bookPages = await collectBookPages(tab, books, { forms: books.forms, sent: submits });
  const now = {
    status, meta, forms: books.forms, choices: books.choices, amounts: books.amounts, account: books.account,
    shelf: books.shelf, anchors, submits, googleForms: google.structure, googleMismatch: google.mismatch,
  };

  if (SAVE) {
    // 기준값은 운영본에서 뜨므로 운영 중인 main의 커밋을 적는다
    const git = spawnSync("git", ["rev-parse", "--short", "origin/main"], { cwd: HERE, encoding: "utf8" }).stdout.trim();
    writeFileSync(BASELINE, JSON.stringify({ 저장한때: new Date().toISOString(), 주소: BASE, 커밋: git, ...now }, null, 2) + "\n");
    console.log(`기준값을 저장했어요: ${BASELINE}`);
    if (google.mismatch.length) console.log(`주의: 지금 운영본도 구글폼과 어긋난 곳이 있어요\n  ${google.mismatch.join("\n  ")}`);
    process.exitCode = 0;
  } else {
    const base = JSON.parse(readFileSync(BASELINE, "utf8"));
    console.log(`점검 대상: ${BASE}\n기준값: ${base.저장한때} (${base.주소}, ${base.커밋})\n`);
    let failed = 0;
    for (const [key, label] of Object.entries(LABELS)) {
      const out = [];
      diff(base[key], now[key], label, out);
      // 주소·공유 태그·바로가기 칸은 새로 생기는 건 괜찮다(옛 링크가 죽지 않으므로). 사라지거나 바뀌면 실패.
      const notes = ADDITIVE.includes(key) ? out.filter((line) => line.includes(": 새로 생김")) : [];
      const fails = out.filter((line) => !notes.includes(line));
      console.log(`${fails.length ? "✗" : "✓"} ${label}`);
      fails.forEach((line) => console.log(`    ${line}`));
      notes.forEach((line) => console.log(`    (새로 생김, 괜찮음) ${line.replace(": 새로 생김", ":")}`));
      failed += fails.length;
    }
    console.log(`${bookPages.length ? "✗" : "✓"} 책별 페이지(/books/<책>/)가 /books/와 똑같이 주문되는지`);
    bookPages.forEach((line) => console.log(`    ${line}`));
    failed += bookPages.length;
    console.log(failed ? `\n다른 곳 ${failed}개 — 합치지 마세요.` : "\n모두 기준값과 같아요.");
    process.exitCode = failed ? 1 : 0;
  }
} catch (e) {
  console.error(`점검 실패: ${e.message}`);
  process.exitCode = 2;
} finally {
  if (tab) await tab.close().catch(() => {});
  proc.kill();
  await sleep(300);
  rmSync(dir, { recursive: true, force: true });
}
