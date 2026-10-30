// p3-21 「위임과 OAuth · OIDC」 게이트 — 실습 서버 둘
//
// `3-auth-principles` 마지막 회차다. 수업 백엔드는 건드리지 않는다 — Step 1~8 본문이 전부 `lab/` 이다
// (`curriculum.md` 「`p3-21` 착수 결정」 · `folder-check.py` 의 `API_LAB_STEPS`).
//   - `lab/p3-21/auth-server.js` — 강의 자료로 나눠 주는 «구글 역할» 인가 서버(4001 · 학생은 `http://127.0.0.1:4001` 로 연다).
//     학생이 짜지 않는 준비물이라 이 판정이 그 동작을 잠근다.
//   - `lab/p3-21/photo-app.js` — 학생이 Step 마다 키우는 «우리 서비스»(4002 · `http://localhost:4002`).
// 판정은 학생이 치는 `node lab/…` 를 그대로 띄워 진짜 포트로 왕복한다(`boot.js`). 브라우저는 아래 `browser()` 가
// 대신한다 — 호스트마다 쿠키를 따로 기억하고 리다이렉트를 GET 으로 따라간다(크롬과 같은 판인지는 기록 「브라우저 실측」 이
// 헤드리스 크롬으로 쟀다 — `127.0.0.1` → `localhost` 로 돌아오는 리다이렉트에도 `SameSite=Lax` 쿠키가 실린다).
// 🔀 2026-10-30 「이해를 먼저」 소급 — 동의 화면 POST 뒤의 리다이렉트를 302 에서 303 으로(RFC 9700 §4.12 — 307 MUST NOT ·
//    303 SHOULD · 307 판이면 크롬이 비밀번호가 든 본문을 `/callback` 에 POST 한다 — 기록 `progress/understanding-first-retrofit.md`).
//
// 축 ① 인가 서버 — 디스커버리 문서 · JWKS · 인가 요청 검사(등록 안 한 클라이언트·redirect_uri 는 돌려보내지 않는다) ·
//      동의 화면 · 허용/거부(303 · 307 판이면 본문이 따라간다) · 토큰 엔드포인트(invalid_client · 한 번만 · PKCE) ·
//      리소스(401 · 403 insufficient_scope · 인가 서버가 다시 뜨면 받아 둔 Access 토큰도 401).
// 축 ② Step 별 판 — Step 2(동의 화면까지) · 3(code) · 4(토큰 · 사진 · 토큰은 터미널에만) · 5(state — 남의 code 를
//      끼우면 403) · 6(PKCE — state 를 통과한 가로챈 code 도 invalid_grant) · 7(ID 토큰 읽기) · 8(ID 토큰 확인).
// 축 ③ ID 토큰 확인 — aud · iss · nonce · 다른 키로 만든 서명을 Step 8 은 막고, Step 7 은 그대로 믿는다.
// 실습·과제 — `lab/p3-21/`(학생 쪽 경로 주석은 `~/instagram-api/lab/…`).
import { describe, it, expect } from 'vitest';
import { readFileSync, mkdtempSync, rmSync, writeFileSync, symlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { boot } from './helpers/boot.js';

const ROOT = new URL('../', import.meta.url);
const P = (rel) => new URL(rel, ROOT).pathname;
const read = (p) => readFileSync(p, 'utf8');

// 실습 파일은 작업트리(`main`)에서 읽는다 — `lab/p3-21/` 은 이 회차만 쓰고, 「이해를 먼저」 소급(2026-10-30)이 나눠 주는
// `auth-server.js`(303)와 `oauth.http`(요청 둘)를 `main` 에서 고쳤다. 북마크 `code/p3-21` 은 그대로다(p3-19·p3-20 과 같다).
// Step 판의 `photo-app.js` 는 아래 `appAt()` 이 그 Step 커밋에서 꺼낸다.
const LAB = (file) => P(`lab/p3-21/${file}`);

const AUTH = 'http://127.0.0.1:4001';
const APP = 'http://localhost:4002';
const RFC_VERIFIER = 'dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk';
const RFC_CHALLENGE = 'E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM';
const b64 = (part) => JSON.parse(Buffer.from(part, 'base64url').toString());

// ── 서버 띄우기 ──
// 파일 하나를 (바꿔서) 임시 폴더에 놓고 띄운다 — node_modules 는 저장소 것을 잇는다.
const bootFile = async (src, name, port, edits = []) => {
  const dir = mkdtempSync(join(tmpdir(), 'p321-'));
  let text = src;
  for (const [from, to] of edits) {
    if (!text.includes(from)) throw new Error(`${name} 에서 바꿀 곳을 못 찾았다: ${from}`);
    text = text.replace(from, to);
  }
  writeFileSync(join(dir, name), text);
  symlinkSync(P('node_modules'), join(dir, 'node_modules'));
  writeFileSync(join(dir, 'package.json'), '{"type":"module"}');
  const server = await boot(join(dir, name), { port, ready: `${port}번 포트에서` });
  return { ...server, stop: async () => { await server.stop(); rmSync(dir, { recursive: true, force: true }); } };
};
const bootAuth = (edits = []) => bootFile(read(LAB('auth-server.js')), 'auth-server.js', 4001, edits);
const bootApp = (src, port = 4002, edits = []) => bootFile(src, 'app.js', port, edits);
const withServers = async (servers, fn) => {
  const up = [];
  try {
    for (const start of servers) up.push(await start());
    return await fn(...up);
  } finally {
    for (const s of up.reverse()) await s.stop();
  }
};

// ── 브라우저 흉내 — 호스트마다 쿠키를 따로 기억하고 리다이렉트를 GET 으로 따라간다 ──
const browser = () => {
  const jar = new Map();
  const cookiesOf = (host) => {
    if (!jar.has(host)) jar.set(host, new Map());
    return jar.get(host);
  };
  const go = async (url, init = {}) => {
    let current = new URL(url);
    let options = init;
    for (let hop = 0; hop < 10; hop += 1) {
      const cookies = cookiesOf(current.hostname);
      const headers = { ...(options.headers ?? {}) };
      if (cookies.size) headers.Cookie = [...cookies].map(([k, v]) => `${k}=${v}`).join('; ');
      const res = await fetch(current, { ...options, headers, redirect: 'manual' });
      for (const line of res.headers.getSetCookie()) {
        const [pair] = line.split(';');
        const [name, value] = pair.split('=');
        if (/Expires=Thu, 01 Jan 1970/.test(line) || value === '') cookies.delete(name);
        else cookies.set(name, value);
      }
      if (res.status >= 300 && res.status < 400) {
        current = new URL(res.headers.get('location'), current);
        options = {};
        continue;
      }
      const body = await res.text();
      return { status: res.status, url: current.href, body, json: () => JSON.parse(body) };
    }
    throw new Error('리다이렉트가 너무 많다');
  };
  return { go, jar, cookie: (host, name) => cookiesOf(host).get(name) };
};

const unescapeHtml = (text) => text.replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)));
const hiddenFields = (html) =>
  Object.fromEntries([...html.matchAll(/<input type="hidden" name="(\w+)" value="([^"]*)">/g)].map(([, n, v]) => [n, unescapeHtml(v)]));

// 동의 화면에서 아이디·비밀번호를 넣고 허용(또는 거부)을 누른다 — 그 뒤 리다이렉트를 따라간 결과를 돌려준다.
const signIn = async (b, { username = 'jaehoon', password, decision = 'allow', start = `${APP}/login` } = {}) => {
  const consent = await b.go(start);
  expect(consent.status).toBe(200);
  const fields = hiddenFields(consent.body);
  const after = await b.go(`${AUTH}/authorize`, {
    method: 'POST',
    body: new URLSearchParams({ ...fields, username, password: password ?? `${username}1234`, decision }),
  });
  return { consent, after };
};

// `.http` 의 `# @no-redirect` 처럼 — 인가 서버에 바로 허용을 보내 303 의 Location 에서 code 를 꺼낸다.
const codeFor = async (username, extra = {}) => {
  const res = await fetch(`${AUTH}/authorize`, {
    method: 'POST',
    redirect: 'manual',
    body: new URLSearchParams({
      response_type: 'code', client_id: 'photo-app', redirect_uri: `${APP}/callback`, scope: 'photos',
      username, password: `${username}1234`, decision: 'allow', ...extra,
    }),
  });
  expect(res.status).toBe(303);
  return new URL(res.headers.get('location')).searchParams.get('code');
};
const tokenFor = (code, extra = {}) => fetch(`${AUTH}/token`, {
  method: 'POST',
  body: new URLSearchParams({
    grant_type: 'authorization_code', code, redirect_uri: `${APP}/callback`,
    client_id: 'photo-app', client_secret: 'photo-app-secret', ...extra,
  }),
});

// ── Step 커밋 ──
const git = (...args) => execFileSync('git', args, { cwd: P('.'), encoding: 'utf8' });
const stepCommits = (n) => git('log', '--format=%H %s', 'HEAD').split('\n')
  .filter((l) => l.includes(' feat(p3-21): ') && l.endsWith(`(Step ${n})`))
  .map((l) => l.split(' ')[0]);
const appAt = (n) => {
  const [last] = stepCommits(n);
  if (!last) throw new Error(`Step ${n} 커밋이 없다`);
  return git('show', `${last}:lab/p3-21/photo-app.js`);
};

describe('축 ① — 나눠 주는 인가 서버', () => {
  it('🔴 디스커버리 문서 · JWKS(RS256 · kid · 공개키만)', async () => {
    await withServers([() => bootAuth()], async (auth) => {
      expect(auth.log.trim()).toBe('인가 서버가 4001번 포트에서 기다리고 있어요.');
      const conf = await (await fetch(`${AUTH}/.well-known/openid-configuration`)).json();
      expect(conf).toEqual({
        issuer: AUTH,
        authorization_endpoint: `${AUTH}/authorize`,
        token_endpoint: `${AUTH}/token`,
        jwks_uri: `${AUTH}/jwks`,
        response_types_supported: ['code'],
        scopes_supported: ['photos', 'openid', 'email', 'profile'],
        id_token_signing_alg_values_supported: ['RS256'],
        code_challenge_methods_supported: ['S256'],
      });
      const { keys } = await (await fetch(`${AUTH}/jwks`)).json();
      expect(keys).toHaveLength(1);
      expect(Object.keys(keys[0]).sort()).toEqual(['alg', 'e', 'kid', 'kty', 'n', 'use']);
      expect(keys[0]).toMatchObject({ kty: 'RSA', alg: 'RS256', use: 'sig', e: 'AQAB' });
      expect(keys[0].kid).toMatch(/^[0-9a-f]{8}$/);
      expect(keys[0].d).toBeUndefined();
    });
  });

  it('🔴 서버가 다시 뜨면 kid 가 바뀐다', async () => {
    const kidOnce = () => withServers([() => bootAuth()], async () => (await (await fetch(`${AUTH}/jwks`)).json()).keys[0].kid);
    expect(await kidOnce()).not.toBe(await kidOnce());
  });

  it('🔴 인가 요청 검사 — 잘못된 요청은 redirect_uri 로 돌려보내지 않고 그 자리에서 400', async () => {
    await withServers([() => bootAuth()], async () => {
      const ask = async (params) => {
        const res = await fetch(`${AUTH}/authorize?${new URLSearchParams(params)}`, { redirect: 'manual' });
        return { status: res.status, text: await res.text() };
      };
      const base = { response_type: 'code', client_id: 'photo-app', redirect_uri: `${APP}/callback`, scope: 'photos' };
      for (const [params, message] of [
        [{ ...base, client_id: 'story-app' }, '등록되지 않은 클라이언트예요'],
        [{ ...base, redirect_uri: 'http://localhost:4999/callback' }, '등록하지 않은 redirect_uri예요'],
        [{ ...base, response_type: 'token' }, 'response_type은 code만 받아요'],
        [{ ...base, scope: 'photos contacts' }, '모르는 scope가 있어요'],
        [{ ...base, scope: 'openid photos' }, 'openid를 요청할 때는 nonce가 필요해요'],
        [{ ...base, code_challenge: 'abc', code_challenge_method: 'plain' }, 'code_challenge_method는 S256만 받아요'],
      ]) {
        const out = await ask(params);
        expect(out.status).toBe(400);
        expect(out.text).toContain(`<h1>잘못된 요청</h1><p>${message}</p>`);
      }
      const ok = await ask({ ...base, state: '"><script>' });
      expect(ok.status).toBe(200);
      expect(ok.text).toContain('<h1>우리 인스타그램에 허락할까요?</h1>');
      expect(ok.text).toContain('<ul><li>사진 목록 보기</li></ul>');
      expect(ok.text).toContain('<input type="hidden" name="state" value="&#34;&#62;&#60;script&#62;">');
      expect(ok.text).not.toContain('<script>');
    });
  });

  it('🔴 허용·거부 — 303 · 거부는 error=access_denied · 틀린 비밀번호는 동의 화면 401 · 허용은 code (state 는 뒤에)', async () => {
    await withServers([() => bootAuth()], async () => {
      const post = (extra) => fetch(`${AUTH}/authorize`, {
        method: 'POST',
        redirect: 'manual',
        body: new URLSearchParams({
          response_type: 'code', client_id: 'photo-app', redirect_uri: `${APP}/callback`, scope: 'photos', state: 's1', ...extra,
        }),
      });
      const deny = await post({ decision: 'deny' });
      expect(deny.status).toBe(303);
      expect(deny.headers.get('location')).toBe(`${APP}/callback?error=access_denied&state=s1`);
      const wrong = await post({ decision: 'allow', username: 'jaehoon', password: 'nope' });
      expect(wrong.status).toBe(401);
      expect(await wrong.text()).toContain('<p>아이디나 비밀번호가 맞지 않아요</p>');
      const allow = await post({ decision: 'allow', username: 'jaehoon', password: 'jaehoon1234' });
      expect(allow.status).toBe(303);
      expect(allow.headers.get('location')).toMatch(/^http:\/\/localhost:4002\/callback\?code=[\w-]{22}&state=s1$/);
    });
  });

  it('🔴 토큰 엔드포인트 — 비밀값 · 한 번만 · redirect_uri 일치 · 응답 모양 · openid 면 id_token', async () => {
    await withServers([() => bootAuth()], async () => {
      const noSecret = await tokenFor(await codeFor('jaehoon'), { client_secret: 'wrong' });
      expect(noSecret.status).toBe(401);
      expect(await noSecret.json()).toEqual({ error: 'invalid_client', error_description: '클라이언트를 확인하지 못했어요' });

      const code = await codeFor('jaehoon');
      const first = await tokenFor(code);
      expect(first.status).toBe(200);
      const body = await first.json();
      expect(Object.keys(body)).toEqual(['access_token', 'token_type', 'expires_in', 'scope']);
      expect(body).toMatchObject({ token_type: 'Bearer', expires_in: 3600, scope: 'photos' });
      expect(body.access_token).toMatch(/^[\w-]{32}$/);
      const again = await tokenFor(code);
      expect(again.status).toBe(400);
      expect(await again.json()).toEqual({ error: 'invalid_grant', error_description: '쓸 수 없는 인가 코드예요' });

      const other = await tokenFor(await codeFor('jaehoon'), { redirect_uri: 'http://localhost:4003/callback' });
      expect(other.status).toBe(400);

      const oidc = await (await tokenFor(await codeFor('jaehoon', { scope: 'openid email photos', nonce: 'n1' }))).json();
      expect(Object.keys(oidc)).toEqual(['access_token', 'token_type', 'expires_in', 'scope', 'id_token']);
      const [h, p] = oidc.id_token.split('.');
      expect(b64(h)).toMatchObject({ alg: 'RS256', typ: 'JWT' });
      expect(Object.keys(b64(p))).toEqual(['iss', 'aud', 'sub', 'email', 'nonce', 'iat', 'exp']);
      expect(b64(p)).toMatchObject({ iss: AUTH, aud: 'photo-app', sub: '10001', email: 'jaehoon@example.com', nonce: 'n1' });
      expect(b64(p).exp - b64(p).iat).toBe(3600);
    });
  });

  it('🔴 PKCE — challenge 를 담아 받은 code 는 맞는 verifier 로만 · 틀리면 invalid_grant 이고 그 code 는 사라진다', async () => {
    await withServers([() => bootAuth()], async () => {
      const pkce = { code_challenge: RFC_CHALLENGE, code_challenge_method: 'S256' };
      const missing = await tokenFor(await codeFor('jaehoon', pkce));
      expect(await missing.json()).toEqual({ error: 'invalid_grant', error_description: 'code_verifier가 맞지 않아요' });
      const code = await codeFor('jaehoon', pkce);
      const wrong = await tokenFor(code, { code_verifier: 'x'.repeat(43) });
      expect(wrong.status).toBe(400);
      expect((await tokenFor(code, { code_verifier: RFC_VERIFIER })).status).toBe(400);
      expect((await tokenFor(await codeFor('jaehoon', pkce), { code_verifier: RFC_VERIFIER })).status).toBe(200);
      // PKCE 다운그레이드 — challenge 없이 받은 인가 코드에 verifier 가 오면 거절(RFC 9700 §4.8.2)
      const downgrade = await tokenFor(await codeFor('jaehoon'), { code_verifier: RFC_VERIFIER });
      expect(downgrade.status).toBe(400);
      expect(await downgrade.json()).toEqual({ error: 'invalid_grant', error_description: 'code_challenge 없이 받은 인가 코드예요' });
    });
  });

  it('🔴 리소스 — 토큰 없으면 401 invalid_token · scope 밖이면 403 insufficient_scope · 사진 · 창 1 에 요청마다 한 줄', async () => {
    await withServers([() => bootAuth()], async (auth) => {
      const none = await fetch(`${AUTH}/photos`);
      expect(none.status).toBe(401);
      expect(none.headers.get('www-authenticate')).toBe('Bearer error="invalid_token"');
      const { access_token: loginOnly } = await (await tokenFor(await codeFor('jaehoon', { scope: 'openid email', nonce: 'n' }))).json();
      const narrow = await fetch(`${AUTH}/photos`, { headers: { Authorization: `Bearer ${loginOnly}` } });
      expect(narrow.status).toBe(403);
      expect(narrow.headers.get('www-authenticate')).toBe('Bearer error="insufficient_scope", scope="photos"');
      expect(await narrow.json()).toEqual({ error: 'insufficient_scope', error_description: '사진을 볼 허락을 받지 않았어요' });
      const { access_token } = await (await tokenFor(await codeFor('dahye'))).json();
      const ok = await fetch(`${AUTH}/photos`, { headers: { Authorization: `Bearer ${access_token}` } });
      expect(await ok.json()).toEqual({ photos: ['등산 정상', '야경'] });
      await new Promise((r) => setTimeout(r, 100));
      expect(auth.tail().split('\n').filter((l) => l.startsWith('GET /photos'))).toEqual(['GET /photos 401', 'GET /photos 403', 'GET /photos 200']);
    });
  });

  // 교안 Step 4 ⚠️ 뒤 — 오늘의 Access 토큰은 인가 서버가 메모리(`tokens` Map)에 적어 둔 기록을 가리키는 무작위 문자열이다
  // (지난 시간 비교표의 «세션» 칸). 그래서 인가 서버가 다시 뜨면 받아 둔 토큰도 통하지 않는다.
  it('🔴 인가 서버가 다시 뜨면 받아 둔 Access 토큰은 401 invalid_token', async () => {
    const bearer = (token) => ({ headers: { Authorization: `Bearer ${token}` } });
    const token = await withServers([() => bootAuth()], async () => {
      const { access_token } = await (await tokenFor(await codeFor('jaehoon'))).json();
      expect(await (await fetch(`${AUTH}/photos`, bearer(access_token))).json()).toEqual({ photos: ['한강 노을', '제주 바다', '강아지 산책'] });
      return access_token;
    });
    await withServers([() => bootAuth()], async () => {
      const res = await fetch(`${AUTH}/photos`, bearer(token));
      expect(res.status).toBe(401);
      expect(await res.json()).toEqual({ error: 'invalid_token', error_description: 'Access 토큰을 확인하지 못했어요' });
    });
  });

  // 교안 Step 2 🙋 — 동의 화면 폼(POST)의 결과를 307 로 돌려보내면 브라우저는 같은 HTTP 메서드·본문으로 다시 보낸다.
  // fetch 도 리다이렉트를 브라우저와 같은 규칙으로 따라가서, 우리 서비스 자리에 «무엇이 왔나» 를 돌려주는 서버를 두고 잰다.
  // (크롬은 헤드리스로 따로 쟀다 — 307 판 Network 탭의 `/callback` 이 POST 이고 Payload 에 `password=jaehoon1234`.)
  it('🔴 303 이면 /callback 은 본문 없는 GET · 307 판이면 비밀번호가 든 본문이 POST 로 따라간다', async () => {
    const ECHO = "import express from 'express';\nconst app = express();\napp.use(express.urlencoded({ extended: false }));\n"
      + "app.all('/callback', (req, res) => res.json({ method: req.method, body: req.body }));\n"
      + "app.listen(4002, () => console.log('4002번 포트에서 기다리고 있어요.'));\n";
    const form = () => new URLSearchParams({
      response_type: 'code', client_id: 'photo-app', redirect_uri: `${APP}/callback`, scope: 'photos',
      username: 'jaehoon', password: 'jaehoon1234', decision: 'allow',
    });
    const TO_307 = ['  res.redirect(303, back.href);', '  res.redirect(307, back.href);'];
    expect(read(LAB('auth-server.js'))).toContain(TO_307[0]);
    await withServers([() => bootAuth(), () => bootApp(ECHO)], async () => {
      const got = await (await fetch(`${AUTH}/authorize`, { method: 'POST', body: form() })).json();
      expect(got).toEqual({ method: 'GET' }); // 본문이 없으면 Express 5 의 req.body 는 undefined 라 JSON 에서 빠진다
    });
    await withServers([() => bootAuth([TO_307]), () => bootApp(ECHO)], async () => {
      const got = await (await fetch(`${AUTH}/authorize`, { method: 'POST', body: form() })).json();
      expect(got.method).toBe('POST');
      expect(got.body).toMatchObject({ username: 'jaehoon', password: 'jaehoon1234', decision: 'allow' });
    });
    // 🙋 가 놓인 Step 2 판의 우리 서비스(Step 3 판도 같다)는 POST /callback 이 없어서 «Cannot POST /callback»
    for (const n of [2, 3]) await withServers([() => bootAuth([TO_307]), () => bootApp(appAt(n))], async () => {
      const res = await fetch(`${AUTH}/authorize`, { method: 'POST', body: form() });
      expect(res.status).toBe(404);
      expect(await res.text()).toContain('Cannot POST /callback');
    });
  });
});

describe('축 ② — Step 별 판', () => {
  it('🔴 Step 2 — `/` 링크 · `/login` 은 파라미터 넷을 담아 302 · 동의 화면까지', async () => {
    await withServers([() => bootAuth(), () => bootApp(appAt(2))], async (auth, app) => {
      expect(app.log.trim()).toBe('우리 서비스가 4002번 포트에서 기다리고 있어요.');
      expect(await (await fetch(`${APP}/`)).text()).toBe('<a href="/login">사진 불러오기</a>');
      const res = await fetch(`${APP}/login`, { redirect: 'manual' });
      expect(res.status).toBe(302);
      expect(res.headers.get('location')).toBe(
        `${AUTH}/authorize?response_type=code&client_id=photo-app&redirect_uri=http%3A%2F%2Flocalhost%3A4002%2Fcallback&scope=photos`);
      const consent = await browser().go(`${APP}/login`);
      expect(consent.body).toContain('<h1>우리 인스타그램에 허락할까요?</h1>');
      // 허용을 누르면 code 를 들고 돌아오지만 Step 2 에는 아직 /callback 이 없다.
      const { after } = await signIn(browser());
      expect(after.status).toBe(404);
      expect(after.url).toMatch(/^http:\/\/localhost:4002\/callback\?code=[\w-]{22}$/);
    });
  });

  it('🔴 Step 3 — code 를 받아 그대로 보여 준다 · 거부하면 400', async () => {
    await withServers([() => bootAuth(), () => bootApp(appAt(3))], async () => {
      const { after } = await signIn(browser());
      expect(after.status).toBe(200);
      expect(Object.keys(after.json())).toEqual(['code']);
      expect(after.json().code).toBe(new URL(after.url).searchParams.get('code'));
      const denied = (await signIn(browser(), { decision: 'deny' })).after;
      expect(denied.status).toBe(400);
      expect(denied.json()).toEqual({ message: '허락을 받지 못했어요 (access_denied)' });
    });
  });

  it('🔴 Step 4 — 토큰을 받아 사진 · 토큰은 창 2 터미널에만 찍히고 브라우저 응답에는 없다 · 같은 주소를 다시 열면 invalid_grant', async () => {
    await withServers([() => bootAuth(), () => bootApp(appAt(4))], async (auth, app) => {
      const b = browser();
      const { after } = await signIn(b);
      expect(after.status).toBe(200);
      expect(after.json()).toEqual({ photos: ['한강 노을', '제주 바다', '강아지 산책'] });
      expect(after.body).not.toContain('access_token');
      expect(app.tail()).toMatch(/access_token: '[\w-]{32}',\n  token_type: 'Bearer',\n  expires_in: 3600,\n  scope: 'photos'\n}/);
      const again = await b.go(after.url);
      expect(again.status).toBe(400);
      expect(again.json()).toEqual({ error: 'invalid_grant', error_description: '쓸 수 없는 인가 코드예요' });
    });
  });

  it('🔴 Step 5 — dahye 가 받은 code 를 jaehoon 의 브라우저에 끼우면 Step 4 판은 dahye 사진 · Step 5 판은 403', async () => {
    await withServers([() => bootAuth(), () => bootApp(appAt(4))], async () => {
      const victim = browser();
      const out = await victim.go(`${APP}/callback?code=${await codeFor('dahye')}`);
      expect(out.json()).toEqual({ photos: ['등산 정상', '야경'] });
    });
    await withServers([() => bootAuth(), () => bootApp(appAt(5))], async () => {
      const victim = browser();
      const out = await victim.go(`${APP}/callback?code=${await codeFor('dahye')}`);
      expect(out.status).toBe(403);
      expect(out.json()).toEqual({ message: '이 브라우저에서 시작한 로그인이 아니에요' });
      // 내가 시작한 흐름은 그대로 된다 · state 쿠키는 한 번 쓰면 지운다
      const b = browser();
      const { consent, after } = await signIn(b);
      expect(new URL(consent.url).searchParams.get('state')).toMatch(/^[0-9a-f-]{36}$/);
      expect(after.json()).toEqual({ photos: ['한강 노을', '제주 바다', '강아지 산책'] });
      expect(b.cookie('localhost', 'oauth_state')).toBeUndefined();
    });
  });

  it('🔴 Step 6 — 새어 나간 jaehoon 의 code 를 dahye 가 자기 흐름(자기 state)에 끼우면 Step 5 판은 jaehoon 사진 · Step 6 판은 invalid_grant', async () => {
    const inject = async (leakedCode) => {
      const attacker = browser();
      const consent = await attacker.go(`${APP}/login`);
      const state = new URL(consent.url).searchParams.get('state');
      return attacker.go(`${APP}/callback?code=${leakedCode}&state=${state}`);
    };
    await withServers([() => bootAuth(), () => bootApp(appAt(5))], async () => {
      const out = await inject(await codeFor('jaehoon'));
      expect(out.json()).toEqual({ photos: ['한강 노을', '제주 바다', '강아지 산책'] });
    });
    await withServers([() => bootAuth(), () => bootApp(appAt(6))], async () => {
      const leaked = await codeFor('jaehoon', { code_challenge: RFC_CHALLENGE, code_challenge_method: 'S256' });
      const out = await inject(leaked);
      expect(out.status).toBe(400);
      expect(out.json()).toEqual({ error: 'invalid_grant', error_description: 'code_verifier가 맞지 않아요' });
      // challenge 없이 받은 jaehoon 의 code 를 PKCE 판에 끼워도 거절 — 이유가 다르다
      const plain = await inject(await codeFor('jaehoon'));
      expect(plain.json()).toEqual({ error: 'invalid_grant', error_description: 'code_challenge 없이 받은 인가 코드예요' });
      // 내 흐름은 그대로 — 주소에 challenge · 쿠키에 verifier
      const b = browser();
      const { consent, after } = await signIn(b);
      const q = new URL(consent.url).searchParams;
      expect(q.get('code_challenge_method')).toBe('S256');
      expect(q.get('code_challenge')).toMatch(/^[\w-]{43}$/);
      expect(createHash('sha256').update(b.cookie('localhost', 'oauth_verifier')).digest('base64url')).toBe(q.get('code_challenge'));
      expect(after.json()).toEqual({ photos: ['한강 노을', '제주 바다', '강아지 산책'] });
    });
  });

  it('🔴 Step 7 — openid email photos + nonce · ID 토큰을 읽어 sub·email 을 함께 보여 준다', async () => {
    await withServers([() => bootAuth(), () => bootApp(appAt(7))], async (auth, app) => {
      const b = browser();
      const { consent, after } = await signIn(b);
      const q = new URL(consent.url).searchParams;
      expect(q.get('scope')).toBe('openid email photos');
      expect(consent.body).toContain('<ul><li>누구인지 알려 주기</li><li>이메일 주소</li><li>사진 목록 보기</li></ul>');
      expect(after.json()).toEqual({ sub: '10001', email: 'jaehoon@example.com', photos: ['한강 노을', '제주 바다', '강아지 산책'] });
      expect(app.tail()).toMatch(/id_token: 'eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCIsImtpZCI6[\w-]+\.[\w-]+\.[\w-]+'/);
      expect(b.cookie('localhost', 'oauth_nonce')).toBe(q.get('nonce'));
    });
  });

  it('🔴 Step 8 — 확인을 거친 같은 결과 · 확인 함수가 JWKS 를 받아 간다', async () => {
    await withServers([() => bootAuth(), () => bootApp(appAt(8))], async () => {
      const { after } = await signIn(browser());
      expect(after.json()).toEqual({ sub: '10001', email: 'jaehoon@example.com', photos: ['한강 노을', '제주 바다', '강아지 산책'] });
      const minji = (await signIn(browser(), { username: 'minji' })).after;
      expect(minji.json()).toEqual({ sub: '10002', email: 'minji@example.com', photos: ['벚꽃길', '카페 라테'] });
      // 교안 Step 8 — 동의 화면이 떠 있을 때 Application 탭에서 oauth_nonce 를 한 글자 고치면 «nonce가 달라요»
      const b = browser();
      const consent = await b.go(`${APP}/login`);
      const nonce = b.cookie('localhost', 'oauth_nonce');
      b.jar.get('localhost').set('oauth_nonce', nonce.slice(0, -1) + (nonce.endsWith('0') ? '1' : '0'));
      const tampered = await b.go(`${AUTH}/authorize`, { method: 'POST', body: new URLSearchParams({ ...hiddenFields(consent.body), username: 'jaehoon', password: 'jaehoon1234', decision: 'allow' }) });
      expect(tampered.status).toBe(401);
      expect(tampered.json()).toEqual({ message: 'ID 토큰을 믿을 수 없어요', reason: 'nonce가 달라요' });
    });
  });
});

