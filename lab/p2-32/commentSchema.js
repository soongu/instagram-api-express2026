// ~/instagram-api/lab/commentSchema.js
import { z } from 'zod';

export const commentCreateSchema = z.object({
  postId: z.number().int().positive(),
  username: z.string().min(1).max(50),
  content: z.string().min(1),
});
