// ~/instagram-api/lab/practice1.js
import mongoose from 'mongoose';

const MONGO_URL = 'mongodb+srv://<사용자이름>:<비밀번호>@cluster0.xxxxx.mongodb.net/instagram';

const 시작 = Date.now();

try {
  await mongoose.connect(MONGO_URL, { serverSelectionTimeoutMS: 3000 });
  console.log(`연결됐어요. ${Date.now() - 시작}ms 걸렸어요.`);
  await mongoose.disconnect();
} catch (error) {
  console.log(`${Date.now() - 시작}ms 만에 실패했어요.`);
  console.log(`이름: ${error.name}`);
  console.log(`내용: ${error.message}`);
}
