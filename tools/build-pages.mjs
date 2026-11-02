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
// 검색 로봇용: 책별 페이지마다 그 책의 소개·가격·주문서 제목을 원본 HTML에 미리 써 넣고(로봇은 자바스크립트를 잘 못 돌림),
// 검색엔진용 상품 정보(JSON-LD)를 붙인다. 화면은 script.js가 열자마자 같은 내용으로 다시 그린다.
// sitemap.xml도 여기서 만든다(판매 중지 책은 뺀다). robots.txt는 저장소 맨 위에 있다.
//
// 대문(/)도 여기서 만든다: 대문은 서점이다(books/index.html + 3.0 소개). 저장소의 index.html은 이 빌드가 만드는 파일이라
// .gitignore에 걸려 있다. 스튜디오 대문은 studio/index.html(/studio/)이고, 거기 입금 공지(<details class="notice">)가
// 있으면 서점 대문 맨 위에도 똑같이 붙인다. 공지를 고치거나 지울 곳은 studio/index.html 한 곳이다.
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
const PROD = "https://hanspoonbooks.com";
// 공개 미리보기처럼 다른 주소로 올릴 때는 SITE_URL을 주면 공유 카드 주소·그림이 그 주소를 가리킨다(카톡 카드 시험용)
const SITE = (process.env.SITE_URL || PROD).replace(/\/$/, "");
const SHARE_START = "<!-- 공유 카드:";
const SHARE_END = "<!-- /공유 카드 -->";

const sandbox = { window: {} };
vm.runInNewContext(readFileSync(join(ROOT, "books-data.js"), "utf8"), sandbox);
const books = sandbox.window.HANSPOON_BOOKS || [];
const FORMATS = sandbox.window.HANSPOON_FORMATS || {};
const DEFAULT_BOOK_ID = 5; // /books/를 열면 먼저 보이는 책 (script.js의 DEFAULT_BOOK_ID와 같게)
// 대문(/) 검색 제목·설명. /books/는 대문과 같은 페이지라 대표 주소(canonical)를 대문으로 둔다.
const FRONT_TITLE = "한스푼 서점 · 프랑스어 입문 노션 교재 『나의 첫 프랑스어 책 3.0』";
const FRONT_DESCRIPTION = "알파벳부터 『어린 왕자』 원문까지, 한 권으로. 프랑스어 입문 노션 교재 『나의 첫 프랑스어 책 3.0』과 프랑스어 PDF 책을 파는 프랑스어 한스푼의 서점이에요.";

const attr = (s) => String(s).replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");
const text = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;");
const won = (n) => `${n.toLocaleString("ko-KR")}원`;