describe('축 ③ — ID 토큰 확인: Step 8 은 막고 Step 7 은 그대로 믿는다', () => {
  const BAD = [
    ['다른 앱에게 준 토큰(aud)', ['const claims = { iss: ISSUER, aud: grant.clientId, sub: grant.sub };', "const claims = { iss: ISSUER, aud: 'story-app', sub: grant.sub };"], 'jwt audience invalid. expected: photo-app'],
    ['다른 곳이 만든 토큰(iss)', ['const claims = { iss: ISSUER, aud: grant.clientId, sub: grant.sub };', "const claims = { iss: 'https://accounts.google.com', aud: grant.clientId, sub: grant.sub };"], 'jwt issuer invalid. expected: http://127.0.0.1:4001'],
    ['다른 로그인에서 나온 토큰(nonce)', ['if (grant.nonce) claims.nonce = grant.nonce;', "if (grant.nonce) claims.nonce = 'another-login';"], 'nonce가 달라요'],
    ['다른 키로 서명한 토큰', ["return jwt.sign(claims, privateKey, { algorithm: 'RS256', keyid: KID, expiresIn: '1h' });", "return jwt.sign(claims, generateKeyPairSync('rsa', { modulusLength: 2048 }).privateKey, { algorithm: 'RS256', keyid: KID, expiresIn: '1h' });"], 'invalid signature'],
  ];
  for (const [label, edit, reason] of BAD) {
    it(`🔴 ${label} — Step 8 은 401 · Step 7 은 사진까지 보여 준다`, async () => {
      await withServers([() => bootAuth([edit]), () => bootApp(appAt(8))], async () => {
        const { after } = await signIn(browser());
        expect(after.status).toBe(401);
        expect(after.json()).toEqual({ message: 'ID 토큰을 믿을 수 없어요', reason });
      });
      await withServers([() => bootAuth([edit]), () => bootApp(appAt(7))], async (auth, app) => {
        const { after } = await signIn(browser());
        expect(after.status).toBe(200);
        expect(after.json().email).toBe('jaehoon@example.com');
        // 교안 Step 7 ⚠️ 뒤 — 응답은 평소와 똑같고, 창 2 의 페이로드에만 aud: 'story-app'
        if (label.includes('(aud)')) {
          expect(after.json()).toEqual({ sub: '10001', email: 'jaehoon@example.com', photos: ['한강 노을', '제주 바다', '강아지 산책'] });
          expect(app.tail()).toContain("aud: 'story-app',");
        }
      });
    });
  }
});

