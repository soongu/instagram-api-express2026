// ~/instagram-api/schemas/conversationSchema.js
import { z } from 'zod';

// 대화방 만들기 - 누구와의 대화방인지 사용자 이름으로 받는다. 나는 로그인 정보로 정한다.
export const conversationCreateSchema = z.object({
  username: z.string().min(1),
});
