// 2026-11-16 소급 정정 — `decodeCursor` 의 `try` 를 `JSON.parse` 한 줄로 좁혔다(p3-33 Step 7).
//
// 옛 판은 `try` 하나가 `cursorSchema.parse(JSON.parse(…))` 를 통째로 감싸고 빈 `catch {}` 가 무엇이든 400 으로 바꿨다.
// 그래서 `import { cursorSchema }` 를 빠뜨리면 생기는 ReferenceError(우리 코드의 실수)까지 «커서 값이 올바르지 않아요» 가 되어,
// 정상 커서도 모두 400 이고 터미널에는 요청 줄만 남았다. 사용자 리허설에서 이것을 p3-34 Step 2 의 미들웨어 순서 문제로 오인했다.
//
// 정정은 main 에만 얹었다 — 북마크 code/p3-33~code/p3-51 은 옛 판 그대로다(사용자 결정 · 「지나간 회차의 결함은 선 위에서 고친다」).
// 북마크를 풀어 «그 회차 끝의 학생 상태» 로 쓰는 판정은 `retrofitRoundDir` 로 «북마크 + 이 정정» 을 만든다.
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';

const OLD_DECODE = (message) => [
  'function decodeCursor(cursor) {',
  '  try {',
  "    return cursorSchema.parse(JSON.parse(Buffer.from(cursor, 'base64url').toString()));",
  '  } catch {',
  `    throw new BadRequestError('${message}');`,
  '  }',
  '}',
].join('\n');

/** 정정한 판 — 수업 목록(`services/postService.js`)과 직접 해보기 3 · 과제 [응용] 의 실습 파일이 같은 글자를 쓴다 */
export const NEW_DECODE = (message) => [
  'function decodeCursor(cursor) {',
  '  let value;',
  '',
  '  // try 는 보낸 값 때문에 실패하는 줄만 감싼다 — 커서가 JSON 이 아니면 JSON.parse 가 던진다.',
  '  // 더 넓게 감싸면 우리 코드의 실수(빠뜨린 import 같은 것)까지 400 으로 바뀌어 숨는다.',
  '  try {',
  "    value = JSON.parse(Buffer.from(cursor, 'base64url').toString());",
  '  } catch {',
  `    throw new BadRequestError('${message}');`,
  '  }',
  '',
  '  // 푼 값의 모양은 safeParse 로 검사한다 — 맞지 않아도 던지지 않고 결과로 알려 준다.',
  '  const result = cursorSchema.safeParse(value);',
  '',
  `  if (!result.success) throw new BadRequestError('${message}');`,
  '',
  '  return result.data;',
  '}',
].join('\n');

export const CURSOR_MESSAGE = '커서 값이 올바르지 않아요';

/** 옛 `decodeCursor` 를 정정한 판으로 바꾼다 — 옛 판이 정확히 한 번 있어야 한다(없으면 조용히 넘어가지 않는다) */
export function retrofitDecodeCursor(src, message = CURSOR_MESSAGE) {
  const parts = src.split(OLD_DECODE(message));
  if (parts.length !== 2) throw new Error(`옛 decodeCursor 가 정확히 한 번 있어야 해요 (${parts.length - 1}번)`);
  return parts.join(NEW_DECODE(message));
}

/**
 * `roundDir()` 이 북마크를 푼 임시 폴더의 파일을 제자리에서 정정한다.
 * 북마크가 없어 작업트리(main)를 가리키면 이미 정정한 판이라 건드리지 않는다.
 */
export function retrofitRoundDir(round, rel = 'services/postService.js', message = CURSOR_MESSAGE) {
  if (!round.fromBookmark) return;
  const file = path.join(round.dir, rel);
  writeFileSync(file, retrofitDecodeCursor(readFileSync(file, 'utf8'), message));
}
