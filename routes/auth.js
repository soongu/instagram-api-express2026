// ~/instagram-api/routes/auth.js
import express from 'express';
import * as authController from '../controllers/authController.js';
import { validateBody, validateQuery } from '../middlewares/validate.js';
import { allowOnly } from '../middlewares/methods.js';
import { loginSchema, signupSchema, checkDuplicateSchema } from '../schemas/authSchema.js';

const router = express.Router();

router.post('/signup', validateBody(signupSchema), authController.signup);
router.get('/check-duplicate', validateQuery(checkDuplicateSchema), authController.checkDuplicate);
router.post('/login', validateBody(loginSchema), authController.login);
router.get('/me', authController.me);
router.post('/logout', authController.logout);

router.all('/signup', allowOnly('POST'));
router.all('/check-duplicate', allowOnly('GET'));
router.all('/login', allowOnly('POST'));
router.all('/me', allowOnly('GET'));
router.all('/logout', allowOnly('POST'));

export default router;