describe('직접 해보기 1 — 우리 앱을 인가 서버에 등록하기', () => {
  const REGISTER = [
    "    redirectUris: ['http://localhost:4002/callback'],\n  },\n};",
    "    redirectUris: ['http://localhost:4002/callback'],\n  },\n  'story-app': {\n    name: '스토리 만들기',\n    secret: 'story-app-secret',\n    redirectUris: ['http://localhost:4003/callback'],\n  },\n};",
  ];

  it('🔴 등록하기 전 — 「등록되지 않은 클라이언트예요」 400', async () => {
    await withServers([() => bootAuth(), () => bootApp(read(LAB('practice1.js')), 4003)], async (auth, app) => {
      expect(app.log.trim()).toBe('스토리 앱이 4003번 포트에서 기다리고 있어요.');
      const out = await browser().go('http://localhost:4003/login');
      expect(out.status).toBe(400);
      expect(out.body).toContain('<p>등록되지 않은 클라이언트예요</p>');
    });
  });

  it('🔴 등록한 뒤 — 동의 화면에 앱 이름 · 허용하면 code', async () => {
    expect(read(P('../../part3/3-auth-principles/p3-21-oauth-oidc-lecture.md'))
      .includes(REGISTER[1].split('\n').slice(2, 7).join('\n'))).toBe(true);
    await withServers([() => bootAuth([REGISTER]), () => bootApp(read(LAB('practice1.js')), 4003)], async () => {
      const { consent, after } = await signIn(browser(), { start: 'http://localhost:4003/login' });
      expect(consent.body).toContain('<h1>스토리 만들기에 허락할까요?</h1>');
      expect(after.url).toMatch(/^http:\/\/localhost:4003\/callback\?code=/);
      expect(Object.keys(after.json())).toEqual(['code']);
    });
  });
});

