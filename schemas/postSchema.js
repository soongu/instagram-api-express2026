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

// 좋아요는 「누가」 눌렀는지만 있으면 된다 — 그 「누가」는 로그인을 배우면 토큰에서 온다.
export const likeSchema = z.object({
  userId: z.number().int().positive(),
});
