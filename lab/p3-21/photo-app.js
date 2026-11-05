// ~/instagram-api/lab/p3-21/photo-app.js
import express from 'express';
import cookieParser from 'cookie-parser';
import jwt from 'jsonwebtoken';
import { createHash, createPublicKey, randomBytes, randomUUID } from 'node:crypto';

const AUTH_SERVER = 'http://127.0.0.1:4001';
const CLIENT_ID = 'photo-app';
const CLIENT_SECRET = 'photo-app-secret';
const REDIRECT_URI = 'http://localhost:4002/callback';

// 로그인을 시작한 브라우저에만 잠깐 남겨 두는 값 — 10분 뒤 사라진다.
const TEMP_COOKIE = { httpOnly: true, sameSite: 'lax', maxAge: 10 * 60 * 1000 };

const app = express();

app.use(cookieParser());
app.use(express.json());

app.get('/', (req, res) => {
  res.send('<a href="/login">사진 불러오기</a>');
});

// 인가 서버의 동의 화면으로 보낸다 — 무엇을 허락받고 싶은지 주소에 담아서
app.get('/login', (req, res) => {
  const state = randomUUID();
  const nonce = randomUUID();
  const codeVerifier = randomBytes(32).toString('base64url');
  const codeChallenge = createHash('sha256').update(codeVerifier).digest('base64url');

  res.cookie('oauth_state', state, TEMP_COOKIE);
  res.cookie('oauth_nonce', nonce, TEMP_COOKIE);
  res.cookie('oauth_verifier', codeVerifier, TEMP_COOKIE);

  const params = new URLSearchParams({
    response_type: 'code',
    client_id: CLIENT_ID,
    redirect_uri: REDIRECT_URI,
    scope: 'openid email photos',
    state,
    nonce,
    code_challenge: codeChallenge,
    code_challenge_method: 'S256',
  });
  res.redirect(`${AUTH_SERVER}/authorize?${params}`);
});

const verifyIdToken = async (idToken, nonce) => {
  // ① 토큰 헤더의 kid로 인가 서버의 공개키를 고른다.
  const { header } = jwt.decode(idToken, { complete: true });
  const { keys } = await (await fetch(`${AUTH_SERVER}/jwks`)).json();
  const jwk = keys.find((key) => key.kid === header.kid);
  const publicKey = createPublicKey({ key: jwk, format: 'jwk' });

  // ② 서명 · 누가 만들었나(iss) · 누구에게 준 것인가(aud) · 끝나는 시각(exp)
  const payload = jwt.verify(idToken, publicKey, {
    algorithms: ['RS256'],
    issuer: AUTH_SERVER,
    audience: CLIENT_ID,
  });

  // ③ 이 브라우저가 시작한 로그인에서 나온 토큰인가
  if (payload.nonce !== nonce) throw new Error('nonce가 달라요');
  return payload;
};

app.get('/callback', async (req, res) => {
  if (!req.query.state || req.query.state !== req.cookies.oauth_state) {
    res.status(403).json({ message: '이 브라우저에서 시작한 로그인이 아니에요' });
    return;
  }
  res.clearCookie('oauth_state');

  if (req.query.error) {
    res.status(400).json({ message: `허락을 받지 못했어요 (${req.query.error})` });
    return;
  }

  // 인가 코드를 토큰으로 바꾼다 — 브라우저를 거치지 않고 서버끼리 주고받는다.
  const tokenRes = await fetch(`${AUTH_SERVER}/token`, {
    method: 'POST',
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      code: req.query.code,
      redirect_uri: REDIRECT_URI,
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET,
      code_verifier: req.cookies.oauth_verifier,
    }),
  });
  const tokens = await tokenRes.json();
  console.log(tokens); // 확인용 — 실제 서비스에서는 토큰을 로그에 남기지 않는다.

  if (!tokenRes.ok) {
    res.status(400).json(tokens);
    return;
  }

  let user;
  try {
    user = await verifyIdToken(tokens.id_token, req.cookies.oauth_nonce);
  } catch (error) {
    res.status(401).json({ message: 'ID 토큰을 믿을 수 없어요', reason: error.message });
    return;
  }

  // Access 토큰으로 사진 목록을 받는다.
  const photosRes = await fetch(`${AUTH_SERVER}/photos`, {
    headers: { Authorization: `Bearer ${tokens.access_token}` },
  });
  const { photos } = await photosRes.json();

  res.json({ sub: user.sub, email: user.email, photos });
});

// 앱이 로그인을 마치고 보낸 ID 토큰을 확인해 그 사람을 로그인시킨다.
app.post('/login/token', async (req, res) => {
  try {
    const user = await verifyIdToken(req.body.idToken, req.cookies.oauth_nonce);
    res.json({ loggedIn: user.email }); // 실제 서비스라면 여기서 세션을 준다.
  } catch (error) {
    res.status(401).json({ message: 'ID 토큰을 믿을 수 없어요', reason: error.message });
  }
});

app.listen(4002, () => {
  console.log('우리 서비스가 4002번 포트에서 기다리고 있어요.');
});
