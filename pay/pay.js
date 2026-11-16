// 카드 결제 화면(/pay/) — 책·가격은 books-data.js에서 읽는다(서점과 같은 원본).
// 순서: ① 서버(/api/pay/prepare)가 주문 번호·금액을 정함 → ② 포트원 결제창 → ③ 서버(/api/pay/complete)가 포트원에 다시 확인 → 완료 화면.
// 결제창 스크립트는 '결제하기'를 누른 뒤에만 불러온다.
(() => {
  const BOOKS = (window.HANSPOON_BOOKS || []).filter((b) => b.status === "판매중" && Number.isInteger(b.price) && b.price > 0 && b.slug);
  const FORMATS = window.HANSPOON_FORMATS || {};
  const $ = (id) => document.getElementById(id);
  const won = (n) => `${Number(n).toLocaleString("ko-KR")}원`;
  // 받는 방법 문구: 서점의 "입금 확인 후 …"를 카드 결제에 맞게 "결제 확인 후 …"로
  const deliveryOf = (book) => ((FORMATS[book.format] || {}).delivery || "").replace(/^입금 확인/, "결제 확인");

  const form = $("payForm");
  const status = $("payStatus");
  const submit = $("paySubmit");
  let current = null;
  const METHOD_LABELS = { CARD: "신용·체크카드", KAKAOPAY: "카카오페이", NAVERPAY: "네이버페이", TOSSPAY: "토스페이" };
  // 완료 화면 확인값: 주문을 준비한 이 브라우저만 이메일·영수증을 자세히 본다(폰에서 결제창을 다녀와도 남도록 탭에 보관)
  const tokens = {
    key: (id) => `hs-pay-${id}`,
    put(id, token) {
      try {
        sessionStorage.setItem(this.key(id), token);
      } catch {}
    },
    get(id) {
      try {
        return sessionStorage.getItem(this.key(id)) || "";
      } catch {
        return "";
      }
    },
  };

  function setStatus(text, info = false) {
    status.textContent = text;
    status.classList.toggle("is-info", info);
  }

  function renderBooks() {
    const wanted = new URLSearchParams(location.search).get("book");
    $("payBooks").innerHTML = "";
    BOOKS.forEach((book) => {
      const label = document.createElement("label");
      label.className = "pay-book";
      const input = document.createElement("input");
      input.type = "radio";
      input.name = "book";
      input.value = book.slug;
      input.checked = book.slug === wanted;
      input.addEventListener("change", () => pick(book));
      const img = document.createElement("img");
      img.src = book.cover || "";
      img.alt = "";
      img.loading = "lazy";
      const text = document.createElement("span");
      const title = document.createElement("span");
      title.className = "pay-book-title";
      title.textContent = book.title;
      const kind = document.createElement("span");
      kind.className = "pay-book-kind";
      kind.textContent = ((FORMATS[book.format] || {}).label || "").split(" · ")[0];
      text.append(title, kind);
      const price = document.createElement("span");
      price.className = "pay-book-price";
      if (book.listPrice > book.price) {
        const was = document.createElement("s");
        was.textContent = won(book.listPrice);
        price.append(was);
      }
      price.append(won(book.price));
      label.append(input, img, text, price);
      $("payBooks").append(label);
      if (input.checked) pick(book);
    });
  }

  function pick(book) {
    current = book;
    const notion = book.format === "notion";
    $("payEmailLabel").textContent = notion ? "노션 가입 이메일" : "교재 받을 이메일";
    $("payEmailHint").hidden = !notion;
    $("sumBook").textContent = book.title;
    $("sumAmount").textContent = won(book.price);
    $("sumDelivery").textContent = deliveryOf(book);
    $("paySummary").hidden = false;
    $("payPreviewLink").href = `/books/${book.slug}/`;
    submit.textContent = `${won(book.price)} 결제하기`;
    const upgrade = $("payUpgrade");
    upgrade.hidden = !book.upgrade;
    if (book.upgrade) upgrade.textContent = `${book.upgrade.from} 구매자 할인(${won(book.upgrade.price)})은 계좌이체 주문서에서 받을 수 있어요.`;
    setStatus("");
  }

  // 빠진 칸을 찾아 첫 번째로 옮겨 준다
  function validate() {
    const name = $("payName");
    const email = $("payEmail");
    const checks = [$("agreeRefund"), $("agreeTerms")];
    name.setAttribute("aria-invalid", String(!name.value.trim()));
    email.setAttribute("aria-invalid", String(!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email.value.trim())));
    checks.forEach((box) => box.closest(".pay-check").classList.toggle("is-missing", !box.checked));
    [name, email, ...checks].forEach((el) => el.setAttribute("aria-invalid", String(el.type === "checkbox" ? !el.checked : el.getAttribute("aria-invalid") === "true")));
    if (!current) return { message: "책을 골라 주세요.", focus: document.querySelector('#payBooks input[type="radio"]') };
    if (name.getAttribute("aria-invalid") === "true") return { message: "이름을 적어 주세요.", focus: name };
    if (email.getAttribute("aria-invalid") === "true") return { message: "이메일 주소를 확인해 주세요.", focus: email };
    if (!checks[0].checked) return { message: "환불 안내를 확인하고 체크해 주세요.", focus: checks[0] };
    if (!checks[1].checked) return { message: "이용약관에 동의해 주세요.", focus: checks[1] };
    return null;
  }

  const loadSdk = () =>
    new Promise((resolve, reject) => {
      if (window.PortOne) return resolve(window.PortOne);
      const script = document.createElement("script");
      script.src = "https://cdn.portone.io/v2/browser-sdk.js";
      script.onload = () => (window.PortOne ? resolve(window.PortOne) : reject(new Error("결제창을 불러오지 못했어요.")));
      script.onerror = () => reject(new Error("결제창을 불러오지 못했어요. 인터넷 연결을 확인해 주세요."));
      document.head.append(script);
    });

  const post = async (url, body) => {
    const response = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const data = await response.json().catch(() => ({}));
    return { status: response.status, data };
  };

  async function pay(event) {
    event.preventDefault();
    if (submit.disabled) return;
    const problem = validate();
    if (problem) {
      setStatus(problem.message);
      if (problem.focus) problem.focus.focus();
      return;
    }
    submit.disabled = true;
    setStatus("결제창을 여는 중이에요…", true);
    try {
      const prepared = await post("/api/pay/prepare", {
        slug: current.slug,
        name: $("payName").value.trim(),
        email: $("payEmail").value.trim(),
        agreeRefund: $("agreeRefund").checked,
        agreeTerms: $("agreeTerms").checked,
        news: $("agreeNews").checked,
        method: (document.querySelector('#payMethods input:checked') || {}).value || "CARD",
      });
      if (prepared.status === 503) return setStatus("카드 결제는 준비 중이에요. 지금은 계좌이체 주문서를 이용해 주세요.");
      if (!prepared.data.ok) return setStatus(prepared.data.message || "주문을 준비하지 못했어요. 잠시 뒤 다시 시도해 주세요.");
      const p = prepared.data;
      $("payTest").hidden = p.mode !== "test";
      tokens.put(p.paymentId, p.viewToken);
      const PortOne = await loadSdk();
      const result = await PortOne.requestPayment({
        storeId: p.storeId,
        channelKey: p.channelKey,
        paymentId: p.paymentId,
        orderName: p.orderName,
        totalAmount: p.totalAmount,
        currency: p.currency,
        payMethod: p.payMethod,
        ...(p.easyPay ? { easyPay: p.easyPay } : {}),
        customer: p.customer,
        customData: p.customData,
        // 폰에서는 결제 뒤 이 주소로 돌아온다(paymentId가 붙어 옴)
        redirectUrl: `${location.origin}/pay/`,
      });
      if (!result) return setStatus("결제창이 닫혔어요. 다시 시도해 주세요.");
      if (result.code !== undefined) return setStatus(result.message || "결제가 끝나지 않았어요. 다시 시도해 주세요.");
      await confirm(p.paymentId);
    } catch (error) {
      setStatus(error.message || "결제를 진행하지 못했어요. 잠시 뒤 다시 시도해 주세요.");
    } finally {
      submit.disabled = false;
    }
  }

  // 서버에 결제 확인을 맡긴다. 확인이 늦으면(결제사 반영 지연) 몇 번 더 물어본다.
  async function confirm(paymentId) {
    setStatus("결제를 확인하는 중이에요…", true);
    for (let attempt = 0; attempt < 4; attempt += 1) {
      const { status: code, data } = await post("/api/pay/complete", { paymentId, token: tokens.get(paymentId) });
      if (data.ok) return done(data);
      if (code !== 409 && code !== 502) return setStatus(`${data.message || "결제를 확인하지 못했어요."} (주문 번호 ${paymentId})`);
      await new Promise((r) => setTimeout(r, 1500));
    }
    setStatus(`결제 확인이 늦어지고 있어요. 결제가 됐다면 안내 메일이 곧 도착해요. (주문 번호 ${paymentId})`);
  }

  function done(data) {
    form.hidden = true;
    $("payTest").hidden = !data.test;
    $("doneBook").textContent = data.title;
    $("doneAmount").textContent = won(data.amount);
    $("doneEmail").textContent = data.email;
    $("doneDelivery").textContent = data.format === "notion" ? "6시간 안에 이 이메일로 노션 초대가 가요" : "6시간 안에 이 이메일로 PDF를 보내 드려요";
    $("doneMail").textContent = data.mailSent ? "방금 안내 메일도 보냈어요. 보이지 않으면 스팸함을 확인해 주세요." : "안내 메일은 곧 따로 보내 드릴게요.";
    const receipt = $("doneReceipt");
    const receiptUrl = /^https:\/\//.test(data.receiptUrl || "") ? data.receiptUrl : "";
    receipt.hidden = !receiptUrl;
    if (receiptUrl) receipt.href = receiptUrl;
    $("payDone").hidden = false;
    $("payDone").focus();
    // 새로 고쳐도 다시 확인하지 않게 주소의 결제 번호를 지운다
    history.replaceState(null, "", "/pay/");
  }

  // 폰에서 결제창을 다녀온 경우: 주소에 paymentId(성공) 또는 code·message(실패)가 붙어 온다
  function resume() {
    const params = new URLSearchParams(location.search);
    const paymentId = params.get("paymentId");
    if (!paymentId) return;
    if (params.get("code")) {
      setStatus(params.get("message") || "결제가 끝나지 않았어요. 다시 시도해 주세요.");
      history.replaceState(null, "", "/pay/");
      return;
    }
    confirm(paymentId);
  }

  // 처음 열릴 때 서버에 공개 설정을 묻는다: 테스트 여부, 준비 여부, 켜진 결제 수단
  async function setup() {
    const config = await fetch("/api/pay/prepare", { headers: { Accept: "application/json" } })
      .then((r) => r.json())
      .catch(() => null);
    if (!config || !config.ok) return;
    $("payTest").hidden = config.mode !== "test";
    if (!config.ready && !status.textContent) setStatus("카드 결제는 준비 중이에요. 지금은 계좌이체 주문서를 이용해 주세요.", true);
    const methods = (config.methods || []).filter((m) => METHOD_LABELS[m]);
    if (methods.length < 2) return;
    $("payLead").textContent = `${methods.map((m) => METHOD_LABELS[m]).join(" · ")}로 결제할 수 있어요.`;
    methods.forEach((m, i) => {
      const label = document.createElement("label");
      label.className = "pay-method";
      const input = document.createElement("input");
      input.type = "radio";
      input.name = "method";
      input.value = m;
      input.checked = i === 0;
      label.append(input, METHOD_LABELS[m]);
      $("payMethods").append(label);
    });
    $("payMethods").hidden = false;
  }

  renderBooks();
  form.addEventListener("submit", pay);
  resume();
  setup();
})();
