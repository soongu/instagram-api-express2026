// ~/instagram-api/schemas/profileSchema.js
import { z } from 'zod';

// 프로필 그리드 주소의 쿼리 문자열 - 해시태그 게시물 목록과 같은 규칙이다(기본 12).
export const profilePostsQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(50).optional().describe('한 페이지의 게시물 수 - 없으면 12'),
  cursor: z.string().min(1).optional().describe('앞 응답의 nextCursor 그대로'),
});

// 팔로워·팔로잉 목록 주소의 쿼리 문자열 - 한 페이지는 limit 명이고, 없으면 20명 · 많아야 50명이다.
export const followListQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(50).optional().describe('한 페이지의 사람 수 - 없으면 20'),
  cursor: z.string().min(1).optional().describe('앞 응답의 nextCursor 그대로'),
});
