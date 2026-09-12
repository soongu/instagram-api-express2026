// p2-37 「문을 좁히고 주소를 코드에서 뺀다」 게이트
//
// 🚨 이 회차의 판정 축은 «누가 막는가» 다. `p2-25` 가 이미 *"CORS 는 서버를 지키는
//    장치가 아니다"* 까지 갔으므로, 이 회차가 새로 주장하는 것은 **좁힌 문이 무엇을
//    바꾸고 무엇을 «안» 바꾸는가** 다. 그 둘을 갈라 재지 않으면 교안이 「막힌다」를
//    과장하게 된다 — 서버는 여전히 200 과 본문을 준다.
//
// 축 ① 문이 좁혀졌다 — `*` 가 안 나가고 우리 출처만 되비친다.
// 축 ② 허락 안 된 출처에는 헤더를 «안 보낸다» — 배열이라 서버가 실제로 대조한다.
// 축 ③ 그래도 서버는 200 과 본문을 준다 — 버리는 쪽은 브라우저다(`p2-25` 회수).
// 축 ④ preflight 도 같은 판정을 받는다.
// 축 ⑤ 교안이 「문자열과 배열이 다르다」고 말하니 그것이 사실이어야 한다.
// 축 ⑥ 둘을 허락하면 «부른 쪽» 을 되비친다 — 헤더엔 출처를 하나만 적을 수 있다.
// 축 ⑦ 프론트 — 주소가 코드에 안 박혀 있고, 프록시 규칙이 우리 서버를 가리킨다.
// 축 ⑧ 앞 회차가 가르친 것이 안 깨졌다.
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import express from 'express';
import cors from 'cors';
import pg from 'pg';
import { boot } from './helpers/boot.js';
import { setupP236 } from '../sql/p2-36/setup.mjs';

const ROOT = new URL('../', import.meta.url);
const P = (rel) => new URL(rel, ROOT).pathname;
const ADMIN = { host: 'localhost', port: 5432, database: 'postgres', user: 'postgres', password: 'postgres' };
const GATE_URL = 'postgresql://postgres:postgres@localhost:5432/p237_gate';
const ENV = { DATABASE_URL: GATE_URL };
const PORT = 3462;

const read = (p) => readFileSync(p, 'utf8');
const FRONT = (rel) => read(P(`../instagram-react/${rel}`));

// 🚨 `.env` 는 `p2-06` 이 정한 대로 저장소에 «안» 올라간다 — 없을 때 조용히
//    통과하면 이 축이 아무것도 안 본다. 무엇을 해야 하는지 적어 시끄럽게 죽는다.
const 환경파일 = () => {
  try {
    return FRONT('.env');
  } catch {
    throw new Error(
      '`instagram-react/.env` 가 없습니다 — 저장소에 안 올라가는 파일입니다.\n' +
      '  `.env.example` 을 복사해 `.env` 를 만들고 다시 도세요.');
  }
};

/** 우리 프론트가 개발할 때 서는 자리 — 교안이 이 값을 허락 목록에 적는다. */
const OURS = 'http://localhost:5173';
/** 허락 목록에 없는 아무 곳. */
const 남 = 'http://evil.example.com';

let db = null;
let server = null;

const seed = () =>
  execFileSync(process.execPath, [P('seed.js')],
    { cwd: P('.'), encoding: 'utf8', env: { ...process.env, ...ENV } });

const 물어보기 = (origin, { method = 'GET', path: p = '/api/posts?limit=1' } = {}) =>
  fetch(`http://localhost:${PORT}${p}`, {
    method,
    headers: origin ? { Origin: origin } : {},
  });

beforeAll(async () => {
  const admin = new pg.Client(ADMIN);
  await admin.connect();
  await admin.query(
    "select pg_terminate_backend(pid) from pg_stat_activity where datname = 'p237_gate' and pid <> pg_backend_pid()");
  await admin.query('DROP DATABASE IF EXISTS p237_gate');
  await admin.query('CREATE DATABASE p237_gate');
  await admin.end();

  db = new pg.Client({ ...ADMIN, database: 'p237_gate' });
  await db.connect();
  await setupP236(db);
  seed();

  server = await boot('app.js', {
    port: PORT, env: { ...ENV, PORT: String(PORT) }, ready: `${PORT}번 포트에서`,
  });
}, 120000);

afterAll(async () => {
  if (server) await server.stop();
  if (db) await db.end();
});

