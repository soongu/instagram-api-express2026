// ~/instagram-api/lab/practice4.js
import mongoose from 'mongoose';
import Book from './Book.js';

const MONGO_URL = 'mongodb+srv://<사용자이름>:<비밀번호>@cluster0.xxxxx.mongodb.net/instagram';

const books = [
  { title: '모던 자바스크립트 입문', author: '이보라', stock: 4 },
  { title: '리액트를 다루는 기술', author: '김민준', stock: 2 },
  { title: '읽기 좋은 코드', author: '더스틴 보즈웰', stock: 7 },
];

await mongoose.connect(MONGO_URL);

await Book.deleteMany({});
await Book.insertMany(books);

console.log(`책 ${books.length}권을 넣었어요.`);

await mongoose.disconnect();
