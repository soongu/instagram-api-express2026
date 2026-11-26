// ~/instagram-api/utils/cursor.js
import { z } from 'zod';
import { BadRequestError } from '../errors.js';

// 여러 목록이 함께 쓰는 커서 함수 - 모두 «시각과 번호» 로 차례를 정한다.
// 어느 시각으로 줄 세우는지는 목록마다 달라서 그 시각 컬럼의 이름을 받는다(없으면 createdAt).

// 커서는 우리가 만들어 준 문자열이지만 돌아올 때는 밖에서 오는 값이다 — 푼 값도 검사한다.
const cursorSchema = (timeField) => z.object({
  [timeField]: z.iso.datetime(),
  id: z.int32(),
});

// 커서는 «마지막으로 내준 행의 시각과 번호» 를 문자열 하나로 인코딩한 것이다.
// 받는 쪽은 뜻을 몰라도 된다 — 받아 두었다가 다음 요청에 그대로 돌려주기만 한다.
export function encodeCursor(row, timeField = 'createdAt') {
  return Buffer.from(JSON.stringify({ [timeField]: row[timeField], id: row.id })).toString('base64url');
}

export function decodeCursor(cursor, timeField = 'createdAt') {
  let value;

  // try 는 보낸 값 때문에 실패하는 줄만 감싼다 — 커서가 JSON 이 아니면 JSON.parse 가 던진다.
  // 더 넓게 감싸면 우리 코드의 실수(빠뜨린 import 같은 것)까지 400 으로 바뀌어 숨는다.
  try {
    value = JSON.parse(Buffer.from(cursor, 'base64url').toString());
  } catch {
    throw new BadRequestError('INVALID_CURSOR');
  }

  // 푼 값의 모양은 safeParse 로 검사한다 — 맞지 않아도 던지지 않고 결과로 알려 준다.
  const result = cursorSchema(timeField).safeParse(value);

  if (!result.success) throw new BadRequestError('INVALID_CURSOR');

  return result.data;
}
