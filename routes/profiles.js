// ~/instagram-api/routes/profiles.js
import express from 'express';
import * as profileController from '../controllers/profileController.js';
import { validateQuery } from '../middlewares/validate.js';
import { allowOnly } from '../middlewares/methods.js';
import { profilePostsQuerySchema } from '../schemas/profileSchema.js';

const router = express.Router();

router.get('/:username', profileController.show);
router.get('/:username/posts', validateQuery(profilePostsQuerySchema), profileController.posts);

router.all('/:username', allowOnly('GET'));
router.all('/:username/posts', allowOnly('GET'));

export default router;
