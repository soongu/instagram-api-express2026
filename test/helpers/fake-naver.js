// 판정 전용 가짜 네이버 — 내부 검증 전용, 교안에 한 줄도 인용하지 않는다.
//
// 🔑 판정은 진짜 네이버(nid.naver.com · openapi.naver.com)에 요청을 보내지 않는다. 학생 파일 사본의 네이버 주소 셋
//    (인가 · 토큰 · 사용자 정보)만 이 서버 주소로 바꿔 띄운다(`p3-46` 판정).
// 🔑 새 OIDC 경로 `/oauth2/…` 다(문서 `developers.naver.com/docs/login/devguide/devguide.md` 3.5 확인 2026-11-12):
//    - `/oauth2/authorize` 는 `scope` 에 `openid` 가 없으면 400(문서 «'openid' scope 필수»)
//    - 거부는 `?error=access_denied&error_description=Canceled%20By%20User&state=…`(state 가 붙는다 — 카카오와 다르다 · 2026-11-13 실측)
//    - `/oauth2/token` 은 `redirect_uri` 필수 · `code_verifier`(challenge 를 받았으면 S256 대조) · 응답에 `id_token`
//    - 틀린 클라이언트는 401 `{ error: 'invalid_client' }`(설명 없음) · 틀린 코드는 400 `{ error: 'invalid_grant' }`
//    - 사용자 정보 `/v1/nid/me` 는 `{ resultcode, message, response: { id, email, name } }` — 값이 `response` 안에 있다
//    - 틀린 토큰은 401 `{ resultcode: '024', message: 'Authentication failed (인증 실패하였습니다.)' }`
import http from 'node:http';
import { createHash, randomBytes } from 'node:crypto';

const json = (res, status, body) => {
  res.writeHead(status, { 'Content-Type': 'application/json;charset=UTF-8' });
  res.end(JSON.stringify(body));
};
const readBody = (req) => new Promise((resolve) => {
  let text = '';
  req.on('data', (chunk) => { text += chunk; });
  req.on('end', () => resolve(text));
});
const s256 = (verifier) => createHash('sha256').update(verifier).digest('base64url');

export const DEFAULT_NAVER_PROFILE = { id: 'aB3dE5fG7hI9jK1lM3nO5pQ7rS9tU1vW3xY5zA7bC9d', email: 'minji.kim@naver.com', name: '김민지' };

