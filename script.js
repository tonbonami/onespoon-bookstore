// 책 정보·가격·구글폼 선택값은 /books-data.js 한 곳에서 온다
const books = window.HANSPOON_BOOKS || [];
const DEFAULT_BOOK_ID = 5;

const won = (n) => `${n.toLocaleString("ko-KR")}원`;
const isComingSoon = (book) => book.status === "출시예정";
const isOnSale = (book) => book.status === "판매중" && book.formValue && book.price;
const isPaused = (book) => book.status === "판매중지";
const priceLine = (book) => book.priceText || won(book.price);
// 정가가 따로 있으면(미리 구매가 등) 정가에 취소선을 긋고 지금 금액을 붙인다. HTML이라 데이터의 숫자만 넣는다
const priceHtml = (book) => (book.listPrice > book.price ? `<s class="list-price">${won(book.listPrice)}</s> ` : "") + won(book.price);
const upgradeNote = ({ from, price }) => `${from} 구매자는 ${won(price)} (메모에 "${from} 구매"를 적어 주세요)`;

// 서가 카드의 언어 칩 (books-data.js의 lang)
const LANGS = { fr: "🇫🇷 프랑스어", es: "🇪🇸 스페인어", en: "🇬🇧 영어", ko: "🇰🇷 한국어" };

// 책 소개의 '종류'·'받는 방법' 줄 (books-data.js의 HANSPOON_FORMATS, 책마다 format으로 고른다)
const FORMATS = window.HANSPOON_FORMATS || {};

// 주문서의 책 카드: 판매 중인 책만, 서가 순서대로
function renderBookPicks() {
  const grid = document.querySelector("#bookPickGrid");
  if (!grid) return;
  grid.innerHTML = books
    .filter(isOnSale)
    .map(
      (book, index) => `
              <label class="book-pick-card">
                <input type="radio" name="entry.1833963440" value="${book.formValue}"${index === 0 ? " required" : ""} />
                <img src="${book.cover}" alt="" width="${book.coverSize[0]}" height="${book.coverSize[1]}" loading="lazy" decoding="async" />
                <span>
                  <strong>${book.formValue}</strong>
                  <small>${book.pickLabel} · ${priceHtml(book)}</small>
                </span>
              </label>`,
    )
    .join("");
}

// 메모 칸 아래 이전 판 구매자 안내
function renderMemoHint() {
  const hint = document.querySelector("#memoHint");
  const book = books.find((item) => item.upgrade);
  if (!hint || !book) return;
  const { from, price } = book.upgrade;
  hint.textContent = `${from}을 구매하신 분은 "${from} 구매"와 ${from} 때 사용하신 이메일을 적어 주세요. 확인 후 안내해 드려요. (${from} 구매자는 ${won(price)})`;
  hint.hidden = false;
}

renderBookPicks();
renderMemoHint();

// 상품 데이터를 못 읽었으면 빈 주문서로 주문이 사라지지 않게 보내기 버튼을 막는다
if (!books.length) {
  document.querySelectorAll('#orderForm button[type="submit"], #notifyForm button[type="submit"]').forEach((button) => {
    button.disabled = true;
  });
  const status = document.querySelector("#orderStatus");
  if (status) status.textContent = "책 목록을 불러오지 못했어요. 새로고침한 뒤 다시 주문해 주세요.";
}

const shelf = document.querySelector("#bookShelf");
const detailContent = document.querySelector("#detailContent");
const detailBook = document.querySelector("#detailBook");
const detailCategory = document.querySelector("#detailCategory");
const detailTitle = document.querySelector("#detailTitle");
const detailDescription = document.querySelector("#detailDescription");
const detailFormat = document.querySelector("#detailFormat");
const detailDelivery = document.querySelector("#detailDelivery");
const detailPrice = document.querySelector("#detailPrice");
const detailAudience = document.querySelector("#detailAudience");
const detailPreview = document.querySelector("#detailPreview");
const orderTitle = document.querySelector("#orderTitle");
const previewModal = document.querySelector("#previewModal");
const previewTitle = document.querySelector("#previewTitle");
const previewPages = document.querySelector("#previewPages");
const previewClose = document.querySelector("#previewClose");
const orderForm = document.querySelector("#orderForm");
const orderStatus = document.querySelector("#orderStatus");
let selectedBook = books[0];

function handleCoverError(img) {
  const card = img.closest(".book-card");
  if (card) card.classList.remove("has-cover");
  img.remove();
}

