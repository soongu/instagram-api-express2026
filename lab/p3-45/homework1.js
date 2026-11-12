// ~/instagram-api/lab/p3-45/homework1.js
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

// 소셜 계정으로 회원을 찾고, 처음 온 사람이면 만든다 — 찾는 기준은 «어느 제공자의 누구» 뿐이다.
function findOrCreateMember({ provider, id, email }) {
  const account = socialAccounts.find((item) => item.provider === provider && item.providerUserId === id);

  if (account) return members.find((member) => member.id === account.memberId);

  const member = { id: members.length + 1, nickname: email.split('@')[0], email };

  members.push(member);
  socialAccounts.push({ provider, providerUserId: id, memberId: member.id });

  return member;
}

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
  // 인가 서버가 확인해 준 사람을 우리 회원으로 바꾼다 — 여기서 넘긴 값이 req.user 가 된다.
  (accessToken, refreshToken, profile, done) => {
    done(null, findOrCreateMember(profile));
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

app.get('/', (req, res) => {
  const notice = req.query.error === undefined ? '' : '<p>로그인하지 못했어요. 다시 시도해 주세요.</p>';

  res.send(`<!doctype html><meta charset="utf-8">${notice}<a href="/login">인가 서버로 로그인</a>`);
});

app.get('/login', passport.authenticate('lab', { session: false }));

// 인가 서버를 다녀온 회원(req.user)에게 로그인을 준다 — 브라우저가 문서로 연 주소라 JSON 대신 /me 로 보낸다.
app.get(
  '/callback',
  passport.authenticate('lab', { session: false, failureRedirect: '/?error=LOGIN_FAILED' }),
  (req, res) => {
    const sessionId = randomUUID();

    sessions.set(sessionId, req.user.id);
    res.cookie('labSession', sessionId, { httpOnly: true, sameSite: 'lax' });
    res.redirect('/me');
  },
);

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
