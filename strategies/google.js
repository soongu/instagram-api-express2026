// ~/instagram-api/strategies/google.js
import OAuth2Strategy from 'passport-oauth2';

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
  },
  // 구글이 확인해 준 사람(profile)을 받는 곳 — 지금은 받은 그대로 넘긴다.
  (accessToken, refreshToken, profile, done) => {
    done(null, profile);
  },
);
