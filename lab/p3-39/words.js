// ~/instagram-api/lab/p3-39/words.js
// 사람들이 비밀번호로 자주 쓰는 모양을 흉내 낸 사전 — 낱말 20개 뒤에 숫자 0~4999 를 붙여 10만 개를 만든다.
const WORDS = [
  'password', 'qwerty', 'qwer', 'asdf', 'abcd',
  'iloveyou', 'love', 'admin', 'hello', 'sunshine',
  'dragon', 'monkey', 'instagram', 'insta', 'korea',
  'jaehoon', 'minji', 'dahye', 'seungwoo', 'nayeon',
];

export function* candidates() {
  for (const word of WORDS) {
    for (let number = 0; number < 5000; number += 1) {
      yield `${word}${number}`;
    }
  }
}
