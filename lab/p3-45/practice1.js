// ~/instagram-api/lab/p3-45/practice1.js
import { randomBytes } from 'node:crypto';
import express from 'express';
import cookieParser from 'cookie-parser';
import passport from 'passport';
import OAuth2Strategy from 'passport-oauth2';

// «구글 역할» 을 하는 실습용 인가 서버 — 창 3에서 node lab/p3-21/auth-server.js 로 띄운다.
const AUTH_SERVER = 'http://127.0.0.1:4001';

// 인가 서버를 다녀오는 동안만 쓰는 쿠키 — 이 서버의 콜백 주소(/callback)에도 실려 오게 path 를 좁히지 않는다.
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
  (accessToken, refreshToken, profile, done) => {
    done(null, profile);
  },
);

// 인가 서버에 «이 Access 토큰의 주인이 누구인지» 묻는다.
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

app.get('/login', passport.authenticate('lab', { session: false }));
app.get('/callback', passport.authenticate('lab', { session: false }), (req, res) => {
  res.json(req.user);
});

app.listen(4002, () => {
  console.log('4002번 포트에서 실습 서버가 돌아가요');
});
