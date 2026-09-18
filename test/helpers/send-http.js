// `.http` 파일을 학생이 httpYac 으로 하듯 위에서부터 차례로 보낸다 — 게이트 전용.
// 🔀 2026-09-19 p2-31·p2-32 audit 에서 두 회차 게이트가 함께 쓰려고 뺐다.
//    「요청 12개를 다시 보내면 무엇만 달라지는가」가 두 회차 교안의 비교 기준이라서다.

/**
 * 요청마다 `{ title, status, body }` 를 돌려준다. body 는 JSON 이면 객체, 아니면 글자.
 * `# @name` 과 `{{이름.id}}`·`{{이름[0].id}}` 두 모양만 안다(`posts.http` 가 쓰는 것이 이것뿐이다).
 */
export async function sendAll(http, base) {
  const named = {};
  const out = [];
  for (const chunk of http.split(/^### /m).slice(1)) {
    const lines = chunk.replace(/\n+$/, '').split('\n');
    const title = lines.shift().trim();
    const name = lines[0].startsWith('# @name ') ? lines.shift().slice('# @name '.length).trim() : null;
    const [method, rawUrl] = lines.shift().split(' ');
    const headers = {};
    while (lines.length && lines[0].trim() !== '') {
      const [key, ...value] = lines.shift().split(':');
      headers[key.trim()] = value.join(':').trim();
    }
    const body = lines.join('\n').trim() || undefined;
    const url = rawUrl
      .replace('http://localhost:3000', base)
      .replace(/\{\{(\w+)\[0\]\.id\}\}/g, (_, n) => named[n][0].id)
      .replace(/\{\{(\w+)\.id\}\}/g, (_, n) => named[n].id);
    const res = await fetch(url, { method, headers, body });
    const text = await res.text();
    let parsed;
    try { parsed = JSON.parse(text); } catch { parsed = text; }
    if (name) named[name] = parsed;
    out.push({ title, status: res.status, body: parsed });
  }
  return out;
}

/**
 * 같은 요청 목록을 두 번 보낸 결과를 맞대어, 몸통이 달라진 요청마다 「제목: 달라진 칸들」을 돌려준다.
 * 상태 코드가 다르면 그것부터 알린다 — 칸 비교는 상태가 같을 때만 뜻이 있다.
 */
export function changedFields(before, after) {
  const out = [];
  before.forEach((b, i) => {
    const a = after[i];
    if (a.title !== b.title) throw new Error(`요청 순서가 다르다: ${b.title} / ${a.title}`);
    if (a.status !== b.status) { out.push(`${b.title}: status ${b.status}→${a.status}`); return; }
    if (JSON.stringify(a.body) === JSON.stringify(b.body)) return;
    if (typeof a.body !== 'object' || typeof b.body !== 'object') { out.push(`${b.title}: (몸통 전체)`); return; }
    const keys = [...new Set([...Object.keys(b.body), ...Object.keys(a.body)])]
      .filter((k) => JSON.stringify(a.body[k]) !== JSON.stringify(b.body[k]));
    out.push(`${b.title}: ${keys.join(',')}`);
  });
  return out;
}
