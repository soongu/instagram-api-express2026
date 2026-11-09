// ~/instagram-api/middlewares/version.js

// 요청이 어느 버전의 주소로 왔는지 적어 둔다 — 응답의 모양을 고르는 쪽이 이 값을 본다.
export function apiVersion(version) {
  return (req, res, next) => {
    res.locals.apiVersion = version;
    next();
  };
}
