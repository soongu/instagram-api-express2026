// ~/instagram-api/lab/p3-36/practice2/routes/tags.js
import express from 'express';
import * as tagController from '../controllers/tagController.js';

const router = express.Router();

router.get('/', tagController.list);
router.post('/', tagController.create);

export default router;
