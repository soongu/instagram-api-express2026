// p3-66 「대화방 목록과 메시지 창」 게이트 - 백엔드(교안 Step 3 의 «대화방 하나»)
// 내부 검증 전용 - 교안에 한 줄도 인용하지 않는다.
//
// 화면 회차라 판정의 본체는 instagram-next `.verify` 다. 여기서는 이 회차가 백엔드에 더한
// `GET /api/v2/conversations/:id` 하나만 잰다(`curriculum.md` 「`p3-66` 착수 결정」 · 계약 표 DM 줄).
// 🔑 띄우는 판 - 이 작업트리의 학생 파일(`P366_DIR` 로 바꾼다). 포트 3968(`P366_PORT`).
// 🔑 판정 DB 는 «p3-65 를 마친 학생 DB» `test/fixtures/p3-65-end.sql` - DB 는 `p366_api_` 로 시작하는 것만 만들고 지운다.
//    PostgreSQL 은 `P366_PG_PORT`(기본 5560 - 판정용 컨테이너 p366-db).
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { readFileSync } from 'node:fs';
import pg from 'pg';
import { boot } from './helpers/boot.js';

const ROOT = new URL('../', import.meta.url);
const P = (rel) => new URL(rel, ROOT).pathname;
const PG_PORT = Number(process.env.P366_PG_PORT ?? 5560);
const ADMIN = { host: 'localhost', port: PG_PORT, database: 'postgres', user: 'postgres', password: 'postgres' };
const GATE_DB = 'p366_api_gate';
const PORT = Number(process.env.P366_PORT ?? 3968);
const DIR = process.env.P366_DIR ?? P('.');
const BASE = `http://localhost:${PORT}/api/v2`;
const env = {
  PORT: String(PORT), DATABASE_URL: `postgresql://postgres:postgres@localhost:${PG_PORT}/${GATE_DB}`,
  CORS_ORIGIN: 'http://localhost:3001', JWT_SECRET: 'q2Xh0v9bGm4RkT7sYp1wLc8nZf3uJd6eHa5iVo0rQyE', SITE_URL: `http://localhost:${PORT}`,
  GOOGLE_CLIENT_ID: 'x', GOOGLE_CLIENT_SECRET: 'x', KAKAO_CLIENT_ID: 'x', KAKAO_CLIENT_SECRET: 'x', NAVER_CLIENT_ID: 'x', NAVER_CLIENT_SECRET: 'x',
};

const admin = async (sql) => {
  const client = new pg.Client(ADMIN);
  await client.connect();
  try { await client.query(sql); } finally { await client.end(); }
};

/** 쿠키 하나를 기억하는 손님 - 요청 파일처럼 마지막 로그인만 남는다. */
function client() {
  const jar = new Map();
  return async (method, path, body) => {
    const headers = {};
    if (jar.size) headers.Cookie = [...jar].map(([k, v]) => `${k}=${v}`).join('; ');
    if (body !== undefined) headers['Content-Type'] = 'application/json';
    const res = await fetch(`${BASE}${path}`, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
    for (const c of res.headers.getSetCookie()) {
      const [pair] = c.split(';');
      const i = pair.indexOf('=');
      jar.set(pair.slice(0, i), pair.slice(i + 1));
    }
    const text = await res.text();
    return { status: res.status, allow: res.headers.get('allow'), body: text ? JSON.parse(text) : null };
  };
}

let server;
beforeAll(async () => {
  await admin(`DROP DATABASE IF EXISTS ${GATE_DB} WITH (FORCE)`);
  await admin(`CREATE DATABASE ${GATE_DB}`);
  const dump = readFileSync(P('test/fixtures/p3-65-end.sql'), 'utf8').split('\n').filter((l) => !l.startsWith('\\')).join('\n');
  const c = new pg.Client({ ...ADMIN, database: GATE_DB });
  await c.connect();
  await c.query(dump);
  await c.end();
  server = await boot(`${DIR}/app.js`, { port: PORT, env, cwd: DIR, ready: '기다리고 있어요' });
}, 60_000);

afterAll(async () => {
  await server?.stop();
  await admin(`DROP DATABASE IF EXISTS ${GATE_DB} WITH (FORCE)`);
});

describe('p3-66 대화방 하나 - GET /api/v2/conversations/:id', () => {
  it('목록의 한 줄과 같은 모양이다(jaehoon 의 1번 방 = seoyeon · 마지막 17)', async () => {
    const send = client();
    expect((await send('POST', '/auth/login', { username: 'jaehoon', password: 'jaehoon1234' })).status).toBe(200);
    const one = await send('GET', '/conversations/1');
    expect(one.status).toBe(200);
    const list = await send('GET', '/conversations');
    const row = list.body.data.items.find((c) => c.id === 1);
    expect(one.body.data).toEqual(row);
    expect(one.body.data.otherUser.username).toBe('seoyeon');
    expect(one.body.data.lastMessage.id).toBe(17);
  });

  it('내가 지운 방은 목록에서 빠지지만 하나로는 받는다 - 미리보기는 null', async () => {
    const send = client();
    await send('POST', '/auth/login', { username: 'jaehoon', password: 'jaehoon1234' });
    expect((await send('DELETE', '/conversations/1')).status).toBe(204);
    const list = await send('GET', '/conversations');
    expect(list.body.data.items.map((c) => c.id)).toEqual([8, 7]);
    const one = await send('GET', '/conversations/1');
    expect(one.status).toBe(200);
    expect(one.body.data.otherUser.username).toBe('seoyeon');
    expect(one.body.data.lastMessage).toBeNull();
  });

  it('없는 방과 남의 방은 똑같이 404 CONVERSATION_NOT_FOUND', async () => {
    const send = client();
    await send('POST', '/auth/login', { username: 'jaehoon', password: 'jaehoon1234' });
    const none = await send('GET', '/conversations/999');
    expect(none.status).toBe(404);
    expect(none.body.error.code).toBe('CONVERSATION_NOT_FOUND');
    const other = client();
    await other('POST', '/auth/login', { username: 'boram', password: 'boram1234' });
    const theirs = await other('GET', '/conversations/8');
    expect(theirs.status).toBe(404);
    expect(theirs.body.error.code).toBe('CONVERSATION_NOT_FOUND');
  });

  it('받지 않는 HTTP 메서드는 405 + Allow: GET, DELETE', async () => {
    const send = client();
    await send('POST', '/auth/login', { username: 'jaehoon', password: 'jaehoon1234' });
    const r = await send('PATCH', '/conversations/1', {});
    expect(r.status).toBe(405);
    expect(r.allow).toBe('GET, DELETE');
  });
});
