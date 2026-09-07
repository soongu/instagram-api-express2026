// ~/instagram-api/lab/Book.js
import mongoose from 'mongoose';

const bookSchema = new mongoose.Schema({
  title: { type: String, required: true },
  author: { type: String, required: true },
  stock: { type: Number, default: 0 },
});

const Book = mongoose.model('Book', bookSchema);

export default Book;
