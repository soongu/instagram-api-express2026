// ~/instagram-api/strategies/createSocialStrategy.js
import OAuth2Strategy from 'passport-oauth2';
import { createStateStore } from './stateStore.js';

// 소셜 로그인 전략을 만든다 — 제공자마다 다른 것만 받는다(주소 · 클라이언트 ID와 비밀값 · scope · 계정을 고르게 하는 prompt 값 · 사용자 정보를 읽는 법).
// 나머지(state 저장소 · PKCE · 돌아올 주소의 모양)는 세 제공자가 같다.
export function createSocialStrategy({ provider, authorizationURL, tokenURL, clientID, clientSecret, scope, accountPrompt, userInfoURL, toProfile }) {
  const strategy = new OAuth2Strategy(
    {
      authorizationURL,
      tokenURL,
      clientID,
      clientSecret,
      // 돌아올 주소는 브라우저가 여는 화면의 주소다 — 화면이 이 주소로 온 요청을 우리 서버에 넘겨준다.
      callbackURL: `${process.env.SITE_URL}/api/v2/auth/${provider}/callback`,
      scope,
      store: createStateStore(provider),
      pkce: true,
    },
    // 제공자가 확인해 준 사람(profile)을 그대로 넘긴다 — Passport 는 여기서 넘긴 값을 req.user 에 담는다.
    // users 의 사람을 찾거나 만드는 일, 지금 로그인한 사람에게 잇는 일은 콜백이 정한다.
    (accessToken, refreshToken, profile, done) => done(null, profile),
  );

  // 인가 주소에 더 실을 값 — passport.authenticate 에 준 옵션이 options 로 온다.
  // 연결하러 떠날 때(chooseAccount)만 prompt 를 싣는다 — 브라우저가 제공자에 로그인해 있어도 어느 계정을 이을지 사람이 고르게.
  strategy.authorizationParams = (options) => (options.chooseAccount ? { prompt: accountPrompt } : {});

  // 제공자에게 «이 Access 토큰의 주인이 누구인지» 묻는다 — 토큰은 주소가 아니라 Authorization 헤더에 싣는다.
  strategy.userProfile = async (accessToken, done) => {
    try {
      const response = await fetch(userInfoURL, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });

      if (!response.ok) throw new Error(`사용자 정보를 받지 못했어요 (${provider} · ${response.status})`);

      // 응답을 우리가 정한 이름(id · email · emailVerified · name)으로 맞추는 일은 제공자마다 달라서 toProfile 이 한다.
      done(null, { provider, ...toProfile(await response.json()) });
    } catch (error) {
      done(error);
    }
  };

  return strategy;
}
