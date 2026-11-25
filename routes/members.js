// ~/instagram-api/routes/members.js
import express from 'express';
import * as memberController from '../controllers/memberController.js';
import { validateQuery, validateBody } from '../middlewares/validate.js';
import { allowOnly } from '../middlewares/methods.js';
import { memberSearchQuerySchema, profileImageSchema } from '../schemas/memberSchema.js';

const router = express.Router();

router.get('/search', validateQuery(memberSearchQuerySchema), memberController.search);
router.put('/me/profile-image', validateBody(profileImageSchema), memberController.updateProfileImage);

router.all('/search', allowOnly('GET'));
router.all('/me/profile-image', allowOnly('PUT'));

export default router;
