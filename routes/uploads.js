// ~/instagram-api/routes/uploads.js
import express from 'express';
import { uploadImages } from '../middlewares/upload.js';

const router = express.Router();

router.post('/', uploadImages, (req, res) => {
  res.status(201).json({ files: req.files, body: req.body });
});

export default router;
