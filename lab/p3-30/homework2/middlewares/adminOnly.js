// ~/instagram-api/lab/p3-30/homework2/middlewares/adminOnly.js
// 실습용 — 요청 헤더에 적힌 역할을 그대로 믿는다. 진짜 서버는 로그인한 사람의 정보로 역할을 확인한다.
function readRole(req, res, next) {
  res.locals.role = req.get('X-Role');
  next();
}

function requireAdmin(req, res, next) {
  if (res.locals.role !== 'admin') {
    res.status(403).json({ message: '관리자만 할 수 있어요' });
    return;
  }

  next();
}

export const adminOnly = [readRole, requireAdmin];
