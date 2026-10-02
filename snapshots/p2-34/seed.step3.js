// ~/instagram-api/seed.js
import { prisma } from './db.js';
import { posts } from './data/posts.js';
import { comments } from './data/comments.js';

// 표를 하나 만들 때마다 이 목록에 넣어야 한다.
// 빠뜨리면 「외래 키가 걸린 표는 못 비운다」며 막힌다.
await prisma.$executeRaw`
  TRUNCATE TABLE post_images, comments, posts, users RESTART IDENTITY`;

// 사람을 먼저 넣는다 — 게시물과 댓글이 가리킬 대상이라서.
// 게시물은 안 쓰고 댓글만 쓴 사람도 있으니 두 목록을 함께 훑는다.
const names = [];

for (const row of [...posts, ...comments]) {
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

await prisma.post.createMany({
  data: posts.map(({ username, profileImage, images, ...post }) => ({
    ...post,
    authorId: idOf(username),
    createdAt: new Date(Date.now() - post.minutesAgo * 60 * 1000),
  })),
});

// 사진은 이제 게시물의 칸이 아니라 따로 선 표라, 게시물을 넣은 «뒤에» 번호를 보고 넣는다.
// 넣은 차례대로 번호가 매겨지니 목록 순서가 그대로 게시물 순서다.
const createdPosts = await prisma.post.findMany({ orderBy: { id: 'asc' } });

await prisma.postImage.createMany({
  data: createdPosts.flatMap((post, index) =>
    posts[index].images.map((imageUrl, order) => ({
      postId: post.id,
      imageUrl,
      imgOrder: order + 1,
    }))),
});

await prisma.comment.createMany({
  data: comments.map(({ username, replies, ...comment }) => ({
    ...comment,
    authorId: idOf(username),
  })),
});

const imageCount = posts.reduce((sum, post) => sum + post.images.length, 0);

console.log(
  `사람 ${names.length}명, 게시물 ${posts.length}개, 사진 ${imageCount}장, `
  + `댓글 ${comments.length}개를 넣었어요.`);

await prisma.$disconnect();
