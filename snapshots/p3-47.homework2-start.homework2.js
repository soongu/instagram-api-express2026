// ~/instagram-api/lab/p3-47/homework2.js
// 돌아올 주소를 /callback 하나로 합친 서비스 — 강의 자료로 나눠 주는 파일이에요.
import { randomBytes, randomUUID } from 'node:crypto';
import express from 'express';
import cookieParser from 'cookie-parser';
import passport from 'passport';
import OAuth2Strategy from 'passport-oauth2';

const AUTH_SERVER = 'http://127.0.0.1:4001';
const TALK_SERVER = 'http://localhost:4003';

// 회원 · 소셜 계정 · 로그인 기록 — 실습 서버라 메모리에 둔다(서버가 다시 뜨면 처음으로 돌아간다).
const members = [
  { id: 1, nickname: 'dahye', email: 'dahye@example.com' },
  { id: 2, nickname: '소라' },
];
const socialAccounts = [{ provider: 'talk', providerUserId: '10001', memberId: 2 }];
const sessions = new Map();

const tempCookie = { httpOnly: true, sameSite: 'lax', maxAge: 1000 * 60 * 10 };

// 임시 쿠키 이름에는 제공자 이름이 붙어 있다 — 두 제공자의 state 와 code_verifier 는 서로 덮어쓰지 않는다.
function createStateStore(provider) {
  const stateCookie = `lab_state_${provider}`;
  const verifierCookie = `lab_verifier_${provider}`;

  return {
    store(req, verifier, state, meta, callback) {
      const value = randomBytes(16).toString('base64url');

      req.res.cookie(stateCookie, value, tempCookie);
      req.res.cookie(verifierCookie, verifier, tempCookie);
      callback(null, value);
    },

    verify(req, state, callback) {
      const saved = req.cookies[stateCookie];
      const verifier = req.cookies[verifierCookie];

      req.res.clearCookie(stateCookie);
      req.res.clearCookie(verifierCookie);

      if (!saved || saved !== state) {
        callback(null, false, { message: 'state가 달라요' });
        return;
      }

      callback(null, verifier);
    },
  };
}

// 소셜 계정으로 회원을 찾고, 처음 온 사람이면 만든다 — 지난 과제와 같다.
function findOrCreateMember({ provider, id, email, name }) {
  const account = socialAccounts.find((item) => item.provider === provider && item.providerUserId === id);

  if (account) return members.find((member) => member.id === account.memberId);

  if (email && members.some((member) => member.email === email)) {
    throw Object.assign(new Error('이미 가입한 이메일이에요'), { code: 'EMAIL_TAKEN' });
  }

  const member = { id: members.length + 1, nickname: name ?? email?.split('@')[0], email };

  members.push(member);
  socialAccounts.push({ provider, providerUserId: id, memberId: member.id });

  return member;
}

const verify = (accessToken, refreshToken, profile, done) => {
  try {
    done(null, findOrCreateMember(profile));
  } catch (error) {
    done(error);
  }
};

// 두 전략 모두 같은 돌아올 주소(/callback)를 쓴다.
const labStrategy = new OAuth2Strategy(
  {
    authorizationURL: `${AUTH_SERVER}/authorize`,
    tokenURL: `${AUTH_SERVER}/token`,
    clientID: 'photo-app',
    clientSecret: 'photo-app-secret',
    callbackURL: 'http://localhost:4002/callback',
    scope: ['email'],
    store: createStateStore('lab'),
    pkce: true,
  },
  verify,
);

labStrategy.userProfile = async (accessToken, done) => {
  try {
    const response = await fetch(`${AUTH_SERVER}/userinfo`, { headers: { Authorization: `Bearer ${accessToken}` } });
    if (!response.ok) throw new Error(`인가 서버가 사용자 정보를 주지 않았어요 (${response.status})`);
    const info = await response.json();
    done(null, { provider: 'lab', id: info.sub, email: info.email });
  } catch (error) {
    done(error);
  }
};

const talkStrategy = new OAuth2Strategy(
  {
    authorizationURL: `${TALK_SERVER}/oauth/authorize`,
    tokenURL: `${TALK_SERVER}/oauth/token`,
    clientID: 'lab-talk',
    clientSecret: 'talk-secret',
    callbackURL: 'http://localhost:4002/callback',
    store: createStateStore('talk'),
    pkce: true,
  },
  verify,
);

talkStrategy.userProfile = async (accessToken, done) => {
  try {
    const response = await fetch(`${TALK_SERVER}/v2/me`, { headers: { Authorization: `Bearer ${accessToken}` } });
    if (!response.ok) throw new Error(`톡이 사용자 정보를 주지 않았어요 (${response.status})`);
    const info = await response.json();
    done(null, { provider: 'talk', id: String(info.id), email: undefined, name: info.account?.profile?.nickname });
  } catch (error) {
    done(error);
  }
};

passport.use('lab', labStrategy);
passport.use('talk', talkStrategy);

const app = express();

app.use(cookieParser());

app.get('/', (req, res) => {
  const notice = req.query.error === undefined ? '' : '<p>로그인하지 못했어요. 다시 시도해 주세요.</p>';

  res.send(`<!doctype html><meta charset="utf-8">${notice}<a href="/login">인가 서버로 로그인</a> <a href="/talk">톡으로 로그인</a>`);
});

function startSession(req, res) {
  const sessionId = randomUUID();

  sessions.set(sessionId, req.user.id);
  res.cookie('labSession', sessionId, { httpOnly: true, sameSite: 'lax' });
  res.redirect('/me');
}

// 시작 주소 — 어느 제공자로 떠나는지 쿠키 lab_provider 에 적어 두고 떠난다.
app.get('/login', (req, res, next) => {
  res.cookie('lab_provider', 'lab', tempCookie);
  next();
}, passport.authenticate('lab', { session: false }));

app.get('/talk', (req, res, next) => {
  res.cookie('lab_provider', 'talk', tempCookie);
  next();
}, passport.authenticate('talk', { session: false }));

// 돌아올 주소는 하나 — 쿠키에 적어 둔 제공자로 전략을 고른다.
app.get('/callback', (req, res, next) => {
  const provider = req.cookies.lab_provider;

  console.log(`[콜백] lab_provider=${provider} 로 처리 · 돌아온 state=${req.query.state}`);
  passport.authenticate(provider, { session: false, failureRedirect: '/?error=LOGIN_FAILED' })(req, res, next);
}, startSession);

app.use('/callback', (err, req, res, next) => {
  if (err.code !== 'EMAIL_TAKEN') console.error(err);

  res.redirect(`/?error=${err.code === 'EMAIL_TAKEN' ? 'EMAIL_TAKEN' : 'LOGIN_FAILED'}`);
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
  console.log('4002번 포트에서 서비스가 돌아가요');
});
