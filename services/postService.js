// ~/instagram-api/services/postService.js
import path from 'node:path';
import { prisma } from '../db.js';
import * as userService from './userService.js';
import * as uploadService from './uploadService.js';
import { BadRequestError, ForbiddenError, NotFoundError } from '../errors.js';
import { cursorSchema } from '../schemas/postSchema.js';

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

// 커서는 «마지막으로 내준 게시물의 시각과 번호» 를 문자열 하나로 인코딩한 것이다.
// 받는 쪽은 뜻을 몰라도 된다 — 받아 두었다가 다음 요청에 그대로 돌려주기만 한다.
function encodeCursor({ createdAt, id }) {
  return Buffer.from(JSON.stringify({ createdAt, id })).toString('base64url');
}

function decodeCursor(cursor) {
  let value;

  // try 는 보낸 값 때문에 실패하는 줄만 감싼다 — 커서가 JSON 이 아니면 JSON.parse 가 던진다.
  // 더 넓게 감싸면 우리 코드의 실수(빠뜨린 import 같은 것)까지 400 으로 바뀌어 숨는다.
  try {
    value = JSON.parse(Buffer.from(cursor, 'base64url').toString());
  } catch {
    throw new BadRequestError('INVALID_CURSOR');
  }

  // 푼 값의 모양은 safeParse 로 검사한다 — 맞지 않아도 던지지 않고 결과로 알려 준다.
  const result = cursorSchema.safeParse(value);

  if (!result.success) throw new BadRequestError('INVALID_CURSOR');

  return result.data;
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

export async function createPost({ imageUrls, ...data }) {
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

      // 내가 올렸고 아직 어느 게시물에도 쓰지 않은 사진의 기록에만 이 게시물을 적는다.
      // 적은 기록 수가 사진 수와 다르면, 남의 사진이나 이미 쓴 사진이 섞여 있다는 뜻이다.
      const { count } = await tx.upload.updateMany({
        where: { fileName: { in: fileNames }, uploaderId: data.authorId, postId: null },
        data: { postId: post.id },
      });
      if (count !== fileNames.length) throw new BadRequestError('IMAGE_NOT_AVAILABLE');

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

  try {
    const post = await prisma.post.update({
      where: { id },
      data,
      select: fieldsFor(userId),
    });

    return flatten(post);
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
