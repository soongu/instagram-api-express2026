// ~/instagram-api/middlewares/validate.js
import { z } from 'zod';
import { BadRequestError } from '../errors.js';

export function validateBody(schema) {
  return (req, res, next) => {
    const result = schema.safeParse(req.body);

    if (!result.success) {
      next(new BadRequestError('보낸 내용이 규칙에 안 맞아요', z.treeifyError(result.error)));
      return;
    }

    req.body = result.data;
    next();
  };
}


export function validateQuery(schema) {
  return (req, res, next) => {
    const result = schema.safeParse(req.query);

    if (!result.success) {
      next(
        new BadRequestError(
          '보낸 내용이 규칙에 안 맞아요',
          z.treeifyError(result.error),
        ),
      );
      return;
    }

    // req.query 는 읽을 때마다 주소에서 새로 만드는 값이라, 검사한 값은 res.locals 에 담아 넘긴다.
    res.locals.query = result.data;
    next();
  };;
}