describe('직접 해보기 2 — code_challenge 를 손으로 계산하기', () => {
  it('🔴 RFC 7636 부록 B 의 값과 같다 · 한 글자만 바꿔도 전혀 다른 값', () => {
    const out = execFileSync(process.execPath, [LAB('practice2.js')], { encoding: 'utf8' });
    const lines = out.trim().split('\n');
    expect(lines[0]).toBe(RFC_CHALLENGE);
    expect(lines[1]).toBe('true');
    expect(lines[2]).toMatch(/^[\w-]{43}$/);
    expect(lines[2]).not.toBe(RFC_CHALLENGE);
    expect(lines).toHaveLength(3);
  });
});

describe('직접 해보기 3 — JWKS 를 한 번 받아 두고, 모르는 kid 가 오면 다시 받기', () => {
  it('🔴 처음 로그인에만 「JWKS를 받았어요」 · 인가 서버가 다시 뜨면 한 번 더 받고 그대로 로그인', async () => {
    const app = await bootApp(read(LAB('practice3.js')));
    try {
      const count = () => app.tail().split('JWKS를 받았어요').length - 1;
      await withServers([() => bootAuth()], async () => {
        expect((await signIn(browser())).after.json().email).toBe('jaehoon@example.com');
        expect(count()).toBe(1);
        expect((await signIn(browser(), { username: 'minji' })).after.json().email).toBe('minji@example.com');
        expect(count()).toBe(1);
      });
      await withServers([() => bootAuth()], async () => {
        expect((await signIn(browser())).after.json().email).toBe('jaehoon@example.com');
        expect(count()).toBe(2);
      });
    } finally {
      await app.stop();
    }
  });

  it('🔴 다시 받지 않는 판 — 인가 서버가 다시 뜨면 「모르는 kid예요」 401', async () => {
    const trap = read(P('snapshots/p3-21.practice3-no-refetch.js'));
    const app = await bootApp(trap);
    try {
      await withServers([() => bootAuth()], async () => {
        expect((await signIn(browser())).after.status).toBe(200);
      });
      await withServers([() => bootAuth()], async () => {
        const { after } = await signIn(browser());
        expect(after.status).toBe(401);
        expect(after.json()).toEqual({ message: 'ID 토큰을 믿을 수 없어요', reason: '모르는 kid예요' });
      });
    } finally {
      await app.stop();
    }
  });
});

