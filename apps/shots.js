// 스크린샷 줄마다 위치 점과 (마우스 환경용) 좌우 버튼을 붙인다.
const arrow = (d) =>
  `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${d}"/></svg>`;

document.querySelectorAll(".app-shots").forEach((row) => {
  const shots = [...row.querySelectorAll("img")];
  const wrap = document.createElement("div");
  wrap.className = "shots-wrap";
  row.before(wrap);
  wrap.append(row);

  const dots = document.createElement("div");
  dots.className = "shots-dots";
  dots.setAttribute("aria-hidden", "true");
  shots.forEach(() => dots.append(document.createElement("span")));
  wrap.append(dots);

  const prev = document.createElement("button");
  const next = document.createElement("button");
  prev.className = "shots-btn prev";
  next.className = "shots-btn next";
  prev.setAttribute("aria-label", "이전 화면");
  next.setAttribute("aria-label", "다음 화면");
  prev.innerHTML = arrow("m15 6-6 6 6 6");
  next.innerHTML = arrow("m9 6 6 6-6 6");
  wrap.append(prev, next);

  const step = () => shots[1].getBoundingClientRect().left - shots[0].getBoundingClientRect().left;
  prev.addEventListener("click", () => row.scrollBy({ left: -step(), behavior: "smooth" }));
  next.addEventListener("click", () => row.scrollBy({ left: step(), behavior: "smooth" }));

  const update = () => {
    const box = row.getBoundingClientRect();
    shots.forEach((img, i) => {
      const r = img.getBoundingClientRect();
      const shown = (Math.min(r.right, box.right) - Math.max(r.left, box.left)) / r.width;
      dots.children[i].classList.toggle("on", shown > 0.7);
    });
    prev.hidden = row.scrollLeft < 4;
    next.hidden = row.scrollLeft + row.clientWidth > row.scrollWidth - 4;
  };
  row.addEventListener("scroll", update, { passive: true });
  window.addEventListener("resize", update);
  window.addEventListener("load", update);
  shots.forEach((img) => img.addEventListener("load", update, { once: true }));
  update();
});
