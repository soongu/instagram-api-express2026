// ~/instagram-api/schemas/postSchema.js
import { z } from 'zod';

const postFields = {
  authorId: z.number().int().positive(),
  postImage: z.string().min(1),
  postAlt: z.string().optional(),
  content: z.string().optional(),
};

export const postCreateSchema = z.object(postFields);

export const postUpdateSchema = z
  .object({ ...postFields, likeCount: z.number().int().nonnegative() })
  .partial();
