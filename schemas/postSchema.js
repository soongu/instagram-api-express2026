// ~/instagram-api/schemas/postSchema.js
import { z } from 'zod';

// 글쓴이는 본문으로 받지 않는다 — 로그인한 사람이 글쓴이다.
const postFields = {
  postAlt: z.string().optional(),
  content: z.string().optional(),
};

// 사진은 이제 한 장이 아니라 목록이라, 「글자 하나」가 아니라 「글자의 배열」로 받는다.
// 한 장도 없는 게시물은 만들 수 없으니 최소 한 장을 요구한다.
export const postCreateSchema = z.object({
  ...postFields,
  imageUrls: z.array(z.string().min(1)).min(1),
});

// 사진을 바꿔 끼우는 것은 줄을 지우고 넣는 일이라 고치기와 결이 다르다 — 여기서는 안 받는다.
// 좋아요 수는 좋아요를 누르고 취소할 때만 바뀐다 — 고치기로는 안 받는다.
export const postUpdateSchema = z.object(postFields).partial();

// 목록 주소의 쿼리 문자열. 주소에서 오는 값은 전부 문자열이라 숫자로 바꿔서 검사한다.
// 상한이 없으면 주소 한 줄로 테이블 전체를 달라고 할 수 있다.
export const postListQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(50).optional().describe('한 페이지의 게시물 수 — 없으면 5'),
  cursor: z.string().min(1).optional().describe('앞 응답의 nextCursor 그대로'),
  username: z.string().optional().describe('이 사람이 올린 게시물만'),
});
