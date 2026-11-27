// ~/instagram-api/docs/openapi.js
// 우리 API 의 계약을 OpenAPI 형식으로 적은 문서다.
import { z } from 'zod';
import { postCreateSchema, postListQuerySchema } from '../schemas/postSchema.js';
import { signupSchema } from '../schemas/authSchema.js';
import { connectionDropQuerySchema } from '../schemas/devSchema.js';
import { commentCreateSchema, commentListQuerySchema, replyListQuerySchema } from '../schemas/commentSchema.js';
import { hashtagPostsQuerySchema } from '../schemas/hashtagSchema.js';
import { profilePostsQuerySchema, followListQuerySchema } from '../schemas/profileSchema.js';
import { memberSearchQuerySchema, profileImageSchema } from '../schemas/memberSchema.js';
import { conversationCreateSchema, conversationListQuerySchema, messageListQuerySchema } from '../schemas/conversationSchema.js';
import { notificationListQuerySchema } from '../schemas/notificationSchema.js';
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
        summary: '댓글 달기 — 글쓴이는 로그인한 사람 · parentId 가 있으면 그 원댓글에 다는 답글',
        requestBody: { required: true, content: json(toSchema(commentCreateSchema)) },
        responses: {
          201: { description: '단 댓글과 바뀐 댓글 수 — 답글은 댓글 수에 세지 않는다 · 댓글 하나를 받는 주소가 없어 Location 헤더는 없다', content: json(data(ref('CommentChange'))) },
          400: { description: '보낸 내용이 규칙에 안 맞거나, 답글에 답글을 달려고 함', content: json(errorOf('VALIDATION_FAILED', 'INVALID_BODY', 'CANNOT_REPLY_TO_REPLY')) },
          401: { description: '로그인하지 않았거나 토큰의 기한이 지남', content: json(errorOf('LOGIN_REQUIRED', 'TOKEN_EXPIRED')) },
          404: { description: '그런 게시물이 없거나, 그 게시물에 parentId 의 댓글이 없음', content: json(errorOf('POST_NOT_FOUND', 'COMMENT_NOT_FOUND')) },
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
    '/api/v2/posts/{id}/comments/{commentId}/replies': {
      parameters: [postIdParameter, pathParameter('commentId', '원댓글 번호')],
      get: {
        summary: '답글 목록 — 원댓글 하나에 달린 답글, 오래된 순',
        parameters: queryParameters(replyListQuerySchema),
        responses: {
          200: { description: '답글 한 페이지 — 답글이 없는 원댓글은 빈 목록', content: json(data(ref('ReplyPage'))) },
          400: { description: '쿼리 값이 규칙에 안 맞거나, 답글 번호로 물음', content: json(errorOf('VALIDATION_FAILED', 'INVALID_CURSOR', 'REPLY_HAS_NO_REPLIES')) },
          401: { description: '로그인하지 않았거나 토큰의 기한이 지남', content: json(errorOf('LOGIN_REQUIRED', 'TOKEN_EXPIRED')) },
          404: { description: '그 게시물에 그런 댓글이 없음', content: json(errorOf('COMMENT_NOT_FOUND')) },
        },
      },
    },
    '/api/v2/hashtags/{name}/posts': {
      parameters: [pathParameter('name', '해시태그 이름 - 앞의 # 은 있어도 없어도 되고, 대문자는 소문자로 맞춰 찾는다')],
      get: {
        summary: '해시태그 게시물 목록 - 그리드용, 피드와 같은 차례',
        parameters: queryParameters(hashtagPostsQuerySchema),
        responses: {
          200: { description: '그리드 칸 한 페이지 - 태그는 있는데 붙은 게시물이 없으면 빈 목록', content: json(data(ref('GridPage'))) },
          400: { description: '쿼리 값이 규칙에 안 맞음', content: json(errorOf('VALIDATION_FAILED', 'INVALID_CURSOR')) },
          401: { description: '로그인하지 않았거나 토큰의 기한이 지남', content: json(errorOf('LOGIN_REQUIRED', 'TOKEN_EXPIRED')) },
          404: { description: '그런 이름의 해시태그가 없음', content: json(errorOf('HASHTAG_NOT_FOUND')) },
        },
      },
    },
    '/api/v2/profiles/{username}': {
      parameters: [pathParameter('username', '사용자 이름')],
      get: {
        summary: '프로필 헤더 - 이름 · 사진 · 게시물 수 · 팔로워 수 · 팔로잉 수 · 내가 팔로우하고 있는지',
        responses: {
          200: { description: '그 사람의 프로필', content: json(data(ref('Profile'))) },
          401: { description: '로그인하지 않았거나 토큰의 기한이 지남', content: json(errorOf('LOGIN_REQUIRED', 'TOKEN_EXPIRED')) },
          404: { description: '그런 사용자 이름이 없음', content: json(errorOf('USER_NOT_FOUND')) },
        },
      },
    },
    '/api/v2/profiles/{username}/posts': {
      parameters: [pathParameter('username', '사용자 이름')],
      get: {
        summary: '프로필 그리드 - 그 사람이 올린 게시물, 피드와 같은 차례',
        parameters: queryParameters(profilePostsQuerySchema),
        responses: {
          200: { description: '그리드 칸 한 페이지 - 올린 게시물이 없으면 빈 목록', content: json(data(ref('GridPage'))) },
          400: { description: '쿼리 값이 규칙에 안 맞음', content: json(errorOf('VALIDATION_FAILED', 'INVALID_CURSOR')) },
          401: { description: '로그인하지 않았거나 토큰의 기한이 지남', content: json(errorOf('LOGIN_REQUIRED', 'TOKEN_EXPIRED')) },
          404: { description: '그런 사용자 이름이 없음', content: json(errorOf('USER_NOT_FOUND')) },
        },
      },
    },
    '/api/v2/profiles/{username}/followers/me': {
      parameters: [pathParameter('username', '팔로우할 사람의 사용자 이름')],
      put: {
        summary: '팔로우 - 이미 팔로우하고 있으면 아무것도 바꾸지 않는다',
        responses: {
          200: { description: '팔로우한 상태와 그 사람의 팔로워 수', content: json(data(ref('FollowStatus'))) },
          400: { description: '나 자신은 팔로우할 수 없음', content: json(errorOf('CANNOT_FOLLOW_SELF')) },
          401: { description: '로그인하지 않았거나 토큰의 기한이 지남', content: json(errorOf('LOGIN_REQUIRED', 'TOKEN_EXPIRED')) },
          404: { description: '그런 사용자 이름이 없음', content: json(errorOf('USER_NOT_FOUND')) },
        },
      },
      delete: {
        summary: '팔로우 취소 - 팔로우하고 있지 않으면 아무것도 바꾸지 않는다',
        responses: {
          200: { description: '팔로우하지 않은 상태와 그 사람의 팔로워 수', content: json(data(ref('FollowStatus'))) },
          400: { description: '나 자신은 팔로우할 수 없음', content: json(errorOf('CANNOT_FOLLOW_SELF')) },
          401: { description: '로그인하지 않았거나 토큰의 기한이 지남', content: json(errorOf('LOGIN_REQUIRED', 'TOKEN_EXPIRED')) },
          404: { description: '그런 사용자 이름이 없음', content: json(errorOf('USER_NOT_FOUND')) },
        },
      },
    },
    '/api/v2/profiles/{username}/followers': {
      parameters: [pathParameter('username', '사용자 이름')],
      get: {
        summary: '팔로워 목록 - 그 사람을 팔로우하는 사람들, 가장 최근에 팔로우한 사람이 먼저',
        parameters: queryParameters(followListQuerySchema),
        responses: {
          200: { description: '팔로워 한 페이지 - 팔로워가 없으면 빈 목록', content: json(data(ref('FollowPage'))) },
          400: { description: '쿼리 값이 규칙에 안 맞음', content: json(errorOf('VALIDATION_FAILED', 'INVALID_CURSOR')) },
          401: { description: '로그인하지 않았거나 토큰의 기한이 지남', content: json(errorOf('LOGIN_REQUIRED', 'TOKEN_EXPIRED')) },
          404: { description: '그런 사용자 이름이 없음', content: json(errorOf('USER_NOT_FOUND')) },
        },
      },
    },
    '/api/v2/profiles/{username}/following': {
      parameters: [pathParameter('username', '사용자 이름')],
      get: {
        summary: '팔로잉 목록 - 그 사람이 팔로우하는 사람들, 가장 최근에 팔로우한 사람이 먼저',
        parameters: queryParameters(followListQuerySchema),
        responses: {
          200: { description: '팔로잉 한 페이지 - 팔로우하는 사람이 없으면 빈 목록', content: json(data(ref('FollowPage'))) },
          400: { description: '쿼리 값이 규칙에 안 맞음', content: json(errorOf('VALIDATION_FAILED', 'INVALID_CURSOR')) },
          401: { description: '로그인하지 않았거나 토큰의 기한이 지남', content: json(errorOf('LOGIN_REQUIRED', 'TOKEN_EXPIRED')) },
          404: { description: '그런 사용자 이름이 없음', content: json(errorOf('USER_NOT_FOUND')) },
        },
      },
    },
    '/api/v2/conversations': {
      get: {
        summary: '내 대화방 목록 - 마지막 메시지가 늦은 방이 먼저, 내가 지운 방은 빠진다',
        parameters: queryParameters(conversationListQuerySchema),
        responses: {
          200: { description: '대화방 한 페이지 - 방이 없으면 빈 목록', content: json(data(ref('ConversationPage'))) },
          400: { description: '쿼리 값이 규칙에 안 맞음', content: json(errorOf('VALIDATION_FAILED', 'INVALID_CURSOR')) },
          401: { description: '로그인하지 않았거나 토큰의 기한이 지남', content: json(errorOf('LOGIN_REQUIRED', 'TOKEN_EXPIRED')) },
        },
      },
      post: {
        summary: '대화방 열기 - 그 사람과의 방이 없으면 만들고, 있으면 있는 방을 준다',
        requestBody: { required: true, content: json(toSchema(conversationCreateSchema)) },
        responses: {
          200: { description: '이미 있던 대화방', content: json(data(ref('Conversation'))) },
          201: { description: '새로 만든 대화방 - Location 헤더에 그 방의 주소', content: json(data(ref('Conversation'))) },
          400: { description: '보낸 내용이 규칙에 안 맞거나 나 자신과의 방', content: json(errorOf('VALIDATION_FAILED', 'INVALID_BODY', 'CANNOT_MESSAGE_SELF')) },
          401: { description: '로그인하지 않았거나 토큰의 기한이 지남', content: json(errorOf('LOGIN_REQUIRED', 'TOKEN_EXPIRED')) },
          404: { description: '그런 사용자 이름이 없음', content: json(errorOf('USER_NOT_FOUND')) },
        },
      },
    },
    '/api/v2/conversations/unread': {
      get: {
        summary: '안 읽은 메시지가 있는 내 대화방 수 - 사이드바의 «메시지» 점',
        responses: {
          200: { description: '방 수 - 없으면 0', content: json(data(ref('UnreadConversations'))) },
          401: { description: '로그인하지 않았거나 토큰의 기한이 지남', content: json(errorOf('LOGIN_REQUIRED', 'TOKEN_EXPIRED')) },
        },
      },
    },
    '/api/v2/conversations/{id}': {
      parameters: [pathParameter('id', '대화방 번호')],
      get: {
        summary: '대화방 하나 - 목록의 한 줄과 같은 모양, 내가 지운 방도 준다',
        responses: {
          200: { description: '그 대화방', content: json(data(ref('Conversation'))) },
          401: { description: '로그인하지 않았거나 토큰의 기한이 지남', content: json(errorOf('LOGIN_REQUIRED', 'TOKEN_EXPIRED')) },
          404: { description: '그런 대화방이 없거나 내가 참여한 대화방이 아님 - 둘을 가르지 않는다', content: json(errorOf('CONVERSATION_NOT_FOUND')) },
        },
      },
      delete: {
        summary: '대화방을 내 쪽에서만 지우기 - 상대에게는 그대로 보이고, 두 사람이 모두 지운 메시지는 실제로 지운다',
        responses: {
          204: { description: '지웠다 - 본문 없음' },
          401: { description: '로그인하지 않았거나 토큰의 기한이 지남', content: json(errorOf('LOGIN_REQUIRED', 'TOKEN_EXPIRED')) },
          404: { description: '그런 대화방이 없거나 내가 참여한 대화방이 아님 - 둘을 가르지 않는다', content: json(errorOf('CONVERSATION_NOT_FOUND')) },
        },
      },
    },
    '/api/v2/conversations/{id}/messages': {
      parameters: [pathParameter('id', '대화방 번호')],
      get: {
        summary: '메시지 이력 - 가장 최근 메시지가 먼저, 내가 지운 시각 뒤의 메시지만',
        parameters: queryParameters(messageListQuerySchema),
        responses: {
          200: { description: '메시지 한 페이지 - after 를 주면 그 번호 뒤의 메시지를 오래된 것부터(nextCursor 는 null)', content: json(data(ref('MessagePage'))) },
          400: { description: '쿼리 값이 규칙에 안 맞음', content: json(errorOf('VALIDATION_FAILED', 'INVALID_CURSOR')) },
          401: { description: '로그인하지 않았거나 토큰의 기한이 지남', content: json(errorOf('LOGIN_REQUIRED', 'TOKEN_EXPIRED')) },
          404: { description: '그런 대화방이 없거나 내가 참여한 대화방이 아님 - 둘을 가르지 않는다', content: json(errorOf('CONVERSATION_NOT_FOUND')) },
        },
      },
    },
    '/api/v2/conversations/{id}/messages/read': {
      parameters: [pathParameter('id', '대화방 번호')],
      patch: {
        summary: '읽음 처리 - 상대가 보낸, 아직 안 읽은 메시지를 모두 읽음으로',
        responses: {
          200: { description: '읽음으로 바뀐 메시지 수 - 바꿀 것이 없으면 0 · 1 이상이면 상대와 나의 연결에 dm:read { conversationId, readerId }', content: json(data(ref('ReadResult'))) },
          401: { description: '로그인하지 않았거나 토큰의 기한이 지남', content: json(errorOf('LOGIN_REQUIRED', 'TOKEN_EXPIRED')) },
          404: { description: '그런 대화방이 없거나 내가 참여한 대화방이 아님 - 둘을 가르지 않는다', content: json(errorOf('CONVERSATION_NOT_FOUND')) },
        },
      },
    },
    '/api/v2/notifications': {
      get: {
        summary: '내 알림 목록 - 가장 최근 알림이 먼저',
        parameters: queryParameters(notificationListQuerySchema),
        responses: {
          200: { description: '알림 한 페이지 - 알림이 없으면 빈 목록', content: json(data(ref('NotificationPage'))) },
          400: { description: '쿼리 값이 규칙에 안 맞음', content: json(errorOf('VALIDATION_FAILED', 'INVALID_CURSOR')) },
          401: { description: '로그인하지 않았거나 토큰의 기한이 지남', content: json(errorOf('LOGIN_REQUIRED', 'TOKEN_EXPIRED')) },
        },
      },
    },
    '/api/v2/notifications/unseen': {
      get: {
        summary: '아직 안 본 알림 수 - 알림 패널을 마지막으로 연 뒤에 온 알림 · 사이드바의 «알림» 점',
        responses: {
          200: { description: '알림 수 - 없으면 0', content: json(data(ref('UnseenNotifications'))) },
          401: { description: '로그인하지 않았거나 토큰의 기한이 지남', content: json(errorOf('LOGIN_REQUIRED', 'TOKEN_EXPIRED')) },
        },
      },
    },
    '/api/v2/notifications/seen': {
      patch: {
        summary: '알림 패널을 열었다 - 지금까지 온 알림을 모두 본 것으로(알림의 읽음은 그대로)',
        responses: {
          200: { description: '아직 안 본 알림 수 - 언제나 0', content: json(data(ref('UnseenNotifications'))) },
          401: { description: '로그인하지 않았거나 토큰의 기한이 지남', content: json(errorOf('LOGIN_REQUIRED', 'TOKEN_EXPIRED')) },
        },
      },
    },
    '/api/v2/notifications/{id}/read': {
      parameters: [pathParameter('id', '알림 번호')],
      patch: {
        summary: '알림 하나를 읽음으로 - 이미 읽은 알림이어도 같은 응답',
        responses: {
          200: { description: '읽음으로 바뀐 알림', content: json(data(ref('NotificationRead'))) },
          401: { description: '로그인하지 않았거나 토큰의 기한이 지남', content: json(errorOf('LOGIN_REQUIRED', 'TOKEN_EXPIRED')) },
          404: { description: '그런 알림이 없거나 내가 받은 알림이 아님 - 둘을 가르지 않는다', content: json(errorOf('NOTIFICATION_NOT_FOUND')) },
        },
      },
    },
    '/api/v2/dev/connections/{username}': {
      parameters: [{ name: 'username', in: 'path', required: true, description: '연결을 끊을 사람의 사용자 이름', schema: { type: 'string' } }],
      delete: {
        summary: '개발용 - 그 사람의 실시간 연결을 끊고 잠깐 다시 붙지 못하게 한다(NODE_ENV=production 이면 없는 주소)',
        parameters: queryParameters(connectionDropQuerySchema),
        responses: {
          200: { description: '끊은 연결 수와 막은 초', content: json(data({ type: 'object', properties: { closedCount: { type: 'integer' }, blockedSeconds: { type: 'integer' } } })) },
          400: { description: 'seconds 가 0~60 의 정수가 아님', content: json(errorOf('VALIDATION_FAILED')) },
          401: { description: '로그인하지 않았거나 토큰의 기한이 지남', content: json(errorOf('LOGIN_REQUIRED', 'TOKEN_EXPIRED')) },
          404: { description: '그런 사용자 이름이 없음', content: json(errorOf('USER_NOT_FOUND')) },
        },
      },
    },
    '/api/v2/members/search': {
      get: {
        summary: '사람 찾기 - 사용자 이름에 검색어가 든 사람을 이름 차례로 20명까지',
        parameters: queryParameters(memberSearchQuerySchema),
        responses: {
          200: { description: '찾은 사람 목록 - 검색어가 없으면 빈 배열', content: json(data({ type: 'array', items: ref('Member') })) },
          400: { description: '쿼리 값이 규칙에 안 맞음', content: json(errorOf('VALIDATION_FAILED')) },
          401: { description: '로그인하지 않았거나 토큰의 기한이 지남', content: json(errorOf('LOGIN_REQUIRED', 'TOKEN_EXPIRED')) },
        },
      },
    },
    '/api/v2/members/me/profile-image': {
      put: {
        summary: '내 프로필 사진 바꾸기 - 사진은 먼저 /api/v2/uploads 로 올리고 받은 주소를 보낸다',
        requestBody: { required: true, content: json(toSchema(profileImageSchema)) },
        responses: {
          200: {
            description: '바꾼 프로필 사진 주소',
            content: json(data({ type: 'object', properties: { profileImage: { type: 'string' } } })),
          },
          400: {
            description: '보낸 내용이 규칙에 안 맞거나, 내가 올리고 아직 아무 데도 쓰지 않은 사진이 아님',
            content: json(errorOf('VALIDATION_FAILED', 'INVALID_BODY', 'IMAGE_NOT_AVAILABLE')),
          },
          401: { description: '로그인하지 않았거나 토큰의 기한이 지남', content: json(errorOf('LOGIN_REQUIRED', 'TOKEN_EXPIRED')) },
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
      RootComment: {
        allOf: [
          { $ref: '#/components/schemas/Comment' },
          { type: 'object', properties: { replyCount: { type: 'integer', description: '이 원댓글에 달린 답글 수' } } },
        ],
      },
      CommentPage: {
        type: 'object',
        properties: {
          items: { type: 'array', items: { $ref: '#/components/schemas/RootComment' } },
          hasNext: { type: 'boolean' },
          nextCursor: { type: ['string', 'null'], description: '다음 요청에 cursor 로 그대로 보낼 값 — 끝이면 null' },
        },
      },
      Profile: {
        type: 'object',
        properties: {
          id: { type: 'integer' },
          username: { type: 'string' },
          name: { type: ['string', 'null'], description: '이름 - 적지 않은 사람은 null' },
          profileImage: { type: ['string', 'null'], description: '프로필 사진 주소 - 없으면 null' },
          postCount: { type: 'integer', description: '그 사람이 올린 게시물 수' },
          followerCount: { type: 'integer', description: '그 사람을 팔로우하는 사람 수' },
          followingCount: { type: 'integer', description: '그 사람이 팔로우하는 사람 수' },
          isFollowing: { type: 'boolean', description: '요청한 사람이 그 사람을 팔로우하고 있는가 - 내 프로필이면 false' },
        },
      },
      FollowStatus: {
        type: 'object',
        properties: {
          following: { type: 'boolean', description: '요청한 사람이 이제 그 사람을 팔로우하고 있는가' },
          followerCount: { type: 'integer', description: '그 사람의 팔로워 수' },
        },
      },
      FollowPerson: {
        type: 'object',
        properties: {
          id: { type: 'integer' },
          username: { type: 'string' },
          name: { type: ['string', 'null'] },
          profileImage: { type: ['string', 'null'] },
          isFollowing: { type: 'boolean', description: '요청한 사람이 이 사람을 팔로우하고 있는가' },
        },
      },
      FollowPage: {
        type: 'object',
        properties: {
          items: { type: 'array', items: ref('FollowPerson') },
          hasNext: { type: 'boolean' },
          nextCursor: { type: ['string', 'null'], description: '다음 요청에 cursor 로 그대로 보낼 값 - 끝이면 null' },
        },
      },
      ConversationPerson: {
        type: 'object',
        properties: {
          id: { type: 'integer' },
          username: { type: 'string' },
          name: { type: ['string', 'null'] },
          profileImage: { type: ['string', 'null'] },
        },
      },
      Conversation: {
        type: 'object',
        properties: {
          id: { type: 'integer' },
          createdAt: { type: 'string', format: 'date-time' },
          lastMessageAt: { type: 'string', format: 'date-time', description: '가장 최근 메시지를 보낸 시각 - 목록은 이 시각이 늦은 방부터 준다. 메시지가 없으면 만든 시각' },
          otherUser: ref('ConversationPerson'),
          lastMessage: { oneOf: [ref('LastMessage'), { type: 'null' }], description: '가장 최근 메시지 - 메시지가 없으면 null' },
          unreadCount: { type: 'integer', description: '내가 안 읽은 메시지 수 - 상대가 보냈고 아직 안 읽었고 내가 지운 시각 뒤에 온 것' },
        },
      },
      UnreadConversations: {
        type: 'object',
        properties: {
          conversationCount: { type: 'integer', description: '안 읽은 메시지가 있는 내 대화방 수' },
        },
      },
      LastMessage: {
        type: 'object',
        properties: {
          id: { type: 'integer' },
          senderId: { type: 'integer' },
          content: { type: 'string' },
          createdAt: { type: 'string', format: 'date-time' },
        },
      },
      ConversationPage: {
        type: 'object',
        properties: {
          items: { type: 'array', items: ref('Conversation') },
          hasNext: { type: 'boolean' },
          nextCursor: { type: ['string', 'null'], description: '다음 요청에 cursor 로 그대로 보낼 값 - 끝이면 null' },
        },
      },
      Message: {
        type: 'object',
        properties: {
          id: { type: 'integer' },
          senderId: { type: 'integer' },
          content: { type: 'string', maxLength: 1000 },
          createdAt: { type: 'string', format: 'date-time' },
          isRead: { type: 'boolean', description: '받는 사람이 읽었는가' },
        },
      },
      MessagePage: {
        type: 'object',
        properties: {
          items: { type: 'array', items: ref('Message') },
          hasNext: { type: 'boolean' },
          nextCursor: { type: ['string', 'null'], description: '더 오래된 메시지를 받을 때 cursor 로 그대로 보낼 값 - 끝이면 null' },
        },
      },
      Notification: {
        type: 'object',
        properties: {
          id: { type: 'integer' },
          type: { type: 'string', enum: ['LIKE', 'COMMENT', 'FOLLOW', 'MENTION'] },
          isRead: { type: 'boolean' },
          createdAt: { type: 'string', format: 'date-time' },
          postId: { type: ['integer', 'null'], description: '어느 게시물의 일인가 - 팔로우 알림은 null' },
          sender: {
            type: 'object',
            description: '알림을 남긴 사람',
            properties: { id: { type: 'integer' }, username: { type: 'string' }, profileImage: { type: ['string', 'null'] } },
          },
          thumbnailUrl: { type: ['string', 'null'], description: '그 게시물의 첫 사진 - 팔로우 알림은 null' },
          message: { type: 'string', description: '패널에 보일 문장 - 예 «seoyeon님이 회원님의 게시물을 좋아해요»' },
        },
      },
      UnseenNotifications: {
        type: 'object',
        properties: {
          unseenCount: { type: 'integer', description: '알림 패널을 마지막으로 연 뒤에 온 알림 수' },
        },
      },
      NotificationRead: {
        type: 'object',
        properties: { id: { type: 'integer' }, isRead: { type: 'boolean', description: '언제나 true' } },
      },
      NotificationPage: {
        type: 'object',
        properties: {
          items: { type: 'array', items: ref('Notification') },
          hasNext: { type: 'boolean' },
          nextCursor: { type: ['string', 'null'], description: '다음 페이지를 받을 때 cursor 로 그대로 보낼 값 - 끝이면 null' },
        },
      },
      ReadResult: {
        type: 'object',
        properties: {
          readCount: { type: 'integer', description: '이번에 읽음으로 바뀐 메시지 수' },
        },
      },
      Member: {
        type: 'object',
        properties: {
          id: { type: 'integer' },
          username: { type: 'string' },
          name: { type: ['string', 'null'] },
          profileImage: { type: ['string', 'null'] },
        },
      },
      GridItem: {
        type: 'object',
        properties: {
          id: { type: 'integer' },
          thumbnailUrl: { type: 'string', description: '첫 사진의 주소' },
          multipleImages: { type: 'boolean', description: '사진이 두 장 이상인가' },
          likeCount: { type: 'integer' },
          commentCount: { type: 'integer' },
        },
      },
      GridPage: {
        type: 'object',
        properties: {
          items: { type: 'array', items: { $ref: '#/components/schemas/GridItem' } },
          hasNext: { type: 'boolean' },
          nextCursor: { type: ['string', 'null'], description: '다음 요청에 cursor 로 그대로 보낼 값 — 끝이면 null' },
        },
      },
      ReplyPage: {
        type: 'object',
        properties: {
          items: { type: 'array', items: { $ref: '#/components/schemas/Comment' } },
          hasNext: { type: 'boolean' },
          nextCursor: { type: ['string', 'null'], description: '다음 요청에 cursor 로 그대로 보낼 값 - 끝이면 null' },
        },
      },
      CommentChange: {
        type: 'object',
        properties: {
          comment: { $ref: '#/components/schemas/Comment', description: '원댓글을 달면 replyCount: 0 이 함께 온다' },
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