// 책 소개 칸을 그 책 것으로 미리 써 넣는다. script.js의 selectBook과 같은 내용이어야 한다.
const DETAIL_SLOTS = {
  cover: /(<button\s+class="detail-book"\s+id="detailBook"[^>]*>)(<\/button>)/,
  category: /(<p class="eyebrow" id="detailCategory">)[^<]*(<\/p>)/,
  title: /(<h2 id="detailTitle">)[^<]*(<\/h2>)/,
  description: /(<p class="lede" id="detailDescription">)[\s\S]*?(<\/p>)/,
  format: /(<dd id="detailFormat">)[^<]*(<\/dd>)/,
  delivery: /(<dd id="detailDelivery">)[^<]*(<\/dd>)/,
  price: /(<dd id="detailPrice">)[^<]*(<\/dd>)/,
  audience: /(<dd id="detailAudience">)[^<]*(<\/dd>)/,
  orderTitle: /(<h2 id="orderTitle">)[^<]*(<\/h2>)/,
  orderLink: /(<a class="primary-link" id="detailForm")/,
  pausedNote: /(<p class="paused-note" id="detailPaused") hidden>(<\/p>)/,
  orderSection: /(<section class="order-section" id="orderFormSection")/,
  notifySection: /(<section class="order-section" id="notifySection"[^>]*?) style="display:none">/,
};
function prerender(html, b) {
  const paused = b.status === "판매중지";
  const soon = b.status === "출시예정";
  const format = FORMATS[b.format] || { label: "-", delivery: "-" };
  const fill = (slot, inner) => {
    html = html.replace(DETAIL_SLOTS[slot], (m, open, close) => open + inner + close);
  };
  fill("cover", b.cover ? `<img src="${attr(b.cover)}" alt="${attr(b.title)} 표지" width="420" height="596" />${b.previewPages ? '<span class="preview-badge">미리 보기</span>' : ""}` : "");
  fill("category", text(b.category));
  fill("title", text(b.title));
  fill("description", b.descriptionHtml || text(b.description));
  fill("format", text(format.label));
  fill("delivery", text(format.delivery));
  fill("price", paused ? "잠시 판매를 쉬고 있어요" : text(b.priceText || won(b.price)) + (b.upgrade ? `<small class="meta-note">${text(b.upgrade.from)} 구매자 ${won(b.upgrade.price)}</small>` : ""));
  fill("audience", text(b.audience));
  fill("orderTitle", `${text(b.title)} 주문하기`);
  if (b.featured && !paused) html = html.replace(`id="${b.featured.slice(1)}" hidden>`, `id="${b.featured.slice(1)}">`);
  if (paused) {
    html = html.replace(DETAIL_SLOTS.orderLink, '$1 style="display:none"');
    html = html.replace(DETAIL_SLOTS.pausedNote, (m, open, close) => `${open}>${text(b.pausedText || "개정판 준비 중이에요")}${close}`);
  }
  if (paused || soon) html = html.replace(DETAIL_SLOTS.orderSection, '$1 style="display:none"');
  if (soon) html = html.replace(DETAIL_SLOTS.notifySection, "$1>");
  return html;
}