describe('과제 [기초] — 로그인만 하는 버튼', () => {
  it('🔴 `/signin` 은 openid email 만 · 동의 화면에 사진이 없고 응답에 photos 가 없다 · `/login` 은 그대로', async () => {
    await withServers([() => bootAuth(), () => bootApp(read(LAB('homework1.js')))], async (auth, app) => {
      expect(await (await fetch(`${APP}/`)).text()).toBe('<a href="/signin">로그인만 하기</a> <a href="/login">사진 불러오기</a>');
      const { consent, after } = await signIn(browser(), { start: `${APP}/signin` });
      expect(consent.body).toContain('<ul><li>누구인지 알려 주기</li><li>이메일 주소</li></ul>');
      expect(after.json()).toEqual({ sub: '10001', email: 'jaehoon@example.com' });
      expect(app.tail()).toContain("scope: 'openid email'");
      const full = (await signIn(browser())).after;
      expect(full.json()).toEqual({ sub: '10001', email: 'jaehoon@example.com', photos: ['한강 노을', '제주 바다', '강아지 산책'] });
    });
  });
});

describe('과제 [응용] — sub 로 우리 회원을 찾고 세션을 준다', () => {
  const CHANGE_EMAIL = ["email: 'jaehoon@example.com'", "email: 'jaehoon.kim@example.com'"];

  const run = async (src) => withServers([() => bootApp(src)], async () => {
    const jaehoon = browser();
    await withServers([() => bootAuth()], async () => {
      const first = (await signIn(jaehoon)).after;
      expect(first.url).toBe(`${APP}/me`);
      expect(first.json()).toEqual({ id: 1, email: 'jaehoon@example.com' });
      expect((await signIn(browser(), { username: 'minji' })).after.json()).toEqual({ id: 2, email: 'minji@example.com' });
    });
    // 쿠키를 안 가진 브라우저는 401
    const stranger = await browser().go(`${APP}/me`);
    expect(stranger.status).toBe(401);
    // 인가 서버에서 jaehoon 의 이메일이 바뀐 뒤 다시 로그인한다
    return withServers([() => bootAuth([CHANGE_EMAIL])], async () => (await signIn(jaehoon)).after.json());
  });

  it('🔴 이메일이 바뀌어도 같은 회원(1번) · 이메일은 새 값으로', async () => {
    expect(await run(read(LAB('homework2.js')))).toEqual({ id: 1, email: 'jaehoon.kim@example.com' });
  });

  it('🔴 email 로 찾는 판은 새 회원(3번)이 생긴다 — 확인 절차가 가려낸다', async () => {
    const src = read(LAB('homework2.js'));
    const key = 'const key = `${user.iss} ${user.sub}`;';
    expect(src).toContain(key);
    expect(await run(src.replace(key, 'const key = user.email;'))).toEqual({ id: 3, email: 'jaehoon.kim@example.com' });
  });
});

