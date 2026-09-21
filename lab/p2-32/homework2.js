// ~/instagram-api/lab/homework2.js
import { prisma } from '../db.js';
import { commentCreateSchema } from './commentSchema.js';
import * as commentService from './commentService.js';

const result = commentCreateSchema.safeParse({
  postId: 1, username: 'yuna', content: '서버 없이 만든 댓글이에요',
});

if (!result.success) {
  console.log('검증에 실패했어요.');
} else {
  const created = await commentService.createComment(result.data);
  console.log(`${created.id}번 댓글을 만들었어요.`);
  await commentService.removeComment(created.id);
  console.log(`${created.id}번 댓글을 다시 지웠어요.`);
}

const bad = commentCreateSchema.safeParse({ postId: 1, username: '', content: '' });
console.log('일부러 틀린 입력은', bad.success ? '통과했어요' : '막혔어요');

await prisma.$disconnect();
