// 판매자 정보 — 결제 확인 메일 맨 아래에 들어간다(전자상거래법의 계약 내용 안내).
// 같은 값이 서점 맨 아래(books/index.html)와 /terms/·/privacy/·/refund/·/pay/에도 있다. 값이 확인되면 여섯 곳을 함께 채운다.
// 빈 값은 메일에서 그 항목이 빠진다. 운영에 열기 전에 모두 채워져 있어야 한다.
const SELLER = {
  name: "한스푼 스튜디오",
  owner: "김우수",
  bizNo: "", // 사업자등록번호
  mailOrderNo: "", // 통신판매업 신고번호
  address: "경기도 남양주시 호평동",
  email: "",
  phone: "",
};

function sellerLine() {
  const s = SELLER;
  return [s.name, s.owner && `대표 ${s.owner}`, s.bizNo && `사업자등록번호 ${s.bizNo}`, s.mailOrderNo && `통신판매업 신고 ${s.mailOrderNo}`, s.address, s.phone && `전화 ${s.phone}`, s.email]
    .filter(Boolean)
    .join(" · ");
}

module.exports = { SELLER, sellerLine };
