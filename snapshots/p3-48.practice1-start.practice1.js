// ~/instagram-api/lab/p3-48/practice1.js
import { randomBytes, randomUUID } from 'node:crypto';
import express from 'express';
import cookieParser from 'cookie-parser';
import passport from 'passport';
import OAuth2Strategy from 'passport-oauth2';

const AUTH_SERVER = 'http://127.0.0.1:4001';
const TALK_SERVER = 'http://localhost:4003';

// 회원 · 소셜 계정 · 로그인 기록 — 실습 서버라 메모리에 둔다(서버가 다시 뜨면 처음으로 돌아간다).
// 1번 dahye 는 이메일로 먼저 가입해 둔 회원이고(인가 서버의 dahye 로 로그인한다), 2번 소라는 톡으로 먼저 가입해 둔 회원이다.
const members = [
  { id: 1, nickname: 'dahye', email: 'dahye@example.com' },
  { id: 2, nickname: '소라' },
];
// 제공자가 그 계정에 매긴 값(providerUserId)은 글자로 적어 둔다 — 숫자를 주는 제공자도 있고 글자를 주는 제공자도 있다.
const socialAccounts = [
  { provider: 'lab', providerUserId: '10003', memberId: 1 },
  { provider: 'talk', providerUserId: '10001', memberId: 2 },
];
const sessions = new Map();

const tempCookie = { httpOnly: true, sameSite: 'lax', maxAge: 1000 * 60 * 10 };

// 임시 쿠키 이름에 제공자 이름을 붙인다 — 두 제공자에 함께 다녀와도 서로의 값을 덮어쓰지 않게.
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

// 소셜 계정으로 회원을 찾고, 처음 온 사람이면 만든다 — 찾는 기준은 «어느 제공자의 누구» 한 쌍이다.
function findOrCreateMember({ provider, id, email, emailVerified, name }) {
  const account = socialAccounts.find((item) => item.provider === provider && item.providerUserId === id);

  if (account) return members.find((member) => member.id === account.memberId);

  // 회원에는 제공자가 확인했다고 한 이메일만 적는다.
  const verifiedEmail = emailVerified ? email : undefined;

  // 확인된 이메일이 이미 다른 회원의 것이면 그 회원에게 잇지 않고, 새로 만들지도 않는다.
  if (verifiedEmail && members.some((member) => member.email === verifiedEmail)) {
    throw Object.assign(new Error('이미 가입한 이메일이에요'), { code: 'EMAIL_TAKEN' });
  }

  // 별명은 제공자가 준 이름으로, 없으면 이메일 앞부분으로 정한다 — 둘 다 없으면 별명 없이 만든다.
  const member = { id: members.length + 1, nickname: name ?? email?.split('@')[0], email: verifiedEmail };

  members.push(member);
  socialAccounts.push({ provider, providerUserId: id, memberId: member.id });

  return member;
}

// 로그인 전략을 만든다 — 제공자마다 다른 것만 받고, 나머지(state 저장소 · PKCE · 회원을 찾거나 만드는 일)는 두 제공자가 같다.
function createLabStrategy({ provider, authorizationURL, tokenURL, clientID, clientSecret, callbackURL, scope, userInfoURL, toProfile }) {
  const strategy = new OAuth2Strategy(
    { authorizationURL, tokenURL, clientID, clientSecret, callbackURL, scope, store: createStateStore(provider), pkce: true },
    // 제공자가 확인해 준 사람을 우리 회원으로 바꾼다 — 여기서 넘긴 값이 req.user 가 된다.
    (accessToken, refreshToken, profile, done) => {
      try {
        done(null, findOrCreateMember(profile));
      } catch (error) {
        done(error);
      }
    },
  );

  strategy.userProfile = async (accessToken, done) => {
    try {
      const response = await fetch(userInfoURL, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });

      if (!response.ok) throw new Error(`사용자 정보를 받지 못했어요 (${provider} · ${response.status})`);

      done(null, { provider, ...toProfile(await response.json()) });
    } catch (error) {
      done(error);
    }
  };

  return strategy;
}

