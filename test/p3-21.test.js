// p3-21 「위임과 OAuth · OIDC」 게이트 — 실습 서버 둘
//
// `3-auth-principles` 마지막 회차다. 수업 백엔드는 건드리지 않는다 — Step 1~8 본문이 전부 `lab/` 이다
// (`curriculum.md` 「`p3-21` 착수 결정」 · `folder-check.py` 의 `API_LAB_STEPS`).
//   - `lab/p3-21/auth-server.js` — 강의 자료로 나눠 주는 «구글 역할» 인가 서버(4001 · 학생은 `http://127.0.0.1:4001` 로 연다).
//     학생이 짜지 않는 준비물이라 이 판정이 그 동작을 잠근다.
//   - `lab/p3-21/photo-app.js` — 학생이 Step 마다 키우는 «우리 서비스»(4002 · `http://localhost:4002`).
// 판정은 학생이 치는 `node lab/…` 를 그대로 띄워 진짜 포트로 왕복한다(`boot.js`). 브라우저는 아래 `browser()` 가
// 대신한다 — 호스트마다 쿠키를 따로 기억하고 302 를 따라간다(크롬과 같은 판인지는 기록 「브라우저 실측」 이 헤드리스
// 크롬으로 쟀다 — `127.0.0.1` → `localhost` 로 돌아오는 302 에도 `SameSite=Lax` 쿠키가 실린다).
//
// 축 ① 인가 서버 — 디스커버리 문서 · JWKS · 인가 요청 검사(등록 안 한 클라이언트·redirect_uri 는 돌려보내지 않는다) ·
//      동의 화면 · 허용/거부 · 토큰 엔드포인트(invalid_client · 한 번만 · PKCE) · 리소스(401 · 403 insufficient_scope).
// 축 ② Step 별 판 — Step 2(동의 화면까지) · 3(code) · 4(토큰 · 사진 · 토큰은 터미널에만) · 5(state — 남의 code 를
//      끼우면 403) · 6(PKCE — state 를 통과한 가로챈 code 도 invalid_grant) · 7(ID 토큰 읽기) · 8(ID 토큰 확인).
// 축 ③ ID 토큰 확인 — aud · iss · nonce · 다른 키로 만든 서명을 Step 8 은 막고, Step 7 은 그대로 믿는다.
// 실습·과제 — `lab/p3-21/`(학생 쪽 경로 주석은 `~/instagram-api/lab/…`).
import { describe, it, expect, afterAll } from 'vitest';
import { readFileSync, mkdtempSync, rmSync, writeFileSync, symlinkSync, cpSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { boot } from './helpers/boot.js';
import { roundDir } from './helpers/round.js';

const ROOT = new URL('../', import.meta.url);
const P = (rel) => new URL(rel, ROOT).pathname;
const read = (p) => readFileSync(p, 'utf8');

// 이 회차의 학생 파일은 북마크 `code/p3-21` 을 풀어서 읽는다(없으면 작업트리 — 이 회차를 짓는 동안).
const ROUND = roundDir('code/p3-21');
const LAB = (file) => join(ROUND.dir, 'lab/p3-21', file);

afterAll(() => ROUND.cleanup());

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

// ── 브라우저 흉내 — 호스트마다 쿠키를 따로 기억하고 302 를 따라간다 ──
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
    throw new Error('302 가 너무 많다');
  };
  return { go, jar, cookie: (host, name) => cookiesOf(host).get(name) };
};