window.handleCoverError = handleCoverError;

function renderShelf() {
  shelf.innerHTML = books
    .filter((book) => !isPaused(book))
    .map(
      (book) => `
        <button class="book-card${book.cover ? " has-cover" : ""}" type="button" data-id="${book.id}" aria-pressed="${book.id === (selectedBook ? selectedBook.id : DEFAULT_BOOK_ID) ? "true" : "false"}">
          <span class="book-cover-wrap" style="--book-color:${book.color};background:${book.color}">
            ${
              book.cover
                ? `<img class="book-cover-image" src="${book.cover}" alt="${book.title} 표지" width="420" height="596" decoding="async" onerror="handleCoverError(this)" />`
                : ""
            }
            <span class="book-cover-fallback" aria-hidden="true">${book.title}</span>
            ${LANGS[book.lang] ? `<span class="book-lang">${LANGS[book.lang]}</span>` : ""}
            <span class="book-check" aria-hidden="true">✓</span>
          </span>
          <span class="book-info">
            <span class="book-title">${book.title}</span>
            <span class="book-price-line">${
              isOnSale(book)
                ? priceHtml(book)
                : `<span class="book-badge">${book.badge || "출시 예정"}</span>`
            }</span>
          </span>
        </button>
      `,
    )
    .join("");
  shelf.style.setProperty("--shelf-columns", Math.min(shelf.children.length, 4) || 4);
}

// 책 소개 아래 후기 칸: 우댕이 고른 후기만, 많아야 6개. 없으면 칸째 숨긴다. (배포 빌드의 미리 써 넣기와 같은 모양)
function renderReviews(book) {
  const section = document.querySelector("#bookReviews");
  const list = document.querySelector("#reviewList");
  if (!section || !list) return;
  const reviews = (book.reviews || []).slice(0, 6);
  section.hidden = !reviews.length;
  list.replaceChildren(
    ...reviews.map((r) => {
      const li = document.createElement("li");
      li.className = "review-card";
      const stars = document.createElement("p");
      stars.className = "review-stars";
      stars.setAttribute("aria-label", `별 5개 중 ${r.stars}개`);
      stars.innerHTML = "★".repeat(r.stars) + `<span class="off">${"★".repeat(5 - r.stars)}</span>`;
      const body = document.createElement("p");
      body.className = "review-text";
      body.textContent = r.text;
      const who = document.createElement("p");
      who.className = "review-who";
      who.textContent = `${r.who} · ${r.date}`;
      li.append(stars, body, who);
      return li;
    }),
  );
}

