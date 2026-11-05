// ~/instagram-api/lab/p3-21/homework2.js
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

// 우리 서비스의 회원과 세션 — 지난 시간처럼 메모리에 둔다.
const members = new Map(); // "iss sub" → { id, email }
const sessions = new Map(); // 세션 ID → 회원
let nextId = 1;

const app = express();

app.use(cookieParser());

app.get('/', (req, res) => {
  res.send('<a href="/login">로그인</a>');
});

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
    scope: 'openid email',
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

  // 인가 서버 안에서 사람을 가리키는 값은 sub — 이메일은 바뀔 수 있다.
  const key = `${user.iss} ${user.sub}`;
  let member = members.get(key);
  if (!member) {
    member = { id: nextId, email: user.email };
    nextId += 1;
    members.set(key, member);
  }
  member.email = user.email;

  const sessionId = randomUUID();
  sessions.set(sessionId, member);
  res.cookie('photoSession', sessionId, { httpOnly: true, sameSite: 'lax', maxAge: 7 * 24 * 60 * 60 * 1000 });
  res.redirect('/me');
});

app.get('/me', (req, res) => {
  const member = sessions.get(req.cookies.photoSession);
  if (!member) {
    res.status(401).json({ message: '로그인이 필요해요' });
    return;
  }
  res.json(member);
});

app.listen(4002, () => {
  console.log('우리 서비스가 4002번 포트에서 기다리고 있어요.');
});