// ── 축 ① · 문이 좁혀졌다 ────────────────────────────────────────────────
describe('축 ① — 문이 우리 프론트만으로 좁혀졌다', () => {
  it('🔴 `*` 는 더 이상 안 나간다 — 지난 회차까지는 이것이 나갔다', async () => {
    const res = await 물어보기(OURS);
    expect(res.headers.get('access-control-allow-origin')).not.toBe('*');
  });

  it('우리 출처로 물어보면 그 출처를 «그대로» 되비친다', async () => {
    const res = await 물어보기(OURS);
    expect(res.headers.get('access-control-allow-origin')).toBe(OURS);
  });

  it('`app.js` 가 허락 목록을 «배열» 로 적어뒀다', () => {
    const src = read(P('app.js'));
    expect(src).not.toMatch(/app\.use\(cors\(\)\)/);
    expect(src).toMatch(/origin:\s*\[/);
    expect(src).toContain(OURS);
  });
});

// ── 축 ② · 허락 안 된 곳에는 헤더를 안 보낸다 ───────────────────────────
describe('축 ② — 허락 안 된 출처에는 그 헤더가 «없다»', () => {
  it('🔴 남의 출처로 물어보면 허락 헤더가 아예 안 붙는다', async () => {
    const res = await 물어보기(남);
    expect(res.headers.get('access-control-allow-origin')).toBeNull();
  });

  it('출처를 아예 안 대면(`.http`·`curl`) 그 헤더는 필요가 없으니 안 붙는다', async () => {
    const res = await 물어보기(null);
    expect(res.headers.get('access-control-allow-origin')).toBeNull();
  });

  it('`Vary: Origin` 이 붙는다 — 답이 출처에 따라 갈린다는 표시다', async () => {
    const res = await 물어보기(OURS);
    expect((res.headers.get('vary') ?? '')).toContain('Origin');
  });
});

// ── 축 ③ · 그래도 서버는 200 과 본문을 준다 ─────────────────────────────
describe('축 ③ — 막히는 것은 브라우저 쪽이고 서버는 그대로 답한다', () => {
  it('🔴 허락 안 된 출처에도 **200** 과 게시물 본문을 준다', async () => {
    const res = await 물어보기(남);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(Array.isArray(body.items)).toBe(true);
    expect(body.items.length).toBe(1);
  });

  it('🔴 허락된 출처와 «똑같은» 본문이다 — 서버는 내용을 안 가린다', async () => {
    const 우리 = await (await 물어보기(OURS)).json();
    const 남것 = await (await 물어보기(남)).json();
    expect(남것).toEqual(우리);
  });
});

// ── 축 ④ · preflight ────────────────────────────────────────────────────
describe('축 ④ — 미리 물어보는 요청도 같은 판정을 받는다', () => {
  const preflight = (origin, method = 'POST') =>
    fetch(`http://localhost:${PORT}/api/posts`, {
      method: 'OPTIONS',
      headers: {
        Origin: origin,
        'Access-Control-Request-Method': method,
        'Access-Control-Request-Headers': 'content-type',
      },
    });

  it('우리 출처의 preflight 는 204 로 통과하고 허락 헤더가 붙는다', async () => {
    const res = await preflight(OURS);
    expect(res.status).toBe(204);
    expect(res.headers.get('access-control-allow-origin')).toBe(OURS);
  });

  it('🔴 남의 출처의 preflight 는 허락 헤더 «없이» 돌아온다', async () => {
    const res = await preflight(남);
    expect(res.headers.get('access-control-allow-origin')).toBeNull();
  });
});

// ── 축 ⑤ · 교안이 말하는 「문자열과 배열의 차이」가 사실인가 ─────────────
describe('축 ⑤ — 문자열로 적으면 서버가 «대조하지 않는다»', () => {
  /** 작은 서버를 하나 띄워 `cors` 의 동작만 재는 자리. 교안 본문에는 안 들어간다. */
  const 띄우기 = (corsOptions, port) =>
    new Promise((resolve) => {
      const app = express();
      app.use(cors(corsOptions));
      app.get('/x', (req, res) => res.json({ ok: true }));
      const s = app.listen(port, () => resolve(s));
    });

  const 허락헤더 = async (port, origin) => {
    const res = await fetch(`http://localhost:${port}/x`, { headers: { Origin: origin } });
    return res.headers.get('access-control-allow-origin');
  };

  it('🔴 문자열이면 «남의 출처에도» 우리 주소를 그대로 적어 보낸다 — 판정은 브라우저가 한다', async () => {
    const s = await 띄우기({ origin: OURS }, 3471);
    try {
      expect(await 허락헤더(3471, OURS)).toBe(OURS);
      expect(await 허락헤더(3471, 남), '문자열은 요청의 Origin 을 읽지 않는다').toBe(OURS);
    } finally { s.close(); }
  });

  it('배열이면 서버가 대조해서 안 맞는 쪽엔 «안» 보낸다', async () => {
    const s = await 띄우기({ origin: [OURS] }, 3472);
    try {
      expect(await 허락헤더(3472, OURS)).toBe(OURS);
      expect(await 허락헤더(3472, 남)).toBeNull();
    } finally { s.close(); }
  });
});

// ── 축 ⑥ · 둘을 허락하면 부른 쪽을 되비친다 ─────────────────────────────
describe('축 ⑥ — 헤더엔 출처를 «하나만» 적을 수 있다', () => {
  it('🔴 둘을 허락해도 답에 실리는 것은 «부른 쪽» 하나다', async () => {
    const 둘 = [OURS, 'https://instagram-react.vercel.app'];
    const app = express();
    app.use(cors({ origin: 둘 }));
    app.get('/x', (req, res) => res.json({ ok: true }));
    const s = await new Promise((r) => { const x = app.listen(3473, () => r(x)); });
    try {
      for (const 하나 of 둘) {
        const res = await fetch('http://localhost:3473/x', { headers: { Origin: 하나 } });
        const 허락 = res.headers.get('access-control-allow-origin');
        expect(허락, `${하나} 로 불렀으면 그 하나만 실린다`).toBe(하나);
        expect(허락, '둘을 쉼표로 이어 적지 않는다').not.toContain(',');
      }
    } finally { s.close(); }
  });
});

// ── 축 ⑦ · 프론트 ───────────────────────────────────────────────────────
describe('축 ⑦ — 주소가 코드에 안 박혀 있고 프록시가 우리 서버를 가리킨다', () => {
  it('🔴 `api.js` 에 `http://localhost:3000` 이 한 글자도 없다', () => {
    expect(FRONT('src/services/api.js')).not.toContain('http://localhost:3000');
  });

  it('`baseURL` 을 환경에서 받아 온다', () => {
    expect(FRONT('src/services/api.js')).toMatch(/baseURL:\s*import\.meta\.env\.VITE_API_URL/);
  });

  it('프록시 규칙이 «개발 서버»(`server`) 아래에 있고 우리 서버를 가리킨다', () => {
    const cfg = FRONT('vite.config.js');
    expect(cfg).toMatch(/server:\s*\{/);
    expect(cfg).toMatch(/proxy:\s*\{/);
    expect(cfg).toContain("'/api': 'http://localhost:3000'");
  });

  it('`.env` 와 `.env.example` 이 «둘 다» 그 이름을 들고 있다', () => {
    expect(환경파일()).toMatch(/^VITE_API_URL=/m);
    expect(FRONT('.env.example')).toMatch(/^VITE_API_URL=/m);
  });

  it('개발에서는 프록시를 타는 «상대 주소» 다 — 전체 주소를 적어두지 않는다', () => {
    const 값 = 환경파일().match(/^VITE_API_URL=(.*)$/m)[1].trim();
    expect(값).toBe('/api');
  });

  it('🔴 `.env` 는 저장소에 안 올라가고 `.env.example` 은 올라간다 — `p2-06` 이 정한 그대로', () => {
    const ignore = FRONT('.gitignore');
    expect(ignore).toMatch(/^\.env$/m);
    expect(ignore).toMatch(/^!\.env\.example$/m);
  });
});

// ── 축 ⑧ · 앞 회차가 안 깨졌다 ──────────────────────────────────────────
describe('축 ⑧ — 앞 회차가 가르친 것이 그대로다', () => {
  it('게시물 목록은 여전히 봉투로 온다 — `p2-36` 계약', async () => {
    const body = await (await 물어보기(OURS, { path: '/api/posts?limit=2' })).json();
    expect(Object.keys(body).sort()).toEqual(['hasNext', 'items']);
  });

  it('없는 주소는 여전히 404 다 — `p2-22` 가 놓은 줄', async () => {
    const res = await 물어보기(OURS, { path: '/api/없는곳' });
    expect(res.status).toBe(404);
  });

  it('사진 주소는 여전히 브라우저에서 열리는 절대 주소다 — `p2-36` 이 고친 것', async () => {
    const body = await (await 물어보기(OURS, { path: '/api/posts?limit=1' })).json();
    for (const url of body.items[0].imageUrls) expect(url).toMatch(/^https?:\/\//);
  });

  it('`MY_USER_ID` 는 여전히 프론트 한 곳에만 적혀 있다 — `p2-36` 이 정한 것', () => {
    expect(FRONT('src/services/api.js')).toContain('export const MY_USER_ID');
  });
});
