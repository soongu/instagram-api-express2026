// ~/instagram-api/schemas/postSchema.js
import { z } from 'zod';

const postFields = {
  authorId: z.number().int().positive(),
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
export const postUpdateSchema = z
  .object({ ...postFields, likeCount: z.number().int().nonnegative() })
  .partial();

// 목록 주소의 쿼리 문자열. 주소에서 오는 값은 전부 문자열이라 숫자로 바꿔서 검사한다.
// 상한이 없으면 주소 한 줄로 테이블 전체를 달라고 할 수 있다.
export const postListQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(50).optional(),
  cursor: z.string().min(1).optional(),
});

// 커서는 우리가 만들어 준 문자열이지만 돌아올 때는 밖에서 오는 값이다 — 푼 값도 검사한다.
export const cursorSchema = z.object({
  createdAt: z.iso.datetime(),
  id: z.int32(),
});