function selectBook(id) {
  const book = books.find((item) => item.id === id);
  if (!book) return;
  selectedBook = book;

  detailContent.classList.remove("fade-in");
  void detailContent.offsetWidth;
  detailContent.classList.add("fade-in");

  detailBook.style.backgroundColor = book.color;
  if (book.cover) {
    detailBook.innerHTML = `<img src="${book.cover}" alt="${book.title} 표지" width="420" height="596" />${book.previewPages ? '<span class="preview-badge">미리 보기</span>' : ""}`;
    const img = detailBook.querySelector("img");
    img.addEventListener("error", () => {
      detailBook.innerHTML = `<span>${book.title}</span>${book.previewPages ? '<span class="preview-badge">미리 보기</span>' : ""}`;
    });
  } else {
    detailBook.innerHTML = `<span>${book.title}</span>${book.previewPages ? '<span class="preview-badge">미리 보기</span>' : ""}`;
  }
  detailCategory.textContent = book.category;
  detailTitle.textContent = book.title;
  if (book.descriptionHtml) detailDescription.innerHTML = book.descriptionHtml;
  else detailDescription.textContent = book.description;
  const format = FORMATS[book.format] || { label: "-", delivery: "-" };
  detailFormat.textContent = format.label;
  detailDelivery.textContent = format.delivery;
  if (book.deliveryNote && !isPaused(book)) {
    const note = document.createElement("small");
    note.className = "meta-note";
    note.textContent = book.deliveryNote;
    detailDelivery.append(note);
  }
  if (isPaused(book)) detailPrice.textContent = "잠시 판매를 쉬고 있어요";
  else if (book.listPrice > book.price && !book.priceText) detailPrice.innerHTML = priceHtml(book);
  else detailPrice.textContent = priceLine(book);
  if (book.priceNote && !isPaused(book)) {
    const note = document.createElement("small");
    note.className = "meta-note";
    note.textContent = book.priceNote;
    detailPrice.append(note);
  }
  if (book.upgrade && !isPaused(book)) {
    const note = document.createElement("small");
    note.className = "meta-note";
    note.textContent = `${book.upgrade.from} 구매자 ${won(book.upgrade.price)}`;
    detailPrice.append(note);
  }
  detailAudience.textContent = book.audience;
  renderReviews(book);
  detailBook.disabled = !book.previewPages;
  detailPreview.hidden = !book.previewPages;
  if (book.previewPages) detailPreview.textContent = `미리 보기 · ${book.previewPages.length}쪽`;

  document.querySelectorAll(".book-card").forEach((card) => {
    const isActive = Number(card.dataset.id) === id;
    card.classList.toggle("is-active", isActive);
    card.setAttribute("aria-pressed", isActive ? "true" : "false");
  });

  document.querySelectorAll(".featured-detail").forEach((el) => {
    el.hidden = true;
  });
  const featuredSelector = book.featured;
  if (featuredSelector && !isPaused(book)) {
    const featured = document.querySelector(featuredSelector);
    if (featured) featured.hidden = false;
  }

  orderTitle.textContent = `${book.title} 주문하기`;

  const notifySection = document.querySelector("#notifySection");
  const orderSection = document.querySelector("#orderFormSection");
  const detailFormLink = document.querySelector("#detailForm");
  if (notifySection) notifySection.style.display = isComingSoon(book) ? "" : "none";
  if (orderSection) orderSection.style.display = isComingSoon(book) || isPaused(book) ? "none" : "";
  // 판매를 멈춘 책: 주문 버튼 대신 짧은 안내만
  const pausedNote = document.querySelector("#detailPaused");
  if (pausedNote) {
    pausedNote.hidden = !isPaused(book);
    pausedNote.textContent = isPaused(book) ? book.pausedText || "개정판 준비 중이에요" : "";
  }
  if (detailFormLink) detailFormLink.style.display = isPaused(book) ? "none" : "";
  if (detailFormLink) {
    detailFormLink.textContent = isComingSoon(book) ? "출시 알림 신청하기" : "주문 양식 작성하기";
    detailFormLink.setAttribute("href", isComingSoon(book) ? "#notifySection" : "#orderFormSection");
  }

  const allRadios = document.querySelectorAll(
    '.book-pick input[name="entry.1833963440"]',
  );
  if (book.formValue) {
    const radio = document.querySelector(
      `.book-pick input[name="entry.1833963440"][value="${book.formValue}"]`,
    );
    if (radio && !radio.disabled) {
      radio.checked = true;
    } else {
      allRadios.forEach((r) => (r.checked = false));
    }
  } else {
    allRadios.forEach((r) => (r.checked = false));
  }
  updateDepositAmount();
  updateOrderBar(book);
}

// ── 폰 하단 주문 띠 ─────────────────────────────
// 책 소개의 주문 버튼을 지나 내려왔고, 주문서(출시 알림)가 화면에 없을 때만 보인다.
const orderBar = document.querySelector("#orderBar");
const phone = window.matchMedia("(max-width: 760px)");
if (orderBar) document.body.classList.add("has-order-bar");

function updateOrderBar(book) {
  if (!orderBar) return;
  document.querySelector("#orderBarCover").src = book.cover;
  document.querySelector("#orderBarTitle").textContent = book.title;
  document.querySelector("#orderBarPrice").textContent = isComingSoon(book) ? "곧 출시" : won(book.price);
  const go = document.querySelector("#orderBarGo");
  go.textContent = isComingSoon(book) ? "출시 알림 받기" : "주문하기";
  go.setAttribute("href", isComingSoon(book) ? "#notifySection" : "#orderFormSection");
  refreshOrderBar();
}

function refreshOrderBar() {
  if (!orderBar) return;
  if (isPaused(selectedBook)) {
    orderBar.hidden = true;
    return;
  }
  const box = (sel) => document.querySelector(sel)?.getBoundingClientRect();
  const onScreen = (sel) => {
    const b = box(sel);
    return !!b && b.height > 0 && b.bottom > 0 && b.top < window.innerHeight;
  };
  const passedDetail = box("#detailForm").bottom < 0;
  const done = !document.querySelector("#orderDone").hidden;
  orderBar.hidden = !(phone.matches && passedDetail && !done && !onScreen("#orderFormSection") && !onScreen("#notifySection"));
}

