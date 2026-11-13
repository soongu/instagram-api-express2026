// ~/instagram-api/strategies/google.js
import OAuth2Strategy from 'passport-oauth2';
import { createStateStore } from './stateStore.js';
import * as authService from '../services/authService.js';

// 구글 로그인 전략 — 구글의 주소 둘과, 구글 콘솔에서 받은 클라이언트 ID·비밀값을 넣어 만든다.
// 돌아올 주소는 브라우저가 여는 화면의 주소다 — 화면이 이 주소로 온 요청을 우리 서버에 넘겨준다.
export const googleStrategy = new OAuth2Strategy(
  {
    authorizationURL: 'https://accounts.google.com/o/oauth2/v2/auth',
    tokenURL: 'https://oauth2.googleapis.com/token',
    clientID: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    callbackURL: `${process.env.SITE_URL}/api/v2/auth/google/callback`,
    scope: ['email', 'profile'],
    store: createStateStore('google'),
    pkce: true,
  },
  // 구글이 확인해 준 사람(profile)을 우리 사람으로 바꾸는 곳 — 여기서 넘긴 값이 req.user 가 된다.
  async (accessToken, refreshToken, profile, done) => {
    try {
      done(null, await authService.findOrCreateSocialUser(profile));
    } catch (error) {
      done(error);
    }
  },
);

// 구글에 «이 Access 토큰의 주인이 누구인지» 묻는다 — 토큰은 주소가 아니라 Authorization 헤더에 싣는다.
googleStrategy.userProfile = async (accessToken, done) => {
  try {
    const response = await fetch('https://openidconnect.googleapis.com/v1/userinfo', {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (!response.ok) throw new Error(`구글이 사용자 정보를 주지 않았어요 (${response.status})`);

    const info = await response.json();

    // 제공자마다 다른 이름을 우리 이름으로 맞춘다 — id 는 구글이 그 계정에 매긴, 바뀌지 않는 값(sub)이다.
    done(null, {
      provider: 'google',
      id: info.sub,
      email: info.email,
      emailVerified: info.email_verified === true,
      name: info.name,
    });
  } catch (error) {
    done(error);
  }
};
