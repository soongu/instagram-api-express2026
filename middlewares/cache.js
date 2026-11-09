// ~/instagram-api/middlewares/cache.js

// API 응답은 브라우저가 받아 둬도 되지만, 쓰기 전에 늘 서버에 아직 같은지 물어보게 한다.
// private — 보는 사람마다 다른 응답이라 그 사람의 브라우저에만 둔다. 가운데 있는 공유 캐시에는 두지 않는다.
export function privateNoCache(req, res, next) {
  res.set('Cache-Control', 'private, no-cache');
  next();
}
