// ~/instagram-api/services/postService.js
import path from 'node:path';
import { prisma } from '../db.js';
import * as userService from './userService.js';
import * as uploadService from './uploadService.js';
import { BadRequestError, ForbiddenError, NotFoundError } from '../errors.js';
import { encodeCursor, decodeCursor } from '../utils/cursor.js';
import { extractHashtags, normalizeHashtag } from '../utils/hashtags.js';

// 저장하는 모양과 내보내는 모양은 다르다.
// 테이블은 글쓴이를 번호로, 사진을 딴 테이블의 행으로 갖고 있지만,
// 화면에 필요한 것은 이름 한 줄과 사진 주소 목록이다.
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

// 쓸 필드만 골라서 받는다 — 안 쓰는 필드는 아예 안 실어 온다.
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

// 보는 사람이 누른 좋아요를 센다 — 목록 · 상세 · 고치기 응답이 같은 기준이다.
// 누가 보는지 알 때만 센다. userId 가 undefined 면 `where` 가 «조건 없음» 이 되어 누가 누른 좋아요든 다 센다.
function fieldsFor(userId) {
  return userId
    ? { ...postFields, _count: { select: { likes: { where: { userId } } } } }
    : postFields;
}

// 목록은 «시각이 늦은 순, 같으면 번호가 큰 순» 이다. 그러니 커서 다음 행은
// 시각이 더 이르거나, 시각이 같고 번호가 더 작은 행이다.
// `lte` 가 인덱스에서 시작 위치를 찾고, OR 는 시각이 같은 행에서 커서 앞의 행을 걸러 낸다.
function afterCursor({ createdAt, id }) {
  return {
    createdAt: { lte: createdAt },
    OR: [{ createdAt: { lt: createdAt } }, { id: { lt: id } }],
  };
}

export async function getPosts({ username, userId, limit = 5, cursor }) {
  // 하나 더 달라고 한다 — 더 있는지 없는지를 «세지 않고» 알아내는 방법이다.
  const posts = await prisma.post.findMany({
    where: {
      author: { username },
      // 커서가 오면 «그 게시물 다음»부터다. 커서의 값만 쓰므로 그 게시물이 지워졌어도 이어진다.
      ...(cursor ? afterCursor(decodeCursor(cursor)) : {}),
    },
    select: fieldsFor(userId),
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    take: limit + 1,
  });

  const hasNext = posts.length > limit;
  const page = posts.slice(0, limit);

  return {
    items: page.map(flatten),
    hasNext,
    // 다음 페이지가 있을 때만 커서를 만든다 — 마지막 페이지의 null 은 «여기가 끝» 이라는 뜻이다.
    nextCursor: hasNext ? encodeCursor(page[page.length - 1]) : null,
  };
}

// 그리드의 칸 하나에 필요한 것만 받는다 - 첫 사진과 «사진이 여러 장인가», 숫자 둘.
// 사진은 두 장까지만 받는다 - 두 장이 오면 여러 장이다. 커서를 만들려고 시각도 받는다.
const gridFields = {
  id: true,
  likeCount: true,
  commentCount: true,
  createdAt: true,
  images: { select: { imageUrl: true }, orderBy: { imgOrder: 'asc' }, take: 2 },
};

function toGridItem({ id, likeCount, commentCount, images }) {
  return {
    id,
    thumbnailUrl: images[0].imageUrl,
    multipleImages: images.length > 1,
    likeCount,
    commentCount,
  };
}

// 해시태그 하나가 붙은 게시물을 피드와 같은 차례로 나눠 준다.
// 그런 이름의 태그가 없으면 404 다. 태그는 있는데 붙은 게시물이 없으면 빈 목록이다.
export async function getHashtagPosts(name, { limit = 12, cursor }) {
  const hashtag = await prisma.hashtag.findUnique({
    where: { name: normalizeHashtag(name) },
    select: { id: true },
  });

  if (!hashtag) throw new NotFoundError('HASHTAG_NOT_FOUND');

  const posts = await prisma.post.findMany({
    where: {
      // 이 태그와의 짝이 하나라도 있는 게시물만.
      hashtags: { some: { hashtagId: hashtag.id } },
      ...(cursor ? afterCursor(decodeCursor(cursor)) : {}),
    },
    select: gridFields,
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    take: limit + 1,
  });

  const hasNext = posts.length > limit;
  const page = posts.slice(0, limit);

  return {
    items: page.map(toGridItem),
    hasNext,
    nextCursor: hasNext ? encodeCursor(page[page.length - 1]) : null,
  };
}

