// ~/instagram-api/lab/p3-47/talk-server.js
// 실습용 제공자 «톡» — 강의 자료로 나눠 주는 완성 파일이에요.
import express from 'express';
import { createHash, randomBytes } from 'node:crypto';
import { setTimeout as sleep } from 'node:timers/promises';

// 사용자 정보를 이만큼(밀리초) 늦게 답한다 — 예: TALK_DELAY=5000 node lab/p3-47/talk-server.js
const DELAY = Number(process.env.TALK_DELAY ?? 0);

// 톡의 계정 — 회원번호(id)는 숫자다. 계정마다 이메일과, 톡이 그 이메일을 확인했는지(emailChecked)가 있다.
const accounts = {
  sora: { id: 10001, nickname: '소라', joinedAt: '2026-03-02T09:00:00Z', email: 'sora@talk.example', emailChecked: true },
  haru: { id: 10002, nickname: '하루', joinedAt: '2026-05-17T14:30:00Z', email: 'haru@talk.example', emailChecked: false },
  bomi: { id: 10003, nickname: '보미', joinedAt: '2026-07-08T11:15:00Z', email: 'bomi@talk.example', emailChecked: true },
  dahye: { id: 10004, nickname: '다혜', joinedAt: '2026-09-21T08:40:00Z', email: 'dahye@example.com', emailChecked: true },
};

// 톡에 등록한 앱 — 돌아올 주소는 등록한 것만 받는다.
const clients = {
  'lab-talk': {
    name: '실습 서비스',
    secret: 'talk-secret',
    redirectUris: ['http://localhost:4002/talk/callback', 'http://localhost:4002/callback'],
  },
};

const codes = new Map(); // 인가 코드 → 누가 어느 앱에, 무엇을 제공하기로 동의했는지
const tokens = new Map(); // Access 토큰 → 누가, 무엇을 제공하기로 동의했는지

const app = express();

app.use(express.urlencoded({ extended: false }));

// 브라우저가 저절로 보내는 아이콘 요청은 기록하지 않는다 — 아래의 요청 기록보다 먼저 답하고 끝낸다.
app.get('/favicon.ico', (req, res) => res.status(204).end());

// 요청마다 한 줄 — 응답을 다 보냈으면 상태 코드를, 받는 쪽이 먼저 끊었으면 그렇다고 적는다.
app.use((req, res, next) => {
  res.on('close', () => {
    console.log(`[톡] ${req.method} ${req.path} ${res.writableFinished ? res.statusCode : '(받는 쪽이 먼저 끊었어요)'}`);
  });
  next();
});

const FIELDS = ['response_type', 'client_id', 'redirect_uri', 'scope', 'state', 'code_challenge', 'code_challenge_method'];
const escape = (text) => String(text).replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
const pick = (table, key) => (Object.hasOwn(table, key ?? '') ? table[key] : undefined);
const fail = (res, status, error, description, code) => res.status(status).json({ error, error_description: description, error_code: code });
// scope 는 공백으로 이은 글자다 — 이메일은 앱이 talk_email 을 달라고 했을 때만 묻는다.
const asksEmail = (scope) => (scope ?? '').split(' ').includes('talk_email');

// 인가 요청이 등록한 앱·주소에서 왔는지 먼저 본다 — 아니면 redirect_uri 로 돌려보내지 않는다.
const checkRequest = (query) => {
  const client = pick(clients, query.client_id);
  if (!client) return '등록되지 않은 앱이에요';
  if (!client.redirectUris.includes(query.redirect_uri)) return '등록하지 않은 redirect_uri예요';
  if (query.response_type !== 'code') return 'response_type은 code만 받아요';
  if (query.code_challenge && query.code_challenge_method !== 'S256') return 'code_challenge_method는 S256만 받아요';
  return null;
};

const errorPage = (res, problem) => res.status(400).send(`<!doctype html><meta charset="utf-8"><h1>잘못된 요청</h1><p>${problem}</p>`);

const accountChoices = Object.entries(accounts)
  .map(([name, account], index) => `<label><input type="radio" name="account" value="${name}"${index === 0 ? ' checked' : ''}> ${name} (${account.nickname})</label>`)
  .join('\n    ');

