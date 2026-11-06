// ~/instagram-api/lab/p3-19/practice3.js
import express from 'express';

const app = express();

app.get('/set', (req, res) => {
  res.cookie('strict', '1', { sameSite: 'strict' });
  res.cookie('lax', '1', { sameSite: 'lax' });
  res.cookie('none', '1', { sameSite: 'none', secure: true });
  // SameSite 를 안 적은 쿠키 — 브라우저의 기본값에 맡긴다.
  res.cookie('plain', '1');
  res.send('쿠키 네 개를 줬어요');
});

// 어디서 보낸 요청에 어떤 쿠키가 실려 왔는지 터미널에 찍는다.
app.all('/check', (req, res) => {
  const cookies = req.headers.cookie ?? '(쿠키 없음)';
  console.log(`${req.method}${req.query.from} →${cookies}`);
  res.send(`받은 쿠키:${cookies}`);
});

// 다른 사이트의 페이지인 척한다 — 127.0.0.1 주소로 열면 localhost 와는 다른 사이트다.
app.get('/other-site', (req, res) => {
  res.send(`<!doctype html>
<meta charset="utf-8">
<p><a href="http://localhost:4003/check?from=link">링크로 가기</a></p>
<form method="post" action="http://localhost:4003/check?from=form">
  <button>폼으로 보내기</button>
</form>
<img src="http://localhost:4003/check?from=image" alt="">`);
});

app.listen(4003, () => {
  console.log('실습 서버가 4003번 포트에서 기다리고 있어요.');
});
