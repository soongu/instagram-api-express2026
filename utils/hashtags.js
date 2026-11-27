// ~/instagram-api/utils/hashtags.js
import { BadRequestError } from '../errors.js';

// # 바로 뒤에 영문, 숫자, 한글, 밑줄(_)이 한 글자 이상 이어지는 곳이 해시태그다.
// 띄어쓰기나 쉼표 같은 다른 글자를 만나면 거기서 태그가 끝난다.
const HASHTAG = /#[0-9A-Za-z가-힣_]+/g;
const MAX_LENGTH = 30;
const MAX_COUNT = 30;

// 해시태그 이름을 저장하는 모양으로 맞춘다 - 앞의 # 을 떼고 소문자로. #Seoul 과 seoul 은 같은 해시태그다.
// 글에서 뽑을 때도, 주소로 이름이 들어올 때도 이 함수 하나로 맞춘다.
export function normalizeHashtag(name) {
  return name.replace(/^#/, '').toLowerCase();
}

// 게시물 글에서 해시태그 이름만 뽑는다 — 글에 나온 차례대로, 같은 이름은 한 번만.
export function extractHashtags(content) {
  if (!content) return [];

  // g 를 붙인 정규식을 match 에 주면 맞는 글자를 전부 배열로 돌려준다. 하나도 없으면 null 이다.
  const tags = content.match(HASHTAG) ?? [];

  // 이름을 맞춘 뒤 Set 에 담는다 - Set 은 같은 값을 한 번만 담고, 처음 들어온 차례를 그대로 지킨다.
  const names = [...new Set(tags.map(normalizeHashtag))];

  if (names.some((name) => name.length > MAX_LENGTH)) throw new BadRequestError('HASHTAG_TOO_LONG');
  if (names.length > MAX_COUNT) throw new BadRequestError('TOO_MANY_HASHTAGS');

  return names;
}
