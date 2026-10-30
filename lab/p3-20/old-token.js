// ~/instagram-api/lab/old-token.js
import jwt from 'jsonwebtoken';

const SECRET = 'my-lab-secret';

// Step 5 에 실린 토큰 — 만료 시각(exp) 없이 만든 것이다.
const oldToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIyIiwiaWF0IjoxNzkzMTcwMDUxfQ.8S-W8GcVhBeN2HlFZ19FcDGymPcEacNvIwEywgm0aEw';

console.log(jwt.verify(oldToken, SECRET));
