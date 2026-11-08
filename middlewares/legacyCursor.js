// ~/instagram-api/middlewares/legacyCursor.js
import * as postService from '../services/postService.js';

// 커서가 «게시물 번호» 이던 때의 화면은 cursor=2 처럼 숫자만 보낸다.
// 지금 커서는 base64url 문자열이라, 숫자로만 된 커서는 옛 화면이 보낸 것이다.
const OLD_CURSOR = /^\d{1,9}$/;

// 옛 커서를 언제부터 쓰지 말라고 했는지와, 언제부터 받지 않을지.
const DEPRECATED_AT = new Date('2026-12-01T00:00:00Z');
const SUNSET_AT = new Date('2027-03-01T00:00:00Z');

export async function legacyCursor(req, res, next) {
  const { cursor } = res.locals.query;

  if (cursor === undefined || !OLD_CURSOR.test(cursor)) {
    next();
    return;
  }

  // 옛 커서로 온 요청에만 알린다 — 이 방식은 곧 사라지니 새 커서로 옮기라고.
  res.set('Deprecation', `@${DEPRECATED_AT.getTime() / 1000}`);
  res.set('Sunset', SUNSET_AT.toUTCString());

  const newCursor = await postService.cursorOf(Number(cursor));

  // 커서였던 게시물이 지워졌으면 이어 줄 위치를 모른다 — 옛 서버처럼 빈 목록으로 끝낸다.
  if (newCursor === null) {
    res.json({ items: [], hasNext: false, nextCursor: null });
    return;
  }

  // 옛 커서를 지금 커서로 바꿔 둔다 — 뒤의 코드는 옛 화면이 있는지 몰라도 된다.
  res.locals.query.cursor = newCursor;
  next();
}
