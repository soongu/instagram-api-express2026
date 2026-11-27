// ~/instagram-api/routes/dev.js
import express from 'express';
import * as devController from '../controllers/devController.js';
import { validateQuery } from '../middlewares/validate.js';
import { allowOnly } from '../middlewares/methods.js';
import { connectionDropQuerySchema } from '../schemas/devSchema.js';

// 개발할 때만 쓰는 주소 - app.js 가 NODE_ENV 가 production 이 아닐 때만 붙인다.
const router = express.Router();

router.delete('/connections/:username', validateQuery(connectionDropQuerySchema), devController.dropUserConnections);

router.all('/connections/:username', allowOnly('DELETE'));

export default router;
