// ~/instagram-api/lab/p3-46/homework2.js
import { randomBytes, randomUUID } from 'node:crypto';
import express from 'express';
import cookieParser from 'cookie-parser';
import passport from 'passport';
import OAuth2Strategy from 'passport-oauth2';

const AUTH_SERVER = 'http://127.0.0.1:4001';
const TALK_SERVER = 'http://localhost:4003';
// 제공자가 사용자 정보를 이 시간(밀리초) 안에 주지 않으면 기다리기를 그만둔다.
const PROVIDER_TIMEOUT = 3000;

// 회원 · 소셜 계정 · 로그인 기록 — 실습 서버라 메모리에 둔다(서버가 다시 뜨면 처음으로 돌아간다).
// 1번 dahye 는 이메일로 먼저 가입해 둔 회원이고, 2번 소라는 톡으로 먼저 가입해 둔 회원이다.
const members = [
  { id: 1, nickname: 'dahye', email: 'dahye@example.com' },
  { id: 2, nickname: '소라' },
];
// 제공자가 그 계정에 매긴 값(providerUserId)은 글자로 적어 둔다 — 숫자를 주는 제공자도 있고 글자를 주는 제공자도 있다.
const socialAccounts = [{ provider: 'talk', providerUserId: '10001', memberId: 2 }];
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

// 소셜 계정으로 회원을 찾고, 처음 온 사람이면 만든다 — 찾는 기준은 «어느 제공자의 누구» 한 쌍이다.
function findOrCreateMember({ provider, id, email, name }) {
  const account = socialAccounts.find((item) => item.provider === provider && item.providerUserId === id);

  if (account) return members.find((member) => member.id === account.memberId);

  // 이메일이 같은 회원이 이미 있어도 그 회원에게 잇지 않는다 — 새로 만들지도 않고 돌려보낸다.
  if (email && members.some((member) => member.email === email)) {
    throw Object.assign(new Error('이미 가입한 이메일이에요'), { code: 'EMAIL_TAKEN' });
  }

  // 별명은 제공자가 준 이름으로, 없으면 이메일 앞부분으로 정한다 — 둘 다 없으면 별명 없이 만든다.
  const member = { id: members.length + 1, nickname: name ?? email?.split('@')[0], email };

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
    try {
      done(null, findOrCreateMember(profile));
    } catch (error) {
      done(error);
    }
  },
);

labStrategy.userProfile = async (accessToken, done) => {
  try {
    const response = await fetch(`${AUTH_SERVER}/userinfo`, {
      headers: { Authorization: `Bearer ${accessToken}` },
      signal: AbortSignal.timeout(PROVIDER_TIMEOUT),
    });

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
    callbackURL: 'http://localhost:4002/talk/callback',
    store: stateStore,
    pkce: true,
  },
  // 톡이 확인해 준 사람을 우리 회원으로 바꾼다 — 여기서 넘긴 값이 req.user 가 된다.
  (accessToken, refreshToken, profile, done) => {
    try {
      done(null, findOrCreateMember(profile));
    } catch (error) {
      done(error);
    }
  },
);

talkStrategy.userProfile = async (accessToken, done) => {
  try {
    const response = await fetch(`${TALK_SERVER}/v2/me`, {
      headers: { Authorization: `Bearer ${accessToken}` },
      signal: AbortSignal.timeout(PROVIDER_TIMEOUT),
    });

    if (!response.ok) throw new Error(`톡이 사용자 정보를 주지 않았어요 (${response.status})`);

    const info = await response.json();

    // 톡은 회원번호를 숫자로 준다 — 글자로 바꿔 둔다. 닉네임은 동의한 사람에게만 account.profile 안에 온다.
    done(null, { provider: 'talk', id: String(info.id), name: info.account?.profile?.nickname });
  } catch (error) {
    done(error);
  }
};

passport.use('lab', labStrategy);
passport.use('talk', talkStrategy);

const app = express();

app.use(cookieParser());

// 로그인하지 못하고 돌아왔을 때 보여 줄 문장 — 주소의 ?error= 에 실려 온 코드로 고른다.
const NOTICES = {
  LOGIN_FAILED: '로그인하지 못했어요. 다시 시도해 주세요.',
  EMAIL_TAKEN: '이미 가입한 이메일이에요.',
  PROVIDER_TIMEOUT: '로그인하는 곳이 제때 답하지 않았어요. 잠시 뒤에 다시 시도해 주세요.',
};

app.get('/', (req, res) => {
  const { error } = req.query;
  // 표에 없는 코드가 와도 주소의 글자를 그대로 보여 주지 않는다.
  const text = Object.hasOwn(NOTICES, error ?? '') ? NOTICES[error] : NOTICES.LOGIN_FAILED;
  const notice = error === undefined ? '' : `<p>${text}</p>`;

  res.send(`<!doctype html><meta charset="utf-8">${notice}<a href="/login">인가 서버로 로그인</a> <a href="/talk">톡으로 로그인</a>`);
});

// 제공자를 다녀온 회원(req.user)을 로그인시킨다 — 브라우저가 문서로 연 주소라 JSON 대신 /me 로 보낸다.
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
  // 무엇 때문에 실패했는지에 따라 에러 코드를 정한다 — 시간 안에 답을 못 받으면 fetch 가 이름이 TimeoutError 인 에러를 던진다.
  let code = 'LOGIN_FAILED';

  if (err.code === 'EMAIL_TAKEN') code = 'EMAIL_TAKEN';
  if (err.name === 'TimeoutError') code = 'PROVIDER_TIMEOUT';

  // 우리가 아는 실패가 아닐 때만 터미널에 남긴다.
  if (code === 'LOGIN_FAILED') console.error(err);

  res.redirect(`/?error=${code}`);
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