// 한 사람이 올린 게시물을 피드와 같은 차례로 나눠 준다 - 해시태그 목록과 같은 그리드 줄이다.
// 그런 사람이 없으면 404 다. 있는데 올린 게시물이 없으면 빈 목록이다.
export async function getUserPosts(username, { limit = 12, cursor }) {
  const user = await prisma.user.findUnique({ where: { username }, select: { id: true } });

  if (!user) throw new NotFoundError('USER_NOT_FOUND');

  const posts = await prisma.post.findMany({
    where: {
      authorId: user.id,
      ...(cursor ? afterCursor(decodeCursor(cursor)) : {}),
    },
    select: gridFields,
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    take: limit + 1,
  });

  const hasNext = posts.length > limit;
  const page = posts.slice(0, limit);

  return {
    items: page.map(toGridItem),
    hasNext,
    nextCursor: hasNext ? encodeCursor(page[page.length - 1]) : null,
  };
}

// 옛 화면이 커서로 보내던 게시물 번호를 지금 커서로 바꾼다. 그 게시물이 없으면 null.
export async function cursorOf(id) {
  const post = await prisma.post.findUnique({
    where: { id },
    select: { createdAt: true, id: true },
  });

  return post === null ? null : encodeCursor(post);
}

export async function getPost(id, userId) {
  const post = await prisma.post.findUnique({
    where: { id },
    select: fieldsFor(userId),
  });

  if (!post) throw new NotFoundError('POST_NOT_FOUND');

  return flatten(post);
}

// 게시물에 해시태그를 붙인다 — 처음 보는 이름이면 태그를 만들고, 있으면 그 태그를 쓴다.
// 어느 쪽이든 그 태그가 붙은 게시물 수를 1 올리고, 게시물과 태그의 짝을 하나 넣는다.
// 트랜잭션 안에서 부르는 함수라 prisma 가 아니라 넘겨받은 tx 로 쓴다.
async function addHashtags(tx, postId, names) {
  for (const name of names) {
    const hashtag = await tx.hashtag.upsert({
      where: { name },
      create: { name, postCount: 1 },
      update: { postCount: { increment: 1 } },
      select: { id: true },
    });
    await tx.postHashtag.create({ data: { postId, hashtagId: hashtag.id } });
  }
}

// 게시물에서 해시태그를 뗀다 — 짝을 지우고 그 태그가 붙은 게시물 수를 1 내린다.
async function removeHashtags(tx, postId, hashtagIds) {
  if (hashtagIds.length === 0) return;

  await tx.postHashtag.deleteMany({ where: { postId, hashtagId: { in: hashtagIds } } });
  await tx.hashtag.updateMany({
    where: { id: { in: hashtagIds } },
    data: { postCount: { decrement: 1 } },
  });
}

// 고친 글의 해시태그에 맞춘다 — 빠진 태그는 떼고, 새로 생긴 태그는 붙인다. 그대로인 태그는 건드리지 않는다.
async function syncHashtags(tx, postId, names) {
  const links = await tx.postHashtag.findMany({
    where: { postId },
    select: { hashtag: { select: { id: true, name: true } } },
  });
  const before = links.map((link) => link.hashtag);

  const removed = before.filter((hashtag) => !names.includes(hashtag.name));
  const added = names.filter((name) => !before.some((hashtag) => hashtag.name === name));

  await removeHashtags(tx, postId, removed.map((hashtag) => hashtag.id));
  await addHashtags(tx, postId, added);
}

