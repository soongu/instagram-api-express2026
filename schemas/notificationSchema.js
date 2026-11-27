// ~/instagram-api/schemas/notificationSchema.js
import { z } from 'zod';

// 알림 목록 주소의 쿼리 문자열 - 한 페이지는 limit 개이고, 없으면 20개 · 많아야 50개다.
export const notificationListQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(50).optional().describe('한 페이지의 알림 수 - 없으면 20'),
  cursor: z.string().min(1).optional().describe('앞 응답의 nextCursor 그대로'),
});
