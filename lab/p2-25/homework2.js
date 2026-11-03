// ~/instagram-api/lab/homework2.js
import express from 'express';

const app = express();

app.get('/boom/sync', (req, res) => {
  throw new Error('그 자리에서 바로 던졌어요');
});

app.get('/boom/async', async (req, res) => {
  await Promise.resolve();
  throw new Error('기다린 뒤에 던졌어요');
});

app.get('/boom/later', (req, res) => {
  setTimeout(() => {
    throw new Error('타이머 안에서 던졌어요');
  }, 100);
});

app.use((req, res) => {
  res.status(404).json({ message: '그런 주소는 없어요' });
});

app.use((err, req, res, next) => {
  console.log('[핸들러가 받았어요]', err.message);
  res.status(500).json({ message: '서버에서 문제가 생겼어요' });
});

app.listen(4000, () => {
  console.log('서버가 4000번 포트에서 기다리고 있어요.');
});
