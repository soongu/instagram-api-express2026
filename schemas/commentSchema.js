// ~/instagram-api/schemas/commentSchema.js
import { z } from 'zod';

// 댓글 목록 주소의 쿼리 문자열 — 게시물 목록과 같은 규칙이다.
// 주소에서 오는 값은 전부 문자열이라 숫자로 바꿔서 검사한다.
export const commentListQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(50).optional().describe('한 페이지의 댓글 수 — 없으면 20'),
  cursor: z.string().min(1).optional().describe('앞 응답의 nextCursor 그대로'),
});
