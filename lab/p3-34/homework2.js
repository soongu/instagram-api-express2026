// ~/instagram-api/lab/p3-34/homework2.js
import express from 'express';
import { z } from 'zod';
import swaggerUi from 'swagger-ui-express';

const app = express();

const notices = [
  { id: 1, title: '서버 점검 안내', pinned: true },
  { id: 2, title: '새 기능 소개', pinned: false },
  { id: 3, title: '이용 약관 변경', pinned: true },
  { id: 4, title: '연말 이벤트', pinned: false },
];

const v1 = express.Router();
const v2 = express.Router();

// v1 을 끝내는 날짜 — 헤더와 문서가 이 두 상수를 함께 쓴다.
const DEPRECATED_AT = new Date('2026-12-01T00:00:00Z');
const SUNSET_AT = new Date('2027-03-01T00:00:00Z');

v1.use((req, res, next) => {
  res.set('Deprecation', `@${DEPRECATED_AT.getTime() / 1000}`);
  res.set('Sunset', SUNSET_AT.toUTCString());
  next();
});

v1.get('/notices', (req, res) => {
  res.json(notices);
});

v2.get('/notices', (req, res) => {
  res.json({
    pinned: notices.filter((notice) => notice.pinned),
    items: notices.filter((notice) => !notice.pinned),
  });
});

app.use('/api/v1', v1);
app.use('/api/v2', v2);
app.use('/api', v1);

// 여기부터 문서 — 공지 하나의 모양을 한 번만 적고, 두 버전의 응답이 그것을 다르게 담는다.
const noticeSchema = z.object({
  id: z.int(),
  title: z.string(),
  pinned: z.boolean(),
});
const noticeList = z.array(noticeSchema);

// 수업의 json 과 달리 zod 스키마를 받아, 안에서 JSON Schema 로 바꿔 담는다.
const json = (schema) => ({ 'application/json': { schema: z.toJSONSchema(schema) } });

const openapi = {
  openapi: '3.2.0',
  info: { title: '공지 API', version: '1.0.0' },
  paths: {
    '/api/v1/notices': {
      get: {
        summary: '공지 목록 (v1)',
        description: `${SUNSET_AT.toISOString().slice(0, 10)} 에 끝나요. /api/v2/notices 로 옮기세요. 버전 없는 /api/notices 도 v1 이에요.`,
        deprecated: true,
        responses: { 200: { description: '공지 배열', content: json(noticeList) } },
      },
    },
    '/api/v2/notices': {
      get: {
        summary: '공지 목록 (v2)',
        responses: {
          200: { description: '고정 공지와 나머지', content: json(z.object({ pinned: noticeList, items: noticeList })) },
        },
      },
    },
  },
};

app.get('/openapi.json', (req, res) => {
  res.json(openapi);
});
app.use('/docs', swaggerUi.serve, swaggerUi.setup(openapi));

app.listen(4012, () => {
  console.log('과제 서버가 4012번 포트에서 기다리고 있어요.');
});
