// ~/instagram-api/lab/auth-server.js
// 실습용 «구글 역할» 인가 서버 — 강의 자료로 나눠 주는 완성 파일이에요.
import express from 'express';
import jwt from 'jsonwebtoken';
import { createHash, generateKeyPairSync, randomBytes } from 'node:crypto';

const ISSUER = 'http://127.0.0.1:4001';

// 이 인가 서버의 계정 — 비밀번호는 이 서버만 안다.
const accounts = {
  jaehoon: { sub: '10001', password: 'jaehoon1234', email: 'jaehoon@example.com', name: '김재훈' },
  minji: { sub: '10002', password: 'minji1234', email: 'minji@example.com', name: '이민지' },
  dahye: { sub: '10003', password: 'dahye1234', email: 'dahye@example.com', name: '정다혜' },
};

// 계정마다 맡겨 둔 사진 — 리소스 서버 역할로 내준다.
const photos = {
  10001: ['한강 노을', '제주 바다', '강아지 산책'],
  10002: ['벚꽃길', '카페 라테'],
  10003: ['등산 정상', '야경'],
};

// 이 인가 서버에 등록한 클라이언트(앱)
const clients = {
  'photo-app': {
    name: '우리 인스타그램',
    secret: 'photo-app-secret',
    redirectUris: ['http://localhost:4002/callback'],
  },
};

const SCOPES = { photos: '사진 목록 보기', openid: '누구인지 알려 주기', email: '이메일 주소', profile: '이름' };

