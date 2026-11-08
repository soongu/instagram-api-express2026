// ~/instagram-api/docs/openapi.js
// 우리 API 의 계약을 OpenAPI 형식으로 적은 문서다.
const json = (schema) => ({ 'application/json': { schema } });

export const openapi = {
  openapi: '3.2.0',
  info: { title: '인스타그램 API', version: '1.0.0' },
  paths: {
    '/api/posts': {
      get: {
        summary: '게시물 목록',
        parameters: [
          { name: 'limit', in: 'query', description: '한 페이지의 게시물 수 — 없으면 5', schema: { type: 'integer', minimum: 1, maximum: 50 } },
          { name: 'cursor', in: 'query', description: '앞 응답의 nextCursor 그대로', schema: { type: 'string' } },
          { name: 'username', in: 'query', description: '이 사람이 올린 게시물만', schema: { type: 'string' } },
          { name: 'userId', in: 'query', description: '보는 사람의 번호 — 그 사람이 누른 좋아요가 liked 로 온다', schema: { type: 'integer' } },
        ],
        responses: {
          200: { description: '게시물 한 페이지', content: json({ $ref: '#/components/schemas/PostPage' }) },
          400: { description: '쿼리 값이 규칙에 안 맞음', content: json({ $ref: '#/components/schemas/Error' }) },
        },
      },
    },
  },
  components: {
    schemas: {
      Post: {
        type: 'object',
        properties: {
          id: { type: 'integer' },
          authorId: { type: 'integer' },
          postAlt: { type: ['string', 'null'] },
          content: { type: ['string', 'null'] },
          likeCount: { type: 'integer' },
          commentCount: { type: 'integer' },
          createdAt: { type: 'string', format: 'date-time' },
          updatedAt: { type: 'string', format: 'date-time' },
          username: { type: 'string' },
          profileImage: { type: ['string', 'null'] },
          imageUrls: { type: 'array', items: { type: 'string' } },
          liked: { type: 'boolean' },
        },
      },
      PostPage: {
        type: 'object',
        properties: {
          items: { type: 'array', items: { $ref: '#/components/schemas/Post' } },
          hasNext: { type: 'boolean' },
          nextCursor: { type: ['string', 'null'], description: '다음 요청에 cursor 로 그대로 보낼 값 — 끝이면 null' },
        },
      },
      Error: {
        type: 'object',
        properties: { message: { type: 'string' } },
      },
    },
  },
};
