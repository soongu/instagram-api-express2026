// ~/instagram-api/schemas/adminSchema.js
import { z } from 'zod';
import { Role } from '@prisma/client';

// 역할 바꾸기는 역할 하나만 받는다 — schema.prisma 의 enum Role 에 있는 값이어야 한다.
export const roleSchema = z.object({
  role: z.enum(Role),
});