export async function createPost({ imageUrls, ...data }) {
  // 해시태그는 아무것도 쓰기 전에 뽑는다 — 규칙에 안 맞으면 여기서 400 이 나고 게시물도 안 생긴다.
  const names = extractHashtags(data.content);

  // 우리 서버에 올린 사진(/uploads/…)만 기록에서 찾는다. 바깥 주소(https://…)는 우리 파일이 아니라 그대로 넣는다.
  const fileNames = imageUrls
    .filter((imageUrl) => imageUrl.startsWith('/uploads/'))
    .map((imageUrl) => path.basename(imageUrl));

  try {
    // 게시물 만들기와, 사진 기록에 그 게시물을 적는 일을 한 트랜잭션으로 묶는다 — 사진을 못 넣으면 게시물 만들기도 없던 일이 된다.
    return await prisma.$transaction(async (tx) => {
      // 게시물과 사진을 `create` 한 번으로 만든다.
      // 사진이 없는 게시물이 잠깐이라도 남는 일이 아예 안 생긴다.
      const post = await tx.post.create({
        data: {
          ...data,
          images: {
            create: imageUrls.map((imageUrl, order) => ({ imageUrl, imgOrder: order + 1 })),
          },
        },
        select: postFields,
      });

      // 내가 올렸고 아직 게시물에도 프로필에도 쓰지 않은 사진의 기록에만 이 게시물을 적는다.
      // 적은 기록 수가 사진 수와 다르면, 남의 사진이나 이미 쓴 사진이 섞여 있다는 뜻이다.
      const { count } = await tx.upload.updateMany({
        where: { fileName: { in: fileNames }, uploaderId: data.authorId, postId: null, profileUserId: null },
        data: { postId: post.id },
      });
      if (count !== fileNames.length) throw new BadRequestError('IMAGE_NOT_AVAILABLE');

      // 게시물이 만들어진 같은 트랜잭션에서 해시태그를 붙인다 — 태그를 못 붙이면 게시물도 없던 일이 된다.
      await addHashtags(tx, post.id, names);

      return flatten(post);
    });
  } catch (error) {
    if (error.code === 'P2003') throw new BadRequestError('USER_NOT_FOUND');
    throw error;
  }
}

// 쓴 사람만 고치고 지울 수 있다 — 게시물이 없으면 404, 있는데 쓴 사람이 아니면 403.
async function checkAuthor(id, userId) {
  const post = await prisma.post.findUnique({ where: { id }, select: { authorId: true } });

  if (!post) throw new NotFoundError('POST_NOT_FOUND');
  if (post.authorId !== userId) throw new ForbiddenError('NOT_POST_AUTHOR');
}

export async function updatePost(id, userId, data) {
  await checkAuthor(id, userId);

  // 글을 고칠 때만 해시태그를 다시 뽑는다 — 사진 설명만 고치면 태그는 그대로다.
  const names = data.content === undefined ? undefined : extractHashtags(data.content);

  try {
    // 글을 고치는 일과 해시태그를 맞추는 일을 한 트랜잭션으로 묶는다.
    return await prisma.$transaction(async (tx) => {
      const post = await tx.post.update({
        where: { id },
        data,
        select: fieldsFor(userId),
      });

      if (names !== undefined) await syncHashtags(tx, id, names);

      return flatten(post);
    });
  } catch (error) {
    if (error.code === 'P2025') throw new NotFoundError('POST_NOT_FOUND');
    throw error;
  }
}

export async function removePost(id, userId, role) {
  // 관리자는 남의 게시물도 지울 수 있다 — 신고된 게시물을 내리는 일이라, 고치기는 열지 않고 지우기에만 연다.
  // 토큰이 관리자라고 하면 데이터베이스에서 지금 역할을 한 번 더 본다.
  const admin = role === 'ADMIN' && (await userService.isAdmin(userId));
  if (!admin) await checkAuthor(id, userId);

  let post;
  let fileNames;
  try {
    // 게시물을 지우면 그 게시물에 쓴 사진의 기록도 함께 지워진다(onDelete: Cascade) — 지우기 전에 파일 이름을 읽어 둔다.
    [fileNames, post] = await prisma.$transaction(async (tx) => {
      const uploads = await tx.upload.findMany({ where: { postId: id }, select: { fileName: true } });
      // 짝은 게시물과 함께 지워지지만(onDelete: Cascade) 태그의 게시물 수는 우리가 내려야 한다.
      const links = await tx.postHashtag.findMany({ where: { postId: id }, select: { hashtagId: true } });
      await removeHashtags(tx, id, links.map((link) => link.hashtagId));
      const deleted = await tx.post.delete({ where: { id }, select: postFields });
      return [uploads.map((upload) => upload.fileName), deleted];
    });
  } catch (error) {
    if (error.code === 'P2025') throw new NotFoundError('POST_NOT_FOUND');
    throw error;
  }

  // 테이블에서 먼저 지우고, 파일은 그다음에 지운다 — 이 게시물에 쓴 기록이 있던 파일만 지운다.
  await uploadService.removeFiles(fileNames);

  return flatten(post);
}
