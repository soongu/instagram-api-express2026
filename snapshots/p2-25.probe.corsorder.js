// 내부 검증 전용 — 교안·답안에 한 줄도 인용하지 않는다.
// 답안이 `cors()` 를 `express.json()` 위에 두라고 권하는 근거를 «한 프로세스 안에서»
// 나란히 잰다. `/above` 는 cors 가 위, `/below` 는 아래인 앱으로 각각 간다.
import express from 'express';
import cors from 'cors';

const above = express();
above.use(cors());
above.use(express.json());
above.post('/', (req, res) => res.json(req.body));
above.use((err, req, res, next) => res.status(err.status ?? 500).json({ ok: false }));

const below = express();
below.use(express.json());
below.use(cors());
below.post('/', (req, res) => res.json(req.body));
below.use((err, req, res, next) => res.status(err.status ?? 500).json({ ok: false }));

const app = express();
app.use('/above', above);
app.use('/below', below);

app.listen(3411, () => console.log('probe cors order 3411'));
