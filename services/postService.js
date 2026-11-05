// ~/instagram-api/services/postService.js
import { prisma } from '../db.js';
import { BadRequestError, NotFoundError } from '../errors.js';

// 저장하는 모양과 내보내는 모양은 다르다.
// 표는 글쓴이를 번호로, 사진을 딴 표의 줄로 갖고 있지만,
// 화면이 기다리는 것은 이름 한 줄과 사진 주소 목록이다.
function flatten({ author, images, _count, ...post }) {
  return {
    ...post,
    username: author.username,
    profileImage: author.profileImage,
    imageUrls: images.map((image) => image.imageUrl),
    // 보는 사람이 누른 좋아요를 셌을 때만 그 수로 정한다. 세지 않았으면 «안 눌렀다».
    liked: _count !== undefined && _count.likes > 0,
  };
}

// 쓸 칸만 골라서 받는다 — 안 쓰는 칸은 아예 안 실어 온다.
// 사진은 언제나 차례대로 읽는다 — 캐러셀이 넘기는 순서가 이 차례다.
const postFields = {
  id: true,
  authorId: true,
  postAlt: true,
  content: true,
  likeCount: true,
  commentCount: true,
  createdAt: true,
  updatedAt: true,
  author: { select: { username: true, profileImage: true } },
  images: { select: { imageUrl: true }, orderBy: { imgOrder: 'asc' } },
};

export async function getPosts({ username, userId, limit = 5, cursor }) {
  // 누가 보는지 알 때만 그 사람이 누른 좋아요를 센다.
  // userId 가 undefined 면 `where` 가 «조건 없음» 이 되어 누가 누른 좋아요든 다 센다.
  const fields = userId
    ? { ...postFields, _count: { select: { likes: { where: { userId } } } } }
    : postFields;

  // 하나 더 달라고 한다 — 더 있는지 없는지를 «세지 않고» 알아내는 방법이다.
  const posts = await prisma.post.findMany({
    where: { author: { username } },
    select: fields,
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    take: limit + 1, // 커서가 오면 «그 게시물 다음» 부터다. 커서가 가리키는 줄 자신은 건너뛴다.
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
  });

  const hasNext = posts.length > limit;

  return { items: posts.slice(0, limit).map(flatten), hasNext };
}

export async function getPost(id) {
  const post = await prisma.post.findUnique({
    where: { id },
    select: postFields,
  });

  if (!post) throw new NotFoundError('그런 게시물은 없어요');

  return flatten(post);
}

export async function createPost({ imageUrls, ...data }) {
  try {
    // 게시물과 사진을 `create` 한 번으로 만든다.
    // 사진이 없는 게시물이 잠깐이라도 남는 일이 아예 안 생긴다.
    const post = await prisma.post.create({
      data: {
        ...data,
        images: {
          create: imageUrls.map((imageUrl, order) => ({ imageUrl, imgOrder: order + 1 })),
        },
      },
      select: postFields,
    });

    return flatten(post);
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
      select: postFields,
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
      select: postFields,
    });

    return flatten(post);
  } catch (error) {
    if (error.code === 'P2025') throw new NotFoundError('그런 게시물은 없어요');
    throw error;
  }
}