let orderBarTick = false;
window.addEventListener(
  "scroll",
  () => {
    if (orderBarTick) return;
    orderBarTick = true;
    window.requestAnimationFrame(() => {
      orderBarTick = false;
      refreshOrderBar();
    });
  },
  { passive: true },
);
window.addEventListener("resize", refreshOrderBar);

// 띠를 누르면 주문서의 책 선택을 지금 보고 있던 책으로 다시 맞춘 뒤 내려간다
document.querySelector("#orderBarGo")?.addEventListener("click", () => {
  if (!selectedBook.formValue) return;
  const radio = document.querySelector(`.book-pick input[name="entry.1833963440"][value="${selectedBook.formValue}"]`);
  if (radio) {
    radio.checked = true;
    updateDepositAmount();
  }
});

function makePreviewPages(book) {
  if (book.previewPages?.length) {
    return book.previewPages
      .map(
        (src, index) => `
          <article class="preview-page image-page${book.previewWide ? " is-wide" : ""}">
            <img src="${src}" alt="${book.title} 미리보기 ${index + 1}페이지" />
            <span>${String(index + 1).padStart(2, "0")}</span>
          </article>
        `,
      )
      .join("");
  }

  const pages = [
    { type: "cover", label: "표지" },
    { title: "Bonjour, Paris", body: "오늘의 표현\nBonjour. Je voudrais un café, s'il vous plaît.\n안녕하세요. 커피 한 잔 주세요." },
    { title: "Day 1", body: "카페에서 주문하기\nUn croissant, s'il vous plaît.\n크루아상 하나 주세요." },
  ];

  return pages
    .map((page, index) => {
      if (page.type === "cover" && book.cover) {
        return `
          <article class="preview-page cover-page">
            <img src="${book.cover}" alt="${book.title} 표지" />
            <span>${page.label}</span>
          </article>
        `;
      }

      return `
        <article class="preview-page text-page" style="background:${book.color}">
          <span>${String(index + 1).padStart(2, "0")}</span>
          <h3>${page.title || book.title}</h3>
          <p>${page.body.replace(/\n/g, "<br>")}</p>
        </article>
      `;
    })
    .join("");
}

function openPreview() {
  if (!selectedBook) return;
  previewTitle.textContent = selectedBook.title;
  previewPages.innerHTML = makePreviewPages(selectedBook);
  previewPages.classList.toggle("is-wide", !!selectedBook.previewWide);
  previewPages.scrollLeft = 0;
  previewModal.classList.add("is-open");
  previewModal.setAttribute("aria-hidden", "false");
  document.body.classList.add("modal-open");
  previewClose.focus();
}

window.openPreview = openPreview;

function closePreview() {
  previewModal.classList.remove("is-open");
  previewModal.setAttribute("aria-hidden", "true");
  document.body.classList.remove("modal-open");
  detailBook.focus();
}

// '책 고르기' 아래 띠: books-data.js에 banner가 있는 판매 중인 책 하나. 그 책의 페이지(/books/<slug>/)에서는 숨긴다
function renderShelfBanner() {
  const box = document.querySelector("#shelfBanner");
  const book = books.find((item) => item.banner && isOnSale(item));
  if (!box || !book || document.body.dataset.book === book.slug) return;
  const { tag, kind, free } = book.banner;
  box.innerHTML = `
    <span class="shelf-banner-tag">${tag}</span>
    <span class="shelf-banner-text">
      <small>${kind}</small>
      <strong>${book.title}</strong>
      <span class="shelf-banner-price">${priceHtml(book)}${book.priceNote ? ` · ${book.priceNote}` : ""}</span>
    </span>
    <span class="shelf-banner-actions">
      <a class="shelf-banner-go" href="/books/${book.slug}/">자세히 보기 →</a>
      ${free ? `<a class="shelf-banner-free" href="${free.href}">${free.label}</a>` : ""}
    </span>`;
  box.hidden = false;
}

renderShelf();
renderShelfBanner();

// 처음 열 책: 책별 페이지(/books/<slug>/)면 그 책, /books/?book=<slug> 링크도 그 책, 아니면 기본 책
const startSlug = document.body.dataset.book || new URLSearchParams(location.search).get("book");
const startBook = books.find((book) => book.slug === startSlug);
selectBook(startBook ? startBook.id : DEFAULT_BOOK_ID);

