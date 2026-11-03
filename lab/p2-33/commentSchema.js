// ~/instagram-api/lab/commentSchema.js
import { z } from 'zod';

export const commentCreateSchema = z.object({
  postId: z.number().int().positive(),
  authorId: z.number().int().positive(),
  content: z.string().min(1),
});
