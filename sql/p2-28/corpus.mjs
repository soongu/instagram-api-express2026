// p2-28 코퍼스 파서 + 착수 상태 세우기. 렌더러와 게이트가 «같은 것»을 쓴다.
//
// 구분자 `-- @@`.  `-- @@bookstore`/`-- @@instagram` 은 대상 DB 전환,
// `-- @@setup` 은 교안 블록이 아닌 준비 구문, `-- @@fails <SQLSTATE>` 는 일부러 막히는 블록.
import { readFileSync } from 'node:fs';
const HERE = new URL('./', import.meta.url);
const read = (n) => readFileSync(new URL(n, HERE), 'utf8');

export function parse(raw) {
  const parts = raw.split(/^-- @@(bookstore|instagram|setup|fails [0-9A-Z]{5})?$/m);
  const out = [];
  for (let i = 1; i < parts.length; i += 2) {
    const mark = parts[i];
    if (mark === 'bookstore' || mark === 'instagram') out.push({ db: mark });
    const sql = (parts[i + 1] || '').split('\n').filter((l) => !l.startsWith('--')).join('\n').trim();
    if (!sql) continue;
    if (mark === 'setup') out.push({ setup: true, sql });
    else out.push({ sql, fails: mark?.startsWith('fails') ? mark.slice(6) : undefined });
  }
  return out;
}
/** 교안·답안이 인용하는 SQL 블록만 (준비 구문·DB 전환 제외) */
export const quoted = (raw) => parse(raw).filter((s) => s.sql && !s.setup).map((s) => s.sql);
export const lectureCorpus = () => read('blocks.sql');
export const answerCorpus = () => read('answers.sql');

export async function setupInstagram(c) { await c.query(read('00-posts.sql')); }
export async function setupBookstore(c) { await c.query(read('01-bookstore.sql')); }
