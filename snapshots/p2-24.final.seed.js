// ~/instagram-api/seed.js
import mongoose from 'mongoose';
import Post from '../models/Post.js';
import { posts } from './p2-22.data-posts.js';

const MONGO_URL = 'mongodb+srv://<사용자이름>:<비밀번호>@cluster0.xxxxx.mongodb.net/instagram';

await mongoose.connect(MONGO_URL);

await Post.deleteMany({});
await Post.insertMany(posts);

console.log(`게시물 ${posts.length}개를 넣었어요.`);

await mongoose.disconnect();
