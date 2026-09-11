// ~/instagram-api/lab/commentSchema.js
import { z } from 'zod';

export const commentCreateSchema = z.object({
  postId: z.number().int().positive(),
  authorId: z.number().int().positive(),
  content: z.string().min(1),
  // 답글일 때만 온다 — 원댓글은 가리킬 원댓글이 없으니 안 보내도 된다.
  parentId: z.number().int().positive().optional(),
});
