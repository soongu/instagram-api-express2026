// ~/instagram-api/strategies/naver.js
import { createSocialStrategy } from './createSocialStrategy.js';

// 네이버 로그인 전략 — 네이버의 주소 둘과, 네이버 개발자 센터에서 받은 클라이언트 ID·시크릿을 넣어 만든다.
export const naverStrategy = createSocialStrategy({
  provider: 'naver',
  authorizationURL: 'https://nid.naver.com/oauth2/authorize',
  tokenURL: 'https://nid.naver.com/oauth2/token',
  clientID: process.env.NAVER_CLIENT_ID,
  clientSecret: process.env.NAVER_CLIENT_SECRET,
  scope: ['openid'],
  userInfoURL: 'https://openapi.naver.com/v1/nid/me',
  // 네이버는 사용자 정보를 response 라는 키 안에 담아 준다 — id 는 네이버가 이 애플리케이션에서 그 계정에 매긴 값이다.
  // 네이버는 이메일을 확인했는지 알려 주는 값을 주지 않는다 — 확인되지 않은 이메일로 다룬다.
  toProfile: ({ response: info }) => ({
    id: info.id,
    email: info.email,
    emailVerified: false,
    name: info.name,
  }),
});
