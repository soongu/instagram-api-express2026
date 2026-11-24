// ~/instagram-api/schemas/commentSchema.js
import { z } from 'zod';

// 댓글 목록 주소의 쿼리 문자열 — 게시물 목록과 같은 규칙이다.
// 주소에서 오는 값은 전부 문자열이라 숫자로 바꿔서 검사한다.
export const commentListQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(50).optional().describe('한 페이지의 댓글 수 — 없으면 20'),
  cursor: z.string().min(1).optional().describe('앞 응답의 nextCursor 그대로'),
});

// 답글 목록 주소의 쿼리 문자열이다. 댓글 목록과 같은 규칙이고 한 페이지의 기본 수만 다르다.
export const replyListQuerySchema = commentListQuerySchema.extend({
  limit: z.coerce.number().int().min(1).max(50).optional().describe('한 페이지의 답글 수 — 없으면 3'),
});

// 댓글 달기의 본문은 글 하나만 받는다. 글쓴이와 게시물은 본문이 아니라 로그인 정보와 주소에서 온다.
// 앞뒤 공백을 떼고 검사하므로 공백만 보낸 글은 빈 글과 같이 400 이다.
export const commentCreateSchema = z.object({
  content: z.string().trim().min(1).max(2200).describe('댓글 글 — 앞뒤 공백을 떼고 1~2200자'),
});
