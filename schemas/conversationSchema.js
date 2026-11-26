// ~/instagram-api/schemas/conversationSchema.js
import { z } from 'zod';

// 대화방 만들기 - 누구와의 대화방인지 사용자 이름으로 받는다. 나는 로그인 정보로 정한다.
export const conversationCreateSchema = z.object({
  username: z.string().min(1),
});

// 대화방 목록 주소의 쿼리 문자열 - 한 페이지는 limit 개이고, 없으면 20개 · 많아야 50개다.
export const conversationListQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(50).optional().describe('한 페이지의 대화방 수 - 없으면 20'),
  cursor: z.string().min(1).optional().describe('앞 응답의 nextCursor 그대로'),
});

// 메시지 이력 주소의 쿼리 문자열 - 한 번에 limit 개이고, 없으면 20개 · 많아야 50개다.
export const messageListQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(50).optional().describe('한 번에 받을 메시지 수 - 없으면 20'),
  cursor: z.string().min(1).optional().describe('앞 응답의 nextCursor 그대로'),
});

// 메시지 보내기 - 연결로 받는 값이다. 보낸 사람은 받지 않는다(연결이 열릴 때 확인한 사람이다).
// 내용은 앞뒤 공백을 떼고 1~1000자 - 컬럼이 VARCHAR(1000) 이다.
export const messageSendSchema = z.object({
  conversationId: z.number().int().positive(),
  content: z.string().trim().min(1).max(1000),
});

// 입력 중 - 어느 대화방에서 치기 시작했는지(true), 멈췄는지(false)만 받는다.
export const typingSchema = z.object({
  conversationId: z.number().int().positive(),
  typing: z.boolean(),
});