describe('실습 `.http` 를 httpYac 으로', () => {
  it('🔴 oauth.http — 앞 둘(Step 4)은 인가 코드만으로 401 둘 · 뒤 셋은 `# @no-redirect` 로 303 에서 멈춘다 · Location 에 code(state 없음)', async () => {
    await withServers([() => bootAuth()], async () => {
      const dir = mkdtempSync(join(tmpdir(), 'p321-http-'));
      try {
        // 교안 Step 4 — 「화면에 보인 인가 코드」 두 곳에 Step 3 화면의 code 를 붙여 넣는다.
        const text = read(LAB('oauth.http'));
        expect(text.split('화면에 보인 인가 코드').length - 1).toBe(2);
        writeFileSync(join(dir, 'oauth.http'), text.replaceAll('화면에 보인 인가 코드', await codeFor('jaehoon')));
        const out = JSON.parse(execFileSync(P('node_modules/.bin/httpyac'), ['send', 'oauth.http', '--all', '--json'],
          { encoding: 'utf-8', cwd: dir })).requests;
        expect(out.map((r) => r.title)).toEqual(['인가 코드로 사진 달라고 해 보기', '비밀값 없이 인가 코드를 토큰으로 바꿔 보기',
          'dahye의 인가 코드 받기', 'jaehoon의 인가 코드 받기', 'jaehoon의 인가 코드 받기 (code_challenge를 담아)']);
        const [photos, token, ...codes] = out;
        expect([photos.response.statusCode, JSON.parse(photos.response.body)])
          .toEqual([401, { error: 'invalid_token', error_description: 'Access 토큰을 확인하지 못했어요' }]);
        expect([token.response.statusCode, JSON.parse(token.response.body)])
          .toEqual([401, { error: 'invalid_client', error_description: '클라이언트를 확인하지 못했어요' }]);
        for (const r of codes) {
          expect(r.response.statusCode).toBe(303);
          expect(r.response.headers.location).toMatch(/^http:\/\/localhost:4002\/callback\?code=[\w-]{22}$/);
        }
      } finally {
        rmSync(dir, { recursive: true, force: true });
      }
    });
  }, 60000);
});

describe('과제 [기초] — 화면으로는 못 가리고 창 1 로 가리는 판(답안 «흔한 실수»)', () => {
  it('🔴 scope 를 안 보고 늘 /photos 를 부르는 판도 브라우저 응답은 같다(undefined 키는 JSON 에서 빠진다) — 창 1 의 GET /photos 403 줄로 가려진다', async () => {
    const src = read(LAB('homework1.js'));
    const guard = "  // 사진을 허락받지 않았으면 누구인지만 보여 준다.\n  if (!tokens.scope.split(' ').includes('photos')) {\n    res.json({ sub: user.sub, email: user.email });\n    return;\n  }\n\n";
    expect(src).toContain(guard);
    await withServers([() => bootAuth(), () => bootApp(src.replace(guard, ''))], async (auth) => {
      const { after } = await signIn(browser(), { start: `${APP}/signin` });
      expect(after.body).toBe('{"sub":"10001","email":"jaehoon@example.com"}');
      await new Promise((r) => setTimeout(r, 100));
      expect(auth.tail()).toContain('GET /photos 403');
    });
    // 맞는 판은 로그인만 하면 창 1 에 사진 요청 줄이 없다
    await withServers([() => bootAuth(), () => bootApp(src)], async (auth) => {
      await signIn(browser(), { start: `${APP}/signin` });
      await new Promise((r) => setTimeout(r, 100));
      expect(auth.tail()).not.toContain('GET /photos');
    });
  });
});

