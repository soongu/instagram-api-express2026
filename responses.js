// ~/instagram-api/responses.js

// 응답 본문의 바깥 형식은 이 파일에서만 정한다.
//   새 주소(/api/v2) — 값을 data 에 담는다.
//   옛 주소(/api)    — 이미 나간 화면이 읽는 모양 그대로, 값만 보낸다.

export function sendData(res, data) {
  if (res.locals.apiVersion === 2) {
    res.json({ data });
    return;
  }

  res.json(data);
}

//   새 주소(/api/v2) — 무엇이 잘못됐는지를 error 에 담는다. 화면은 code 를 보고, 사람은 message 를 읽는다.
//   옛 주소(/api)    — { message } 그대로. 검사 실패는 details 가 함께 간다.
export function sendError(res, error) {
  const { status, code, message, details } = error;

  res.status(status);

  if (res.locals.apiVersion === 2) {
    // details 가 없으면(undefined) JSON 에 아예 실리지 않는다.
    res.json({ error: { code, message, details } });
    return;
  }

  res.json({ message, details });
}
