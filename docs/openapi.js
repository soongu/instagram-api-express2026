// ~/instagram-api/docs/openapi.js
// 우리 API 의 계약을 OpenAPI 형식으로 적은 문서다.
import { z } from 'zod';
import { postCreateSchema, postListQuerySchema } from '../schemas/postSchema.js';
import { signupSchema } from '../schemas/authSchema.js';
import { commentCreateSchema, commentListQuerySchema } from '../schemas/commentSchema.js';
import { MESSAGES } from '../errors.js';
import { SUNSET_AT } from '../middlewares/deprecation.js';

const json = (schema) => ({ 'application/json': { schema } });
const ref = (name) => ({ $ref: `#/components/schemas/${name}` });

// 새 주소(/api/v2)의 성공 응답 — 값을 data 에 담는다.
const data = (schema) => ({ type: 'object', required: ['data'], properties: { data: schema } });

// 새 주소의 실패 응답 — 그 응답이 보낼 수 있는 에러 코드만 적는다.
// MESSAGES 에 없는 코드를 적으면 문서를 만들다가 에러를 던진다 — 서버가 뜨지 않으니 바로 알아챈다.
function errorOf(...codes) {
  for (const code of codes) {
    if (!Object.hasOwn(MESSAGES, code)) {
      throw new Error(`MESSAGES에 없는 에러 코드예요: ${code}`);
    }
  }

  return {
    type: 'object',
    required: ['error'],
    properties: {
      error: {
        type: 'object',
        required: ['code', 'message', 'path', 'timestamp'],
        properties: {
          code: { type: 'string', enum: codes },
          message: { type: 'string' },
          details: { type: 'object', description: '검사에 실패했을 때 — 필드마다 무엇이 틀렸는지' },
          path: { type: 'string', description: '실패한 요청의 주소 — 쿼리 문자열은 뺀다' },
          timestamp: { type: 'string', format: 'date-time', description: '서버가 실패를 알린 시각(UTC)' },
        },
      },
    },
  };
}

// 옛 주소의 설명 — 끝나는 날은 응답 헤더와 같은 상수에서 꺼낸다.
const OLD = `옛 주소예요. ${SUNSET_AT.toISOString().slice(0, 10)}에 끝나요. 같은 일을 하는 /api/v2 주소로 옮기세요.`;

// 검사에 쓰는 zod 스키마를 OpenAPI 가 읽는 JSON Schema 로 바꾼다.
// 요청으로 들어오는 값을 적는 것이라, zod 가 바꾸기 전의 모양(input)으로 뽑는다.
function toSchema(schema) {
  return z.toJSONSchema(schema, { io: 'input' });
}

// 쿼리 문자열 스키마의 필드를 하나씩 OpenAPI 의 parameters 로 펼친다.
function queryParameters(schema) {
  const { properties, required = [] } = toSchema(schema);

  return Object.entries(properties).map(([name, { description, ...value }]) => ({
    name,
    in: 'query',
    description,
    required: required.includes(name),
    schema: value,
  }));
}

// 게시물 목록의 쿼리 — 두 버전이 같다. 보는 사람은 로그인 정보로 정해서 쿼리에 없다.
const listParameters = queryParameters(postListQuerySchema);

// 주소 안의 번호다. /posts/{id} 의 id 처럼 경로에 들어가는 값이다.
function pathParameter(name, description) {
  return { name, in: 'path', required: true, description, schema: { type: 'integer' } };
}

const postIdParameter = pathParameter('id', '게시물 번호');