// ── 교안·답안의 코드 블록이 코드베이스에 «실재» 한다 ──
// 교안 Step N 의 `// ~/instagram-api/lab/photo-app.js` 블록은 «그 Step 커밋» 의 photo-app.js 안에 줄 그대로 있어야 한다.
const LECTURE = P('../../part3/3-auth-principles/p3-21-oauth-oidc-lecture.md');
const ANSWERS = P('../../part3/3-auth-principles/p3-21-oauth-oidc-answers.md');
const blocksOf = (file) => {
  const out = [];
  let step = 0;
  let zone = 'body';
  let cur = null;
  for (const line of read(file).split('\n')) {
    if (cur) {
      if (line.startsWith('```')) { out.push(cur); cur = null; } else cur.lines.push(line);
      continue;
    }
    const m = line.match(/^## Step (\d+)/);
    if (m) { step = Number(m[1]); zone = 'body'; }
    if (/^### 직접 해보기/.test(line)) zone = 'lab';
    if (/^## (과제|생각해볼|마무리)/.test(line)) zone = 'rest';
    const f = line.match(/^```(\w*)$/);
    if (f) cur = { lang: f[1], step, zone, lines: [] };
  }
  return out;
};
const contains = (hay, body) => hay.includes(body.join('\n'));
const stepFiles = (n) => stepCommits(n).map((c) => git('show', `${c}:lab/p3-21/photo-app.js`));

describe('교안·답안 블록이 코드베이스에 실재한다', () => {
  it('🔴 교안 본문의 photo-app.js 블록 — 그 Step 커밋의 photo-app.js 안에 줄 그대로', () => {
    const blocks = blocksOf(LECTURE).filter((b) => b.lang === 'javascript' && b.lines[0] === '// ~/instagram-api/lab/photo-app.js');
    expect(blocks.length).toBe(15);
    const misses = blocks.filter((b) => !stepFiles(b.step).some((t) => contains(t, b.lines.slice(1))));
    expect(misses.map((b) => `Step ${b.step} ${b.lines[1]}`)).toEqual([]);
  });

  it('🔴 교안의 나머지 lab 블록 — 실습 파일 · 인가 서버(직접 해보기 1 은 등록을 더한 판)', () => {
    const REGISTERED = read(LAB('auth-server.js')).replace(
      "    redirectUris: ['http://localhost:4002/callback'],\n  },\n};",
      "    redirectUris: ['http://localhost:4002/callback'],\n  },\n  'story-app': {\n    name: '스토리 만들기',\n    secret: 'story-app-secret',\n    redirectUris: ['http://localhost:4003/callback'],\n  },\n};");
    const blocks = blocksOf(LECTURE).filter((b) => b.lang === 'javascript' && /^\/\/ ~\/instagram-api\/lab\//.test(b.lines[0])
      && b.lines[0] !== '// ~/instagram-api/lab/photo-app.js');
    // 인가 서버 블록 넷 — Step 2 🙋 의 303 줄 · 직접 해보기 1 의 등록 · Step 4 의 `tokens` Map · Step 7 의 `aud` 줄
    expect(blocks.map((b) => b.lines[0])).toEqual([
      '// ~/instagram-api/lab/auth-server.js', '// ~/instagram-api/lab/practice1.js', '// ~/instagram-api/lab/auth-server.js',
      '// ~/instagram-api/lab/auth-server.js', '// ~/instagram-api/lab/practice2.js', '// ~/instagram-api/lab/auth-server.js',
      '// ~/instagram-api/lab/practice3.js',
    ]);
    expect(blocks.filter((b) => b.lines[0].endsWith('auth-server.js')).map((b) => b.step)).toEqual([2, 3, 4, 7]);
    const misses = blocks.filter((b) => {
      const name = b.lines[0].replace('// ~/instagram-api/lab/', '');
      const hay = name === 'auth-server.js' ? REGISTERED : read(LAB(name));
      return !contains(hay, b.lines.slice(1));
    });
    expect(misses.map((b) => `Step ${b.step} ${b.lines[0]}`)).toEqual([]);
    // 실습 1·2 의 해설은 파일 전체다
    for (const name of ['practice1.js', 'practice2.js']) {
      const b = blocks.find((x) => x.lines[0] === `// ~/instagram-api/lab/${name}`);
      expect(b.lines.join('\n') + '\n').toBe(read(LAB(name)));
    }
  });

  it('🔴 교안의 .http 블록 — lab/p3-21/oauth.http 의 요청 다섯 그대로(Step 4 블록 하나에 요청 둘)', () => {
    const blocks = blocksOf(LECTURE).filter((b) => b.lang === '' && b.lines[0]?.startsWith('### '));
    expect(blocks.map((b) => b.lines[0])).toEqual(['### 인가 코드로 사진 달라고 해 보기', '### dahye의 인가 코드 받기',
      '### jaehoon의 인가 코드 받기', '### jaehoon의 인가 코드 받기 (code_challenge를 담아)']);
    expect(blocks.map((b) => b.step)).toEqual([4, 5, 6, 6]);
    expect(blocks[0].lines).toContain('### 비밀값 없이 인가 코드를 토큰으로 바꿔 보기');
    const http = read(LAB('oauth.http'));
    expect(blocks.filter((b) => !contains(http, b.lines)).map((b) => b.lines[0])).toEqual([]);
  });

  it('🔴 답안의 해설 블록 — homework1·homework2 안에 줄 그대로', () => {
    const blocks = blocksOf(ANSWERS).filter((b) => b.lang === 'javascript');
    expect(blocks.map((b) => b.lines[0])).toEqual([
      '// ~/instagram-api/lab/homework1.js', '// ~/instagram-api/lab/homework1.js',
      '// ~/instagram-api/lab/homework2.js', '// ~/instagram-api/lab/homework2.js',
    ]);
    const misses = blocks.filter((b) => !contains(read(LAB(b.lines[0].replace('// ~/instagram-api/lab/', ''))), b.lines.slice(1)));
    expect(misses.map((b) => b.lines[1])).toEqual([]);
  });

  it('🔴 교안이 인용한 응답 글자 — 판정이 받은 그대로', () => {
    const text = read(LECTURE);
    for (const line of [
      '{"message":"허락을 받지 못했어요 (access_denied)"}',
      '{"photos":["한강 노을","제주 바다","강아지 산책"]}',
      '{"error":"invalid_grant","error_description":"쓸 수 없는 인가 코드예요"}',
      '{"photos":["등산 정상","야경"]}',
      '{"message":"이 브라우저에서 시작한 로그인이 아니에요"}',
      '{"error":"invalid_grant","error_description":"code_verifier가 맞지 않아요"}',
      '{"sub":"10001","email":"jaehoon@example.com","photos":["한강 노을","제주 바다","강아지 산책"]}',
      '{"message":"ID 토큰을 믿을 수 없어요","reason":"jwt audience invalid. expected: photo-app"}',
      '{"message":"ID 토큰을 믿을 수 없어요","reason":"nonce가 달라요"}',
      'http://127.0.0.1:4001/authorize?response_type=code&client_id=photo-app&redirect_uri=http%3A%2F%2Flocalhost%3A4002%2Fcallback&scope=photos',
      '인가 서버가 4001번 포트에서 기다리고 있어요.',
      '`GET /photos 200`',
      '「code_challenge 없이 받은 인가 코드예요」',
      // 「이해를 먼저」 소급(2026-10-30) — 위 판정들이 받은 그대로
      'HTTP/1.1 303  - See Other',
      'HTTP/1.1 401  - Unauthorized',
      '  "error_description": "Access 토큰을 확인하지 못했어요"',
      '  "error_description": "클라이언트를 확인하지 못했어요"',
      '`Cannot POST /callback`',
      'scope=photos&username=jaehoon&password=jaehoon1234&decision=allow',
      "`aud`가 `'story-app'`이에요",
    ]) expect(text).toContain(line);
  });

  it('🔴 교안 Step 7 토큰 헤더의 kid 와 Step 8 JWKS 출력의 kid 가 같다 — 같은 인가 서버 실행에서 떴다', () => {
    const text = read(LECTURE);
    const idt = text.match(/id_token: '([\w.-]+)'/)[1];
    const jwks = JSON.parse(text.match(/^(\{"keys":\[.+\]\})$/m)[1]);
    expect(b64(idt.split('.')[0]).kid).toBe(jwks.keys[0].kid);
  });

  it('🔴 교안 Step 4·7 의 터미널 출력은 실제 출력과 값만 다르다(줄 · 키 · 차례가 같다)', async () => {
    const mask = (t) => t
      .replace(/(access_token: ')[\w-]+'/g, "$1A'")
      .replace(/(id_token: ')[\w.-]+'/g, "$1I'")
      .replace(/(nonce: ')[\w-]+'/g, "$1N'")
      .replace(/(iat|exp): \d+/g, '$1: T');
    const textBlocks = blocksOf(LECTURE).filter((b) => b.lang === 'text' && b.lines[0] === '{');
    const shown = Object.fromEntries(textBlocks.map((b) => [b.step, b.lines.join('\n')]));
    for (const n of [4, 7]) {
      await withServers([() => bootAuth(), () => bootApp(appAt(n))], async (auth, app) => {
        await signIn(browser());
        const printed = app.tail().split('\n').slice(1).join('\n').trimEnd();
        expect(mask(shown[n])).toBe(mask(printed));
      });
    }
    // 교안 Step 7 출력의 페이로드는 그 위 id_token 의 페이로드와 같다
    const s7 = shown[7];
    const idt = s7.match(/id_token: '([\w.-]+)'/)[1];
    const p = b64(idt.split('.')[1]);
    expect(s7).toContain(`nonce: '${p.nonce}'`);
    expect(s7).toContain(`iat: ${p.iat},\n  exp: ${p.exp}`);
  });
});

// ── 소급 뒤 두 페르소나 낭독(2026-10-30) — 학생이 따라 쳐서 찾은 것을 잠근다 ──
// 교안 글자는 «원고가 그 장면을 말하는가» 만 본다(1차 반영 전 원고로 Red 를 확인했다). 동작은 판을 바꿔 띄워 잰다.
describe('소급 뒤 낭독 — 확인 절차와 새로 쓴 사실', () => {
  const hw1Guard = "  if (!tokens.scope.split(' ').includes('photos')) {";

  it('🔴 과제 [기초] — ID 토큰에서 scope 를 찾는 판은 「로그인만 하기」로는 맞는 판과 같고 「사진 불러오기」에서 photos 가 빠진다 · 요구사항 5 가 그 로그인을 시킨다', async () => {
    const text = read(LECTURE);
    expect(text).toContain('이어서 「사진 불러오기」로 다시 로그인해 응답에 `photos`가 오는지도 적어요.');
    expect(text).toContain('6. 「로그인만 하기」로 로그인했을 때 창 2 터미널에 찍힌 `access_token`을 복사해');
    expect(read(ANSWERS)).toContain('### 흔한 실수 — ID 토큰에서 `scope`를 찾으면');
    const src = read(LAB('homework1.js'));
    expect(src).toContain(hw1Guard);
    const quiet = src.replace(hw1Guard, "  if (!(user.scope ?? '').split(' ').includes('photos')) {");
    await withServers([() => bootAuth(), () => bootApp(quiet)], async (auth) => {
      const only = (await signIn(browser(), { start: `${APP}/signin` })).after;
      expect(only.body).toBe('{"sub":"10001","email":"jaehoon@example.com"}');
      await new Promise((r) => setTimeout(r, 100));
      expect(auth.tail()).not.toContain('GET /photos');
      const full = (await signIn(browser())).after;
      expect(full.json()).toEqual({ sub: '10001', email: 'jaehoon@example.com' }); // 사진이 안 온다
    });
    // `?? ''` 없이 쓰면 undefined 에서 split — 500
    const loud = src.replace(hw1Guard, "  if (!user.scope.split(' ').includes('photos')) {");
    await withServers([() => bootAuth(), () => bootApp(loud)], async () => {
      expect((await signIn(browser(), { start: `${APP}/signin` })).after.status).toBe(500);
    });
  });

  it('🔴 Step 5 — `!req.query.state ||` 를 뺀 판은 주소에도 쿠키에도 state 가 없는 dahye 장면을 통과시킨다 · 맞는 판은 403', async () => {
    expect(read(LECTURE)).toContain('**조건 맨 앞의 `!req.query.state`도 바로 이 장면을 막아요.**');
    const full = "if (!req.query.state || req.query.state !== req.cookies.oauth_state) {";
    const loose = "if (req.query.state !== req.cookies.oauth_state) {";
    const scene = async (src) => withServers([() => bootAuth(), () => bootApp(src)], async () => {
      const code = await codeFor('dahye');
      return browser().go(`${APP}/callback?code=${code}`);
    });
    const step5 = appAt(5);
    expect(step5).toContain(full);
    const ok = await scene(step5);
    expect([ok.status, ok.json()]).toEqual([403, { message: '이 브라우저에서 시작한 로그인이 아니에요' }]);
    const bad = await scene(step5.replace(full, loose));
    expect([bad.status, bad.json()]).toEqual([200, { photos: ['등산 정상', '야경'] }]);
  });

  it('🔴 Step 6 — state 를 확인한 바로 다음에 oauth_verifier 를 지워도 토큰 교환은 된다(clearCookie 는 응답에 싣는 일)', async () => {
    expect(read(LECTURE)).toContain('**`res.clearCookie`는 «이 쿠키를 지우라»는 줄을 응답에 싣는 일이고, 지금 처리하는 요청의 `req.cookies`는 바꾸지 않아요.**');
    const step6 = appAt(6);
    const at = "  res.clearCookie('oauth_state');\n";
    expect(step6).toContain(at);
    for (const [src, verifierLeft] of [[step6, true], [step6.replace(at, `${at}  res.clearCookie('oauth_verifier');\n`), false]]) {
      await withServers([() => bootAuth(), () => bootApp(src)], async () => {
        const b = browser();
        const { after } = await signIn(b);
        expect([after.status, after.json()]).toEqual([200, { photos: ['한강 노을', '제주 바다', '강아지 산책'] }]);
        expect(b.cookie('localhost', 'oauth_verifier') !== undefined).toBe(verifierLeft);
      });
    }
  });

  it('🔴 같은 브라우저에서 흐름을 둘 시작하면 앞 동의 화면의 「허용」은 403 — state 쿠키는 마지막 것 하나', async () => {
    expect(read(LECTURE)).toContain('⚠️ **새 탭에서는 「사진 불러오기」를 누르지 않아요.**');
    await withServers([() => bootAuth(), () => bootApp(read(LAB('photo-app.js')))], async () => {
      const b = browser();
      const first = await b.go(`${APP}/login`);
      const second = await b.go(`${APP}/login`);
      const [s1, s2] = [first, second].map((c) => hiddenFields(c.body).state);
      expect(s1).not.toBe(s2);
      expect(b.cookie('localhost', 'oauth_state')).toBe(s2);
      const after = await b.go(`${AUTH}/authorize`, {
        method: 'POST',
        body: new URLSearchParams({ ...hiddenFields(first.body), username: 'jaehoon', password: 'jaehoon1234', decision: 'allow' }),
      });
      expect([after.status, after.json()]).toEqual([403, { message: '이 브라우저에서 시작한 로그인이 아니에요' }]);
    });
  });

  it('🔴 실습용 인가 서버의 동의 화면은 프레임을 막는 헤더를 보내지 않는다(그래서 <iframe> 안에 그려진다)', async () => {
    expect(read(LECTURE)).toContain('오늘의 실습용 인가 서버는 이 헤더를 보내지 않아서 `<iframe>` 안에도 그대로 그려져요.');
    await withServers([() => bootAuth()], async () => {
      const q = new URLSearchParams({ response_type: 'code', client_id: 'photo-app', redirect_uri: `${APP}/callback`, scope: 'photos' });
      const res = await fetch(`${AUTH}/authorize?${q}`);
      expect(res.status).toBe(200);
      expect(res.headers.get('x-frame-options')).toBeNull();
      expect(res.headers.get('content-security-policy') ?? '').not.toMatch(/frame-ancestors/);
    });
  });

  it('🔴 직접 해보기 1 — redirectUris 를 문자열로 적으면 글자 일부만 맞는 주소에도 동의 화면이 열린다 · 배열이면 400', async () => {
    expect(read(LECTURE)).toContain('돌아올 주소는 `photo-app`처럼 배열에 담되 `http://localhost:4003/callback` 하나만 넣어요.');
    const base = "    redirectUris: ['http://localhost:4002/callback'],\n  },\n};";
    const reg = (uris) => [base, `    redirectUris: ['http://localhost:4002/callback'],\n  },\n  'story-app': {\n    name: '스토리 만들기',\n    secret: 'story-app-secret',\n    redirectUris: ${uris},\n  },\n};`];
    const open = async (edit) => withServers([() => bootAuth([edit])], async () => {
      const q = new URLSearchParams({ response_type: 'code', client_id: 'story-app', redirect_uri: 'http://localhost:4003/', scope: 'photos' });
      return (await fetch(`${AUTH}/authorize?${q}`)).status;
    });
    expect(await open(reg("['http://localhost:4003/callback']"))).toBe(400);
    expect(await open(reg("'http://localhost:4003/callback'"))).toBe(200);
  });
});
