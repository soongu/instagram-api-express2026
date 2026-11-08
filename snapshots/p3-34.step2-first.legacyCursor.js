// ~/instagram-api/middlewares/legacyCursor.js
import * as postService from '../services/postService.js';

// 커서가 «게시물 번호» 이던 때의 화면은 cursor=2 처럼 숫자만 보낸다.
// 지금 커서는 base64url 문자열이라, 숫자로만 된 커서는 옛 화면이 보낸 것이다.
const OLD_CURSOR = /^\d{1,9}$/;

export async function legacyCursor(req, res, next) {
  const { cursor } = res.locals.query;

  if (cursor === undefined || !OLD_CURSOR.test(cursor)) {
    next();
    return;
  }

  // 옛 커서를 지금 커서로 바꿔 둔다 — 뒤의 코드는 옛 화면이 있는지 몰라도 된다.
  res.locals.query.cursor = await postService.cursorOf(Number(cursor));
  next();
}
