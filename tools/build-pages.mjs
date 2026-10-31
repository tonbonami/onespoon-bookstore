// 책별 주소 /books/<slug>/ 를 만든다. Vercel이 배포할 때마다 돌린다(vercel.json의 buildCommand).
//   node tools/build-pages.mjs
//
// books/index.html을 그대로 복사하고, 머리말(제목·설명·공유 카드)만 그 책 것으로 바꾸고,
// <body data-book="<slug>">를 달아 그 책이 골라진 채로 열리게 한다. 주문서·가격은 books-data.js를 같이 쓴다.
// 상품 데이터가 이상하면(선택값·가격 빠짐, slug 겹침, 표지 없음) 여기서 멈춘다.
// 그러면 배포가 실패하고 운영 중인 사이트는 이전 버전 그대로 남는다.
// 판매 중인 책의 formValue가 실제 구글폼 '주문하실 책 이름' 선택지에 없어도 멈춘다(오타 하나로 주문이 사라지지 않게).
// 만든 파일(books/<slug>/index.html)은 .gitignore의 books/* 에 걸려 저장소에 올라가지 않는다.
//
// Vercel에서 돌 때(VERCEL=1)만: 배포되는 books/index.html 복사본의 ?v= 캐시 번호를 파일 내용으로 자동으로 붙인다.
// 그래서 books-data.js·script.js·styles.css를 고칠 때 ?v= 숫자를 손으로 올리지 않아도 된다.
// 내 컴퓨터에서 돌리면 books/index.html 원본은 건드리지 않는다.
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { createHash } from "node:crypto";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import vm from "node:vm";
import { readGoogleForm } from "./google-form.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const PROD = "https://onespoon-studio.vercel.app";
// 공개 미리보기처럼 다른 주소로 올릴 때는 SITE_URL을 주면 공유 카드 주소·그림이 그 주소를 가리킨다(카톡 카드 시험용)
const SITE = (process.env.SITE_URL || PROD).replace(/\/$/, "");
const SHARE_START = "<!-- 공유 카드:";
const SHARE_END = "<!-- /공유 카드 -->";

const sandbox = { window: {} };
vm.runInNewContext(readFileSync(join(ROOT, "books-data.js"), "utf8"), sandbox);
const books = sandbox.window.HANSPOON_BOOKS || [];

// ── 상품 데이터 검사 ───────────────────────────
const problems = [];
const seen = new Set();
if (!books.length) problems.push("books-data.js에서 책을 하나도 읽지 못함");
for (const b of books) {
  const name = b.title || `id ${b.id}`;
  for (const key of ["id", "slug", "title", "status", "cover", "coverSize", "shareText"]) {
    if (b[key] == null || b[key] === "") problems.push(`${name}: ${key} 없음`);
  }
  if (!/^[a-z0-9-]+$/.test(b.slug || "")) problems.push(`${name}: slug는 영어 소문자·숫자·-만 (${b.slug})`);
  for (const key of ["id", "slug", "formValue"]) {
    if (b[key] == null) continue;
    if (seen.has(`${key}:${b[key]}`)) problems.push(`${key} 겹침: ${b[key]}`);
    seen.add(`${key}:${b[key]}`);
  }
  if (!["notion", "pdf"].includes(b.format)) problems.push(`${name}: format은 "notion" 또는 "pdf" (${b.format})`);
  if (!["판매중", "출시예정"].includes(b.status)) problems.push(`${name}: status는 "판매중" 또는 "출시예정" (${b.status})`);
  if (b.status === "판매중") {
    if (!b.formValue) problems.push(`${name}: 판매중인데 formValue(구글폼 선택값) 없음`);
    if (!Number.isInteger(b.price) || b.price <= 0) problems.push(`${name}: 판매중인데 price가 원 단위 숫자가 아님 (${b.price})`);
    if (!b.pickLabel) problems.push(`${name}: 판매중인데 pickLabel 없음`);
  }
  if (b.status === "출시예정" && b.price == null && !b.priceText) problems.push(`${name}: 출시예정이면 priceText로 안내 문구를 적어 주세요`);
  if (b.upgrade && (!b.upgrade.from || !Number.isInteger(b.upgrade.price))) problems.push(`${name}: upgrade는 { from: "2.0", price: 15000 } 꼴`);
  if (b.cover && !existsSync(join(ROOT, b.cover))) problems.push(`${name}: 표지 파일 없음 ${b.cover}`);
}

const source = readFileSync(join(ROOT, "books/index.html"), "utf8");
const start = source.indexOf(SHARE_START);
const end = source.indexOf(SHARE_END);
if (start < 0 || end < start) problems.push(`books/index.html에서 공유 카드 표시(${SHARE_START} … ${SHARE_END})를 찾지 못함`);
if (!source.includes("<title>한스푼 서점</title>")) problems.push("books/index.html의 <title>한스푼 서점</title>을 찾지 못함");
if (!/<body>/.test(source)) problems.push("books/index.html의 <body>를 찾지 못함");

