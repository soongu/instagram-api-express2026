// ~/instagram-api/lab/p3-37/homework1.js
import express from 'express';

const app = express();

// 게시물 번호마다 좋아요를 누른 사람
const likers = {
  1: ['jaehoon', 'minji', 'dahye'],
  2: [],
};

const MESSAGES = {
  POST_NOT_FOUND: '그런 게시물은 없어요',
};

// 새 주소로 온 요청이면 값은 data 에, 목록에 대한 정보는 meta 에 담는다. 옛 주소는 값만 보낸다.
function sendData(res, data, meta) {
  if (res.locals.apiVersion === 2) {
    res.json(meta === undefined ? { data } : { data, meta });
    return;
  }
  res.json(data);
}

// 새 주소면 { error: { code, message } }, 옛 주소면 { message }.
function sendError(res, status, code) {
  res.status(status);
  if (res.locals.apiVersion === 2) {
    res.json({ error: { code, message: MESSAGES[code] } });
    return;
  }
  res.json({ message: MESSAGES[code] });
}

const api = express.Router();

api.get('/posts/:id/likers', (req, res) => {
  const names = likers[req.params.id];

  if (names === undefined) {
    sendError(res, 404, 'POST_NOT_FOUND');
    return;
  }

  sendData(res, names, { count: names.length });
});

app.use('/api/v2', (req, res, next) => {
  res.locals.apiVersion = 2;
  next();
}, api);
app.use('/api', api);

app.listen(4011, () => {
  console.log('과제 서버가 4011번 포트에서 기다리고 있어요.');
});
