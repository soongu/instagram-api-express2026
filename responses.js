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

// 실패 — 새 주소는 { error: { code, message, details, path, timestamp } }, 옛 주소는 { message, details }
export function sendError(req, res, error) {
  const { status, code, message, details } = error;

  res.status(status);

  if (res.locals.apiVersion === 2) {
    // 어느 주소로 온 요청이었는지 — 쿼리 문자열(? 뒤)에는 이메일 같은 값이 실리기도 해서 뺀다.
    const path = req.originalUrl.split('?')[0];
    // 서버 시계의 지금 시각 — 끝의 Z 는 UTC 라는 뜻이다.
    const timestamp = new Date().toISOString();
    // details 가 없으면(undefined) JSON 에 아예 실리지 않는다.
    res.json({ error: { code, message, details, path, timestamp } });
    return;
  }

  res.json({ message, details });
}
