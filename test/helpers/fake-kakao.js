// 판정 전용 가짜 카카오 — 내부 검증 전용, 교안에 한 줄도 인용하지 않는다.
//
// 🔑 판정은 진짜 카카오(kauth.kakao.com · kapi.kakao.com)에 요청을 보내지 않는다. 학생 파일 사본의 카카오 주소 셋
//    (인가 · 토큰 · 사용자 정보)만 이 서버 주소로 바꿔 띄운다(`p3-46` 판정).
// 🔑 동의 화면은 없다 — `/oauth/authorize` 는 받은 쿼리를 기록하고 곧바로 돌아올 주소로 302 한다.
// 🔑 진짜 카카오처럼 굴려고 고른 것(문서 `developers.kakao.com/docs/ko/kakaologin/rest-api` 확인 2026-11-12):
//    - 거부는 `?error=access_denied&error_description=User%20denied%20access` — **state 를 안 붙인다**
//    - 토큰 주소의 틀린 시크릿은 401 `{ error: 'invalid_client', error_description: 'Bad client credentials', error_code: 'KOE010' }`
//    - 틀린 코드는 400 `KOE320` · PKCE 는 «challenge 를 받았으면 확인» 만(문서의 파라미터 표에는 없고 디스커버리에만 S256)
//    - 사용자 정보 `/v2/user/me` 는 `Authorization: Bearer` 헤더만 · 회원번호 `id` 는 **숫자** · 닉네임은 `kakao_account.profile.nickname`
//    - 틀린 토큰은 401 `{ msg: 'this access token does not exist', code: -401 }`
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

export const DEFAULT_KAKAO_PROFILE = {
  id: 3812345678,
  connected_at: '2026-11-12T05:21:08Z',
  properties: { nickname: '민지' },
  kakao_account: { profile_nickname_needs_agreement: false, profile: { nickname: '민지', is_default_nickname: false } },
};
/** 닉네임 제공에 동의하지 않은 사람의 응답 — `kakao_account.profile` 이 없다. */
export const KAKAO_NO_NICKNAME = {
  id: 3812345678,
  connected_at: '2026-11-12T05:21:08Z',
  kakao_account: { profile_nickname_needs_agreement: true },
};

/** 가짜 카카오를 띄운다 — `profile`·`mode`·`clientSecret` 을 테스트가 바꿔 끼운다. */
export function startFakeKakao({ port = 3971, clientId = 'test-kakao', clientSecret = 'test-kakao-secret' } = {}) {
  const state = {
    profile: structuredClone(DEFAULT_KAKAO_PROFILE),
    mode: 'allow',
    clientSecret,
    userinfoFails: false,
    codes: new Map(),
    tokens: new Map(),
    log: { authorize: [], token: [], userinfo: [] },
  };
  const server = http.createServer(async (req, res) => {
    const url = new URL(req.url, `http://localhost:${port}`);

    if (req.method === 'GET' && url.pathname === '/oauth/authorize') {
      const query = Object.fromEntries(url.searchParams);
      state.log.authorize.push(query);
      if (query.client_id !== clientId || !query.redirect_uri || query.response_type !== 'code') {
        json(res, 400, { error: 'invalid_request', error_description: 'Bad client credentials', error_code: 'KOE101' });
        return;
      }
      const back = new URL(query.redirect_uri);
      if (state.mode === 'deny') {
        // 문서 그대로 — 취소하면 state 없이 돌아온다(빈칸은 %20).
        res.writeHead(302, { Location: `${back.href}?error=access_denied&error_description=User%20denied%20access` });
        res.end();
        return;
      }
      const code = randomBytes(24).toString('base64url');
      state.codes.set(code, {
        redirectUri: query.redirect_uri,
        challenge: query.code_challenge,
        method: query.code_challenge_method,
        profile: structuredClone(state.profile),
        used: false,
      });
      back.searchParams.set('code', code);
      if (query.state !== undefined) back.searchParams.set('state', query.state);
      res.writeHead(302, { Location: back.href });
      res.end();
      return;
    }

    if (req.method === 'POST' && url.pathname === '/oauth/token') {
      const raw = await readBody(req);
      const body = Object.fromEntries(new URLSearchParams(raw));
      state.log.token.push({ body, contentType: req.headers['content-type'], authorization: req.headers.authorization });
      if (body.client_id !== clientId || body.client_secret !== state.clientSecret) {
        json(res, 401, { error: 'invalid_client', error_description: 'Bad client credentials', error_code: 'KOE010' });
        return;
      }
      const saved = state.codes.get(body.code);
      if (body.grant_type !== 'authorization_code' || !saved || saved.used) {
        json(res, 400, { error: 'invalid_grant', error_description: `authorization code not found for code=${body.code}`, error_code: 'KOE320' });
        return;
      }
      if (saved.redirectUri !== body.redirect_uri) {
        json(res, 400, { error: 'invalid_grant', error_description: 'Redirect URI mismatch.', error_code: 'KOE303' });
        return;
      }
      saved.used = true;
      // PKCE — challenge 를 받았으면 verifier 가 맞아야 한다.
      if (saved.challenge !== undefined && (saved.method !== 'S256' || s256(body.code_verifier ?? '') !== saved.challenge)) {
        json(res, 400, { error: 'invalid_grant', error_description: 'invalid code_verifier', error_code: 'KOE320' });
        return;
      }
      const accessToken = randomBytes(40).toString('base64url');
      state.tokens.set(accessToken, saved.profile);
      json(res, 200, {
        token_type: 'bearer',
        access_token: accessToken,
        expires_in: 21599,
        refresh_token: randomBytes(40).toString('base64url'),
        refresh_token_expires_in: 5183999,
        scope: 'profile_nickname',
      });
      return;
    }

    if (req.method === 'GET' && url.pathname === '/v2/user/me') {
      state.log.userinfo.push({ url: req.url, authorization: req.headers.authorization });
      const header = req.headers.authorization ?? '';
      const profile = header.startsWith('Bearer ') ? state.tokens.get(header.slice('Bearer '.length)) : undefined;
      if (state.userinfoFails || !profile) {
        json(res, 401, { msg: 'this access token does not exist', code: -401 });
        return;
      }
      json(res, 200, profile);
      return;
    }

    json(res, 404, { msg: 'no handler found', code: -404 });
  });

  return new Promise((resolve) => {
    server.listen(port, () => resolve({
      base: `http://localhost:${port}`,
      urls: {
        authorize: `http://localhost:${port}/oauth/authorize`,
        token: `http://localhost:${port}/oauth/token`,
        userinfo: `http://localhost:${port}/v2/user/me`,
      },
      state,
      /** 판정마다 처음 상태로 — 프로필 · 모드 · 시크릿 · 기록. */
      reset() {
        state.profile = structuredClone(DEFAULT_KAKAO_PROFILE);
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
