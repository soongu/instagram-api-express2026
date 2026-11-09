// ~/instagram-api/responses.js

// 응답 본문의 바깥 모양은 이 파일에서만 정한다.
//   새 주소(/api/v2) — 값을 data 에 담는다.
//   옛 주소(/api)    — 이미 나간 화면이 읽는 모양 그대로, 값만 보낸다.

export function sendData(res, data) {
  if (res.locals.apiVersion === 2) {
    res.json({ data });
    return;
  }

  res.json(data);
}