const unescapeHtml = (text) => text.replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)));
const hiddenFields = (html) =>
  Object.fromEntries([...html.matchAll(/<input type="hidden" name="(\w+)" value="([^"]*)">/g)].map(([, n, v]) => [n, unescapeHtml(v)]));

// 동의 화면에서 아이디·비밀번호를 넣고 허용(또는 거부)을 누른다 — 그 뒤 302 를 따라간 결과를 돌려준다.
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

// `.http` 의 `# @no-redirect` 처럼 — 인가 서버에 바로 허용을 보내 302 의 Location 에서 code 를 꺼낸다.
const codeFor = async (username, extra = {}) => {
  const res = await fetch(`${AUTH}/authorize`, {
    method: 'POST',
    redirect: 'manual',
    body: new URLSearchParams({
      response_type: 'code', client_id: 'photo-app', redirect_uri: `${APP}/callback`, scope: 'photos',
      username, password: `${username}1234`, decision: 'allow', ...extra,
    }),
  });
  expect(res.status).toBe(302);
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

  it('🔴 허용·거부 — 거부는 error=access_denied · 틀린 비밀번호는 동의 화면 401 · 허용은 code (state 는 뒤에)', async () => {
    await withServers([() => bootAuth()], async () => {
      const post = (extra) => fetch(`${AUTH}/authorize`, {
        method: 'POST',
        redirect: 'manual',
        body: new URLSearchParams({
          response_type: 'code', client_id: 'photo-app', redirect_uri: `${APP}/callback`, scope: 'photos', state: 's1', ...extra,
        }),
      });
      const deny = await post({ decision: 'deny' });
      expect(deny.status).toBe(302);
      expect(deny.headers.get('location')).toBe(`${APP}/callback?error=access_denied&state=s1`);
      const wrong = await post({ decision: 'allow', username: 'jaehoon', password: 'nope' });
      expect(wrong.status).toBe(401);
      expect(await wrong.text()).toContain('<p>아이디나 비밀번호가 맞지 않아요</p>');
      const allow = await post({ decision: 'allow', username: 'jaehoon', password: 'jaehoon1234' });
      expect(allow.status).toBe(302);
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
    });
  });

  it('🔴 리소스 — 토큰 없으면 401 invalid_token · scope 밖이면 403 insufficient_scope · 사진', async () => {
    await withServers([() => bootAuth()], async () => {
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
      expect(app.tail()).toMatch(/id_token: 'eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCIsImtpZCI6Ij[\w-]+\.[\w-]+\.[\w-]+'/);
      expect(b.cookie('localhost', 'oauth_nonce')).toBe(q.get('nonce'));
    });
  });

  it('🔴 Step 8 — 확인을 거친 같은 결과 · 확인 함수가 JWKS 를 받아 간다', async () => {
    await withServers([() => bootAuth(), () => bootApp(appAt(8))], async () => {
      const { after } = await signIn(browser());
      expect(after.json()).toEqual({ sub: '10001', email: 'jaehoon@example.com', photos: ['한강 노을', '제주 바다', '강아지 산책'] });
      const minji = (await signIn(browser(), { username: 'minji' })).after;
      expect(minji.json()).toEqual({ sub: '10002', email: 'minji@example.com', photos: ['벚꽃길', '카페 라테'] });
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
      await withServers([() => bootAuth([edit]), () => bootApp(appAt(7))], async () => {
        const { after } = await signIn(browser());
        expect(after.status).toBe(200);
        expect(after.json().email).toBe('jaehoon@example.com');
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
  it('🔴 oauth.http — `# @no-redirect` 로 302 에서 멈춘다 · Location 에 code(state 없음)', async () => {
    await withServers([() => bootAuth()], async () => {
      const dir = mkdtempSync(join(tmpdir(), 'p321-http-'));
      try {
        cpSync(LAB('oauth.http'), join(dir, 'oauth.http'));
        const out = JSON.parse(execFileSync(P('node_modules/.bin/httpyac'), ['send', 'oauth.http', '--all', '--json'],
          { encoding: 'utf-8', cwd: dir })).requests;
        expect(out.map((r) => r.title)).toEqual(['dahye의 code 받기', 'jaehoon의 code 받기', 'jaehoon의 code 받기 (challenge를 담아)']);
        for (const r of out) {
          expect(r.response.statusCode).toBe(302);
          expect(r.response.headers.location).toMatch(/^http:\/\/localhost:4002\/callback\?code=[\w-]{22}$/);
        }
      } finally {
        rmSync(dir, { recursive: true, force: true });
      }
    });
  }, 60000);
});
