// 내부 검증 전용 — 교안·답안에 한 줄도 인용하지 않는다.
// 답안 「흔한 실수」의 주장(400 만이 아니다)을 재는 탐침. 한도를 낮춰 413 을 쉽게 낸다.
import express from 'express';

const app = express();

app.use(express.json({ limit: '100b' }));

app.post('/x', (req, res) => res.json(req.body ?? {}));

app.use((err, req, res, next) => {
  res.status(err.status ?? 500).json({ name: err.name, type: err.type ?? null });
});

app.listen(3410, () => console.log('probe limits 3410'));
