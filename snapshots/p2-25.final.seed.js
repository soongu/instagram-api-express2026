// ~/instagram-api/seed.js
import mongoose from 'mongoose';
import Post from '../models/Post.js';
import { posts } from './p2-22.data-posts.js';

await mongoose.connect(process.env.MONGO_URL);

await Post.deleteMany({});
await Post.insertMany(posts);

console.log(`게시물 ${posts.length}개를 넣었어요.`);

await mongoose.disconnect();