const labStrategy = createLabStrategy({
  provider: 'lab',
  authorizationURL: `${AUTH_SERVER}/authorize`,
  tokenURL: `${AUTH_SERVER}/token`,
  clientID: 'photo-app',
  clientSecret: 'photo-app-secret',
  callbackURL: 'http://localhost:4002/callback',
  scope: ['email'],
  userInfoURL: `${AUTH_SERVER}/userinfo`,
  // 실습용 인가 서버는 이메일을 확인했는지 알려 주지 않는다 — 확인되지 않은 이메일로 다룬다.
  toProfile: (info) => ({ id: info.sub, email: info.email, emailVerified: false }),
});

const talkStrategy = createLabStrategy({
  provider: 'talk',
  authorizationURL: `${TALK_SERVER}/oauth/authorize`,
  tokenURL: `${TALK_SERVER}/oauth/token`,
  clientID: 'lab-talk',
  clientSecret: 'talk-secret',
  callbackURL: 'http://localhost:4002/talk/callback',
  scope: ['talk_email'],
  userInfoURL: `${TALK_SERVER}/v2/me`,
  // 톡은 회원번호를 숫자로 준다 — 글자로 바꿔 둔다. 닉네임과 이메일은 제공에 동의한 사람에게만 account 안에 온다.
  // 톡은 이메일을 확인했는지를 email_checked 로 알려 준다.
  toProfile: (info) => ({
    id: String(info.id),
    email: info.account?.email,
    emailVerified: info.account?.email_checked === true,
    name: info.account?.profile?.nickname,
  }),
});

passport.use('lab', labStrategy);
passport.use('talk', talkStrategy);

const app = express();

app.use(cookieParser());

// 로그인하지 못하고 돌아왔을 때 보여 줄 문장 — 주소의 ?error= 에 실려 온 코드로 고른다.
const NOTICES = {
  LOGIN_FAILED: '로그인하지 못했어요. 다시 시도해 주세요.',
  EMAIL_TAKEN: '이미 가입한 이메일이에요.',
};

app.get('/', (req, res) => {
  const { error } = req.query;
  // 표에 없는 코드가 와도 주소의 글자를 그대로 보여 주지 않는다.
  const text = Object.hasOwn(NOTICES, error ?? '') ? NOTICES[error] : NOTICES.LOGIN_FAILED;
  const notice = error === undefined ? '' : `<p>${text}</p>`;

  res.send(`<!doctype html><meta charset="utf-8">${notice}<a href="/login">인가 서버로 로그인</a> <a href="/talk">톡으로 로그인</a>`);
});

// 제공자에게 다녀온 회원(req.user)을 로그인시킨다 — 브라우저가 문서로 연 주소라 JSON 대신 /me 로 보낸다.
function startSession(req, res) {
  const sessionId = randomUUID();

  sessions.set(sessionId, req.user.id);
  res.cookie('labSession', sessionId, { httpOnly: true, sameSite: 'lax' });
  res.redirect('/me');
}

app.get('/login', passport.authenticate('lab', { session: false }));
app.get('/callback', passport.authenticate('lab', { session: false, failureRedirect: '/?error=LOGIN_FAILED' }), startSession);

// 톡으로 로그인 — 인가 서버와 같은 주소 둘이다. 전략의 이름만 다르다.
app.get('/talk', passport.authenticate('talk', { session: false }));
app.get('/talk/callback', passport.authenticate('talk', { session: false, failureRedirect: '/?error=LOGIN_FAILED' }), startSession);

// 두 콜백에서 난 에러는 여기서 받는다 — 브라우저가 문서로 연 주소라 JSON 대신 첫 화면으로 보낸다.
app.use(['/callback', '/talk/callback'], (err, req, res, next) => {
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

// 회원마다 어느 제공자로 로그인하는지를 함께 보여 준다.
app.get('/members', (req, res) => {
  res.json(members.map((member) => ({
    ...member,
    providers: socialAccounts.filter((account) => account.memberId === member.id).map((account) => account.provider),
  })));
});

app.listen(4002, () => {
  console.log('4002번 포트에서 과제 서버가 돌아가요');
});
