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

// 새 메시지가 없으면 바로 답하지 않고 응답을 붙잡아 둔다. 25초 동안 아무 일도 없으면 빈 배열로 답한다.
const waiting = new Set();

app.get('/messages/wait', (req, res) => {
  const after = Number(req.query.after ?? 0);
  const news = messages.filter((message) => message.id > after);
  if (news.length > 0) {
    return res.json(news);
  }

  const waiter = { res };
  waiter.timer = setTimeout(() => {
    waiting.delete(waiter);
    res.json([]);
  }, 25000);
  waiting.add(waiter);
});

app.post('/messages', (req, res) => {
  const message = { id: nextId++, name: req.body.name, text: req.body.text };
  messages.push(message);
  res.status(201).json(message);

  // 붙잡아 둔 응답에 새 메시지를 실어 보낸다.
  for (const waiter of waiting) {
    clearTimeout(waiter.timer);
    waiter.res.json([message]);
  }
  waiting.clear();
});

app.listen(4001, () => {
  console.log('채팅 서버가 http://localhost:4001 에서 기다리고 있어요.');
});
