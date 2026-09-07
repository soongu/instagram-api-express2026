// ~/instagram-api/lab/Comment.js
import mongoose from 'mongoose';

const commentSchema = new mongoose.Schema({
  postId: { type: Number, required: true },
  username: { type: String, required: true },
  content: { type: String, required: true },
  likeCount: { type: Number, default: 0 },
});

const Comment = mongoose.model('Comment', commentSchema);

export default Comment;
