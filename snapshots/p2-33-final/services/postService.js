// ~/instagram-api/services/postService.js
import { prisma } from '../db.js';
import { BadRequestError, NotFoundError } from '../errors.js';

// 저장하는 모양과 내보내는 모양은 다르다.
// 표는 글쓴이를 번호로 갖고 있지만, 화면이 기다리는 것은 이름과 사진이다.
function withAuthor({ author, ...post }) {
  return { ...post, username: author.username, profileImage: author.profileImage };
}

export async function getPosts({ username, limit }) {
  const posts = await prisma.post.findMany({
    where: { author: { username } },
    include: { author: true },
    orderBy: { createdAt: 'desc' },
    take: limit,
  });

  return posts.map(withAuthor);
}

export async function getPost(id) {
  const post = await prisma.post.findUnique({
    where: { id },
    include: { author: true },
  });

  if (!post) throw new NotFoundError('그런 게시물은 없어요');

  return withAuthor(post);
}

export async function createPost(data) {
  try {
    const post = await prisma.post.create({ data, include: { author: true } });

    return withAuthor(post);
  } catch (error) {
    if (error.code === 'P2003') throw new BadRequestError('그런 사용자는 없어요');
    throw error;
  }
}

export async function updatePost(id, data) {
  try {
    const post = await prisma.post.update({
      where: { id },
      data,
      include: { author: true },
    });

    return withAuthor(post);
  } catch (error) {
    if (error.code === 'P2025') throw new NotFoundError('그런 게시물은 없어요');
    if (error.code === 'P2003') throw new BadRequestError('그런 사용자는 없어요');
    throw error;
  }
}

export async function removePost(id) {
  try {
    const post = await prisma.post.delete({
      where: { id },
      include: { author: true },
    });

    return withAuthor(post);
  } catch (error) {
    if (error.code === 'P2025') throw new NotFoundError('그런 게시물은 없어요');
    throw error;
  }
}
