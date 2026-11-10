// ~/instagram-api/middlewares/deprecation.js

// 옛 방식을 언제부터 쓰지 말라고 했는지와, 언제부터 받지 않을지 — 응답 헤더와 API 문서가 이 두 값을 함께 쓴다.
export const DEPRECATED_AT = new Date('2026-12-01T00:00:00Z');
export const SUNSET_AT = new Date('2027-03-01T00:00:00Z');

// 응답에 두 날짜와, 자세한 안내를 읽을 문서 주소를 적는다 — 옛 커서와 옛 주소가 함께 쓴다.
export function setDeprecation(res) {
  res.set('Deprecation', `@${DEPRECATED_AT.getTime() / 1000}`);
  res.set('Sunset', SUNSET_AT.toUTCString());
  res.set('Link', '</api/docs>; rel="deprecation"; type="text/html"');
}

// 옛 주소(/api)로 온 요청에 알린다 — /api 에 붙인 미들웨어는 /api/v2 로 온 요청에도 불리니, 새 주소는 건너뛴다.
export function oldApiNotice(req, res, next) {
  if (res.locals.apiVersion !== 2) {
    setDeprecation(res);
  }
  next();
}
