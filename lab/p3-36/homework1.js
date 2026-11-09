// ~/instagram-api/lab/p3-36/homework1.js
import express from 'express';
import * as userService from '../../services/userService.js';
import { HttpError } from '../../errors.js';

const app = express();

app.use(express.json());

// 컨트롤러 — 관리자가 보낸 요청에서 값을 꺼내 수업 서비스에 넘기고, 응답을 정한다.
async function createUser(req, res) {
  const { username, name, phone } = req.body;
  const user = await userService.createUser({ username, name, phone });

  res.status(201).json(user);
}

async function checkPhone(req, res) {
  const taken = await userService.isTaken('phone', req.query.phone);

  res.json({ phone: req.query.phone, taken });
}

// 주소 지도 — 어느 주소로 오면 어느 컨트롤러 함수로 가는지만 적는다.
app.post('/admin/users', createUser);
app.get('/admin/phones', checkPhone);

app.use((err, req, res, next) => {
  if (err instanceof HttpError) {
    res.status(err.status).json({ message: err.message });
    return;
  }

  console.error(err);
  res.status(500).json({ message: '서버에서 문제가 생겼어요' });
});

app.listen(4011, () => {
  console.log('관리자 서버가 4011번 포트에서 기다리고 있어요.');
});
