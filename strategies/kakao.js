// ~/instagram-api/strategies/kakao.js
import { createSocialStrategy } from './createSocialStrategy.js';

// 카카오 로그인 전략 — 카카오의 주소 둘과, 카카오 콘솔에서 받은 REST API 키·클라이언트 시크릿을 넣어 만든다.
export const kakaoStrategy = createSocialStrategy({
  provider: 'kakao',
  authorizationURL: 'https://kauth.kakao.com/oauth/authorize',
  tokenURL: 'https://kauth.kakao.com/oauth/token',
  clientID: process.env.KAKAO_CLIENT_ID,
  clientSecret: process.env.KAKAO_CLIENT_SECRET,
  scope: ['profile_nickname', 'account_email'],
  userInfoURL: 'https://kapi.kakao.com/v2/user/me',
  // 카카오는 같은 뜻의 값을 다른 이름, 다른 위치에 준다 — id 는 카카오가 이 앱에서 그 계정에 매긴 회원번호(숫자)다.
  // 이메일은 이메일 제공에 동의한 사람에게만 kakao_account 안에 온다.
  toProfile: (info) => ({
    id: String(info.id),
    email: info.kakao_account?.email,
    // 카카오는 이메일이 지금도 그 계정의 것인지(is_email_valid)와 확인을 거쳤는지(is_email_verified)를 따로 알려 준다 — 둘 다 true 일 때만 확인된 이메일로 본다.
    emailVerified: info.kakao_account?.is_email_valid === true && info.kakao_account?.is_email_verified === true,
    name: info.kakao_account?.profile?.nickname,
  }),
});
