// ~/instagram-api/routes/members.js
import express from 'express';
import * as memberController from '../controllers/memberController.js';
import { validateQuery } from '../middlewares/validate.js';
import { allowOnly } from '../middlewares/methods.js';
import { memberSearchQuerySchema } from '../schemas/memberSchema.js';

const router = express.Router();

router.get('/search', validateQuery(memberSearchQuerySchema), memberController.search);

router.all('/search', allowOnly('GET'));

export default router;
