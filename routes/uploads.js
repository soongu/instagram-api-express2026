// ~/instagram-api/routes/uploads.js
import express from 'express';
import * as uploadController from '../controllers/uploadController.js';
import { uploadImages } from '../middlewares/upload.js';
import { allowOnly } from '../middlewares/methods.js';

const router = express.Router();

router.post('/', uploadImages, uploadController.create);

router.all('/', allowOnly('POST'));

export default router;
