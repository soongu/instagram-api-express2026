// 판정 전용 가짜 구글 — 내부 검증 전용, 교안에 한 줄도 인용하지 않는다.
//
// 🔑 판정은 진짜 구글(accounts.google.com)에 요청을 보내지 않는다. 학생 파일 사본의 구글 주소 셋
//    (인가 · 토큰 · 사용자 정보)만 이 서버 주소로 바꿔 띄운다 — 바꾸는 것은 주소 셋뿐이다(`p3-45` 판정).
// 🔑 동의 화면은 없다 — `/authorize` 는 받은 쿼리를 기록하고 곧바로 돌아올 주소로 302 한다(`deny` 면 거부).
// 🔑 진짜 구글처럼 굴려고 고른 것 — 토큰 주소의 틀린 비밀값은 401 `invalid_client`(설명 `Unauthorized`),
//    틀린 코드·돌아올 주소·PKCE 는 400 `invalid_grant` · 사용자 정보는 `Authorization: Bearer` 헤더로만 받는다
//    (주소의 `access_token` 은 401) · 사용자 정보의 이름은 OIDC 표준 클레임(`sub` · `email` · `email_verified` · `name`).
import http from 'node:http';
import { createHash, randomBytes } from 'node:crypto';

const json = (res, status, body) => {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(body));
};
const readBody = (req) => new Promise((resolve) => {
  let text = '';
  req.on('data', (chunk) => { text += chunk; });
  req.on('end', () => resolve(text));
});
const s256 = (verifier) => createHash('sha256').update(verifier).digest('base64url');

export const DEFAULT_PROFILE = { sub: '108123456789012345678', email: 'minji.kim@gmail.com', email_verified: true, name: '김민지' };

/** 가짜 구글을 띄운다 — `profile`·`mode`·`clientSecret` 을 테스트가 바꿔 끼운다. */
export function startFakeGoogle({ port = 3961, clientId = 'test-client', clientSecret = 'test-secret' } = {}) {
  const state = {
    profile: { ...DEFAULT_PROFILE },
    mode: 'allow',
    clientSecret,
    userinfoFails: false,
    codes: new Map(),
    tokens: new Map(),
    log: { authorize: [], token: [], userinfo: [] },
  };
  const server = http.createServer(async (req, res) => {
    const url = new URL(req.url, `http://localhost:${port}`);

    if (req.method === 'GET' && url.pathname === '/authorize') {
      const query = Object.fromEntries(url.searchParams);
      state.log.authorize.push(query);
      if (query.client_id !== clientId || !query.redirect_uri) {
        json(res, 400, { error: 'invalid_request' });
        return;
      }
      const back = new URL(query.redirect_uri);
      if (state.mode === 'deny') {
        back.searchParams.set('error', 'access_denied');
      } else {
        const code = randomBytes(12).toString('base64url');
        state.codes.set(code, {
          redirectUri: query.redirect_uri,
          challenge: query.code_challenge,
          method: query.code_challenge_method,
          profile: { ...state.profile },
          used: false,
        });
        back.searchParams.set('code', code);
      }
      if (query.state !== undefined) back.searchParams.set('state', query.state);
      res.writeHead(302, { Location: back.href });
      res.end();
      return;
    }

    if (req.method === 'POST' && url.pathname === '/token') {
      const raw = await readBody(req);
      const body = Object.fromEntries(new URLSearchParams(raw));
      state.log.token.push({ body, contentType: req.headers['content-type'], authorization: req.headers.authorization });
      if (body.client_id !== clientId || body.client_secret !== state.clientSecret) {
        json(res, 401, { error: 'invalid_client', error_description: 'Unauthorized' });
        return;
      }
      const saved = state.codes.get(body.code);
      if (body.grant_type !== 'authorization_code' || !saved || saved.used || saved.redirectUri !== body.redirect_uri) {
        json(res, 400, { error: 'invalid_grant', error_description: 'Bad Request' });
        return;
      }
      saved.used = true;
      // PKCE — challenge 를 받았으면 verifier 가 맞아야 하고, 안 받았는데 verifier 가 오면 거절한다(RFC 9700).
      if (saved.challenge !== undefined ? (saved.method !== 'S256' || s256(body.code_verifier ?? '') !== saved.challenge) : body.code_verifier !== undefined) {
        json(res, 400, { error: 'invalid_grant', error_description: 'Invalid code verifier.' });
        return;
      }
      const accessToken = `ya29.${randomBytes(24).toString('base64url')}`;
      state.tokens.set(accessToken, saved.profile);
      json(res, 200, { access_token: accessToken, expires_in: 3599, scope: 'openid https://www.googleapis.com/auth/userinfo.email https://www.googleapis.com/auth/userinfo.profile', token_type: 'Bearer' });
      return;
    }

    if (req.method === 'GET' && url.pathname === '/userinfo') {
      state.log.userinfo.push({ url: req.url, authorization: req.headers.authorization });
      const header = req.headers.authorization ?? '';
      const profile = header.startsWith('Bearer ') ? state.tokens.get(header.slice('Bearer '.length)) : undefined;
      if (state.userinfoFails || url.searchParams.has('access_token') || !profile) {
        json(res, 401, { error: 'invalid_request', error_description: 'Invalid Credentials' });
        return;
      }
      json(res, 200, profile);
      return;
    }

    json(res, 404, { error: 'not_found' });
  });

  return new Promise((resolve) => {
    server.listen(port, () => resolve({
      base: `http://localhost:${port}`,
      urls: {
        authorize: `http://localhost:${port}/authorize`,
        token: `http://localhost:${port}/token`,
        userinfo: `http://localhost:${port}/userinfo`,
      },
      state,
      /** 판정마다 처음 상태로 — 프로필 · 모드 · 비밀값 · 기록. */
      reset() {
        state.profile = { ...DEFAULT_PROFILE };
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
