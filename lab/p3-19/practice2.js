// ~/instagram-api/lab/p3-19/practice2.js
import express from 'express';

const app = express();

app.get('/', (req, res) => {
  // 화면의 배경색 설정
  res.cookie('theme', 'dark');
  // 로그인한 사람
  res.cookie('loginUser', 'jaehoon', { httpOnly: true });

  res.send(`<!doctype html>
<meta charset="utf-8">
<h1>쿠키 두 개</h1>
<p id="visible"></p>
<script>
  document.getElementById('visible').textContent = '스크립트가 읽은 쿠키: ' + document.cookie;
  if (document.cookie.includes('theme=dark')) document.body.style.background = '#ddd';
</script>`);
});

app.listen(4002, () => {
  console.log('실습 서버가 4002번 포트에서 기다리고 있어요.');
});
