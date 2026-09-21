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

export function createPost(data) {
  return prisma.post.create({ data });
}

export function updatePost(id, data) {
  return prisma.post.update({ where: { id }, data });
}

export function removePost(id) {
  return prisma.post.delete({ where: { id } });
}
