// ~/instagram-api/lab/p3-45/homework2.js
import { randomBytes, randomUUID } from 'node:crypto';
import express from 'express';
import cookieParser from 'cookie-parser';
import passport from 'passport';
import OAuth2Strategy from 'passport-oauth2';

const AUTH_SERVER = 'http://127.0.0.1:4001';

// 회원 · 소셜 계정 · 로그인 기록 — 실습 서버라 메모리에 둔다(서버가 다시 뜨면 비워진다).
const members = [];
const socialAccounts = [];
const sessions = new Map();
// 인가 서버는 다녀왔지만 아직 별명을 정하지 않은 사람 — 임시 ID → 인가 서버가 확인해 준 사람.
const pendings = new Map();

const tempCookie = { httpOnly: true, sameSite: 'lax', maxAge: 1000 * 60 * 10 };

const stateStore = {
  store(req, verifier, state, meta, callback) {
    const value = randomBytes(16).toString('base64url');

    req.res.cookie('lab_state', value, tempCookie);
    req.res.cookie('lab_verifier', verifier, tempCookie);
    callback(null, value);
  },

  verify(req, state, callback) {
    const { lab_state: saved, lab_verifier: verifier } = req.cookies;

    req.res.clearCookie('lab_state');
    req.res.clearCookie('lab_verifier');

    if (!saved || saved !== state) {
      callback(null, false, { message: 'state가 달라요' });
      return;
    }

    callback(null, verifier);
  },
};

// 소셜 계정으로 회원을 찾는다 — 찾는 기준은 «어느 제공자의 누구» 뿐이다. 없으면 undefined.
function findMember({ provider, id }) {
  const account = socialAccounts.find((item) => item.provider === provider && item.providerUserId === id);

  return account && members.find((member) => member.id === account.memberId);
}

// 별명을 정한 사람을 회원으로 만든다 — 회원과 소셜 계정을 함께 넣는다.
function createMember({ provider, id, email }, nickname) {
  const member = { id: members.length + 1, nickname, email };

  members.push(member);
  socialAccounts.push({ provider, providerUserId: id, memberId: member.id });

  return member;
}

// 로그인 기록을 남기고 쿠키를 준 뒤 /me 로 보낸다 — 다시 온 회원도, 방금 별명을 정한 회원도 여기를 지난다.
function startSession(res, member) {
  const sessionId = randomUUID();

  sessions.set(sessionId, member.id);
  res.cookie('labSession', sessionId, { httpOnly: true, sameSite: 'lax' });
  res.redirect('/me');
}

const nicknameForm = (notice = '') => `<!doctype html><meta charset="utf-8">
<p>${notice}</p>
<form method="post" action="/nickname">
  <label>별명 <input name="nickname"></label>
  <button>가입하기</button>
</form>`;

const labStrategy = new OAuth2Strategy(
  {
    authorizationURL: `${AUTH_SERVER}/authorize`,
    tokenURL: `${AUTH_SERVER}/token`,
    clientID: 'photo-app',
    clientSecret: 'photo-app-secret',
    callbackURL: 'http://localhost:4002/callback',
    scope: ['email'],
    store: stateStore,
    pkce: true,
  },
  // 이미 회원이면 그 회원을, 처음 온 사람이면 인가 서버가 확인해 준 사람을 pending 에 담아 넘긴다.
  (accessToken, refreshToken, profile, done) => {
    done(null, findMember(profile) ?? { pending: profile });
  },
);

labStrategy.userProfile = async (accessToken, done) => {
  try {
    const response = await fetch(`${AUTH_SERVER}/userinfo`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (!response.ok) throw new Error(`인가 서버가 사용자 정보를 주지 않았어요 (${response.status})`);

    const info = await response.json();

    done(null, { provider: 'lab', id: info.sub, email: info.email });
  } catch (error) {
    done(error);
  }
};

passport.use('lab', labStrategy);

const app = express();

app.use(cookieParser());
app.use(express.urlencoded({ extended: false }));

app.get('/', (req, res) => {
  const notice = req.query.error === undefined ? '' : '<p>로그인하지 못했어요. 다시 시도해 주세요.</p>';

  res.send(`<!doctype html><meta charset="utf-8">${notice}<a href="/login">인가 서버로 로그인</a>`);
});

app.get('/login', passport.authenticate('lab', { session: false }));

// 다시 온 회원에게는 로그인을 주고, 처음 온 사람은 별명을 정하는 화면으로 보낸다.
app.get(
  '/callback',
  passport.authenticate('lab', { session: false, failureRedirect: '/?error=LOGIN_FAILED' }),
  (req, res) => {
    if (!req.user.pending) {
      startSession(res, req.user);
      return;
    }

    // 아직 회원이 아니다 — 확인받은 사람을 임시 ID 로 맡겨 두고, 그 ID 만 쿠키에 준다.
    const pendingId = randomUUID();

    pendings.set(pendingId, req.user.pending);
    res.cookie('labPending', pendingId, tempCookie);
    res.redirect('/nickname');
  },
);

app.get('/nickname', (req, res) => {
  if (!pendings.has(req.cookies.labPending)) {
    res.redirect('/');
    return;
  }

  res.send(nicknameForm());
});

app.post('/nickname', (req, res) => {
  const profile = pendings.get(req.cookies.labPending);

  if (!profile) {
    res.redirect('/');
    return;
  }

  const nickname = (req.body?.nickname ?? '').trim();

  if (nickname.length < 2 || nickname.length > 10) {
    res.status(400).send(nicknameForm('별명은 2자에서 10자까지 쓸 수 있어요'));
    return;
  }

  if (members.some((member) => member.nickname === nickname)) {
    res.status(409).send(nicknameForm('이미 쓰고 있는 별명이에요'));
    return;
  }

  // 한 번 쓴 임시 기록은 지운다 — 같은 쿠키로 회원을 또 만들 수 없게.
  pendings.delete(req.cookies.labPending);
  res.clearCookie('labPending');
  startSession(res, createMember(profile, nickname));
});

app.get('/me', (req, res) => {
  const member = members.find((item) => item.id === sessions.get(req.cookies.labSession));

  if (!member) {
    res.status(401).json({ message: '로그인이 필요해요' });
    return;
  }

  res.json(member);
});

app.get('/members', (req, res) => {
  res.json(members);
});

app.listen(4002, () => {
  console.log('4002번 포트에서 과제 서버가 돌아가요');
});
