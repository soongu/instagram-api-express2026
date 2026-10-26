// ~/instagram-api/lab/homework2.js
import express from 'express';

const app = express();

const API_KEY = 'lab-key-123';

app.get('/api/secret', (req, res) => {
  const header = req.headers.authorization;

  if (!header || !header.startsWith('Bearer ')) {
    // 무엇을 실어 보내야 하는지 알려 주는 헤더를 함께 보낸다.
    res.set('WWW-Authenticate', 'Bearer');
    res.status(401).json({ message: 'API 키가 필요해요' });
    return;
  }

  if (header.slice('Bearer '.length) !== API_KEY) {
    res.status(401).json({ message: 'API 키가 맞지 않아요' });
    return;
  }

  res.json({ message: '비밀 내용이에요' });
});

app.listen(4012, () => {
  console.log('과제 서버가 4012번 포트에서 기다리고 있어요.');
});
