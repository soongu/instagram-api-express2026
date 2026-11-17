// ~/instagram-api/middlewares/methods.js
import { MethodNotAllowedError } from '../errors.js';

// 주소는 맞는데 그 주소가 받지 않는 HTTP 메서드로 온 요청에 405 로 답한다.
// Allow 헤더에 받는 HTTP 메서드를 적어 두면, 요청을 보낸 쪽이 무엇으로 다시 보낼지 안다.
export function allowOnly(...methods) {
  const allow = methods.join(', ');

  return (req, res, next) => {
    res.set('Allow', allow);
    next(new MethodNotAllowedError('METHOD_NOT_ALLOWED'));
  };
}
