// ~/instagram-api/lab/homework2.js
import { prisma } from '../db.js';
import * as postService from '../services/postService.js';

const created = await postService.createPost({
  username: 'yuna',
  postImage: '/images/post-9.jpg',
  content: '서버 없이 만들었어요',
});

console.log(`${created.id}번 게시물을 만들었어요.`);

const posts = await postService.getPosts({ limit: 3 });

for (const post of posts) {
  console.log(`${post.id} ${post.username} ${post.content}`);
}

await postService.removePost(created.id);
console.log(`${created.id}번 게시물을 다시 지웠어요.`);

await prisma.$disconnect();
