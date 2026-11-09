// ~/instagram-api/lab/p3-37/coupons.js
import express from 'express';

const app = express();

const MESSAGES = {
  COUPON_NOT_FOUND: '그런 쿠폰은 없어요',
  COUPON_ALREADY_USED: '이미 쓴 쿠폰이에요',
  COUPON_EXPIRED: '기간이 지난 쿠폰이에요',
  INTERNAL_ERROR: '서버에서 문제가 생겼어요',
};

class HttpError extends Error {
  constructor(status, code) {
    super(MESSAGES[code]);
    this.status = status;
    this.code = code;
  }
}

const coupons = [
  { id: 1, used: false, expiresAt: '2099-12-31' },
  { id: 2, used: false, expiresAt: '2026-01-31' },
  { id: 3, used: true, expiresAt: '2099-12-31' },
];

function parseCouponId(req, res, next) {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) throw new HttpError(404, 'COUPON_NOT_FOUND');
  req.couponId = id;
  next();
}

function useCoupon(id) {
  const coupon = coupons.find((one) => one.id === id);
  if (!coupon) throw new HttpError(404, 'COUPON_NOT_FOUND');
  if (coupon.used) throw new HttpError(409, 'COUPON_ALREADY_USED');
  if (new Date(coupon.expiresAt) < new Date()) throw new HttpError(409, 'COUPON_EXPIRED');

  coupon.used = true;
  return coupon;
}

app.post('/api/coupons/:id/use', parseCouponId, (req, res) => {
  res.json({ data: useCoupon(req.couponId) });
});

app.use((err, req, res, next) => {
  if (err instanceof HttpError) {
    res.status(err.status).json({ error: { code: err.code, message: err.message } });
    return;
  }
  console.error(err);
  res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: MESSAGES.INTERNAL_ERROR } });
});

app.listen(4002, () => {
  console.log('쿠폰 서버가 4002번 포트에서 기다리고 있어요.');
});
