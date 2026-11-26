// ~/instagram-api/schemas/devSchema.js
import { z } from 'zod';

// 개발용 연결 끊기 - 몇 초 동안 다시 붙지 못하게 할지. 없으면 10초 · 0 이면 막지 않는다 · 많아야 60초다.
export const connectionDropQuerySchema = z.object({
  seconds: z.coerce.number().int().min(0).max(60).optional().describe('다시 붙지 못하게 할 초 - 없으면 10'),
});
