// ~/instagram-api/services/postService.js
import { prisma } from '../db.js';
import { BadRequestError, NotFoundError } from '../errors.js';

// 저장하는 모양과 내보내는 모양은 다르다.
// 표는 글쓴이를 번호로, 사진을 딴 표의 줄로 갖고 있지만,
// 화면이 기다리는 것은 이름 한 줄과 사진 주소 목록이다.
function flatten({ author, images, ...post }) {
  return {
    ...post,
    username: author.username,
    profileImage: author.profileImage,
    imageUrls: images.map((image) => image.imageUrl),
  };
}

// 사진은 언제나 차례대로 읽는다 — 캐러셀이 넘기는 순서가 이 차례다.
const withRelations = {
  author: true,
  images: { orderBy: { imgOrder: 'asc' } },
};

export async function getPosts({ username, limit }) {
  const posts = await prisma.post.findMany({
    where: { author: { username } },
    include: withRelations,
    orderBy: { createdAt: 'desc' },
    take: limit,
  });

  return posts.map(flatten);
}

export async function getPost(id) {
  const post = await prisma.post.findUnique({
    where: { id },
    include: withRelations,
  });

  if (!post) throw new NotFoundError('그런 게시물은 없어요');

  return flatten(post);
}

export async function createPost({ imageUrls, ...data }) {
  try {
    const post = await prisma.post.create({ data });

    // 사진은 게시물의 칸이 아니라 딴 표의 줄이라, 게시물이 생겨 번호를 받은 «뒤에» 넣는다.
    await prisma.postImage.createMany({
      data: imageUrls.map((imageUrl, order) => ({
        postId: post.id,
        imageUrl,
        imgOrder: order + 1,
      })),
    });

    return getPost(post.id);
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
      include: withRelations,
    });

    return flatten(post);
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
      include: withRelations,
    });

    return flatten(post);
  } catch (error) {
    if (error.code === 'P2025') throw new NotFoundError('그런 게시물은 없어요');
    throw error;
  }
}
