// ~/instagram-api/lab/practice2.js
import mongoose from 'mongoose';
import Story from './Story.js';

const MONGO_URL = 'mongodb+srv://<사용자이름>:<비밀번호>@cluster0.xxxxx.mongodb.net/instagram';

const stories = [
  { username: 'jaehoon' },
  { username: 'minji' },
  { username: 'seungwoo' },
];

await mongoose.connect(MONGO_URL);

await Story.deleteMany({});
await Story.insertMany(stories);

console.log(`스토리 ${stories.length}개를 넣었어요.`);

await mongoose.disconnect();