// 책 하나를 보고 들어온 손님에게는 그 책 소개부터 보여 준다 (#orderFormSection 같은 바로가기가 있으면 그쪽이 먼저).
// 처음 들어왔을 때만: 뒤로 가기·새로고침은 브라우저가 기억한 위치를 그대로 둔다.
const navigationType = performance.getEntriesByType("navigation")[0]?.type;
if (startBook && !location.hash && navigationType !== "back_forward" && navigationType !== "reload") {
  const card = shelf.querySelector(`.book-card[data-id="${startBook.id}"]`);
  if (card) card.scrollIntoView({ behavior: "instant", block: "nearest", inline: "center" });
  const detail = document.querySelector("#bookDetail");
  window.scrollTo({ top: detail.getBoundingClientRect().top + window.scrollY - 12, behavior: "instant" });
}

shelf.addEventListener("click", (event) => {
  const card = event.target.closest(".book-card");
  if (!card) return;
  selectBook(Number(card.dataset.id));
  document.querySelector("#bookDetail").scrollIntoView({ behavior: "smooth", block: "start" });
});

function setupCollapseButtons() {
  document.querySelectorAll(".collapse-toggle-btn").forEach((button) => {
    button.addEventListener("click", () => {
      const targetId = button.getAttribute("aria-controls");
      const target = document.getElementById(targetId);
      if (!target) return;
      const isExpanded = button.getAttribute("aria-expanded") === "true";
      if (isExpanded) {
        target.hidden = true;
        button.setAttribute("aria-expanded", "false");
        button.textContent = button.dataset.labelClosed;
        button.scrollIntoView({ behavior: "smooth", block: "nearest" });
      } else {
        target.hidden = false;
        button.setAttribute("aria-expanded", "true");
        button.textContent = button.dataset.labelOpen;
      }
    });
  });
}

setupCollapseButtons();

detailBook.addEventListener("click", openPreview);
detailPreview.addEventListener("click", openPreview);
previewClose.addEventListener("click", closePreview);
previewModal.addEventListener("click", (event) => {
  if (event.target === previewModal) closePreview();
});

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && previewModal.classList.contains("is-open")) {
    closePreview();
  }
});

const orderEmail = document.querySelector("#orderEmail");
const orderEmailMirror1 = document.querySelector("#orderEmailMirror1");
const orderEmailMirror2 = document.querySelector("#orderEmailMirror2");

function syncEmailMirrors() {
  if (!orderEmail) return;
  const value = orderEmail.value;
  if (orderEmailMirror1) orderEmailMirror1.value = value;
  if (orderEmailMirror2) orderEmailMirror2.value = value;
}

if (orderEmail) {
  orderEmail.addEventListener("input", syncEmailMirrors);
  orderEmail.addEventListener("change", syncEmailMirrors);
}

const depositCopy = document.querySelector("#depositCopy");
const depositAccount = document.querySelector("#depositAccount");

if (depositCopy && depositAccount) {
  depositCopy.addEventListener("click", async () => {
    const value = depositAccount.textContent.trim();
    try {
      await navigator.clipboard.writeText(value);
    } catch (e) {
      const range = document.createRange();
      range.selectNode(depositAccount);
      const sel = window.getSelection();
      sel.removeAllRanges();
      sel.addRange(range);
    }
    depositCopy.textContent = "복사됨";
    depositCopy.classList.add("is-copied");
    window.setTimeout(() => {
      depositCopy.textContent = "복사";
      depositCopy.classList.remove("is-copied");
    }, 1500);
  });
}

// 책별 입금 금액 (가격이 바뀌면 여기와 books 배열의 price를 함께 고쳐 주세요)
function getBookAmounts() {
  return Object.fromEntries(
    books
      .filter(isOnSale)
      .map((book) => [
        book.formValue,
        {
          amount: won(book.price),
          note: book.upgrade
            ? upgradeNote(book.upgrade)
            : book.priceNote
              ? `${book.priceNote}${book.listPrice > book.price ? ` (정가 ${won(book.listPrice)})` : ""}`
              : "",
        },
      ]),
  );
}

function getSelectedBookValue() {
  const checked = document.querySelector('.book-pick input[name="entry.1833963440"]:checked');
  return checked ? checked.value : "";
}

function updateDepositAmount() {
  const amountEl = document.querySelector("#depositAmount");
  const noteEl = document.querySelector("#depositAmountNote");
  if (!amountEl) return;
  const info = getBookAmounts()[getSelectedBookValue()];
  amountEl.textContent = info ? info.amount : "위에서 책을 골라 주세요";
  amountEl.classList.toggle("is-empty", !info);
  if (noteEl) {
    noteEl.textContent = info && info.note ? info.note : "";
    noteEl.hidden = !(info && info.note);
  }
  // 메모 칸의 이전 판 구매자 안내는 그 책을 골랐을 때만
  const memoHint = document.querySelector("#memoHint");
  const picked = books.find((book) => book.formValue === getSelectedBookValue());
  if (memoHint && memoHint.textContent) memoHint.hidden = !(picked && picked.upgrade);
}