/** 가짜 네이버를 띄운다 — `profile`(= 응답의 `response`)·`mode`·`clientSecret` 을 테스트가 바꿔 끼운다. */
export function startFakeNaver({ port = 3972, clientId = 'test-naver', clientSecret = 'test-naver-secret' } = {}) {
  const state = {
    profile: { ...DEFAULT_NAVER_PROFILE },
    mode: 'allow',
    clientSecret,
    userinfoFails: false,
    codes: new Map(),
    tokens: new Map(),
    log: { authorize: [], token: [], userinfo: [] },
  };
  const server = http.createServer(async (req, res) => {
    const url = new URL(req.url, `http://localhost:${port}`);

    if (req.method === 'GET' && url.pathname === '/oauth2/authorize') {
      const query = Object.fromEntries(url.searchParams);
      state.log.authorize.push(query);
      if (query.client_id !== clientId || !query.redirect_uri || query.response_type !== 'code') {
        json(res, 400, { error: 'invalid_request' });
        return;
      }
      if (!(query.scope ?? '').split(' ').includes('openid')) {
        json(res, 400, { error: 'invalid_scope', error_description: "'openid' scope is required" });
        return;
      }
      const back = new URL(query.redirect_uri);
      if (state.mode === 'deny') {
        // 진짜 네이버의 취소 주소(2026-11-13 실측) — error · error_description · state 차례이고 빈칸은 %20 이다.
        const tail = query.state === undefined ? '' : `&state=${encodeURIComponent(query.state)}`;
        back.search = `?error=access_denied&error_description=Canceled%20By%20User${tail}`;
      } else {
        if (query.state !== undefined) back.searchParams.set('state', query.state);
        const code = randomBytes(12).toString('base64url');
        state.codes.set(code, {
          redirectUri: query.redirect_uri,
          challenge: query.code_challenge,
          method: query.code_challenge_method ?? 'S256',
          profile: { ...state.profile },
          used: false,
        });
        back.searchParams.set('code', code);
      }
      res.writeHead(302, { Location: back.href });
      res.end();
      return;
    }

    if (req.method === 'POST' && url.pathname === '/oauth2/token') {
      const raw = await readBody(req);
      const body = Object.fromEntries(new URLSearchParams(raw));
      state.log.token.push({ method: req.method, body, contentType: req.headers['content-type'], authorization: req.headers.authorization });
      if (body.client_id !== clientId || body.client_secret !== state.clientSecret) {
        json(res, 401, { error: 'invalid_client' });
        return;
      }
      const saved = state.codes.get(body.code);
      if (body.grant_type !== 'authorization_code' || !saved || saved.used || !body.redirect_uri || saved.redirectUri !== body.redirect_uri) {
        json(res, 400, { error: 'invalid_grant' });
        return;
      }
      saved.used = true;
      if (saved.challenge !== undefined && (saved.method !== 'S256' || s256(body.code_verifier ?? '') !== saved.challenge)) {
        json(res, 400, { error: 'invalid_grant' });
        return;
      }
      const accessToken = `AAAAN${randomBytes(48).toString('base64url')}`;
      state.tokens.set(accessToken, saved.profile);
      json(res, 200, {
        access_token: accessToken,
        refresh_token: randomBytes(48).toString('base64url'),
        token_type: 'bearer',
        expires_in: 3600,
        // 서명을 확인하지 않는 자리라 모양만 JWT 인 글자를 준다(학생 코드는 id_token 을 읽지 않는다).
        id_token: `${Buffer.from('{"alg":"RS256","typ":"JWT"}').toString('base64url')}.${Buffer.from(JSON.stringify({ iss: 'https://nid.naver.com', sub: saved.profile.id, aud: clientId })).toString('base64url')}.c2lnbmF0dXJl`,
      });
      return;
    }

    if (req.method === 'GET' && url.pathname === '/v1/nid/me') {
      state.log.userinfo.push({ url: req.url, authorization: req.headers.authorization });
      const header = req.headers.authorization ?? '';
      const profile = header.startsWith('Bearer ') ? state.tokens.get(header.slice('Bearer '.length)) : undefined;
      if (state.userinfoFails || !profile) {
        json(res, 401, { resultcode: '024', message: 'Authentication failed (인증 실패하였습니다.)' });
        return;
      }
      json(res, 200, { resultcode: '00', message: 'success', response: profile });
      return;
    }

    json(res, 404, { errorMessage: 'Not Found', errorCode: '404' });
  });

  return new Promise((resolve) => {
    server.listen(port, () => resolve({
      base: `http://localhost:${port}`,
      urls: {
        authorize: `http://localhost:${port}/oauth2/authorize`,
        token: `http://localhost:${port}/oauth2/token`,
        userinfo: `http://localhost:${port}/v1/nid/me`,
      },
      state,
      /** 판정마다 처음 상태로 — 프로필 · 모드 · 시크릿 · 기록. */
      reset() {
        state.profile = { ...DEFAULT_NAVER_PROFILE };
        state.mode = 'allow';
        state.clientSecret = clientSecret;
        state.userinfoFails = false;
        state.codes.clear();
        state.tokens.clear();
        state.log = { authorize: [], token: [], userinfo: [] };
      },
      // fetch 가 붙들고 있는 keep-alive 연결까지 닫아야 close 가 끝난다.
      stop: () => new Promise((done) => {
        server.close(() => done());
        server.closeAllConnections();
      }),
    }));
  });
}
