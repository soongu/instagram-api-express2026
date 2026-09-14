// p2-39 「무엇을 만들지 정해요」 게이트
//
// 🚨 이 회차는 서버를 만들지 않는다. 연습용 주제 설명서(동네 물건 나눔) 한 장을
//    «설계 문서 둘» 로 옮기는 회차라, 판정 축도 그 둘이다.
//    ① 표와 관계 — `schema.prisma` 초안이 실제 표로 서고, 적어둔 규칙이 «실제로» 막는다.
//       같은 이웃이 같은 글에 두 번 신청하는 것 · 신청이 달린 채 글만 사라지는 것 ·
//       글이 남아 있는 분류를 지우는 것.
//    ② 계약 — `.http` 예시가 교안의 계약 표와 한 줄도 어긋나지 않는다.
//       🚨 초안은 여섯 줄이었는데 교안 Step 3 이 「이웃 목록에서 닉네임을 고른다」로 정하자
//       그 목록을 부를 주소가 계약에 없었다 → `GET /api/neighbors` 를 더해 일곱 줄.
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
  'GET /api/neighbors',
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

  it('예시 요청이 계약의 일곱 줄을 빠짐없이, 그 밖의 것 없이 담는다', () => {
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

describe('p2-39 ③ 실습 2 — 계약에 「신청 취소」 한 줄', () => {
  it('practice2.http 는 취소 요청 하나만 담고, 본 계약에는 없는 줄이다', () => {
    const lines = read(P('lab/p2-39/practice2.http')).split('\n')
      .map((l) => l.match(/^(GET|POST|PATCH|PUT|DELETE) http:\/\/localhost:3000(\/api\/[^\s?]*)/))
      .filter(Boolean)
      .map(([, m, path]) => `${m} ${path.replace(/\/\d+(?=\/|$)/g, '/:id')}`);
    expect(lines).toEqual(['DELETE /api/shares/:id/requests/:id']);
    expect(CONTRACT).not.toContain(lines[0]);
  });
});

describe('p2-39 ④ 교안이 코드베이스와 같다', () => {
  const LECTURE = P('../../part2/6-fullstack-join/p2-39-project-plan-lecture.md');
  const blocksOf = (lang) => {
    const out = []; let cur = null;
    for (const l of read(LECTURE).split('\n')) {
      if (cur === null && l.trim() === '```' + lang) cur = [];
      else if (cur !== null && l.trim() === '```') { out.push(cur); cur = null; }
      else if (cur !== null) cur.push(l);
    }
    return out;
  };
  const squash = (t) => t.trim().replace(/\s+/g, ' ');
  const sourceLines = (...files) => new Set(files.flatMap((f) => read(P(f)).split('\n').map(squash)));
  const missingIn = (lang, ...files) => {
    const src = sourceLines(...files);
    return blocksOf(lang).flat().map(squash).filter((l) => l && l !== '...' && !src.has(l));
  };

  it('교안에 ```http 블록이 있고, 그 줄이 전부 코드베이스 .http 에 실재한다', () => {
    expect(blocksOf('http').length).toBeGreaterThan(0);
    expect(missingIn('http', HTTP, 'lab/p2-39/practice2.http')).toEqual([]);
  });

  it('교안에 ```prisma 블록이 있고, 그 줄이 전부 schema.prisma 에 실재한다', () => {
    expect(blocksOf('prisma').length).toBeGreaterThan(0);
    expect(missingIn('prisma', SCHEMA)).toEqual([]);
  });

  it('교안 계약 표의 요청 칸이 CONTRACT 일곱 줄과 같다', () => {
    const rows = read(LECTURE).split('\n')
      .map((l) => l.match(/^\| `((?:GET|POST|PATCH|PUT|DELETE) \/api\/[^`]*)` \|/))
      .filter(Boolean).map((m) => m[1]);
    expect([...new Set(rows)].sort()).toEqual([...CONTRACT].sort());
  });
});

describe('p2-39 ⑤ 과제 [기초] — 받을 사람을 담는 칸', () => {
  const HW1 = 'lab/p2-39/homework1.prisma';
  const DBNAME = 'p239_hw1';
  let admin; let db;

  beforeAll(async () => {
    admin = new pg.Client(ADMIN); await admin.connect();
    await admin.query(`DROP DATABASE IF EXISTS ${DBNAME} WITH (FORCE)`);
    await admin.query(`CREATE DATABASE ${DBNAME}`);
    db = new pg.Client({ ...ADMIN, database: DBNAME }); await db.connect();
    await db.query(prismaCli(['migrate', 'diff', '--from-empty', '--to-schema', P(HW1), '--script']));
    await db.query(`
      INSERT INTO categories (name) VALUES ('책');
      INSERT INTO neighbors (nickname, town) VALUES ('minji', '망원동'), ('jaehoon', '합정동');
      INSERT INTO shares (title, content, owner_id, category_id) VALUES ('소설 세 권', '상태 좋아요', 1, 1);
    `);
  });

  afterAll(async () => {
    await db?.end();
    await admin?.query(`DROP DATABASE IF EXISTS ${DBNAME} WITH (FORCE)`);
    await admin?.end();
  });

  it('초안에서 과제판으로 가는 SQL 은 칸 하나와 외래 키 하나만 더한다', () => {
    const sql = prismaCli(['migrate', 'diff', '--from-schema', P(SCHEMA), '--to-schema', P(HW1), '--script']);
    expect(sql).toMatch(/ADD COLUMN\s+"receiver_id" INTEGER/);
    expect(sql).toMatch(/FOREIGN KEY \("receiver_id"\) REFERENCES "neighbors"\("id"\) ON DELETE SET NULL/);
    expect(sql).not.toMatch(/DROP/);
  });

  it('받을 사람을 아직 안 골랐으면 비어 있다', async () => {
    const { rows } = await db.query('SELECT receiver_id FROM shares WHERE id = 1');
    expect(rows[0].receiver_id).toBeNull();
  });

  it('받을 이웃이 사라지면 나눔은 남고 받을 사람 칸만 비워진다', async () => {
    await db.query('UPDATE shares SET receiver_id = 2, is_given_away = true WHERE id = 1');
    await db.query('DELETE FROM neighbors WHERE id = 2');
    const { rows } = await db.query('SELECT receiver_id, is_given_away FROM shares WHERE id = 1');
    expect(rows[0]).toEqual({ receiver_id: null, is_given_away: true });
  });
});

describe('p2-39 ⑥ 과제 [응용] — 인스타그램 프로필', () => {
  const HW2 = 'lab/p2-39/homework2.prisma';
  const DBNAME = 'p239_hw2';
  let admin; let db;

  beforeAll(async () => {
    admin = new pg.Client(ADMIN); await admin.connect();
    await admin.query(`DROP DATABASE IF EXISTS ${DBNAME} WITH (FORCE)`);
    await admin.query(`CREATE DATABASE ${DBNAME}`);
    db = new pg.Client({ ...ADMIN, database: DBNAME }); await db.connect();
    await db.query(prismaCli(['migrate', 'diff', '--from-empty', '--to-schema', P(HW2), '--script']));
    await db.query(`INSERT INTO users (username, name) VALUES ('minji', '박민지'), ('jaehoon', '김재훈')`);
  });

  afterAll(async () => {
    await db?.end();
    await admin?.query(`DROP DATABASE IF EXISTS ${DBNAME} WITH (FORCE)`);
    await admin?.end();
  });

  it('지금 스키마에서 과제판으로 가는 SQL 은 users 에 칸 하나를 더하고 follows 표를 만든다 — 지우는 것은 없다', () => {
    const sql = prismaCli(['migrate', 'diff', '--from-schema', P('prisma/schema.prisma'), '--to-schema', P(HW2), '--script']);
    expect(sql).toMatch(/ALTER TABLE "users" ADD COLUMN\s+"name" VARCHAR\(50\)/);
    expect(sql).toMatch(/CREATE TABLE "follows"/);
    expect(sql).toMatch(/CREATE UNIQUE INDEX "follows_follower_id_following_id_key"/);
    expect(sql).not.toMatch(/DROP/);
  });

  // 답안이 name 에 물음표를 붙인 이유 — 비워둘 수 없는 칸은 줄이 이미 있으면 못 더한다.
  it('줄이 이미 있는 표에 비워둘 수 없는 칸을 기본값 없이 더하면 막힌다 (23502)', async () => {
    await expect(db.query('ALTER TABLE users ADD COLUMN nickname2 VARCHAR(50) NOT NULL'))
      .rejects.toMatchObject({ code: '23502' });
  });

  it('이미 있는 회원은 이름이 비어 있어도 들어간다', async () => {
    await db.query(`INSERT INTO users (username) VALUES ('nayeon')`);
    const { rows } = await db.query(`SELECT name FROM users WHERE username = 'nayeon'`);
    expect(rows[0].name).toBeNull();
  });

  it('같은 사람을 두 번 팔로우하면 막힌다 (23505)', async () => {
    await db.query('INSERT INTO follows (follower_id, following_id) VALUES (1, 2)');
    await expect(db.query('INSERT INTO follows (follower_id, following_id) VALUES (1, 2)'))
      .rejects.toMatchObject({ code: '23505' });
  });

  // 답안 「이렇게 하면 더 좋아요」 — @@unique 는 같은 쌍만 막고 자기 자신 팔로우는 못 막는다.
  it('자기 자신을 팔로우하는 줄은 표가 막지 않는다', async () => {
    await db.query('INSERT INTO follows (follower_id, following_id) VALUES (1, 1)');
    const { rows } = await db.query('SELECT count(*)::int AS n FROM follows WHERE follower_id = following_id');
    expect(rows[0].n).toBe(1);
  });

  it('팔로워 수는 칸이 없어도 follows 에서 셀 수 있다', async () => {
    const { rows } = await db.query('SELECT count(*)::int AS n FROM follows WHERE following_id = 2');
    expect(rows[0].n).toBe(1);
  });

  it('homework2.http 는 프로필 요청 한 줄이다', () => {
    const lines = read(P('lab/p2-39/homework2.http')).split('\n').filter((l) => /^(GET|POST|PATCH|DELETE) /.test(l));
    expect(lines).toEqual(['GET http://localhost:3000/api/profiles/minji']);
  });
});

describe('p2-39 ⑦ 과제 [기초] 답안 — 규칙을 표에서 막는 판', () => {
  const STRICT = 'lab/p2-39/homework1-strict.prisma';
  const DBNAME = 'p239_hw1_strict';
  let admin; let db;

  beforeAll(async () => {
    admin = new pg.Client(ADMIN); await admin.connect();
    await admin.query(`DROP DATABASE IF EXISTS ${DBNAME} WITH (FORCE)`);
    await admin.query(`CREATE DATABASE ${DBNAME}`);
    db = new pg.Client({ ...ADMIN, database: DBNAME }); await db.connect();
    await db.query(prismaCli(['migrate', 'diff', '--from-empty', '--to-schema', P(STRICT), '--script']));
    await db.query(`
      INSERT INTO categories (name) VALUES ('책');
      INSERT INTO neighbors (nickname, town) VALUES ('minji', '망원동'), ('jaehoon', '합정동'), ('seoyeon', '망원동');
      INSERT INTO shares (title, content, owner_id, category_id) VALUES ('소설 세 권', '상태 좋아요', 1, 1);
      INSERT INTO share_requests (share_id, neighbor_id) VALUES (1, 2);
    `);
  });

  afterAll(async () => {
    await db?.end();
    await admin?.query(`DROP DATABASE IF EXISTS ${DBNAME} WITH (FORCE)`);
    await admin?.end();
  });

  it('받을 사람 칸이 신청 표의 (나눔, 이웃) 쌍을 가리키는 외래 키로 나온다', () => {
    const sql = prismaCli(['migrate', 'diff', '--from-empty', '--to-schema', P(STRICT), '--script']);
    expect(sql).toMatch(/FOREIGN KEY \("id", "receiver_id"\) REFERENCES "share_requests"\("share_id", "neighbor_id"\)/);
  });

  it('신청한 이웃은 받을 사람으로 고를 수 있다', async () => {
    await db.query('UPDATE shares SET receiver_id = 2 WHERE id = 1');
    const { rows } = await db.query('SELECT receiver_id FROM shares WHERE id = 1');
    expect(rows[0].receiver_id).toBe(2);
  });

  it('신청하지 않은 이웃을 받을 사람으로 고르면 표가 막는다 (23503)', async () => {
    await expect(db.query('UPDATE shares SET receiver_id = 3 WHERE id = 1'))
      .rejects.toMatchObject({ code: '23503', constraint: 'shares_id_receiver_id_fkey' });
  });

  // 답안이 대가로 드는 장면 — 받을 사람으로 골린 신청 줄은 나눔 표가 붙잡고 있어 못 지운다.
  it('받을 사람으로 골린 신청은 지울 수 없다 (23001 · RESTRICT) — 실습 2 의 취소와 부딪힌다', async () => {
    await expect(db.query('DELETE FROM share_requests WHERE share_id = 1 AND neighbor_id = 2'))
      .rejects.toMatchObject({ code: '23001', constraint: 'shares_id_receiver_id_fkey' });
  });
});

describe('p2-39 ⑧ 답안이 코드베이스와 같다', () => {
  const ANSWERS = P('../../part2/6-fullstack-join/p2-39-project-plan-answers.md');
  const blocksOf = (lang) => {
    const out = []; let cur = null;
    for (const l of read(ANSWERS).split('\n')) {
      if (cur === null && l.trim() === '```' + lang) cur = [];
      else if (cur !== null && l.trim() === '```') { out.push(cur); cur = null; }
      else if (cur !== null) cur.push(l);
    }
    return out;
  };
  const squash = (t) => t.trim().replace(/\s+/g, ' ');
  const missing = (lang, sources) => {
    const src = new Set(sources.flatMap((t) => t.split('\n').map(squash)));
    return blocksOf(lang).flat().map(squash).filter((l) => l && l !== '...' && !src.has(l));
  };

  it('```prisma 줄이 전부 과제판 스키마들에 실재한다', () => {
    const files = [SCHEMA, 'lab/p2-39/homework1.prisma', 'lab/p2-39/homework1-strict.prisma', 'lab/p2-39/homework2.prisma'];
    expect(blocksOf('prisma').length).toBeGreaterThan(0);
    expect(missing('prisma', files.map((f) => read(P(f))))).toEqual([]);
  });

  it('```http 줄이 전부 homework2.http 에 실재한다', () => {
    expect(missing('http', [read(P('lab/p2-39/homework2.http'))])).toEqual([]);
  });

  it('```sql 줄이 전부 과제판의 실제 migrate diff 출력에 있다', () => {
    const sql = prismaCli(['migrate', 'diff', '--from-empty', '--to-schema', P('lab/p2-39/homework1.prisma'), '--script']);
    expect(blocksOf('sql').length).toBeGreaterThan(0);
    expect(missing('sql', [sql])).toEqual([]);
  });

  it('[응용] 「지우는 줄은 하나도 없다」 — 지금 스키마에서 과제판까지의 SQL 에 DROP 이 없다', () => {
    const sql = prismaCli(['migrate', 'diff', '--from-schema', P('prisma/schema.prisma'), '--to-schema', P('lab/p2-39/homework2.prisma'), '--script']);
    expect(sql).not.toMatch(/DROP/);
  });

  it('[응용] 화면이 받던 값 여섯이 가짜 서버 profiles 에 실제로 있다', () => {
    // 🚨 작업트리가 아니라 `main` 에서 읽는다 — 이 세션 동안 React 작업트리가 두 번 다른 회차로
    //    체크아웃됐고, 그때마다 작업트리를 읽는 축이 거짓 빨강을 냈다(p2-18 판에는 profiles 가 없다).
    const db = JSON.parse(execFileSync('git', ['-C', P('../instagram-react'), 'show', 'main:mock/db.json'], { encoding: 'utf8' }));
    expect(Object.keys(db.profiles[0]).filter((k) => k !== 'id').sort())
      .toEqual(['followerCount', 'followingCount', 'name', 'postCount', 'profileImage', 'username']);
  });
});
