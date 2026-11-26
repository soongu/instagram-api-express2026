// ~/instagram-api/routes/profiles.js
import express from 'express';
import * as profileController from '../controllers/profileController.js';
import { validateQuery } from '../middlewares/validate.js';
import { allowOnly } from '../middlewares/methods.js';
import { profilePostsQuerySchema, followListQuerySchema } from '../schemas/profileSchema.js';

const router = express.Router();

router.get('/:username', profileController.show);
router.get('/:username/posts', validateQuery(profilePostsQuerySchema), profileController.posts);
router.get('/:username/followers', validateQuery(followListQuerySchema), profileController.followers);

// 「minji 의 팔로워 가운데 나」 하나를 주소로 가리킨다 - «나» 는 로그인 정보로 정한다.
// 있게 만들기(PUT)와 없게 만들기(DELETE) - 둘 다 몇 번을 보내도 결과가 같다.
router.put('/:username/followers/me', profileController.follow);
router.delete('/:username/followers/me', profileController.unfollow);

router.all('/:username', allowOnly('GET'));
router.all('/:username/posts', allowOnly('GET'));
router.all('/:username/followers', allowOnly('GET'));
router.all('/:username/followers/me', allowOnly('PUT', 'DELETE'));

export default router;
