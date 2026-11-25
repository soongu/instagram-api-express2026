// ~/instagram-api/schemas/memberSchema.js
import { z } from 'zod';

// 사람 찾기 주소의 쿼리 문자열 - 검색어는 없어도 된다(없으면 빈 배열).
export const memberSearchQuerySchema = z.object({
  keyword: z.string().max(50).optional().describe('사용자 이름에 들어 있는 글자'),
});

// 프로필 사진 바꾸기의 본문 - 사진은 먼저 올리고, 받은 주소(/uploads/…)를 보낸다.
export const profileImageSchema = z.object({
  imageUrl: z.string().startsWith('/uploads/').describe('사진 올리기 응답의 imageUrls 에 든 주소 하나'),
});
