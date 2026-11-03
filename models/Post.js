// ~/instagram-api/models/Post.js
import mongoose from 'mongoose';

const postSchema = new mongoose.Schema({
  username: { type: String, required: true },
  profileImage: String,
  postImage: { type: String, required: true },
  postAlt: String,
  content: String,
  minutesAgo: { type: Number, default: 0 },
  likeCount: { type: Number, default: 0 },
  commentCount: { type: Number, default: 0 },
});

const Post = mongoose.model('Post', postSchema);

export default Post;
