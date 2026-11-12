// ~/instagram-api/strategies/stateStore.js
import { randomBytes } from 'node:crypto';

// 구글을 다녀오는 동안만 쓰는 쿠키 — 10분 뒤에 사라지고, 인증 주소로 가는 요청에만 실려 간다.
export const tempCookie = { httpOnly: true, sameSite: 'lax', path: '/api/v2/auth', maxAge: 1000 * 60 * 10 };

// state 와 PKCE 의 code_verifier 를 쿠키에 맡겨 두는 저장소 — 우리 서버에는 세션이 없어서 직접 만든다.
export const stateStore = {
  // 구글로 보내기 직전에 불린다 — state 를 새로 만들어 code_verifier 와 함께 쿠키에 둔다.
  store(req, verifier, state, meta, callback) {
    const value = randomBytes(16).toString('base64url');

    req.res.cookie('oauth_state', value, tempCookie);
    req.res.cookie('oauth_verifier', verifier, tempCookie);
    callback(null, value);
  },

  // 구글에서 돌아왔을 때 불린다 — 주소의 state 가 쿠키의 것과 같을 때만 code_verifier 를 돌려준다.
  verify(req, state, callback) {
    const { oauth_state: saved, oauth_verifier: verifier } = req.cookies;

    // 한 번 쓴 값은 지운다 — 쿠키는 이름과 path 가 같아야 같은 쿠키다.
    req.res.clearCookie('oauth_state', { path: tempCookie.path });
    req.res.clearCookie('oauth_verifier', { path: tempCookie.path });

    if (!saved || saved !== state) {
      callback(null, false, { message: 'state가 달라요' });
      return;
    }

    callback(null, verifier);
  },
};
