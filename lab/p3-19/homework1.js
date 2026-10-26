// ~/instagram-api/lab/homework1.js
import express from 'express';
import cookieParser from 'cookie-parser';

const app = express();

app.use(cookieParser());

const THIRTY_DAYS = 1000 * 60 * 60 * 24 * 30;
const greetings = { ko: '안녕하세요', en: 'Hello' };

app.get('/', (req, res) => {
  const asked = req.query.lang;

  // 주소로 언어를 고르면 쿠키에 30일 동안 남겨 둔다.
  if (asked === 'ko' || asked === 'en') {
    res.cookie('lang', asked, { maxAge: THIRTY_DAYS });
    res.send(greetings[asked]);
    return;
  }

  // 고르지 않았으면 남겨 둔 쿠키를 보고, 쿠키도 없으면 한국어로 인사한다.
  const saved = req.cookies.lang === 'en' ? 'en' : 'ko';
  res.send(greetings[saved]);
});

app.listen(4011, () => {
  console.log('과제 서버가 4011번 포트에서 기다리고 있어요.');
});
