// ~/instagram-api/lab/p3-34/homework1.js
import express from 'express';
import { z } from 'zod';
import swaggerUi from 'swagger-ui-express';

const app = express();

const notices = [
  { id: 1, title: '서버 점검 안내', content: '11월 20일 새벽 2시부터 4시까지 서버를 점검해요.' },
  { id: 2, title: '새 기능 소개', content: '이제 게시물에 사진을 열 장까지 올릴 수 있어요.' },
];

// 응답의 모양 — 문서도 이 스키마에서 뽑고, 보낼 때도 이 스키마를 거친다.
const noticeSchema = z.object({
  id: z.int(),
  title: z.string(),
  content: z.string(),
  body: z.string().meta({ deprecated: true, description: 'content 와 같은 값이에요 — content 를 쓰세요. 2027-03-01 에 빼요' }),
});

app.get('/api/notices/:id', (req, res) => {
  const notice = notices.find((one) => one.id === Number(req.params.id));

  if (!notice) {
    res.status(404).json({ message: '그런 공지는 없어요' });
    return;
  }

  // 옛 화면이 읽는 body 를 같은 값으로 함께 보낸다.
  res.json(noticeSchema.parse({ ...notice, body: notice.content }));
});

const openapi = {
  openapi: '3.2.0',
  info: { title: '공지 API', version: '1.0.0' },
  paths: {
    '/api/notices/{id}': {
      get: {
        summary: '공지 하나',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'integer' } }],
        responses: {
          200: { description: '공지', content: { 'application/json': { schema: z.toJSONSchema(noticeSchema) } } },
          404: { description: '그런 공지는 없어요' },
        },
      },
    },
  },
};

app.get('/openapi.json', (req, res) => {
  res.json(openapi);
});
app.use('/docs', swaggerUi.serve, swaggerUi.setup(openapi));

app.listen(4011, () => {
  console.log('과제 서버가 4011번 포트에서 기다리고 있어요.');
});
