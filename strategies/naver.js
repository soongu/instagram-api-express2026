// ~/instagram-api/strategies/naver.js
import OAuth2Strategy from 'passport-oauth2';
import { stateStore } from './stateStore.js';
import * as authService from '../services/authService.js';

// 네이버 로그인 전략 — 네이버의 주소 둘과, 네이버 개발자 센터에서 받은 클라이언트 ID·시크릿을 넣어 만든다.
// 돌아올 주소는 브라우저가 여는 화면의 주소다 — 화면이 이 주소로 온 요청을 우리 서버에 넘겨준다.
export const naverStrategy = new OAuth2Strategy(
  {
    authorizationURL: 'https://nid.naver.com/oauth2/authorize',
    tokenURL: 'https://nid.naver.com/oauth2/token',
    clientID: process.env.NAVER_CLIENT_ID,
    clientSecret: process.env.NAVER_CLIENT_SECRET,
    callbackURL: `${process.env.SITE_URL}/api/v2/auth/naver/callback`,
    scope: ['openid'],
    store: stateStore,
    pkce: true,
  },
  // 네이버가 확인해 준 사람(profile)을 users 의 사람으로 바꾸는 곳 — 여기서 넘긴 값이 req.user 가 된다.
  async (accessToken, refreshToken, profile, done) => {
    try {
      done(null, await authService.findOrCreateSocialUser(profile));
    } catch (error) {
      done(error);
    }
  },
);

// 네이버에 «이 Access 토큰의 주인이 누구인지» 묻는다 — 토큰은 주소가 아니라 Authorization 헤더에 싣는다.
naverStrategy.userProfile = async (accessToken, done) => {
  try {
    const response = await fetch('https://openapi.naver.com/v1/nid/me', {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (!response.ok) throw new Error(`네이버가 사용자 정보를 주지 않았어요 (${response.status})`);

    // 네이버는 사용자 정보를 response 라는 키 안에 담아 준다.
    const { response: info } = await response.json();

    // id 는 네이버가 이 애플리케이션에서 그 계정에 매긴 값이다.
    // 네이버는 이메일을 확인했는지 알려 주는 값을 주지 않는다 — 확인되지 않은 이메일로 다룬다.
    done(null, {
      provider: 'naver',
      id: info.id,
      email: info.email,
      emailVerified: false,
      name: info.name,
    });
  } catch (error) {
    done(error);
  }
};
