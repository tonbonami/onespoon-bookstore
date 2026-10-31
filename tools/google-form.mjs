// 구글폼 공개 양식(viewform)을 읽기만 해서(제출 없음) 지금 질문 구조를 가져온다.
// 보호 점검(tools/guard)과 배포 빌드(tools/build-pages.mjs)가 같이 쓴다.
// 돌려주는 것: { "entry.123": { 질문, 필수, 선택지: [...] }, ... } — 읽지 못하면 null
export async function readGoogleForm(action, { timeoutMs = 10000 } = {}) {
  const url = action.replace(/\/formResponse$/, "/viewform");
  const res = await fetch(url, {
    headers: { "user-agent": "Mozilla/5.0", "accept-language": "ko" },
    signal: AbortSignal.timeout(timeoutMs),
  });
  const html = await res.text();
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
