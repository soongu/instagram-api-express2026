// 결과 표를 「언어 없는 펜스」로 «계산해서» 뽑는 자 — p2-27 이 만들고 p2-28 이 공유한다.
//
// 🚨 손으로 옮겨 적지 않으려고 만들었다. 옮겨 적는 순간 그 자리가 드리프트가 된다
//    (루트 캐논 「다이어그램-코드 수치 드리프트」).
// 🚨 폭 계산은 캐논 실측 자를 쓴다 — 한글·전각·①~⑳ = 2칸, 박스·`·`·`→`·ASCII = 1칸.
export const W = (s) => [...String(s)].reduce((a, c) => {
  const cp = c.codePointAt(0);
  const wide = (cp>=0x1100&&cp<=0x115F)||(cp>=0x2E80&&cp<=0xA4CF)||(cp>=0xAC00&&cp<=0xD7A3)
    ||(cp>=0xF900&&cp<=0xFAFF)||(cp>=0xFE30&&cp<=0xFE6F)||(cp>=0xFF00&&cp<=0xFF60)
    ||(cp>=0xFFE0&&cp<=0xFFE6)||(cp>=0x2460&&cp<=0x24FF);
  return a + (wide ? 2 : 1);
}, 0);
export const pad = (s, n, right) =>
  right ? ' '.repeat(Math.max(0, n - W(s))) + s : s + ' '.repeat(Math.max(0, n - W(s)));

// 숫자 칸은 오른쪽 정렬, 글자 칸은 왼쪽 정렬.
export function fence(rows, fields, { indent = 3, gap = 3, nullAs = '' } = {}) {
  const cols = fields.map((f) => f.name);
  // 🚨 칸 이름이 겹치면 «렌더링할 수 없다» — pg 는 줄을 객체로 주는데 같은 이름이 둘이면
  //    뒤엣것이 앞엣것을 덮어써서, 앞 표의 칸 자리에 뒤 표의 값이 찍힌다. 그대로 교안에
  //    붙이면 「1번 게시물을 minji 가 썼다」 같은 «거짓 표»가 된다(p2-28 Step 3 실측).
  //    조용히 틀린 것을 내놓느니 여기서 멈춘다 — 부르는 쪽이 칸 이름만 쓰게.
  const dup = cols.filter((n, i) => cols.indexOf(n) !== i);
  if (dup.length) throw new Error(`fence(): 칸 이름이 겹쳐서 표를 못 그린다 — ${[...new Set(dup)].join(', ')}`);
  // 정렬 방향은 «JS 타입»이 아니라 «값이 숫자로 읽히는가»로 정한다.
  // 🚨 pg 는 count()·sum() 을 문자열로 준다(bigint 는 JS 숫자에 안 들어간다). typeof 로
  //    가르면 같은 표에서 comment_count 는 오른쪽, count(*) 는 왼쪽으로 «따로 논다».
  const numeric = (v) => v !== '' && /^-?\d+(\.\d+)?$/.test(v);
  const isNum = cols.map((c) => {
    const vals = rows.map((r) => (r[c] === null || r[c] === undefined ? '' : String(r[c])));
    return vals.some((v) => v !== '') && vals.every((v) => v === '' || numeric(v));
  });
  const cell = (r, c) => (r[c] === null || r[c] === undefined ? nullAs : String(r[c]));
  const wid = cols.map((c, i) => Math.max(W(c), ...rows.map((r) => W(cell(r, c)))));
  const line = (cells) => ' '.repeat(indent) +
    cells.map((v, i) => pad(v, wid[i], isNum[i])).join(' '.repeat(gap)).replace(/\s+$/, '');
  return [line(cols), ...rows.map((r) => line(cols.map((c) => cell(r, c))))].join('\n');
}