// 구글폼에 실제로 있는 선택값인지 (공개 양식을 읽기만 함). 구글폼을 못 읽으면 경고만 하고 넘어간다(급한 배포를 막지 않게).
const BOOK_ENTRY = "entry.1833963440";
const orderAction = source.match(/id="orderForm"\s+action="([^"]+\/formResponse)"/)?.[1];
if (!orderAction) problems.push("books/index.html에서 주문서(orderForm)의 구글폼 주소를 찾지 못함");
else {
  const form = await readGoogleForm(orderAction).catch((e) => {
    console.warn(`주의: 구글폼을 읽지 못해 선택값 확인을 건너뜀 (${e.message})`);
    return undefined;
  });
  if (form === null) console.warn("주의: 구글폼 질문 구조를 읽지 못해 선택값 확인을 건너뜀");
  else if (form && !form[BOOK_ENTRY]) problems.push(`구글폼에 '주문하실 책 이름'(${BOOK_ENTRY}) 질문이 없음`);
  else if (form) {
    for (const b of books.filter((x) => x.status === "판매중" && x.formValue)) {
      if (!form[BOOK_ENTRY].선택지.includes(b.formValue)) {
        problems.push(`${b.title}: formValue "${b.formValue}"이 구글폼 선택지에 없음 (지금 선택지: ${form[BOOK_ENTRY].선택지.join(" / ")})`);
      }
    }
  }
}

if (problems.length) {
  console.error(`책별 페이지를 만들지 않았어요. 상품 데이터를 고쳐 주세요:\n  ${problems.join("\n  ")}`);
  process.exit(1);
}

// 캐시 번호: 파일 내용이 바뀌면 주소도 바뀌게
const hashOf = (file) => createHash("sha1").update(readFileSync(join(ROOT, file))).digest("hex").slice(0, 10);
const VERSIONS = Object.fromEntries(["books-data.js", "script.js", "styles.css"].map((f) => [f, hashOf(f)]));
const stampVersions = (html) =>
  Object.entries(VERSIONS).reduce((out, [file, v]) => out.replace(new RegExp(`/${file.replace(".", "\\.")}\\?v=[^"]+`, "g"), `/${file}?v=${v}`), html);

// ── 책별 페이지 만들기 ─────────────────────────
// 배포되는 /books/ 복사본: 캐시 번호 자동 + 미리보기 주소면 공유 카드도 그 주소로 (Vercel 빌드 기계 안에서만)
if (process.env.VERCEL) {
  const books_html = source.slice(0, start) + source.slice(start, end).replaceAll(PROD, SITE) + source.slice(end);
  writeFileSync(join(ROOT, "books/index.html"), stampVersions(books_html));
  console.log(`캐시 번호: ${Object.entries(VERSIONS).map(([f, v]) => `${f}?v=${v}`).join(", ")}`);
}

const attr = (s) => String(s).replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");
const text = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;");

for (const b of books) {
  const url = `${SITE}/books/${b.slug}/`;
  const image = existsSync(join(ROOT, `assets/og/${b.slug}.jpg`)) ? `${SITE}/assets/og/${b.slug}.jpg` : `${SITE}/assets/og/books.jpg`;
  const share = `<!-- 공유 카드: tools/build-pages.mjs가 만든 책별 페이지 (손으로 고치지 말고 books-data.js와 books/index.html을 고치세요) -->
    <link rel="canonical" href="${url}" />
    <meta property="og:type" content="website" />
    <meta property="og:site_name" content="한스푼 서점" />
    <meta property="og:title" content="${attr(b.title)}" />
    <meta property="og:description" content="${attr(b.shareText)}" />
    <meta property="og:url" content="${url}" />
    <meta property="og:image" content="${image}" />
    <meta property="og:image:width" content="1200" />
    <meta property="og:image:height" content="630" />
    <meta name="twitter:card" content="summary_large_image" />
    `;
  const html = stampVersions(source.slice(0, start) + share + source.slice(end))
    .replace("<title>한스푼 서점</title>", `<title>${text(b.title)} · 한스푼 서점</title>`)
    .replace(/(<meta\s+name="description"\s+content=")[^"]*(")/, `$1${attr(b.shareText)}$2`)
    .replace("<body>", `<body data-book="${b.slug}">`);
  mkdirSync(join(ROOT, "books", b.slug), { recursive: true });
  writeFileSync(join(ROOT, "books", b.slug, "index.html"), html);
  console.log(`만듦: /books/${b.slug}/  (${b.title})`);
}
