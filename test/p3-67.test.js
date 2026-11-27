// p3-67 「DM 받는 쪽」 게이트 - 백엔드(교안 Step 4 안 읽음 · Step 6 «읽음» 알리기 · Step 8 «이 번호 뒤»)
// 내부 검증 전용 - 교안에 한 줄도 인용하지 않는다.
//
// 화면 회차라 판정의 본체는 instagram-next `.verify` 다. 여기서는 이 회차가 백엔드에 더한 것만 잰다
// (`curriculum.md` 「`p3-67` 착수 결정」 ② · ③ · 「`p3-65` 착수 결정」 ③ 의 after).
// 🔑 띄우는 판 - 이 작업트리의 학생 파일(`P367_DIR` 로 바꾼다). 포트 3996(`P367_PORT`).
// 🔑 판정 DB 는 «p3-66 을 마친 학생 DB» `test/fixtures/p3-66-end.sql` - DB 는 `p367_api_` 로 시작하는 것만 만들고 지운다.
//    PostgreSQL 은 `P367_PG_PORT`(기본 5570 - 판정용 컨테이너 p367-db).
//    jaehoon(2) 의 방 - 1(seoyeon 43 · jaehoon 이 지운 뒤 84 로 다시 뜸 · 지운 시각 전의 16·17 은 안 읽은 채) ·
//    7(minji 3 · minji 가 보낸 31 개 안 읽음) · 8(doyun 44 · 3 개 안 읽음) · 11(boram 48 · 메시지 없음). 판정 DB 에서 읽음 처리는 한 번도 없었다.
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { readFileSync } from 'node:fs';
import pg from 'pg';
import { io as connectIo } from 'socket.io-client';
import { boot } from './helpers/boot.js';

const ROOT = new URL('../', import.meta.url);
const P = (rel) => new URL(rel, ROOT).pathname;
const PG_PORT = Number(process.env.P367_PG_PORT ?? 5570);
const ADMIN = { host: 'localhost', port: PG_PORT, database: 'postgres', user: 'postgres', password: 'postgres' };
const GATE_DB = 'p367_api_gate';
const PORT = Number(process.env.P367_PORT ?? 3996);
const DIR = process.env.P367_DIR ?? P('.');
const ORIGIN = `http://localhost:${PORT}`;
const BASE = `${ORIGIN}/api/v2`;
const env = {
  PORT: String(PORT), DATABASE_URL: `postgresql://postgres:postgres@localhost:${PG_PORT}/${GATE_DB}`,
  CORS_ORIGIN: 'http://localhost:3001', JWT_SECRET: 'q2Xh0v9bGm4RkT7sYp1wLc8nZf3uJd6eHa5iVo0rQyE', SITE_URL: ORIGIN,
  GOOGLE_CLIENT_ID: 'x', GOOGLE_CLIENT_SECRET: 'x', KAKAO_CLIENT_ID: 'x', KAKAO_CLIENT_SECRET: 'x', NAVER_CLIENT_ID: 'x', NAVER_CLIENT_SECRET: 'x',
};
const PASSWORDS = { jaehoon: 'jaehoon1234', seoyeon: 'instagram1234', doyun: 'instagram1234' };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const admin = async (sql) => {
  const client = new pg.Client(ADMIN);
  await client.connect();
  try { await client.query(sql); } finally { await client.end(); }
};
const onDb = async (sql, params = []) => {
  const client = new pg.Client({ ...ADMIN, database: GATE_DB });
  await client.connect();
  try { return (await client.query(sql, params)).rows; } finally { await client.end(); }
};

