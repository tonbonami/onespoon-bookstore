const FEATURED_DETAILS = {
  1: "#featured30Days",
  5: "#featuredNoFu3",
};
const DEFAULT_BOOK_ID = 1;

const books = [
  {
    id: 1,
    title: "30 Days in Paris",
    category: "프랑스어 입문 · 듣고 따라 말하는 어휘책",
    description:
      "30일 동안 파리에 머무는 한 사람의 시점을 따라가며, 카페·시장·사무실·행정 창구에서 실제로 쓰이는 프랑스어를 한 스푼씩 떠먹는 책. 외워야 한다는 부담 없이, 들으면서 따라 말하는 사이에 600개의 표현이 자연스럽게 자리 잡습니다.",
    price: "20,000원",
    audience: "프랑스어 입문 · 파리 여행 · 유학 · 일상 회화 준비자",
    color: "#E8F0FE",
    cover: "assets/30daysinparis_bookcover.png",
    formValue: "30 Days in Paris",
    previewPages: [
      "assets/preview-pages/paris-preview-01.jpg",
      "assets/preview-pages/paris-preview-02.jpg",
      "assets/preview-pages/paris-preview-03.jpg",
      "assets/preview-pages/paris-preview-04.jpg",
      "assets/preview-pages/paris-preview-05.jpg",
      "assets/preview-pages/paris-preview-06.jpg",
      "assets/preview-pages/paris-preview-07.jpg",
      "assets/preview-pages/paris-preview-08.jpg",
      "assets/preview-pages/paris-preview-09.jpg",
      "assets/preview-pages/paris-preview-10.jpg",
    ],
  },
  {
    id: 6,
    title: "프랑스어 필수 동사 100",
    category: "프랑스어 입문 · 빈도순 필수 동사",
    description:
      "가장 많이 사용하는 프랑스어 동사 100개를 빈도순으로. 주요 동사 변화표와 예문 300개를 수록한 핵심 동사 학습서. être · avoir · aller · faire 부터 시작합니다.",
    price: "9,000원",
    audience: "프랑스어 입문 ~ 초중급 · 동사 활용을 빠르게 익히고 싶은 분",
    color: "#f5f0e8",
    cover: "assets/verbs-100-cover.png?v=2",
    formValue: "프랑스어 필수동사 100",
    previewPages: [
      "assets/preview-pages/verbs-100-preview-01.png",
      "assets/preview-pages/verbs-100-preview-02.png",
      "assets/preview-pages/verbs-100-preview-03.png",
    ],
  },
  {
    id: 5,
    title: "나의 첫 프랑스어 책 3.0",
    category: "프랑스어 입문 · 노션 기반 종합 교재",
    description:
      "한 권으로 알파벳부터 어린왕자 원문까지. 발음과 문법을 중심 축으로 — 알파벳·자음·모음·리에종부터 명사·관사·시제·고급 문법·동사 변화까지 단단히 다지고, 어휘·회화·일상 표현·읽기까지 200+ 페이지에 담은 노션 기반 프랑스어 입문서 (A1~B1).",
    price: "28,000원 (예상)",
    audience: "한국어로 프랑스어를 처음 시작하는 입문자 (A1~B1)",
    color: "#f5ede0",
    cover: "assets/nofu-book-3-cover.png?v=2",
    formValue: "나의 첫 프랑스어 책 3.0 (준비중)",
    previewPages: [
      "assets/preview-pages/nofu3-preview-01.png",
      "assets/preview-pages/nofu3-preview-02.png",
      "assets/preview-pages/nofu3-preview-03.png",
      "assets/preview-pages/nofu3-preview-04.png",
      "assets/preview-pages/nofu3-preview-05.png",
    ],
  },
];

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
              ? `<img class="book-cover-image" src="${book.cover}" alt="${book.title} 표지" onerror="handleCoverError(this)" />`
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
    detailBook.innerHTML = `<img src="${book.cover}" alt="${book.title} 표지" /><span class="preview-badge">미리 보기</span>`;
    const img = detailBook.querySelector("img");
    img.addEventListener("error", () => {
      detailBook.innerHTML = `<span>${book.title}</span>${book.previewPages ? '<span class="preview-badge">미리 보기</span>' : ""}`;
    });
  } else {
    detailBook.innerHTML = `<span>${book.title}</span>${book.previewPages ? '<span class="preview-badge">미리 보기</span>' : ""}`;
  }
  detailCategory.textContent = book.category;
  detailTitle.textContent = book.title;
  detailDescription.textContent = book.description;
  detailPrice.textContent = book.price;
  detailAudience.textContent = book.audience;
  detailBook.disabled = !book.previewPages;

  document.querySelectorAll(".book-card").forEach((card) => {
    card.classList.toggle("is-active", Number(card.dataset.id) === id);
  });

  document.querySelectorAll(".featured-detail").forEach((el) => {
    el.hidden = true;
  });
  const featuredSelector = FEATURED_DETAILS[book.id];
  if (featuredSelector) {
    const featured = document.querySelector(featuredSelector);
    if (featured) featured.hidden = false;
  }

  orderTitle.textContent = `${book.title} 주문하기`;

  if (book.formValue) {
    const radio = document.querySelector(
      `.book-pick input[name="entry.1833963440"][value="${book.formValue}"]`,
    );
    if (radio) radio.checked = true;
  } else {
    document
      .querySelectorAll('.book-pick input[name="entry.1833963440"]')
      .forEach((r) => (r.checked = false));
  }
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
selectBook(DEFAULT_BOOK_ID);

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

orderForm.addEventListener("submit", () => {
  syncEmailMirrors();
  orderStatus.textContent = "주문 정보가 전송되고 있어요...";
  window.setTimeout(() => {
    orderStatus.textContent = "전송되었습니다. 위 계좌로 입금해주시면 6시간 안에 보내드릴게요.";
    orderForm.reset();
  }, 900);
});
