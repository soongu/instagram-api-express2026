// ~/instagram-api/seed.js
import { prisma } from './db.js';
import { posts } from './data/posts.js';
import { comments } from './data/comments.js';

function withTimes({ minutesAgo, ...row }) {
  const createdAt = new Date(Date.now() - minutesAgo * 60 * 1000);
  return { ...row, createdAt, updatedAt: createdAt };
}

// 표를 하나 만들 때마다 이 목록에 넣어야 한다.
// 빠뜨리면 「외래 키가 걸린 표는 못 비운다」며 막힌다.
await prisma.$executeRaw`
  TRUNCATE TABLE post_likes, post_images, comments, posts, users RESTART IDENTITY`;

// 사람을 먼저 넣는다 — 게시물과 댓글이 가리킬 대상이라서.
// 게시물은 안 쓰고 댓글만 쓴 사람도 있으니 세 목록을 함께 훑는다(답글까지).
const replies = comments.flatMap((comment) => comment.replies ?? []);
const names = [];

for (const row of [...posts, ...comments, ...replies]) {
  if (!names.includes(row.username)) names.push(row.username);
}

names.sort();

await prisma.user.createMany({
  data: names.map((username) => ({
    username,
    profileImage: posts.find((post) => post.username === username)?.profileImage ?? null,
  })),
});

const users = await prisma.user.findMany();
const idOf = (username) => users.find((user) => user.username === username).id;

// 게시물과 그 사진을 «한 번에» 만든다.
// 번호를 나중에 다시 읽어서 채워 넣을 일이 없다.
for (const { username, profileImage, images, ...post } of posts) {
  await prisma.post.create({
    data: {
      ...withTimes(post),
      authorId: idOf(username),
      images: {
        create: images.map((imageUrl, order) => ({ imageUrl, imgOrder: order + 1 })),
      },
    },
  });
}

await prisma.comment.createMany({
  data: comments.map(({ username, replies, ...comment }) => ({
    ...withTimes(comment),
    authorId: idOf(username),
  })),
});

// 답글도 같은 comments 표에 들어간다. 다만 가리킬 원댓글이 먼저 있어야 하니 한 박자 뒤다.
// 여기는 일부러 두 박자로 둔다 — 중첩해서 적으면 답글이 원댓글 바로 뒤에 들어가
// 댓글 번호가 통째로 밀린다. 지금 번호를 그대로 두려고 이 차례를 지킨다.
const createdComments = await prisma.comment.findMany({ orderBy: { id: 'asc' } });

await prisma.comment.createMany({
  data: createdComments.flatMap((comment, index) =>
    (comments[index].replies ?? []).map(({ username, ...reply }) => ({
      ...withTimes(reply),
      postId: comment.postId,
      authorId: idOf(username),
      parentId: comment.id,
    }))),
});

const imageCount = posts.reduce((sum, post) => sum + post.images.length, 0);

console.log(
  `사람 ${names.length}명, 게시물 ${posts.length}개, 사진 ${imageCount}장, `
  + `댓글 ${comments.length}개, 답글 ${replies.length}개를 넣었어요.`);

await prisma.$disconnect();
