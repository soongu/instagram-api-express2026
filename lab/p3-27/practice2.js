// ~/instagram-api/lab/p3-27/practice2.js
import express from 'express';
import { logger } from '../../middlewares/logger.js';

const app = express();

const notes = [];

function requireJson(message) {
  return (req, res, next) => {
    const type = req.headers['content-type'] ?? '';

    if (req.method === 'POST' && !type.startsWith('application/json')) {
      res.status(415).json({ message });
      return;
    }

    next();
  };
}

app.use(logger);
app.use(requireJson('JSON 형식으로 보내 주세요'));
app.use(express.json());

app.get('/api/notes', (req, res) => {
  res.json(notes);
});

app.post('/api/notes', (req, res) => {
  const note = { id: notes.length + 1, text: req.body.text };
  notes.push(note);
  res.status(201).json(note);
});

app.listen(4002, () => {
  console.log('실습 서버가 4002번 포트에서 기다리고 있어요.');
});
