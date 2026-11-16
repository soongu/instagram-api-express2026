// ~/instagram-api/services/commentService.js
import { prisma } from '../db.js';

// 댓글은 오래된 것부터 보여 준다 — 시각이 같으면 번호가 작은 것이 먼저다.
export async function getComments(postId) {
  return prisma.comment.findMany({
    where: { postId },
    orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
  });
}
