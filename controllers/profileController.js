// ~/instagram-api/controllers/profileController.js
import * as userService from '../services/userService.js';
import * as postService from '../services/postService.js';
import * as followService from '../services/followService.js';
import { sendData } from '../responses.js';

// 프로필 헤더 - 팔로우하고 있는지는 로그인한 사람을 기준으로 본다.
export async function show(req, res) {
  const profile = await userService.getProfile(req.params.username, res.locals.userId);

  sendData(res, profile);
}

export async function posts(req, res) {
  const { limit, cursor } = res.locals.query;
  const page = await postService.getUserPosts(req.params.username, { limit, cursor });

  sendData(res, page);
}

// 그 사람을 팔로우한다 - 누가 팔로우하는지는 주소가 아니라 로그인 정보로 정한다.
export async function follow(req, res) {
  const status = await followService.follow(req.params.username, res.locals.userId);

  sendData(res, status);
}

// 그 사람의 팔로우를 취소한다.
export async function unfollow(req, res) {
  const status = await followService.unfollow(req.params.username, res.locals.userId);

  sendData(res, status);
}

// 그 사람을 팔로우하는 사람들의 목록.
export async function followers(req, res) {
  const page = await followService.getFollowList(req.params.username, 'followers', res.locals.query);

  sendData(res, page);
}

// 그 사람이 팔로우하는 사람들의 목록.
export async function following(req, res) {
  const page = await followService.getFollowList(req.params.username, 'following', res.locals.query);

  sendData(res, page);
}
