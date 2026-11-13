// ~/instagram-api/strategies/google.js
import { createSocialStrategy } from './createSocialStrategy.js';

// 구글 로그인 전략 — 구글의 주소 둘과, 구글 콘솔에서 받은 클라이언트 ID·비밀값을 넣어 만든다.
export const googleStrategy = createSocialStrategy({
  provider: 'google',
  authorizationURL: 'https://accounts.google.com/o/oauth2/v2/auth',
  tokenURL: 'https://oauth2.googleapis.com/token',
  clientID: process.env.GOOGLE_CLIENT_ID,
  clientSecret: process.env.GOOGLE_CLIENT_SECRET,
  scope: ['email', 'profile'],
  userInfoURL: 'https://openidconnect.googleapis.com/v1/userinfo',
  // 구글이 준 사용자 정보를 우리가 정한 이름으로 맞춘다 — id 는 구글이 그 계정에 매긴, 바뀌지 않는 값(sub)이다.
  toProfile: (info) => ({
    id: info.sub,
    email: info.email,
    emailVerified: info.email_verified === true,
    name: info.name,
  }),
});