// ID 토큰에 서명할 키 한 쌍 — 서버가 뜰 때마다 새로 만들고, kid 도 새로 붙인다.
const { privateKey, publicKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
const KID = randomBytes(4).toString('hex');
const jwk = { ...publicKey.export({ format: 'jwk' }), kid: KID, alg: 'RS256', use: 'sig' };

const codes = new Map(); // 인가 코드 → 누가 어느 앱에 무엇을 허락했나
const tokens = new Map(); // Access 토큰 → 누가 무엇을 허락했나

const app = express();

app.use(express.urlencoded({ extended: false }));

const FIELDS = ['response_type', 'client_id', 'redirect_uri', 'scope', 'state', 'nonce', 'code_challenge', 'code_challenge_method'];
const escape = (text) => String(text).replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
const scopesOf = (scope) => (scope ?? '').split(' ').filter(Boolean);
const fail = (res, status, error, description) => res.status(status).json({ error, error_description: description });

// 인가 요청이 등록한 앱·주소에서 왔는지 먼저 본다 — 아니면 redirect_uri 로 돌려보내지 않는다.
const checkRequest = (query) => {
  const client = clients[query.client_id];
  if (!client) return '등록되지 않은 클라이언트예요';
  if (!client.redirectUris.includes(query.redirect_uri)) return '등록하지 않은 redirect_uri예요';
  if (query.response_type !== 'code') return 'response_type은 code만 받아요';
  const scopes = scopesOf(query.scope);
  if (scopes.length === 0 || scopes.some((scope) => !SCOPES[scope])) return '모르는 scope가 있어요';
  if (scopes.includes('openid') && !query.nonce) return 'openid를 요청할 때는 nonce가 필요해요';
  if (query.code_challenge && query.code_challenge_method !== 'S256') return 'code_challenge_method는 S256만 받아요';
  return null;
};

const errorPage = (res, problem) => res.status(400).send(`<!doctype html><meta charset="utf-8"><h1>잘못된 요청</h1><p>${problem}</p>`);

const consentPage = (query, message = '') => `<!doctype html>
<meta charset="utf-8">
<title>구글 역할 인가 서버</title>
<h1>${escape(clients[query.client_id].name)}에 허락할까요?</h1>
<ul>${scopesOf(query.scope).map((scope) => `<li>${SCOPES[scope]}</li>`).join('')}</ul>
<p>${message}</p>
<form method="post" action="/authorize">
  ${FIELDS.filter((name) => query[name]).map((name) => `<input type="hidden" name="${name}" value="${escape(query[name])}">`).join('\n  ')}
  <label>아이디 <input name="username"></label>
  <label>비밀번호 <input name="password" type="password"></label>
  <button name="decision" value="allow">허용</button>
  <button name="decision" value="deny">거부</button>
</form>`;

app.get('/.well-known/openid-configuration', (req, res) => {
  res.json({
    issuer: ISSUER,
    authorization_endpoint: `${ISSUER}/authorize`,
    token_endpoint: `${ISSUER}/token`,
    jwks_uri: `${ISSUER}/jwks`,
    response_types_supported: ['code'],
    scopes_supported: Object.keys(SCOPES),
    id_token_signing_alg_values_supported: ['RS256'],
    code_challenge_methods_supported: ['S256'],
  });
});

app.get('/jwks', (req, res) => {
  res.json({ keys: [jwk] });
});

// 동의 화면
app.get('/authorize', (req, res) => {
  const problem = checkRequest(req.query);
  if (problem) return errorPage(res, problem);
  res.send(consentPage(req.query));
});

// 허용·거부를 누르면 — 결과를 redirect_uri 로 돌려보낸다.
app.post('/authorize', (req, res) => {
  const problem = checkRequest(req.body);
  if (problem) return errorPage(res, problem);

  const back = new URL(req.body.redirect_uri);
  if (req.body.decision !== 'allow') {
    back.searchParams.set('error', 'access_denied');
  } else {
    const account = accounts[req.body.username];
    if (!account || account.password !== req.body.password) {
      return res.status(401).send(consentPage(req.body, '아이디나 비밀번호가 맞지 않아요'));
    }
    const code = randomBytes(16).toString('base64url');
    codes.set(code, {
      clientId: req.body.client_id,
      redirectUri: req.body.redirect_uri,
      sub: account.sub,
      scope: req.body.scope,
      nonce: req.body.nonce,
      codeChallenge: req.body.code_challenge,
      expiresAt: Date.now() + 5 * 60 * 1000, // 인가 코드는 5분만 쓸 수 있다
    });
    back.searchParams.set('code', code);
  }
  if (req.body.state) back.searchParams.set('state', req.body.state);
  res.redirect(back.href);
});

const idTokenFor = (grant) => {
  const account = Object.values(accounts).find((item) => item.sub === grant.sub);
  const scopes = scopesOf(grant.scope);
  const claims = { iss: ISSUER, aud: grant.clientId, sub: grant.sub };
  if (scopes.includes('email')) claims.email = account.email;
  if (scopes.includes('profile')) claims.name = account.name;
  if (grant.nonce) claims.nonce = grant.nonce;
  return jwt.sign(claims, privateKey, { algorithm: 'RS256', keyid: KID, expiresIn: '1h' });
};

// 인가 코드를 토큰으로 바꿔 준다 — 브라우저가 아니라 앱의 서버가 직접 부른다.
app.post('/token', (req, res) => {
  const { grant_type, code, redirect_uri, client_id, client_secret, code_verifier } = req.body;
  if (grant_type !== 'authorization_code') return fail(res, 400, 'unsupported_grant_type', 'authorization_code만 받아요');

  const client = clients[client_id];
  if (!client || client.secret !== client_secret) return fail(res, 401, 'invalid_client', '클라이언트를 확인하지 못했어요');

  const grant = codes.get(code);
  codes.delete(code); // 인가 코드는 한 번만 쓴다
  if (!grant || grant.expiresAt < Date.now() || grant.clientId !== client_id || grant.redirectUri !== redirect_uri) {
    return fail(res, 400, 'invalid_grant', '쓸 수 없는 인가 코드예요');
  }
  if (grant.codeChallenge) {
    const challenge = createHash('sha256').update(code_verifier ?? '').digest('base64url');
    if (challenge !== grant.codeChallenge) return fail(res, 400, 'invalid_grant', 'code_verifier가 맞지 않아요');
  } else if (code_verifier) {
    // challenge 없이 받은 인가 코드에 verifier 가 오면 거절한다(RFC 9700 — PKCE 를 피해 가는 공격을 막는다).
    return fail(res, 400, 'invalid_grant', 'code_challenge 없이 받은 인가 코드예요');
  }

  const accessToken = randomBytes(24).toString('base64url');
  tokens.set(accessToken, { sub: grant.sub, scope: grant.scope, expiresAt: Date.now() + 60 * 60 * 1000 });

  const body = { access_token: accessToken, token_type: 'Bearer', expires_in: 3600, scope: grant.scope };
  if (scopesOf(grant.scope).includes('openid')) body.id_token = idTokenFor(grant);
  res.json(body);
});

// 리소스 서버 역할 — Access 토큰을 받고, 허락받은 범위(scope)만 내준다.
app.get('/photos', (req, res) => {
  res.on('finish', () => console.log(`GET /photos ${res.statusCode}`)); // 사진 요청이 올 때마다 한 줄
  const header = req.headers.authorization ?? '';
  const grant = header.startsWith('Bearer ') ? tokens.get(header.slice('Bearer '.length)) : undefined;
  if (!grant || grant.expiresAt < Date.now()) {
    res.set('WWW-Authenticate', 'Bearer error="invalid_token"');
    return fail(res, 401, 'invalid_token', 'Access 토큰을 확인하지 못했어요');
  }
  if (!scopesOf(grant.scope).includes('photos')) {
    res.set('WWW-Authenticate', 'Bearer error="insufficient_scope", scope="photos"');
    return fail(res, 403, 'insufficient_scope', '사진을 볼 허락을 받지 않았어요');
  }
  res.json({ photos: photos[grant.sub] });
});

app.listen(4001, () => {
  console.log('인가 서버가 4001번 포트에서 기다리고 있어요.');
});
