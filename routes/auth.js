// ~/instagram-api/routes/auth.js
import express from 'express';
import passport from 'passport';
import * as authController from '../controllers/authController.js';
import { validateBody, validateQuery } from '../middlewares/validate.js';
import { allowOnly } from '../middlewares/methods.js';
import { requireLogin } from '../middlewares/auth.js';
import { loginSchema, signupSchema, checkDuplicateSchema } from '../schemas/authSchema.js';

const router = express.Router();

router.post('/signup', validateBody(signupSchema), authController.signup);
router.get('/check-duplicate', validateQuery(checkDuplicateSchema), authController.checkDuplicate);
router.post('/login', validateBody(loginSchema), authController.login);
router.post('/reissue', authController.reissue);
router.get('/me', requireLogin, authController.me);
router.post('/logout', authController.logout);
// 이 라우터는 로그인 확인보다 위에 붙어 있다 — 로그인이 필요한 라우트에는 직접 끼운다.
router.post('/logout-all', requireLogin, authController.logoutAll);
// 구글 로그인 — 브라우저가 문서로 여는 주소 둘. 시작 주소는 구글로 보내고, 구글은 콜백 주소로 돌려보낸다.
router.get('/google', authController.rememberNext, passport.authenticate('google', { session: false }));
router.get(
  '/google/callback',
  passport.authenticate('google', { session: false, failureRedirect: '/login?error=SOCIAL_LOGIN_FAILED' }),
  authController.socialCallback,
);
// 위 두 주소에서 난 에러는 여기서 받는다 — 앱의 에러 미들웨어까지 가면 JSON 으로 답하게 된다.
router.use('/google', authController.socialFailed);

router.all('/signup', allowOnly('POST'));
router.all('/check-duplicate', allowOnly('GET'));
router.all('/login', allowOnly('POST'));
router.all('/reissue', allowOnly('POST'));
router.all('/me', allowOnly('GET'));
router.all('/logout', allowOnly('POST'));
router.all('/logout-all', allowOnly('POST'));
router.all('/google', allowOnly('GET'));
router.all('/google/callback', allowOnly('GET'));

export default router;
