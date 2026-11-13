// ~/instagram-api/middlewares/logger.js
export function logger(req, res, next) {
  // 응답을 다 보낸 뒤에 한 줄 — 상태 코드는 그때 정해져 있다.
  res.on('finish', () => {
    console.log(`${req.method} ${req.originalUrl} ${res.statusCode}`);
  });
  next();
}
