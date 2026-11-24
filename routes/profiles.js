// ~/instagram-api/routes/profiles.js
import express from 'express';
import * as profileController from '../controllers/profileController.js';
import { allowOnly } from '../middlewares/methods.js';

const router = express.Router();

router.get('/:username', profileController.show);

router.all('/:username', allowOnly('GET'));

export default router;
