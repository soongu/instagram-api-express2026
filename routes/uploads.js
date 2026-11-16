// ~/instagram-api/routes/uploads.js
import express from 'express';
import { upload } from '../middlewares/upload.js';

const router = express.Router();

router.post('/', upload.array('images'), (req, res) => {
  res.status(201).json({ files: req.files, body: req.body });
});

export default router;
