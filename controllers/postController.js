// ~/instagram-api/controllers/postController.js
import * as postService from '../services/postService.js';
import { sendData } from '../responses.js';

// 요청에서 값을 꺼내 서비스에 넘기고, 돌려받은 결과로 응답을 정한다.

export async function list(req, res) {
  const { limit, cursor, username } = res.locals.query;
  const page = await postService.getPosts({
    username,
    // 보는 사람은 로그인 정보로 정한다 — 그 사람이 누른 좋아요가 liked 로 간다.
    userId: res.locals.userId,
    limit,
    cursor,
  });

  sendData(res, page);
}

export async function detail(req, res) {
  const post = await postService.getPost(req.postId);

  sendData(res, post);
}

export async function create(req, res) {
  // 글쓴이는 본문이 아니라 로그인 정보로 정한다.
  const newPost = await postService.createPost({ ...req.body, authorId: res.locals.userId });

  // 새 게시물을 가리키는 주소를 Location 헤더에 싣는다 — 요청이 온 주소(/api/posts · /api/v2/posts) 아래에.
  res.status(201).location(`${req.baseUrl}/${newPost.id}`);
  sendData(res, newPost);
}

export async function update(req, res) {
  const post = await postService.updatePost(req.postId, res.locals.userId, req.body);

  sendData(res, post);
}

export async function remove(req, res) {
  const deleted = await postService.removePost(req.postId, res.locals.userId, res.locals.role);

  sendData(res, deleted);
}
