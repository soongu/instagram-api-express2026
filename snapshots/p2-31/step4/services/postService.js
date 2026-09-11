// ~/instagram-api/services/postService.js
import { prisma } from '../db.js';

export function getPosts({ username, limit }) {
  return prisma.post.findMany({
    where: { username },
    orderBy: { createdAt: 'desc' },
    take: limit,
  });
}

export function getPost(id) {
  return prisma.post.findUnique({ where: { id } });
}
