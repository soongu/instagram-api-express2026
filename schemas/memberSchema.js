// ~/instagram-api/schemas/memberSchema.js
import { z } from 'zod';

// 사람 찾기 주소의 쿼리 문자열 - 검색어는 없어도 된다(없으면 빈 배열).
export const memberSearchQuerySchema = z.object({
  keyword: z.string().max(50).optional().describe('사용자 이름에 들어 있는 글자'),
});