// 검색엔진용 상품 정보(구글 판매자 목록). 판매 중인 책만 넣는다(출시 예정·판매 중지 책은 가격이 없어 빼야 오류가 안 남).
// 반품·배송은 서점에 적힌 문구 그대로 옮긴다. 문구를 바꾸면 여기도 같이 바꾼다:
//   환불: 자주 묻는 질문 "디지털 콘텐츠 특성상 발송 후 환불은 어렵습니다" → 반품 불가(MerchantReturnNotPermitted)
//   배송: 노션 초대·PDF 메일이라 배송비 0원, "입금 확인 후 6시간 안에"(books-data.js HANSPOON_FORMATS) → 처리 0~1일, 배송 0일
// 디지털 상품이라 GTIN은 없고, 브랜드와 sku(slug)로 상품을 알린다.
function productData(b, url, image) {
  if (b.status !== "판매중") return "";
  const days = (min, max) => ({ "@type": "QuantitativeValue", minValue: min, maxValue: max, unitCode: "DAY" });
  const data = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: b.title,
    description: b.shareText,
    image: [image, SITE + b.cover],
    url,
    sku: b.slug,
    brand: { "@type": "Brand", name: "프랑스어 한스푼" },
    offers: {
      "@type": "Offer",
      price: b.price,
      priceCurrency: "KRW",
      availability: "https://schema.org/InStock",
      url,
      hasMerchantReturnPolicy: {
        "@type": "MerchantReturnPolicy",
        applicableCountry: "KR",
        returnPolicyCategory: "https://schema.org/MerchantReturnNotPermitted",
      },
      shippingDetails: {
        "@type": "OfferShippingDetails",
        shippingRate: { "@type": "MonetaryAmount", value: 0, currency: "KRW" },
        shippingDestination: { "@type": "DefinedRegion", addressCountry: "KR" },
        deliveryTime: { "@type": "ShippingDeliveryTime", handlingTime: days(0, 1), transitTime: days(0, 0) },
      },
    },
  };
  return `<script type="application/ld+json">${JSON.stringify(data).replace(/</g, "\\u003c")}</script>\n  `;
}

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
  if (!["판매중", "출시예정", "판매중지"].includes(b.status)) problems.push(`${name}: status는 "판매중"·"출시예정"·"판매중지" 중 하나 (${b.status})`);
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
if (!source.includes("</head>")) problems.push("books/index.html의 </head>를 찾지 못함");
if (!source.includes("발송 후 환불은 어렵습니다")) console.warn("주의: 서점의 환불 문구가 바뀌었어요. 상품 정보의 반품 정책(반품 불가)이 맞는지 tools/build-pages.mjs productData를 확인하세요");
for (const [kind, f] of Object.entries(FORMATS)) {
  if (!String(f.delivery).includes("6시간 안에")) console.warn(`주의: '받는 방법'(${kind}) 문구가 바뀌었어요. 상품 정보의 배송 시간(처리 0~1일)을 확인하세요`);
}
for (const [slot, re] of Object.entries(DETAIL_SLOTS)) {
  if (!re.test(source)) problems.push(`books/index.html에서 책 소개를 미리 써 넣을 자리(${slot})를 찾지 못함`);
}
if (!existsSync(join(ROOT, "studio/index.html"))) problems.push("스튜디오 대문 studio/index.html이 없음");
// 저장소 맨 위 index.html은 이 빌드가 만드는 파일이다. 손으로 만든(고친) 것이 있으면 덮어써서 고친 내용이 사라지므로 멈춘다.
const FRONT_MARK = "<!-- 공유 카드: tools/build-pages.mjs가 만든 대문";
if (existsSync(join(ROOT, "index.html")) && !readFileSync(join(ROOT, "index.html"), "utf8").includes(FRONT_MARK)) {
  problems.push("맨 위 index.html은 배포 빌드가 만드는 서점 대문이라 손으로 고치면 안 돼요. 입금 공지는 studio/index.html, 서점은 books/index.html에서 고치고 index.html은 지워 주세요");
}
if (!source.includes("</nav>")) problems.push("books/index.html의 </nav>(위쪽 스튜디오·앱 링크)를 찾지 못함");
for (const b of books) {
  if (b.featured && !source.includes(`id="${b.featured.slice(1)}" hidden>`)) problems.push(`${b.title}: books/index.html에서 ${b.featured} 상세 소개를 찾지 못함`);
  if (!FORMATS[b.format]) problems.push(`${b.title}: books-data.js의 HANSPOON_FORMATS에 "${b.format}"이 없음`);
}

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
  console.error(`배포 페이지를 만들지 않았어요(운영 중인 사이트는 이전 그대로). 아래를 고쳐 주세요:\n  ${problems.join("\n  ")}`);
  process.exit(1);
}

// 캐시 번호: 파일 내용이 바뀌면 주소도 바뀌게
const hashOf = (file) => createHash("sha1").update(readFileSync(join(ROOT, file))).digest("hex").slice(0, 10);
const VERSIONS = Object.fromEntries(["books-data.js", "script.js", "styles.css", "notice.css"].map((f) => [f, hashOf(f)]));
const stampVersions = (html) =>
  Object.entries(VERSIONS).reduce((out, [file, v]) => out.replace(new RegExp(`/${file.replace(".", "\\.")}\\?v=[^"]+`, "g"), `/${file}?v=${v}`), html);

