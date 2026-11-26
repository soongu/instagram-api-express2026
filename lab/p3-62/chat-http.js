// ~/instagram-api/lab/p3-62/chat-http.js
import express from 'express';

const app = express();
app.use(express.json());
app.use(express.static('lab/p3-62/public'));

const messages = [];
let nextId = 1;

// after 번호보다 뒤에 온 메시지만 준다. 화면은 마지막으로 받은 번호를 after 로 보낸다.
app.get('/messages', (req, res) => {
  const after = Number(req.query.after ?? 0);
  res.json(messages.filter((message) => message.id > after));
});

app.post('/messages', (req, res) => {
  const message = { id: nextId++, name: req.body.name, text: req.body.text };
  messages.push(message);
  res.status(201).json(message);
});

app.listen(4001, () => {
  console.log('채팅 서버가 http://localhost:4001 에서 기다리고 있어요.');
});
