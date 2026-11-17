// 카드 결제 서버가 쓰는 책 목록 — 가격의 기준은 화면과 똑같이 books-data.js 한 곳이다.
// books-data.js는 브라우저용(window.…)이라, 빈 window를 만들어 놓고 그대로 불러온다.
globalThis.window = globalThis.window || {};
require("../../books-data.js");

const BOOKS = globalThis.window.HANSPOON_BOOKS || [];
const FORMATS = globalThis.window.HANSPOON_FORMATS || {};

// 카드로 살 수 있는 책: 판매 중이고 가격이 있는 책만
function sellable() {
  return BOOKS.filter((b) => b.status === "판매중" && Number.isInteger(b.price) && b.price > 0 && b.slug);
}

function findBook(slug) {
  return sellable().find((b) => b.slug === slug) || null;
}

// 결제 번호(주문 번호)에 책 주소를 넣어 둔다: hs-<slug>-<시각>-<난수>, 이전 판 구매자 할인 주문은 hu-<slug>-…
// 서버가 만든 번호라서, 결제 뒤 확인할 때 "어느 책의 어떤 값이어야 하는지"를 이 번호로 다시 찾는다(브라우저가 보낸 값은 믿지 않는다).
function makePaymentId(slug, { upgrade = false, now = Date.now(), random = require("node:crypto").randomBytes(8).toString("hex") } = {}) {
  return `${upgrade ? "hu" : "hs"}-${slug}-${now.toString(36)}-${random}`;
}

const PAYMENT_ID = /^h([su])-([a-z0-9-]+)-([a-z0-9]+)-[a-f0-9]{16}$/;

// { book, upgrade } 또는 null. 할인 번호인데 그 책에 할인이 없으면 null
function orderOfPaymentId(paymentId) {
  const m = PAYMENT_ID.exec(String(paymentId || ""));
  const book = m ? findBook(m[2]) : null;
  if (!book) return null;
  const upgrade = m[1] === "u";
  if (upgrade && !(book.upgrade && Number.isInteger(book.upgrade.price))) return null;
  return { book, upgrade };
}

function bookOfPaymentId(paymentId) {
  const order = orderOfPaymentId(paymentId);
  return order ? order.book : null;
}

// 그 주문이 받아야 할 책값: 할인 주문이면 이전 판 구매자 값, 아니면 지금 책값
const priceOf = (book, upgrade) => (upgrade ? book.upgrade.price : book.price);

// 주문 번호를 만든 시각(밀리초). 번호 꼴이 아니면 0
function createdAtOf(paymentId) {
  const m = PAYMENT_ID.exec(String(paymentId || ""));
  const at = m ? parseInt(m[3], 36) : 0;
  return Number.isFinite(at) ? at : 0;
}

module.exports = { BOOKS, FORMATS, sellable, findBook, makePaymentId, orderOfPaymentId, bookOfPaymentId, priceOf, createdAtOf };
