// ~/instagram-api/lab/homework2.js
import mongoose from 'mongoose';
import Comment from './Comment.js';

const MONGO_URL = 'mongodb+srv://<사용자이름>:<비밀번호>@cluster0.xxxxx.mongodb.net/instagram';

const comments = [
  { postId: 1, username: 'minji', content: '노을 미쳤다 🌇', likeCount: 12 },
  { postId: 1, username: 'seungwoo', content: '어디예요 여기?', likeCount: 3 },
  { postId: 2, username: 'jaehoon', content: '저 카페 저도 가봤어요', likeCount: 8 },
];

await mongoose.connect(MONGO_URL);

await Comment.deleteMany({});
await Comment.insertMany(comments);

console.log(`댓글 ${comments.length}개를 넣었어요.`);

await mongoose.disconnect();
