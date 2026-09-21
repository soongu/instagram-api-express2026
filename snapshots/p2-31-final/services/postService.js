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

export async function updatePost(id, data) {
  try {
    return await prisma.post.update({ where: { id }, data });
  } catch (error) {
    if (error.code === 'P2025') return null;
    throw error;
  }
}

export async function removePost(id) {
  try {
    return await prisma.post.delete({ where: { id } });
  } catch (error) {
    if (error.code === 'P2025') return null;
    throw error;
  }
}
