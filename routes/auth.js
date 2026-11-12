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
// 구글 로그인 시작 — 구글의 로그인 화면으로 보낸다. 우리 서버는 세션을 쓰지 않아서 session: false 를 준다.
router.get('/google', passport.authenticate('google', { session: false }));

router.all('/signup', allowOnly('POST'));
router.all('/check-duplicate', allowOnly('GET'));
router.all('/login', allowOnly('POST'));
router.all('/reissue', allowOnly('POST'));
router.all('/me', allowOnly('GET'));
router.all('/logout', allowOnly('POST'));
router.all('/logout-all', allowOnly('POST'));
router.all('/google', allowOnly('GET'));

export default router;
