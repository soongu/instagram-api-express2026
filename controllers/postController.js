// ~/instagram-api/controllers/postController.js
import * as postService from '../services/postService.js';

// 요청에서 값을 꺼내 서비스에 넘기고, 돌려받은 결과로 응답을 정한다.

export async function list(req, res) {
  const { limit, cursor, username } = res.locals.query;
  const page = await postService.getPosts({
    username,
    // 서버가 로그인 정보를 쓰기 전까지는 «누가 보는지» 를 주소에 실어 받는다.
    userId: Number(req.query.userId) || undefined,
    limit,
    cursor,
  });

  res.json(page);
}

export async function detail(req, res) {
  const post = await postService.getPost(req.postId);

  res.json(post);
}

export async function create(req, res) {
  const newPost = await postService.createPost(req.body);

  // 새 게시물을 가리키는 주소를 Location 헤더에 싣는다.
  res.status(201).location(`/api/posts/${newPost.id}`).json(newPost);
}

export async function update(req, res) {
  const post = await postService.updatePost(req.postId, req.body);

  res.json(post);
}

export async function remove(req, res) {
  const deleted = await postService.removePost(req.postId);

  res.json(deleted);
}
