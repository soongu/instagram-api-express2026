// ~/instagram-api/lab/p3-36/practice2/controllers/tagController.js
import * as tagService from '../services/tagService.js';

export function list(req, res) {
  res.json(tagService.listTags());
}

export function create(req, res) {
  const result = tagService.addTag(req.body.name);

  res.status(result.created ? 201 : 200).json(result);
}
