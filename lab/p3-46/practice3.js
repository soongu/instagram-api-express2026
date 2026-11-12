// ~/instagram-api/lab/p3-46/practice3.js

// 제공자에게 다녀온 브라우저가 연 콜백 주소들 — saved 는 떠나기 전에 쿠키에 저장해 둔 state 다.
const arrivals = [
  {
    label: '구글에서 허용',
    saved: 'pX3kQ9vT2mZr8LwY',
    url: 'http://localhost:3001/api/v2/auth/google/callback?state=pX3kQ9vT2mZr8LwY&code=4%2F0AeanS0bX1cD&scope=email+profile',
  },
  {
    label: '카카오에서 취소',
    saved: 'Jm4tB7nH1sKd6QeA',
    url: 'http://localhost:3001/api/v2/auth/kakao/callback?error=access_denied&error_description=User%20denied%20access',
  },
  {
    label: '네이버에서 취소',
    saved: 'uR5yC2gW8fVx0NpL',
    url: 'http://localhost:3001/api/v2/auth/naver/callback?state=uR5yC2gW8fVx0NpL&error=access_denied&error_description=Canceled+By+User',
  },
  {
    label: 'state를 고친 주소',
    saved: 'pX3kQ9vT2mZr8LwY',
    url: 'http://localhost:3001/api/v2/auth/google/callback?state=AAAAAAAAAAAAAAAA&code=4%2F0AeanS0bX1cD&scope=email+profile',
  },
  {
    label: '네이버 쪽 문제',
    saved: 'uR5yC2gW8fVx0NpL',
    url: 'http://localhost:3001/api/v2/auth/naver/callback?error=server_error&state=uR5yC2gW8fVx0NpL',
  },
  {
    label: 'code도 error도 없는 주소',
    saved: 'Jm4tB7nH1sKd6QeA',
    url: 'http://localhost:3001/api/v2/auth/kakao/callback?state=Jm4tB7nH1sKd6QeA',
  },
  {
    label: 'state에 error라는 글자가 든 성공',
    saved: 'no_error_Zk81TqLm',
    url: 'http://localhost:3001/api/v2/auth/kakao/callback?code=hQ7xV2bN9cM4&state=no_error_Zk81TqLm',
  },
  {
    label: '쿠키도 state도 없는 주소',
    saved: undefined,
    url: 'http://localhost:3001/api/v2/auth/kakao/callback?code=hQ7xV2bN9cM4',
  },
];

// 콜백 주소를 읽어 넷 가운데 하나를 돌려준다 — 'ok' · 'denied' · 'forged' · 'failed'.
function readCallback(url, savedState) {
  const query = new URL(url).searchParams;
  const error = query.get('error');

  // 제공자가 알려 준 실패를 state 보다 먼저 본다 — 카카오는 취소했을 때 state 를 붙이지 않는다.
  if (error === 'access_denied') return 'denied';
  if (error !== null || !query.has('code')) return 'failed';

  // 저장해 둔 state 가 없거나 주소의 state 와 다르면 우리가 보낸 요청의 답이 아니다.
  if (!savedState || query.get('state') !== savedState) return 'forged';

  return 'ok';
}

for (const { label, saved, url } of arrivals) {
  console.log(`${readCallback(url, saved)}  ${label}`);
}
