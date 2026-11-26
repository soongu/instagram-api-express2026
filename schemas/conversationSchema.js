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