document.querySelectorAll('.book-pick input[name="entry.1833963440"]').forEach((radio) => {
  radio.addEventListener("change", updateDepositAmount);
});
updateDepositAmount();

const orderDone = document.querySelector("#orderDone");

function copyText(text, button) {
  const done = () => {
    button.textContent = "복사됨";
    button.classList.add("is-copied");
    window.setTimeout(() => {
      button.textContent = "복사";
      button.classList.remove("is-copied");
    }, 1500);
  };
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(text).then(done, done);
  } else {
    done();
  }
}

const doneCopy = document.querySelector("#doneCopy");
if (doneCopy) {
  doneCopy.addEventListener("click", () => {
    const account = document.querySelector("#doneAccount");
    copyText(account ? account.textContent.trim() : "110-234-710919", doneCopy);
  });
}

function showOrderDone({ bookValue, name, email }) {
  if (!orderDone) {
    orderStatus.textContent = "전송되었습니다. 위 계좌로 입금해 주시면 6시간 안에 보내드릴게요.";
    return;
  }
  const info = getBookAmounts()[bookValue];
  const setText = (sel, value) => {
    const el = document.querySelector(sel);
    if (el) el.textContent = value;
  };
  setText("#doneBook", bookValue || "-");
  setText("#doneAmount", info ? info.amount : "-");
  // 이전 판 구매자 금액은 그 책(3.0)을 주문했을 때만 금액 아래에 같이
  const doneNote = document.querySelector("#doneAmountNote");
  const upgradeBook = books.find((book) => book.formValue === bookValue && book.upgrade);
  if (doneNote) {
    doneNote.textContent = upgradeBook
      ? `${upgradeBook.upgrade.from} 구매자는 ${won(upgradeBook.upgrade.price)} (메모에 '${upgradeBook.upgrade.from} 구매')`
      : "";
    doneNote.hidden = !upgradeBook;
  }
  // 발송 일정이 따로 있는 책(미리 구매 등)은 받는 시기를 같이
  const doneDeliveryRow = document.querySelector("#doneDeliveryRow");
  const deliveryBook = books.find((book) => book.formValue === bookValue && book.deliveryNote);
  if (doneDeliveryRow) {
    setText("#doneDelivery", deliveryBook ? deliveryBook.deliveryNote : "");
    doneDeliveryRow.hidden = !deliveryBook;
  }
  setText("#doneDepositor", name || "-");
  setText("#doneEmail", email || "-");
  orderForm.hidden = true;
  orderDone.hidden = false;
  orderDone.scrollIntoView({ behavior: "smooth", block: "start" });
  orderDone.focus({ preventScroll: true });
}

const orderAgain = document.querySelector("#orderAgain");
if (orderAgain && orderDone) {
  orderAgain.addEventListener("click", () => {
    orderDone.hidden = true;
    orderForm.hidden = false;
    orderStatus.textContent = "";
    updateDepositAmount();
    orderForm.scrollIntoView({ behavior: "smooth", block: "start" });
  });
}

orderForm.addEventListener("submit", () => {
  syncEmailMirrors();
  const bookValue = getSelectedBookValue();
  const nameInput = orderForm.querySelector('input[name="entry.133598618"]');
  const name = nameInput ? nameInput.value.trim() : "";
  const email = orderEmail ? orderEmail.value.trim() : "";
  orderStatus.textContent = "주문 정보가 전송되고 있어요...";
  window.setTimeout(() => {
    orderStatus.textContent = "";
    showOrderDone({ bookValue, name, email });
    orderForm.reset();
    updateDepositAmount();
  }, 900);
});

const notifyForm = document.querySelector("#notifyForm");
const notifyStatus = document.querySelector("#notifyStatus");
if (notifyForm) {
  notifyForm.addEventListener("submit", () => {
    if (notifyStatus) notifyStatus.textContent = "신청 정보를 보내고 있어요...";
    window.setTimeout(() => {
      notifyForm.reset();
      if (notifyStatus) notifyStatus.textContent = "신청해 주셔서 고마워요. 11월 중순, 가장 먼저 알려 드릴게요.";
    }, 900);
  });
}
