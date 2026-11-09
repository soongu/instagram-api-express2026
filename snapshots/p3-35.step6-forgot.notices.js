// ~/instagram-api/lab/p3-35/notices.js
import express from 'express';
import { setTimeout as sleep } from 'node:timers/promises';
import { logger } from '../../middlewares/logger.js';

const app = express();

app.use(logger);
app.use(express.json());

const notices = [
  { id: 1, title: '서버 점검 안내' },
  { id: 2, title: '새 기능 소개' },
  { id: 3, title: '이용 약관 변경' },
];

// 목록이 바뀔 때마다 1씩 올리는 번호 — 이 번호가 같으면 목록도 같다.
let version = 1;
// 한 번 만든 목록을 담아 둔다 — 목록이 바뀌면 비운다.
let cachedList = null;

// 목록을 바꾼 라우트는 응답하기 전에 꼭 이 함수를 부른다.
function changed() {
  version += 1;
  cachedList = null;
}

// 목록을 만든다 — 데이터베이스에서 읽어 오는 시간을 0.3초 기다리는 것으로 흉내 낸다.
async function buildList() {
  await sleep(300);
  console.log('공지 목록을 만들었어요');
  return notices.map((notice) => ({ id: notice.id, title: notice.title }));
}

app.get('/api/notices', async (req, res) => {
  // 만들기 전에 비교한다 — 브라우저가 보낸 ETag 가 지금 번호와 같으면 만들지 않고 304로 답한다.
  res.set('ETag', `"v${version}"`);
  if (req.fresh) {
    res.status(304).end();
    return;
  }

  if (cachedList === null) {
    cachedList = await buildList();
  }
  res.json(cachedList);
});

app.patch('/api/notices/:id', (req, res) => {
  const notice = notices.find((one) => one.id === Number(req.params.id));
  if (!notice) {
    res.status(404).json({ message: '그런 공지는 없어요' });
    return;
  }

  notice.title = req.body.title;
  changed();
  res.json(notice);
});

app.delete('/api/notices/:id', (req, res) => {
  const index = notices.findIndex((one) => one.id === Number(req.params.id));
  if (index === -1) {
    res.status(404).json({ message: '그런 공지는 없어요' });
    return;
  }

  notices.splice(index, 1);
  res.status(204).end();
});

app.listen(4013, () => {
  console.log('공지 서버가 4013번 포트에서 기다리고 있어요.');
});