const consentPage = (query) => `<!doctype html>
<meta charset="utf-8">
<title>톡 로그인</title>
<h1>${escape(clients[query.client_id].name)}에 로그인할까요?</h1>
<form method="post" action="/oauth/authorize">
  ${FIELDS.filter((name) => query[name]).map((name) => `<input type="hidden" name="${name}" value="${escape(query[name])}">`).join('\n  ')}
  <p>
    ${accountChoices}
  </p>
  <p><label><input type="checkbox" name="nickname" value="yes" checked> 닉네임 제공</label></p>
  ${asksEmail(query.scope) ? '<p><label><input type="checkbox" name="email" value="yes" checked> 이메일 제공</label></p>' : ''}
  <button name="decision" value="allow">허용</button>
  <button name="decision" value="deny">거부</button>
</form>`;

// 동의 화면
app.get('/oauth/authorize', (req, res) => {
  const problem = checkRequest(req.query);
  if (problem) return errorPage(res, problem);
  res.send(consentPage(req.query));
});

// 허용·거부를 누르면 — 결과를 redirect_uri 로 돌려보낸다(폼을 받은 뒤라 303).
app.post('/oauth/authorize', (req, res) => {
  const problem = checkRequest(req.body);
  if (problem) return errorPage(res, problem);

  const { client_id: clientId, redirect_uri: redirectUri, state } = req.body;
  const account = pick(accounts, req.body.account);

  // 거부하면 state 를 붙이지 않고 돌려보낸다.
  if (req.body.decision !== 'allow' || !account) {
    return res.redirect(303, `${redirectUri}?error=access_denied&error_description=User%20denied%20access`);
  }

  const code = randomBytes(16).toString('base64url');
  codes.set(code, {
    clientId,
    redirectUri,
    account,
    nickname: req.body.nickname === 'yes',
    askedEmail: asksEmail(req.body.scope),
    email: req.body.email === 'yes',
    codeChallenge: req.body.code_challenge,
  });

  const back = new URL(redirectUri);
  back.searchParams.set('code', code);
  if (state) back.searchParams.set('state', state);
  res.redirect(303, back.href);
});

// 인가 코드를 토큰으로 바꿔 준다 — 브라우저가 아니라 앱의 서버가 직접 부른다.
app.post('/oauth/token', (req, res) => {
  const { grant_type, code, redirect_uri, client_id, client_secret, code_verifier } = req.body;

  const client = pick(clients, client_id);
  if (!client || client.secret !== client_secret) return fail(res, 401, 'invalid_client', '앱을 확인하지 못했어요', 'TALK-010');

  const grant = codes.get(code);
  codes.delete(code); // 인가 코드는 한 번만 쓴다
  if (grant_type !== 'authorization_code' || !grant || grant.clientId !== client_id) {
    return fail(res, 400, 'invalid_grant', '쓸 수 없는 인가 코드예요', 'TALK-320');
  }
  if (grant.redirectUri !== redirect_uri) return fail(res, 400, 'invalid_grant', 'redirect_uri가 인가 요청 때와 달라요', 'TALK-303');
  if (grant.codeChallenge && createHash('sha256').update(code_verifier ?? '').digest('base64url') !== grant.codeChallenge) {
    return fail(res, 400, 'invalid_grant', 'code_verifier가 맞지 않아요', 'TALK-320');
  }

  const accessToken = randomBytes(24).toString('base64url');
  tokens.set(accessToken, grant);
  res.json({ token_type: 'bearer', access_token: accessToken, expires_in: 3600 });
});

// Access 토큰의 주인이 누구인지 알려 준다 — 토큰은 Authorization 헤더로만 받는다.
app.get('/v2/me', async (req, res) => {
  const header = req.headers.authorization ?? '';
  const grant = header.startsWith('Bearer ') ? tokens.get(header.slice('Bearer '.length)) : undefined;
  if (!grant) return res.status(401).json({ message: '토큰을 확인하지 못했어요', code: 'TALK-401' });

  if (DELAY > 0) await sleep(DELAY);
  if (res.destroyed) return; // 기다리는 동안 받는 쪽이 끊었다

  const { account, nickname, askedEmail, email } = grant;
  // 닉네임 제공에 동의하지 않았으면 profile 이 없다.
  const info = nickname ? { nickname_agreed: true, profile: { nickname: account.nickname } } : { nickname_agreed: false };
  // 이메일은 talk_email 을 달라고 한 앱에만 준다 — 제공에 동의하지 않았으면 email_agreed: false 만 온다.
  if (askedEmail) {
    Object.assign(info, email ? { email_agreed: true, email: account.email, email_checked: account.emailChecked } : { email_agreed: false });
  }

  res.json({ id: account.id, joined_at: account.joinedAt, account: info });
});

app.listen(4003, () => {
  console.log('톡 서버가 4003번 포트에서 기다리고 있어요.');
  if (DELAY > 0) console.log(`사용자 정보는 ${DELAY}ms 늦게 답해요.`);
});
