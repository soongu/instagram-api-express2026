// ~/instagram-api/lab/p3-36/practice2/services/tagService.js
const tags = [];

// 해시태그 이름은 앞뒤 공백과 맨 앞의 # 을 빼고 소문자로 맞춘다 — #Seoul 과 seoul 은 같은 해시태그다.
function normalize(name) {
  return name.trim().replace(/^#/, '').toLowerCase();
}

export function addTag(rawName) {
  const name = normalize(rawName);

  if (tags.includes(name)) {
    return { name, created: false };
  }

  tags.push(name);
  return { name, created: true };
}

export function listTags() {
  return tags;
}
