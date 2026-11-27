// ~/instagram-api/utils/mentions.js

// @ 바로 뒤에 사용자 이름에 쓸 수 있는 글자(영문 · 숫자 · 밑줄 · 점)가 이어지는 곳이 멘션이다.
// 화면이 «@이름» 을 링크로 바꾸는 규칙(~/instagram-next/utils/mentions.js)과 같아야 한다 - 링크가 걸린 사람에게만 알림이 간다.
// 점은 글자 사이에만 둔다 - «@dahye.» 처럼 문장 끝의 마침표까지 이름으로 읽지 않게.
// @ 바로 앞에 영문 · 숫자 · 밑줄 · 점이 붙어 있으면 멘션이 아니다 - 메일 주소(a@b.com)는 멘션이 아니다.
// 괄호 안이 사용자 이름이다. g 를 붙여 글 전체에서 찾는다.
const MENTION = /(?<![0-9A-Za-z_.])@([0-9A-Za-z_]+(?:\.[0-9A-Za-z_]+)*)/g;

// 글에서 멘션한 사용자 이름만 뽑는다 - 글에 나온 차례대로, 같은 이름은 한 번만.
export function extractMentions(content) {
  // matchAll 은 맞는 곳마다 [전체, 괄호 안] 을 돌려준다. 괄호 안(@ 를 뗀 이름)만 모은다.
  const names = [...content.matchAll(MENTION)].map((match) => match[1]);

  return [...new Set(names)];
}