export const openapi = {
  openapi: '3.2.0',
  info: {
    title: '인스타그램 API',
    version: '2.0.0',
    description: `새 주소 /api/v2 는 성공을 { data }, 실패를 { error: { code, message, details } } 로 보내요. 버전 없는 옛 주소 /api 는 ${SUNSET_AT.toISOString().slice(0, 10)}에 끝나요.`,
  },
  paths: {
    '/api/v2/posts': {
      get: {
        summary: '게시물 목록',
        parameters: listParameters,
        responses: {
          200: { description: '게시물 한 페이지', content: json(data(ref('PostPage'))) },
          400: { description: '쿼리 값이 규칙에 안 맞음', content: json(errorOf('VALIDATION_FAILED', 'INVALID_CURSOR')) },
          401: { description: '로그인하지 않았거나 토큰의 기한이 지남', content: json(errorOf('LOGIN_REQUIRED', 'TOKEN_EXPIRED')) },
        },
      },
      post: {
        summary: '게시물 올리기',
        requestBody: { required: true, content: json(toSchema(postCreateSchema)) },
        responses: {
          201: { description: '만든 게시물 — Location 헤더에 그 게시물의 주소', content: json(data(ref('Post'))) },
          400: { description: '보낸 내용이 규칙에 안 맞거나, 넣을 수 없는 사진 주소가 섞여 있음', content: json(errorOf('VALIDATION_FAILED', 'INVALID_BODY', 'IMAGE_NOT_AVAILABLE')) },
          401: { description: '로그인하지 않았거나 토큰의 기한이 지남', content: json(errorOf('LOGIN_REQUIRED', 'TOKEN_EXPIRED')) },
        },
      },
    },
    '/api/v2/posts/{id}/comments': {
      parameters: [postIdParameter],
      get: {
        summary: '댓글 목록 — 원댓글만, 오래된 순',
        parameters: queryParameters(commentListQuerySchema),
        responses: {
          200: { description: '댓글 한 페이지', content: json(data(ref('CommentPage'))) },
          400: { description: '쿼리 값이 규칙에 안 맞음', content: json(errorOf('VALIDATION_FAILED', 'INVALID_CURSOR')) },
          401: { description: '로그인하지 않았거나 토큰의 기한이 지남', content: json(errorOf('LOGIN_REQUIRED', 'TOKEN_EXPIRED')) },
          404: { description: '그런 게시물이 없음 — 댓글이 없는 게시물은 빈 목록', content: json(errorOf('POST_NOT_FOUND')) },
        },
      },
      post: {
        summary: '댓글 달기 — 글쓴이는 로그인한 사람',
        requestBody: { required: true, content: json(toSchema(commentCreateSchema)) },
        responses: {
          201: { description: '단 댓글과 바뀐 댓글 수 — 댓글 하나를 받는 주소가 없어 Location 헤더는 없다', content: json(data(ref('CommentChange'))) },
          400: { description: '보낸 내용이 규칙에 안 맞음', content: json(errorOf('VALIDATION_FAILED', 'INVALID_BODY')) },
          401: { description: '로그인하지 않았거나 토큰의 기한이 지남', content: json(errorOf('LOGIN_REQUIRED', 'TOKEN_EXPIRED')) },
          404: { description: '그런 게시물이 없음', content: json(errorOf('POST_NOT_FOUND')) },
        },
      },
    },
    '/api/v2/posts/{id}/comments/{commentId}': {
      parameters: [postIdParameter, pathParameter('commentId', '댓글 번호')],
      delete: {
        summary: '댓글 지우기 — 댓글을 쓴 사람이나 그 게시물을 쓴 사람만',
        responses: {
          200: { description: '지운 댓글과 바뀐 댓글 수 — 원댓글을 지우면 딸린 답글도 함께 지워진다', content: json(data(ref('CommentChange'))) },
          401: { description: '로그인하지 않았거나 토큰의 기한이 지남', content: json(errorOf('LOGIN_REQUIRED', 'TOKEN_EXPIRED')) },
          403: { description: '내 댓글도 아니고 내 게시물에 달린 댓글도 아님', content: json(errorOf('CANNOT_REMOVE_COMMENT')) },
          404: { description: '그 게시물에 그런 댓글이 없음', content: json(errorOf('COMMENT_NOT_FOUND', 'POST_NOT_FOUND')) },
        },
      },
    },
    '/api/v2/auth/signup': {
      post: {
        summary: '가입',
        requestBody: { required: true, content: json(toSchema(signupSchema)) },
        responses: {
          201: {
            description: '가입한 사람의 사용자 이름',
            content: json(data({ type: 'object', properties: { message: { type: 'string' }, username: { type: 'string' } } })),
          },
          400: { description: '보낸 내용이 규칙에 안 맞음', content: json(errorOf('VALIDATION_FAILED', 'INVALID_BODY')) },
          409: { description: '누가 이미 쓰고 있는 값 — 코드로 어느 칸인지 알 수 있다', content: json(errorOf('USERNAME_TAKEN', 'EMAIL_TAKEN', 'PHONE_TAKEN')) },
        },
      },
    },
    '/api/posts': {
      get: {
        summary: '게시물 목록 (옛 주소)',
        description: OLD,
        deprecated: true,
        parameters: listParameters,
        responses: {
          200: { description: '게시물 한 페이지', content: json(ref('PostPage')) },
          400: { description: '쿼리 값이 규칙에 안 맞음', content: json(ref('Error')) },
          401: { description: '로그인하지 않음', content: json(ref('Error')) },
        },
      },
      post: {
        summary: '게시물 올리기 (옛 주소)',
        description: OLD,
        deprecated: true,
        requestBody: { required: true, content: json(toSchema(postCreateSchema)) },
        responses: {
          201: { description: '만든 게시물 — Location 헤더에 그 게시물의 주소', content: json(ref('Post')) },
          400: { description: '보낸 내용이 규칙에 안 맞음', content: json(ref('Error')) },
          401: { description: '로그인하지 않음', content: json(ref('Error')) },
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
      Comment: {
        type: 'object',
        properties: {
          id: { type: 'integer' },
          authorId: { type: 'integer' },
          content: { type: 'string' },
          likeCount: { type: 'integer' },
          createdAt: { type: 'string', format: 'date-time' },
          username: { type: 'string' },
          profileImage: { type: ['string', 'null'] },
        },
      },
      CommentPage: {
        type: 'object',
        properties: {
          items: { type: 'array', items: { $ref: '#/components/schemas/Comment' } },
          hasNext: { type: 'boolean' },
          nextCursor: { type: ['string', 'null'], description: '다음 요청에 cursor 로 그대로 보낼 값 — 끝이면 null' },
        },
      },
      CommentChange: {
        type: 'object',
        properties: {
          comment: { $ref: '#/components/schemas/Comment' },
          commentCount: { type: 'integer', description: '바뀐 뒤 게시물의 댓글 수 — 원댓글만 센다' },
        },
      },
      Error: {
        type: 'object',
        description: '옛 주소의 실패 응답',
        properties: { message: { type: 'string' }, details: { type: 'object' } },
      },
      ErrorCode: {
        type: 'string',
        description: '우리 서버가 보낼 수 있는 에러 코드 전부',
        enum: Object.keys(MESSAGES),
      },
    },
  },
};
