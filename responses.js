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
