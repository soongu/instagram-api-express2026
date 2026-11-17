// ~/instagram-api/responses.js

// 응답 본문의 바깥 형식은 이 파일에서만 정한다.
// 새 주소(/api/v2)로 온 요청은 봉투에 담고, 옛 주소(/api)로 온 요청은 이미 나간 화면이 읽던 형식 그대로 보낸다.

// 성공 — 새 주소는 { data }, 옛 주소는 값만
export function sendData(res, data) {
  if (res.locals.apiVersion === 2) {
    res.json({ data });
    return;
  }

  res.json(data);
}

// 실패 — 새 주소는 { error: { code, message, details } }, 옛 주소는 { message, details }
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