// ── 책별 페이지 만들기 ─────────────────────────
// 배포되는 /books/ 복사본: 캐시 번호 자동 + 미리보기 주소면 공유 카드도 그 주소로 (Vercel 빌드 기계 안에서만)
if (process.env.VERCEL) {
  const books_html = source.slice(0, start) + source.slice(start, end).replaceAll(PROD, SITE) + source.slice(end);
  const first = books.find((b) => b.id === DEFAULT_BOOK_ID) || books[0];
  writeFileSync(join(ROOT, "books/index.html"), stampVersions(prerender(books_html, first)));
  console.log(`캐시 번호: ${Object.entries(VERSIONS).map(([f, v]) => `${f}?v=${v}`).join(", ")}`);
}

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
  const html = prerender(stampVersions(source.slice(0, start) + share + source.slice(end)), b)
    .replace("</head>", `${productData(b, url, image)}</head>`)
    .replace("<title>한스푼 서점</title>", `<title>${text(b.searchTitle || b.title)} | 한스푼 서점</title>`)
    .replace(/(<meta\s+name="description"\s+content=")[^"]*(")/, `$1${attr(b.shareText)}$2`)
    .replace("<body>", `<body data-book="${b.slug}">`);
  mkdirSync(join(ROOT, "books", b.slug), { recursive: true });
  writeFileSync(join(ROOT, "books", b.slug, "index.html"), html);
  console.log(`만듦: /books/${b.slug}/  (${b.title})`);
}

// ── 대문(/) ─────────────────────────────────
// 서점 페이지 그대로 + 대문 제목·설명·대표 주소 + 3.0 소개 미리 써 넣기 + 스튜디오의 입금 공지(있으면)
{
  const first = books.find((b) => b.id === DEFAULT_BOOK_ID) || books[0];
  const studio = readFileSync(join(ROOT, "studio/index.html"), "utf8");
  const notice = studio.match(/<details\b(?=[^>]*\bclass="notice")[^>]*>[\s\S]*?<\/details>/)?.[0];
  const share = `${FRONT_MARK} (손으로 고치지 말고 books/index.html을 고치세요) -->
    <link rel="canonical" href="${SITE}/" />
    <meta property="og:type" content="website" />
    <meta property="og:site_name" content="한스푼 서점" />
    <meta property="og:title" content="한스푼 서점" />
    <meta property="og:description" content="${attr(FRONT_DESCRIPTION)}" />
    <meta property="og:url" content="${SITE}/" />
    <meta property="og:image" content="${SITE}/assets/og/books.jpg" />
    <meta property="og:image:width" content="1200" />
    <meta property="og:image:height" content="630" />
    <meta name="twitter:card" content="summary_large_image" />
    `;
  let front = source.slice(0, start) + share + source.slice(end);
  front = front
    .replace("<title>한스푼 서점</title>", `<title>${text(FRONT_TITLE)}</title>`)
    .replace(/(<meta\s+name="description"\s+content=")[^"]*(")/, `$1${attr(FRONT_DESCRIPTION)}$2`);
  if (notice) {
    front = front
      .replace("</head>", `  <link rel="stylesheet" href="/notice.css?v=x" />\n  </head>`)
      .replace("</nav>", () => `</nav>\n\n      ${notice}`);
  }
  writeFileSync(join(ROOT, "index.html"), prerender(stampVersions(front), first));
  console.log(`만듦: /  (대문 = 서점, ${first.title} 소개)`);
  console.log(notice ? "  입금 공지: studio/index.html의 공지를 대문 맨 위에 붙임" : '  입금 공지: 없음(studio/index.html에 <details class="notice">가 없어 대문에 붙이지 않음)');
}

// ── sitemap.xml ───────────────────────────────
// 검색엔진에 알릴 주소 목록. 판매 중지 책은 뺀다(다시 팔면 자동으로 들어감).
const pages = ["/", ...books.filter((b) => b.status !== "판매중지").map((b) => `/books/${b.slug}/`), "/studio/", "/apps/", "/francespoon/"];
writeFileSync(
  join(ROOT, "sitemap.xml"),
  `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${pages.map((p) => `  <url><loc>${SITE}${p}</loc></url>`).join("\n")}\n</urlset>\n`,
);
console.log(`만듦: /sitemap.xml (${pages.length}개 주소)`);
