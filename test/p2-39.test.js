// p2-39 「무엇을 만들지 정해요」 게이트
//
// 🚨 이 회차는 서버를 만들지 않는다. 연습용 주제 설명서(동네 물건 나눔) 한 장을
//    «설계 문서 둘» 로 옮기는 회차라, 판정 축도 그 둘이다.
//    ① 표와 관계 — `schema.prisma` 초안이 실제 표로 서고, 적어둔 규칙이 «실제로» 막는다.
//       같은 이웃이 같은 글에 두 번 신청하는 것 · 신청이 달린 채 글만 사라지는 것 ·
//       글이 남아 있는 분류를 지우는 것.
//    ② 계약 — `.http` 예시가 교안의 계약 표와 한 줄도 어긋나지 않는다.
//       p2-36 이 «여섯 군데» 로 겪은 어긋남을 이번엔 만들기 전에 막는 자리다.
// 🚨 진짜 instagram DB 를 안 건드린다 — 전용 DB 를 만들고 끝나면 지운다.
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import pg from 'pg';

const ROOT = new URL('../', import.meta.url);
const P = (rel) => new URL(rel, ROOT).pathname;
const read = (p) => readFileSync(p, 'utf8');

const ADMIN = { host: 'localhost', port: 5432, database: 'postgres', user: 'postgres', password: 'postgres' };
const GATE_DB = 'p239_gate';

const SCHEMA = 'lab/p2-39/schema.prisma';
const HTTP = 'lab/p2-39/api.http';

const prismaCli = (args) =>
  execFileSync(P('node_modules/.bin/prisma'), args, { cwd: P('.'), encoding: 'utf8', env: { ...process.env } });

/** 교안 Step 4 의 계약 표 — 교안이 서면 표와 이 목록을 대조하는 축을 더한다. */
const CONTRACT = [
  'GET /api/categories',
  'GET /api/shares',
  'GET /api/shares/:id',
  'POST /api/shares',
  'PATCH /api/shares/:id',
  'POST /api/shares/:id/requests',
];

const diffSql = () => prismaCli(['migrate', 'diff', '--from-empty', '--to-schema', P(SCHEMA), '--script']);

describe('p2-39 ① 표와 관계 — 초안이 실제 표로 선다', () => {
  let admin;
  let db;

  beforeAll(async () => {
    admin = new pg.Client(ADMIN);
    await admin.connect();
    await admin.query(`DROP DATABASE IF EXISTS ${GATE_DB} WITH (FORCE)`);
    await admin.query(`CREATE DATABASE ${GATE_DB}`);
    db = new pg.Client({ ...ADMIN, database: GATE_DB });
    await db.connect();
    await db.query(diffSql());
    await db.query(`
      INSERT INTO categories (name) VALUES ('책'), ('생활용품');
      INSERT INTO neighbors (nickname, town) VALUES ('minji', '망원동'), ('jaehoon', '합정동');
      INSERT INTO shares (title, content, owner_id, category_id)
        VALUES ('다 읽은 소설 세 권', '상태 좋아요', 1, 1);
    `);
  });

  afterAll(async () => {
    await db?.end();
    await admin?.query(`DROP DATABASE IF EXISTS ${GATE_DB} WITH (FORCE)`);
    await admin?.end();
  });

  it('표 넷이 snake_case 복수 이름으로 생긴다', async () => {
    const { rows } = await db.query(
      `SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' ORDER BY table_name`);
    expect(rows.map((r) => r.table_name)).toEqual(['categories', 'neighbors', 'share_requests', 'shares']);
  });

  it('새 글은 「아직 나눔 중」으로 시작하고 올린 시각이 저절로 적힌다', async () => {
    const { rows } = await db.query('SELECT is_given_away, created_at FROM shares WHERE id = 1');
    expect(rows[0].is_given_away).toBe(false);
    expect(rows[0].created_at).toBeInstanceOf(Date);
  });

  it('같은 이웃이 같은 글에 두 번 신청하면 막힌다 (23505)', async () => {
    await db.query(`INSERT INTO share_requests (share_id, neighbor_id, message) VALUES (1, 2, '받고 싶어요')`);
    await expect(
      db.query(`INSERT INTO share_requests (share_id, neighbor_id, message) VALUES (1, 2, '한 번 더')`),
    ).rejects.toMatchObject({ code: '23505' });
  });

  it('신청은 비워둔 메시지로도 들어간다 — 메시지 칸은 선택이다', async () => {
    await db.query(`INSERT INTO neighbors (nickname, town) VALUES ('seoyeon', '망원동')`);
    await db.query('INSERT INTO share_requests (share_id, neighbor_id) VALUES (1, 3)');
    const { rows } = await db.query('SELECT message FROM share_requests WHERE neighbor_id = 3');
    expect(rows[0].message).toBeNull();
  });

  it('닉네임은 겹칠 수 없다 (23505)', async () => {
    await expect(
      db.query(`INSERT INTO neighbors (nickname, town) VALUES ('minji', '연남동')`),
    ).rejects.toMatchObject({ code: '23505' });
  });

  // 🚨 23503 이 아니다. Prisma 는 필수 관계에 `ON DELETE RESTRICT` 를 적고, PostgreSQL 은
  //    RESTRICT 위반을 23001 로 낸다. 23503 은 손으로 쓴 외래 키(NO ACTION)가 내던 코드다
  //    (`p2-28`~`p2-33` 의 댓글 표). 착수 초고가 그 기억으로 23503 을 적었다가 실행으로 뒤집혔다.
  it('글이 남아 있는 분류는 지울 수 없다 (23001 · RESTRICT)', async () => {
    await expect(db.query('DELETE FROM categories WHERE id = 1'))
      .rejects.toMatchObject({ code: '23001', constraint: 'shares_category_id_fkey' });
  });

  it('글을 올린 이웃도 지울 수 없다 (23001 · RESTRICT)', async () => {
    await expect(db.query('DELETE FROM neighbors WHERE id = 1'))
      .rejects.toMatchObject({ code: '23001', constraint: 'shares_owner_id_fkey' });
  });

  it('글을 지우면 그 글에 달린 신청도 함께 사라진다', async () => {
    await db.query('DELETE FROM shares WHERE id = 1');
    const { rows } = await db.query('SELECT count(*)::int AS n FROM share_requests');
    expect(rows[0].n).toBe(0);
  });
});

describe('p2-39 ② 계약 — `.http` 예시가 계약 표와 같다', () => {
  const requests = () =>
    read(P(HTTP)).split('\n')
      .map((l) => l.match(/^(GET|POST|PATCH|PUT|DELETE) http:\/\/localhost:3000(\/api\/[^\s?]*)/))
      .filter(Boolean)
      .map(([, method, path]) => `${method} ${path.replace(/\/\d+(?=\/|$)/g, '/:id')}`);

  it('예시 요청이 계약의 여섯 줄을 빠짐없이, 그 밖의 것 없이 담는다', () => {
    expect([...new Set(requests())].sort()).toEqual([...CONTRACT].sort());
  });

  it('몸통을 보내는 요청은 전부 JSON 으로 읽힌다', () => {
    const blocks = read(P(HTTP)).split(/^###.*$/m);
    const withBody = blocks.filter((b) => /^(POST|PATCH) /m.test(b));
    expect(withBody.length).toBeGreaterThan(0);
    for (const b of withBody) {
      const body = b.slice(b.indexOf('{'), b.lastIndexOf('}') + 1);
      expect(() => JSON.parse(body)).not.toThrow();
    }
  });
});
