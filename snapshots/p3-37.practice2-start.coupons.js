// ~/instagram-api/lab/p3-37/coupons.js
import express from 'express';

const app = express();

class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

const coupons = [
  { id: 1, used: false, expiresAt: '2099-12-31' },
  { id: 2, used: false, expiresAt: '2026-01-31' },
  { id: 3, used: true, expiresAt: '2099-12-31' },
];

function parseCouponId(req, res, next) {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) throw new HttpError(404, '그런 쿠폰은 없어요');
  req.couponId = id;
  next();
}

function useCoupon(id) {
  const coupon = coupons.find((one) => one.id === id);
  if (!coupon) throw new HttpError(404, '그런 쿠폰은 없어요');
  if (coupon.used) throw new HttpError(409, '이미 쓴 쿠폰이에요');
  if (new Date(coupon.expiresAt) < new Date()) throw new HttpError(409, '기간이 지난 쿠폰이에요');

  coupon.used = true;
  return coupon;
}

app.post('/api/coupons/:id/use', parseCouponId, (req, res) => {
  res.json({ data: useCoupon(req.couponId) });
});

app.use((err, req, res, next) => {
  if (err instanceof HttpError) {
    res.status(err.status).json({ error: { message: err.message } });
    return;
  }
  console.error(err);
  res.status(500).json({ error: { message: '서버에서 문제가 생겼어요' } });
});

app.listen(4002, () => {
  console.log('쿠폰 서버가 4002번 포트에서 기다리고 있어요.');
});
