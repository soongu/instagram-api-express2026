// ~/instagram-api/lab/p3-44/practice3.js
// 화면 없이 수업 백엔드에 로그인하고, 명령 뒤에 붙인 토큰으로 게시물을 부른다 — 쿠키는 손으로 다룬다.
// 쓰는 법: node lab/p3-44/practice3.js 붙여-넣을-토큰
const BASE = 'http://localhost:3000/api/v2';

// 받은 쿠키 — 이름 → 값. 브라우저처럼 Set-Cookie 를 읽어 담는다.
const cookies = {};

function keepCookies(response) {
  for (const line of response.headers.getSetCookie()) {
    const [pair] = line.split(';');
    const at = pair.indexOf('=');
    cookies[pair.slice(0, at)] = pair.slice(at + 1);
  }
}

async function getPosts() {
  // 게시물 주소에는 Access 토큰 쿠키만 실린다 — Refresh 쿠키의 path 는 /api/v2/auth 라서.
  const response = await fetch(`${BASE}/posts?limit=1`, { headers: { Cookie: `accessToken=${cookies.accessToken}` } });
  const body = await response.json();
  console.log(`게시물 목록 ${response.status}${body.error ? ` ${body.error.code}` : ''}`);
  return body;
}

const login = await fetch(`${BASE}/auth/login`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ username: 'jaehoon', password: 'jaehoon1234' }),
});
keepCookies(login);
console.log(`로그인 ${login.status}`);

// 로그인으로 받은 Access 토큰 대신 명령 뒤에 붙인 토큰을 쓴다.
cookies.accessToken = process.argv[2];

const first = await getPosts();

// 기한만 지났을 때만 새 토큰을 받는다 — 위조나 엉터리 토큰이면 다시 로그인해야 하니 여기서 멈춘다.
if (first.error?.code === 'TOKEN_EXPIRED') {
  const reissue = await fetch(`${BASE}/auth/reissue`, { method: 'POST', headers: { Cookie: `refreshToken=${cookies.refreshToken}` } });
  keepCookies(reissue);
  console.log(`새 토큰 받기 ${reissue.status}`);
  await getPosts();
}
