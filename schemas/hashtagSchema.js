// ~/instagram-api/schemas/hashtagSchema.js
import { z } from 'zod';

// 해시태그 게시물 목록 주소의 쿼리 문자열 - 게시물 목록과 같은 규칙이고 한 페이지의 기본 수만 다르다.
// 그리드가 한 줄에 셋이라 기본값은 셋의 배수인 12 다.
export const hashtagPostsQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(50).optional().describe('한 페이지의 게시물 수 - 없으면 12'),
  cursor: z.string().min(1).optional().describe('앞 응답의 nextCursor 그대로'),
});
