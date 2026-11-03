// ~/instagram-api/lab/homework3.js
import mongoose from 'mongoose';
import Post from '../models/Post.js';
import { posts } from '../data/posts.js';

const MONGO_URL = 'mongodb+srv://<사용자이름>:<비밀번호>@cluster0.xxxxx.mongodb.net/instagram';

const force = process.argv.includes('--force');

await mongoose.connect(MONGO_URL);

const already = await Post.countDocuments();

if (already > 0 && !force) {
  console.log(`이미 게시물 ${already}개가 들어 있어서 아무것도 안 했어요.`);
  console.log('그래도 비우고 다시 넣으려면 뒤에 --force를 붙이세요.');
} else {
  await Post.deleteMany({});
  await Post.insertMany(posts);
  console.log(`게시물 ${posts.length}개를 넣었어요.`);
}

await mongoose.disconnect();
