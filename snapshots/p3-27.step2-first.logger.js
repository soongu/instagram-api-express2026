// ~/instagram-api/middlewares/logger.js
export function logger(req, res, next) {
  console.log(`${req.method} ${req.originalUrl} ${res.statusCode}`);
  next();
}
