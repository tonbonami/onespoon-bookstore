// 책 정보·가격·구글폼 선택값은 /books-data.js 한 곳에서 온다
const books = window.HANSPOON_BOOKS || [];
const DEFAULT_BOOK_ID = 5;

const won = (n) => `${n.toLocaleString("ko-KR")}원`;
const isComingSoon = (book) => book.status === "출시예정";
const isOnSale = (book) => book.status === "판매중" && book.formValue && book.price;
const priceLine = (book) => book.priceText || won(book.price);
const upgradeNote = ({ from, price }) => `${from} 구매자는 ${won(price)} (메모에 "${from} 구매"를 적어 주세요)`;

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
                  <small>${book.pickLabel} · ${won(book.price)}</small>
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
const detailPrice = document.querySelector("#detailPrice");
const detailAudience = document.querySelector("#detailAudience");
const orderTitle = document.querySelector("#orderTitle");
const previewModal = document.querySelector("#previewModal");
const previewTitle = document.querySelector("#previewTitle");
const previewPages = document.querySelector("#previewPages");
const previewClose = document.querySelector("#previewClose");
const orderForm = document.querySelector("#orderForm");
const orderStatus = document.querySelector("#orderStatus");
const arrows = document.querySelectorAll(".shelf-arrow");
let selectedBook = books[0];

function handleCoverError(img) {
  const card = img.closest(".book-card");
  if (card) card.classList.remove("has-cover");
  img.remove();
}

window.handleCoverError = handleCoverError;

function renderShelf() {
  shelf.innerHTML = books
    .map(
      (book) => `
        <button class="book-card${book.cover ? " has-cover" : ""}" type="button" style="background:${book.color}" data-id="${book.id}">
          <span class="book-spine" aria-hidden="true"></span>
          ${
            book.cover
              ? `<img class="book-cover-image" src="${book.cover}" alt="${book.title} 표지" width="420" height="596" decoding="async" onerror="handleCoverError(this)" />`
              : ""
          }
          <span class="book-tag">${book.category}</span>
          <span class="book-title">${book.title}</span>
        </button>
      `,
    )
    .join("");
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
  detailPrice.textContent = priceLine(book);
  detailAudience.textContent = book.audience;
  detailBook.disabled = !book.previewPages;

  document.querySelectorAll(".book-card").forEach((card) => {
    card.classList.toggle("is-active", Number(card.dataset.id) === id);
  });

  document.querySelectorAll(".featured-detail").forEach((el) => {
    el.hidden = true;
  });
  const featuredSelector = book.featured;
  if (featuredSelector) {
    const featured = document.querySelector(featuredSelector);
    if (featured) featured.hidden = false;
  }

  orderTitle.textContent = `${book.title} 주문하기`;

  const notifySection = document.querySelector("#notifySection");
  const orderSection = document.querySelector("#orderFormSection");
  const detailFormLink = document.querySelector("#detailForm");
  if (notifySection) notifySection.style.display = isComingSoon(book) ? "" : "none";
  if (orderSection) orderSection.style.display = isComingSoon(book) ? "none" : "";
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
}

function makePreviewPages(book) {
  if (book.previewPages?.length) {
    return book.previewPages
      .map(
        (src, index) => `
          <article class="preview-page image-page">
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

renderShelf();

// 처음 열 책: 책별 페이지(/books/<slug>/)면 그 책, /books/?book=<slug> 링크도 그 책, 아니면 기본 책
const startSlug = document.body.dataset.book || new URLSearchParams(location.search).get("book");
const startBook = books.find((book) => book.slug === startSlug);
selectBook(startBook ? startBook.id : DEFAULT_BOOK_ID);

// 책 하나를 보고 들어온 손님에게는 그 책 소개부터 보여 준다 (#orderFormSection 같은 바로가기가 있으면 그쪽이 먼저)
if (startBook && !location.hash) {
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

arrows.forEach((arrow) => {
  arrow.addEventListener("click", () => {
    const direction = arrow.classList.contains("left") ? -1 : 1;
    shelf.scrollBy({ left: direction * 260, behavior: "smooth" });
  });
});

detailBook.addEventListener("click", openPreview);
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
      .map((book) => [book.formValue, { amount: won(book.price), note: book.upgrade ? upgradeNote(book.upgrade) : "" }]),
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
