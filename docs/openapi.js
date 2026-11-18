// ~/instagram-api/docs/openapi.js
// 우리 API 의 계약을 OpenAPI 형식으로 적은 문서다.
import { z } from 'zod';
import {
  postCreateSchema,
  postListQuerySchema,
} from '../schemas/postSchema.js';
import { signupSchema } from '../schemas/authSchema.js';
import { MESSAGES } from '../errors.js';
import { SUNSET_AT } from '../middlewares/deprecation.js';

const json = (schema) => ({ 'application/json': { schema } });
const ref = (name) => ({ $ref: `#/components/schemas/${name}` });

// 새 주소(/api/v2)의 성공 응답 — 값을 data 에 담는다.
const data = (schema) => ({
  type: 'object',
  required: ['data'],
  properties: { data: schema },
});

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
          details: {
            type: 'object',
            description: '검사에 실패했을 때 — 필드마다 무엇이 틀렸는지',
          },
          path: {
            type: 'string',
            description: '실패한 요청의 주소 — 쿼리 문자열은 뺀다',
          },
          timestamp: {
            type: 'string',
            format: 'date-time',
            description: '서버가 실패를 알린 시각(UTC)',
          },
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

  return Object.entries(properties).map(
    ([name, { description, ...value }]) => ({
      name,
      in: 'query',
      description,
      required: required.includes(name),
      schema: value,
    }),
  );
}

// 게시물 목록의 쿼리 — 두 버전이 같다.
const listParameters = [
  ...queryParameters(postListQuerySchema),
  // userId 는 검사 스키마 밖에서 읽는 값이라 손으로 적는다.
  {
    name: 'userId',
    in: 'query',
    description:
      '보는 사람의 번호 — 그 사람이 누른 좋아요가 liked 로 온다(숫자가 아니면 세지 않는다)',
    schema: { type: 'integer' },
  },
];

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
          200: {
            description: '게시물 한 페이지',
            content: json(data(ref('PostPage'))),
          },
          400: {
            description: '쿼리 값이 규칙에 안 맞음',
            content: json(errorOf('VALIDATION_FAILED', 'INVALID_CURSOR')),
          },
        },
      },
      post: {
        summary: '게시물 올리기',
        requestBody: {
          required: true,
          content: json(toSchema(postCreateSchema)),
        },
        responses: {
          201: {
            description: '만든 게시물 — Location 헤더에 그 게시물의 주소',
            content: json(data(ref('Post'))),
          },
          400: {
            description: '보낸 내용이 규칙에 안 맞거나, 글쓴이가 없음',
            content: json(
              errorOf('VALIDATION_FAILED', 'INVALID_BODY', 'USER_NOT_FOUND'),
            ),
          },
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
            content: json(
              data({
                type: 'object',
                properties: {
                  message: { type: 'string' },
                  username: { type: 'string' },
                },
              }),
            ),
          },
          400: {
            description: '보낸 내용이 규칙에 안 맞음',
            content: json(errorOf('VALIDATION_FAILED', 'INVALID_BODY')),
          },
          409: {
            description:
              '누가 이미 쓰고 있는 값 — 코드로 어느 칸인지 알 수 있다',
            content: json(
              errorOf('USERNAME_TAKEN', 'EMAIL_TAKEN', 'PHONE_TAKEN'),
            ),
          },
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
          200: {
            description: '게시물 한 페이지',
            content: json(ref('PostPage')),
          },
          400: {
            description: '쿼리 값이 규칙에 안 맞음',
            content: json(ref('Error')),
          },
        },
      },
      post: {
        summary: '게시물 올리기 (옛 주소)',
        description: OLD,
        deprecated: true,
        requestBody: {
          required: true,
          content: json(toSchema(postCreateSchema)),
        },
        responses: {
          201: {
            description: '만든 게시물 — Location 헤더에 그 게시물의 주소',
            content: json(ref('Post')),
          },
          400: {
            description: '보낸 내용이 규칙에 안 맞음',
            content: json(ref('Error')),
          },
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
          items: {
            type: 'array',
            items: { $ref: '#/components/schemas/Post' },
          },
          hasNext: { type: 'boolean' },
          nextCursor: {
            type: ['string', 'null'],
            description: '다음 요청에 cursor 로 그대로 보낼 값 — 끝이면 null',
          },
        },
      },
      Error: {
        type: 'object',
        description: '옛 주소의 실패 응답',
        properties: {
          message: { type: 'string' },
          details: { type: 'object' },
        },
      },
      ErrorCode: {
        type: 'string',
        description: '우리 서버가 보낼 수 있는 에러 코드 전부',
        enum: Object.keys(MESSAGES),
      },
    },
  },
};
