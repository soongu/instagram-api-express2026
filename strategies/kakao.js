// ~/instagram-api/strategies/kakao.js
import OAuth2Strategy from 'passport-oauth2';
import { stateStore } from './stateStore.js';
import * as authService from '../services/authService.js';

// 카카오 로그인 전략 — 카카오의 주소 둘과, 카카오 콘솔에서 받은 REST API 키·클라이언트 시크릿을 넣어 만든다.
// 돌아올 주소는 브라우저가 여는 화면의 주소다 — 화면이 이 주소로 온 요청을 우리 서버에 넘겨준다.
export const kakaoStrategy = new OAuth2Strategy(
  {
    authorizationURL: 'https://kauth.kakao.com/oauth/authorize',
    tokenURL: 'https://kauth.kakao.com/oauth/token',
    clientID: process.env.KAKAO_CLIENT_ID,
    clientSecret: process.env.KAKAO_CLIENT_SECRET,
    callbackURL: `${process.env.SITE_URL}/api/v2/auth/kakao/callback`,
    scope: ['profile_nickname'],
    store: stateStore,
    pkce: true,
  },
  // 카카오가 확인해 준 사람(profile)을 users 의 사람으로 바꾸는 곳 — 여기서 넘긴 값이 req.user 가 된다.
  async (accessToken, refreshToken, profile, done) => {
    try {
      done(null, await authService.findOrCreateSocialUser(profile));
    } catch (error) {
      done(error);
    }
  },
);

// 카카오에 «이 Access 토큰의 주인이 누구인지» 묻는다 — 토큰은 주소가 아니라 Authorization 헤더에 싣는다.
kakaoStrategy.userProfile = async (accessToken, done) => {
  try {
    const response = await fetch('https://kapi.kakao.com/v2/user/me', {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (!response.ok) throw new Error(`카카오가 사용자 정보를 주지 않았어요 (${response.status})`);

    const info = await response.json();

    done(null, {
      provider: 'kakao',
      id: info.sub,
      email: info.email,
      emailVerified: info.email_verified === true,
      name: info.name,
    });
  } catch (error) {
    done(error);
  }
};
