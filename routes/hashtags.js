// ~/instagram-api/routes/hashtags.js
import express from 'express';
import * as hashtagController from '../controllers/hashtagController.js';
import { validateQuery } from '../middlewares/validate.js';
import { allowOnly } from '../middlewares/methods.js';
import { hashtagPostsQuerySchema } from '../schemas/hashtagSchema.js';

const router = express.Router();

router.get('/:name/posts', validateQuery(hashtagPostsQuerySchema), hashtagController.posts);

router.all('/:name/posts', allowOnly('GET'));

export default router;
