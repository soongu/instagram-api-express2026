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
import { readFileSync, writeFileSync, cpSync, rmSync } from 'node:fs';
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
// `p2-38` 부터 `app.js` 가 허락 목록을 환경에서 받는다 — 학생이 `--env-file`
// 로 넣어주는 그 자리에 게이트가 자기 값을 넣는다(`boot.js` 가 정한 방식).
const ENV = { DATABASE_URL: GATE_URL, CORS_ORIGIN: 'http://localhost:5173' };
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

  // 🚨 `p2-38` 이 허락 목록을 `CORS_ORIGIN` 으로 빼면서 이 «줄의 모양» 이 바뀐다.
  //    동작(무엇이 되비쳐지는가)은 그대로라 위아래 축은 live 로 두고, 글자 모양을
  //    보는 이 축만 «그 시점 스냅숏» 으로 얼려 떼어낸다 — 이 회차 자신이 `p2-36`
  //    에 쓴 그 방법이다. live 로 두면 뒷 회차가 이 축을 거짓으로 빨갛게 만든다.
  it('`app.js` 가 허락 목록을 «배열» 로 적어뒀다 (그 시점 판)', () => {
    const src = read(P('snapshots/p2-37.final.app.js'));
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

// ── 축 ⑨ · 교안이 만들라고 한 `.http` 가 실재하고 그대로 돈다 ───────────
describe('축 ⑨ — `requests/cors.http` 의 요청이 전부 교안이 말한 답을 준다', () => {
  /** `.http` 파일을 「### 제목 / 메서드 주소 / 헤더들」 로 갈라 읽는다. */
  const 요청들 = () => {
    const 덩이 = read(P('requests/cors.http')).split(/^### /m).slice(1);
    return 덩이.map((b) => {
      const 줄 = b.split('\n').map((l) => l.trim());
      const 제목 = 줄[0];
      const [method, url] = 줄[1].split(/\s+/);
      const headers = {};
      for (const l of 줄.slice(2)) {
        if (!l || l.startsWith('#')) continue;
        const i = l.indexOf(':');
        if (i < 0) break;
        headers[l.slice(0, i).trim()] = l.slice(i + 1).trim();
      }
      return { 제목, method, url, headers };
    });
  };

  it('파일이 다섯 요청을 담고 있고 우리 서버를 가리킨다', () => {
    const rs = 요청들();
    expect(rs.length).toBe(5);
    for (const r of rs) expect(r.url).toContain('localhost:3000');
  });

  it('🔴 그 다섯을 실제로 보내면 교안이 적은 그대로 갈린다', async () => {
    const 결과 = [];
    for (const r of 요청들()) {
      // 교안의 3000 을 게이트가 띄운 포트로만 바꿔 «그 요청 그대로» 보낸다.
      const res = await fetch(r.url.replace('localhost:3000', `localhost:${PORT}`),
        { method: r.method, headers: r.headers });
      결과.push({ 제목: r.제목, status: res.status, 허락: res.headers.get('access-control-allow-origin') });
    }
    expect(결과.map((x) => x.허락)).toEqual([OURS, null, null, OURS, null]);
    // 막힌 요청도 서버는 그대로 답한다 — 200 이거나 preflight 의 204 다.
    expect(결과.map((x) => x.status)).toEqual([200, 200, 200, 204, 204]);
  });
});

// ── 축 ⑩ · 과제 — 답안 코드가 실재하고 실제로 돈다 ─────────────────────
describe('축 ⑩ — 과제 답안이 진짜 서버에서 돈다', () => {

  // 🚨 과제 파일의 `import '../db.js'` 는 «학생 배치» 기준이다
  //    (`~/instagram-api/lab/homework1.js` → `~/instagram-api/db.js`).
  //    회차별 보관 폴더(`lab/p2-37/`)에서 띄우면 한 단 깊어서 그 경로가 깨진다.
  //    그래서 프로젝트 바로 아래에 학생과 «같은 깊이» 로 펼쳐놓고 띄운다 —
  //    파일은 한 글자도 안 고치고 놓이는 곳만 맞춰주는 것이다.
  //    🚨 그리고 학생 파일은 포트를 4001 로 박아 두는데 앞 회차 게이트들도 그 번호를
  //    쓴다 — vitest 가 파일을 병렬로 돌리므로 사본에서만 번호를 갈라준다.
  const LAB_PORT = 4037;
  const RUN = P('.p2-37-run');
  beforeAll(() => {
    rmSync(RUN, { recursive: true, force: true });
    cpSync(P('lab/p2-37'), RUN, { recursive: true });
    for (const f of ['homework1.js', 'homework2.js']) {
      writeFileSync(`${RUN}/${f}`, readFileSync(`${RUN}/${f}`, 'utf8').replaceAll('4001', String(LAB_PORT)));
    }
  });
  afterAll(() => { rmSync(RUN, { recursive: true, force: true }); });
  const 댓글 = (port, origin, headers = {}) =>
    fetch(`http://localhost:${port}/api/comments?postId=1&limit=2`,
      { headers: origin ? { Origin: origin, ...headers } : headers });

  it('[기초] 댓글 서버에 좁힌 문이 놓여 있고, 우리 것만 허락한다', async () => {
    const src = read(P('lab/p2-37/homework1.js'));
    expect(src).toContain("import cors from 'cors'");
    expect(src).toMatch(/cors\(\{\s*origin:\s*\[/);

    const s = await boot('.p2-37-run/homework1.js',
      { port: LAB_PORT, env: { ...ENV, PORT: String(LAB_PORT) }, ready: '기다리고 있어요' });
    try {
      const 우리 = await 댓글(LAB_PORT, OURS);
      expect(우리.headers.get('access-control-allow-origin')).toBe(OURS);
      const 남것 = await 댓글(LAB_PORT, 남);
      expect(남것.headers.get('access-control-allow-origin')).toBeNull();
      // 🔴 막힌 쪽도 서버는 그대로 답한다 — 과제 4번이 학생에게 확인시키는 그것이다.
      expect(남것.status).toBe(200);
      expect((await 남것.json()).items.length).toBeGreaterThan(0);
    } finally { await s.stop(); }
  }, 30000);

  it('🔴 [기초] «놓기 전» 에는 우리 프론트에도 헤더가 없다 — 답안이 그렇게 말한다', async () => {
    // 학생이 이 과제를 시작하는 판은 `p2-36` 의 그 파일이다 — cors 가 «한 줄도» 없다.
    const before = read(P('lab/p2-36/homework1.js'));
    expect(before).not.toContain('cors');

    const RUN2 = P('.p2-37-before');
    rmSync(RUN2, { recursive: true, force: true });
    cpSync(P('lab/p2-36'), RUN2, { recursive: true });
    const PORT2 = 4038;
    writeFileSync(`${RUN2}/homework1.js`,
      readFileSync(`${RUN2}/homework1.js`, 'utf8').replaceAll('4001', String(PORT2)));
    const s = await boot('.p2-37-before/homework1.js',
      { port: PORT2, env: { ...ENV, PORT: String(PORT2) }, ready: '기다리고 있어요' });
    try {
      for (const origin of [OURS, 남, null]) {
        const res = await fetch(`http://localhost:${PORT2}/api/comments?postId=1&limit=2`,
          { headers: origin ? { Origin: origin } : {} });
        expect(res.headers.get('access-control-allow-origin'),
          `${origin ?? '(출처 없음)'} 에도 헤더가 없어야 한다`).toBeNull();
        expect(res.status).toBe(200);
      }
    } finally {
      await s.stop();
      rmSync(RUN2, { recursive: true, force: true });
    }
  }, 30000);

  it('[응용] 허락 목록을 환경에서 받아 오고, 쉼표로 이어 적은 둘이 다 통한다', async () => {
    const src = read(P('lab/p2-37/homework2.js'));
    expect(src).toContain('process.env.CORS_ORIGIN');
    expect(src).toMatch(/\.split\(','\)/);
    expect(src, '목록을 코드에 다시 적어두면 뺀 것이 아니다').not.toContain("['http://localhost:5173']");

    const 둘 = `${OURS},http://localhost:5174`;
    const s = await boot('.p2-37-run/homework2.js',
      { port: LAB_PORT, env: { ...ENV, PORT: String(LAB_PORT), CORS_ORIGIN: 둘 }, ready: '기다리고 있어요' });
    try {
      for (const 하나 of [OURS, 'http://localhost:5174']) {
        const res = await 댓글(LAB_PORT, 하나);
        expect(res.headers.get('access-control-allow-origin'), `${하나} 가 허락돼야 한다`).toBe(하나);
      }
      expect((await 댓글(LAB_PORT, 남)).headers.get('access-control-allow-origin')).toBeNull();
    } finally { await s.stop(); }
  }, 30000);

  it('`requests/cors-comments.http` 가 실재하고 댓글 서버를 가리킨다', () => {
    const http = read(P('requests/cors-comments.http'));
    expect(http.split(/^### /m).length - 1).toBe(3);
    expect(http).toContain('localhost:4001');
    expect(http).toContain('Origin: http://localhost:5173');
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

// ── 인용 대조 — 교안·답안이 실은 코드가 코드베이스와 같은가 ─────────────
describe('인용이 코드베이스와 맞는가', () => {
  const LECTURE = P('../../part2/6-fullstack-join/p2-37-cors-proxy-env-lecture.md');
  const ANSWERS = P('../../part2/6-fullstack-join/p2-37-cors-proxy-env-answers.md');
  const squash = (t) => t.replace(/\s+/g, ' ').trim();
  const blocksOf = (path, lang) =>
    [...read(path).matchAll(new RegExp('```' + lang + '\\n([\\s\\S]*?)```', 'g'))].map((m) => m[1]);
  const meaningful = (b) =>
    b.split('\n').map((l) => squash(l).replace(/\s*\/\/[^"'`]*$/, '').trim())
      .filter((l) => l.length > 12 && !l.startsWith('//') && !/^[}\]);,]+$/.test(l));

  const sources = () => [
    'app.js', 'lab/p2-37/homework1.js', 'lab/p2-37/homework2.js',
    '../instagram-react/src/services/api.js',
    '../instagram-react/vite.config.js',
    // 🔑 교안은 «바꾸기 전» 코드도 인용한다 — 그것도 실재하는 코드다.
    //    이 회차 시작 시점(p2-36 최종판)이 얼려져 있으니 코퍼스에 함께 둔다.
    '../instagram-react/src/services/p2-36.final.api.snapshot.js',
    'snapshots/p2-36.final.app.js',
  ].map((f) => squash(read(P(f))));

  for (const [이름, path] of [['교안', LECTURE], ['답안', ANSWERS]]) {
    for (const lang of ['js', 'jsx', 'javascript']) {
      it(`🔴 ${이름}의 \`\`\`${lang} 줄이 전부 코드베이스에 실재한다`, () => {
        const srcs = sources();
        const missing = [];
        for (const b of blocksOf(path, lang)) {
          for (const line of meaningful(b)) {
            if (!srcs.some((x) => x.includes(line))) missing.push(line);
          }
        }
        expect(missing).toEqual([]);
      });
    }
  }

  it('🔴 `.http` 인용도 실제 파일과 같다', () => {
    const cors = squash(read(P('requests/cors.http')));
    const comments = squash(read(P('requests/cors-comments.http')));
    for (const [이름, path] of [['교안', LECTURE], ['답안', ANSWERS]]) {
      for (const b of blocksOf(path, '')) {
        const lines = b.split('\n').map((l) => l.trim())
          .filter((l) => /^(GET|POST|OPTIONS|DELETE|PATCH)\s+http/.test(l) || /^(Origin|Access-Control-Request)/.test(l));
        for (const l of lines) {
          expect(cors.includes(l) || comments.includes(l), `${이름}: ${l}`).toBe(true);
        }
      }
    }
  });
});