/** 쿠키를 기억하는 손님 - 그 사람으로 로그인해서 돌려준다. */
async function as(username) {
  const jar = new Map();
  const send = async (method, path, body) => {
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
  const login = await send('POST', '/auth/login', { username, password: PASSWORDS[username] });
  if (login.status !== 200) throw new Error(`${username} 로그인 ${login.status}`);
  send.cookie = () => [...jar].map(([k, v]) => `${k}=${v}`).join('; ');
  return send;
}
/** 그 사람의 연결 하나 - 받은 이벤트를 모은다. */
async function socketOf(send) {
  const events = [];
  const socket = connectIo(ORIGIN, { extraHeaders: { cookie: send.cookie() }, reconnection: false, transports: ['websocket'] });
  socket.onAny((event, value) => events.push([event, value]));
  await new Promise((ok, fail) => { socket.on('connect', ok); socket.on('connect_error', fail); });
  return { socket, events, close: () => socket.disconnect() };
}
const rowsOf = (page) => Object.fromEntries(page.items.map((c) => [c.id, c.unreadCount]));

let server;
beforeAll(async () => {
  await admin(`DROP DATABASE IF EXISTS ${GATE_DB} WITH (FORCE)`);
  await admin(`CREATE DATABASE ${GATE_DB}`);
  const dump = readFileSync(P('test/fixtures/p3-66-end.sql'), 'utf8').split('\n').filter((l) => !l.startsWith('\\')).join('\n');
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

describe('Step 4 - 안 읽은 메시지 수', () => {
  it('목록 줄마다 unreadCount - 7번 31 · 8번 3 · 11번 0 · 1번은 지운 시각 전의 두 개를 세지 않아 0', async () => {
    const jaehoon = await as('jaehoon');
    const list = await jaehoon('GET', '/conversations');
    expect(list.status).toBe(200);
    expect(rowsOf(list.body.data)).toEqual({ 1: 0, 7: 31, 8: 3, 11: 0 });
  });

  it('대화방 하나에도 같은 unreadCount - 목록의 한 줄과 같다', async () => {
    const jaehoon = await as('jaehoon');
    const list = await jaehoon('GET', '/conversations');
    for (const id of [1, 7, 8, 11]) {
      const one = await jaehoon('GET', `/conversations/${id}`);
      expect(one.body.data).toEqual(list.body.data.items.find((c) => c.id === id));
    }
  });

  it('seoyeon 쪽 1번 방 - jaehoon 이 보낸 84 하나(seoyeon 이 지운 시각 뒤)', async () => {
    const seoyeon = await as('seoyeon');
    const one = await seoyeon('GET', '/conversations/1');
    expect(one.body.data.unreadCount).toBe(1);
  });

  it('GET /conversations/unread - 안 읽은 메시지가 있는 대화방 수(jaehoon 2 · seoyeon 1) · 다른 HTTP 메서드는 405', async () => {
    const jaehoon = await as('jaehoon');
    const r = await jaehoon('GET', '/conversations/unread');
    expect(r.status).toBe(200);
    expect(r.body.data).toEqual({ conversationCount: 2 });
    const seoyeon = await as('seoyeon');
    expect((await seoyeon('GET', '/conversations/unread')).body.data).toEqual({ conversationCount: 1 });
    const post = await jaehoon('POST', '/conversations/unread', {});
    expect(post.status).toBe(405);
    expect(post.allow).toBe('GET');
  });
});

describe('Step 8 - 이 번호 뒤(after)', () => {
  it('7번 방 after=80 - 81 · 82 · 83 을 오래된 것부터 · hasNext false · nextCursor null', async () => {
    const jaehoon = await as('jaehoon');
    const r = await jaehoon('GET', '/conversations/7/messages?after=80');
    expect(r.status).toBe(200);
    expect(r.body.data.items.map((m) => m.id)).toEqual([81, 82, 83]);
    expect(r.body.data.hasNext).toBe(false);
    expect(r.body.data.nextCursor).toBe(null);
  });

  it('limit 을 넘으면 앞에서부터 limit 개 · hasNext true', async () => {
    const jaehoon = await as('jaehoon');
    const r = await jaehoon('GET', '/conversations/7/messages?after=80&limit=2');
    expect(r.body.data.items.map((m) => m.id)).toEqual([81, 82]);
    expect(r.body.data.hasNext).toBe(true);
  });

  it('지운 방은 지운 시각 뒤만 - 1번 방 after=1 은 84 하나 · 가장 최근 번호 뒤는 빈 목록', async () => {
    const jaehoon = await as('jaehoon');
    expect((await jaehoon('GET', '/conversations/1/messages?after=1')).body.data.items.map((m) => m.id)).toEqual([84]);
    expect((await jaehoon('GET', '/conversations/1/messages?after=84')).body.data.items).toEqual([]);
  });

  it('잘못된 after 와 cursor 와 함께 쓴 after 는 400 VALIDATION_FAILED', async () => {
    const jaehoon = await as('jaehoon');
    for (const q of ['after=abc', 'after=0', 'after=1.5']) {
      const r = await jaehoon('GET', `/conversations/7/messages?${q}`);
      expect([q, r.status, r.body.error.code]).toEqual([q, 400, 'VALIDATION_FAILED']);
    }
    const page = await jaehoon('GET', '/conversations/7/messages?limit=2');
    const both = await jaehoon('GET', `/conversations/7/messages?after=80&cursor=${page.body.data.nextCursor}`);
    expect(both.status).toBe(400);
    expect(both.body.error.code).toBe('VALIDATION_FAILED');
  });
});

describe('Step 6 - 읽음을 알린다(dm:read)', () => {
  it('jaehoon 이 8번 방을 읽으면 doyun 의 연결과 jaehoon 의 다른 연결에 dm:read · 다시 읽으면(0개) 아무에게도 안 간다', async () => {
    const jaehoon = await as('jaehoon');
    const doyun = await as('doyun');
    const seoyeon = await as('seoyeon');
    const doyunTab = await socketOf(doyun);
    const jaehoonTab = await socketOf(jaehoon);
    const seoyeonTab = await socketOf(seoyeon);
    try {
      const r = await jaehoon('PATCH', '/conversations/8/messages/read');
      expect(r.status).toBe(200);
      expect(r.body.data).toEqual({ readCount: 3 });
      await sleep(300);
      const expected = ['dm:read', { conversationId: 8, readerId: 2 }];
      expect(doyunTab.events).toEqual([expected]);
      expect(jaehoonTab.events).toEqual([expected]);
      expect(seoyeonTab.events).toEqual([]);
      const again = await jaehoon('PATCH', '/conversations/8/messages/read');
      expect(again.body.data).toEqual({ readCount: 0 });
      await sleep(300);
      expect(doyunTab.events.length).toBe(1);
      // 읽은 뒤의 목록 - 8번 방은 0
      expect(rowsOf((await jaehoon('GET', '/conversations')).body.data)[8]).toBe(0);
      expect((await jaehoon('GET', '/conversations/unread')).body.data).toEqual({ conversationCount: 1 });
      expect((await onDb('SELECT count(*)::int AS n FROM direct_messages WHERE conversation_id = 8 AND is_read'))[0].n).toBe(3);
    } finally {
      doyunTab.close();
      jaehoonTab.close();
      seoyeonTab.close();
    }
  });
});

describe('Step 8 - 개발용 «그 사람 연결 끊기»(DELETE /dev/connections/:username)', () => {
  /** 다시 연결까지 하는 연결 - 끊기고 다시 붙는 차례를 시각과 함께 모은다. */
  async function liveSocketOf(send) {
    const trail = [];
    const t0 = Date.now();
    const socket = connectIo(ORIGIN, { extraHeaders: { cookie: send.cookie() }, transports: ['polling', 'websocket'] });
    const events = [];
    socket.onAny((event, value) => events.push([event, value]));
    socket.on('disconnect', (reason) => trail.push(`disconnect ${reason} ${Date.now() - t0}`));
    socket.io.on('reconnect', () => trail.push(`reconnect ${Date.now() - t0}`));
    await new Promise((ok, fail) => { socket.once('connect', ok); socket.once('connect_error', fail); });
    return { socket, events, trail, t0, close: () => socket.disconnect() };
  }

  it('jaehoon 의 두 연결만 끊고 3초 동안 받지 않는다 · 그 사이 온 메시지는 안 온다 · 3초 뒤 스스로 다시 붙는다 · seoyeon 은 그대로', async () => {
    const jaehoon = await as('jaehoon');
    const seoyeon = await as('seoyeon');
    const a = await liveSocketOf(jaehoon);
    const b = await liveSocketOf(jaehoon);
    const s = await liveSocketOf(seoyeon);
    try {
      const r = await jaehoon('DELETE', '/dev/connections/jaehoon?seconds=3');
      expect(r.status).toBe(200);
      expect(r.body.data).toEqual({ closedCount: 2, blockedSeconds: 3 });
      const cutAt = Date.now();
      await sleep(500);
      expect(a.trail[0]).toMatch(/^disconnect transport close /);
      expect(b.trail[0]).toMatch(/^disconnect transport close /);
      expect(s.trail).toEqual([]);
      const ack = await s.socket.timeout(2000).emitWithAck('dm:send', { conversationId: 1, content: '방금 메시지 받았어요?' });
      expect(ack.data.content).toBe('방금 메시지 받았어요?');
      await sleep(300);
      expect(a.events.filter(([e]) => e === 'dm:message')).toEqual([]);
      // 막는 3초가 지나면 다음 시도에서 붙는다(시도 간격은 1초에서 두 배씩 · 많아야 5초)
      for (let i = 0; i < 100 && !(a.socket.connected && b.socket.connected); i += 1) await sleep(100);
      expect(a.socket.connected).toBe(true);
      expect(Date.now() - cutAt).toBeGreaterThanOrEqual(3000);
      expect(a.events.filter(([e]) => e === 'dm:message')).toEqual([]);
    } finally { a.close(); b.close(); s.close(); }
  }, 30_000);

  it('seconds 가 0 이면 막지 않는다 - 끊긴 뒤 1초 안팎에 다시 붙는다', async () => {
    const jaehoon = await as('jaehoon');
    const a = await liveSocketOf(jaehoon);
    try {
      const r = await jaehoon('DELETE', '/dev/connections/jaehoon?seconds=0');
      expect(r.body.data).toEqual({ closedCount: 1, blockedSeconds: 0 });
      for (let i = 0; i < 50 && !a.trail.some((x) => x.startsWith('reconnect')); i += 1) await sleep(100);
      expect(a.trail.some((x) => x.startsWith('reconnect'))).toBe(true);
    } finally { a.close(); }
  });

  it('seconds 없으면 10초 · 연결이 없는 사람은 closedCount 0 · 없는 사람 404 · seconds 61 은 400 · 다른 HTTP 메서드 405', async () => {
    const jaehoon = await as('jaehoon');
    const none = await jaehoon('DELETE', '/dev/connections/doyun');
    expect(none.body.data).toEqual({ closedCount: 0, blockedSeconds: 10 });
    expect((await jaehoon('DELETE', '/dev/connections/nobody_here')).body.error.code).toBe('USER_NOT_FOUND');
    const bad = await jaehoon('DELETE', '/dev/connections/jaehoon?seconds=61');
    expect([bad.status, bad.body.error.code]).toEqual([400, 'VALIDATION_FAILED']);
    const post = await jaehoon('POST', '/dev/connections/jaehoon', {});
    expect([post.status, post.allow]).toEqual([405, 'DELETE']);
  });
});

describe('Step 8 - NODE_ENV=production 이면 개발용 주소가 없다', () => {
  it('DELETE /dev/connections/jaehoon 은 404', async () => {
    const port = PORT + 1;
    const prod = await boot(`${DIR}/app.js`, { port, env: { ...env, PORT: String(port), NODE_ENV: 'production' }, cwd: DIR, ready: '기다리고 있어요' });
    try {
      const login = await fetch(`http://localhost:${port}/api/v2/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username: 'jaehoon', password: 'jaehoon1234' }) });
      const cookie = login.headers.getSetCookie().map((c) => c.split(';')[0]).join('; ');
      const r = await fetch(`http://localhost:${port}/api/v2/dev/connections/jaehoon`, { method: 'DELETE', headers: { cookie } });
      expect(r.status).toBe(404);
    } finally { await prod.stop(); }
  }, 30_000);
});
