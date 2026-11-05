// ~/instagram-api/middlewares/logger.js
export function logger(req, res, next) {
  next();
  console.log(`${req.method} ${req.originalUrl} ${res.statusCode}`);
}
