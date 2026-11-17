// ~/instagram-api/lab/p3-31/peek.js
import express from 'express';

const app = express();

app.get('/', (req, res) => {
  res.send(`
    <form action="/peek" method="post" enctype="multipart/form-data">
      <input name="content" value="제주 바다">
      <input type="file" name="images">
      <button>보내기</button>
    </form>
  `);
});

// 어떤 형식으로 오든 본문을 글자 그대로 읽는다 — 무엇이 왔는지 들여다보려는 서버다.
app.post('/peek', express.text({ type: '*/*' }), (req, res) => {
  console.log(req.get('Content-Type'));
  console.log(req.body);
  res.send('받았어요');
});

// 다른 출처(4009)의 화면이 수업 백엔드(3000)의 사진을 <img>로 띄운다.
app.get('/photo', (req, res) => {
  res.send(
    '<img src="http://localhost:3000/uploads/8117e306-5916-41ea-b9fb-405d0cd3e8fc.jpg" width="300">',
  );
});

app.listen(4009, () => {
  console.log('들여다보기 서버가 4009번 포트에서 기다리고 있어요.');
});
