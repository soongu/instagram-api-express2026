// ~/instagram-api/lab/Story.js
import mongoose from 'mongoose';

const storySchema = new mongoose.Schema({
  username: { type: String, required: true },
  isViewed: { type: Boolean, default: false },
});

const Story = mongoose.model('Story', storySchema);

export default Story;
