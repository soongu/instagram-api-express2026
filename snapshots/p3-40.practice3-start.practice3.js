// ~/instagram-api/lab/p3-40/practice3.js
import { signupSchema } from '../../schemas/authSchema.js';

// 가입 규칙 가운데 비밀번호 규칙만 꺼낸다.
const passwordRule = signupSchema.shape.password;

const passwords = [
  'a'.repeat(72),
  'a'.repeat(73),
  '가'.repeat(24),
  '가'.repeat(25),
  '😀'.repeat(18),
  '😀'.repeat(19),
  '우리집강아지이름은초코이고고양이는나비예요Summer2026!',
];

for (const password of passwords) {
  const bytes = ____;
  const result = ____;

  console.log(`length ${password.length} · ${bytes}바이트 · ${result}`);
}
