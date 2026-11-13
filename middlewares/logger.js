// ~/instagram-api/middlewares/logger.js
export function logger(req, res, next) {
  const start = performance.now();

  // 응답을 다 보낸 뒤에 한 줄 — 상태 코드와 걸린 시간은 그때 정해져 있다.
  res.on('finish', () => {
    const ms = performance.now() - start;
    console.log(
      `${req.method} ${req.originalUrl} ${res.statusCode} ${ms.toFixed(1)}ms`,
    );
  });

  next();
}
