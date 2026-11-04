// ~/instagram-api/lab/p3-20/expire.js
import jwt from 'jsonwebtoken';

const SECRET = 'my-lab-secret';

// 1초 뒤에 끝나는 토큰
const token = jwt.sign({ sub: '2' }, SECRET, { expiresIn: '1s' });
console.log(jwt.verify(token, SECRET));

// 2초 뒤에 다시 확인한다.
setTimeout(() => {
  try {
    jwt.verify(token, SECRET);
  } catch (error) {
    console.log(error.name, error.message);
  }
}, 2000);
