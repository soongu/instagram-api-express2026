// ~/instagram-api/schemas/authSchema.js
import { z } from 'zod';

// 아직 비밀번호가 없다 — 이름 하나만 받는다.
export const loginSchema = z.object({
  username: z.string().min(1),
});
