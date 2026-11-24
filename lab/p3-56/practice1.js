// ~/instagram-api/lab/p3-56/practice1.js
// 리뷰 글에서 #태그 이름을 뽑는 함수를 만들고 문장 몇 개로 확인한다. 서버가 아니라 터미널에서 한 번 돌고 끝난다.

// # 바로 뒤에 영문, 숫자, 한글, 밑줄(_)이 이어지는 곳이 태그다. 다른 글자를 만나면 태그가 끝난다.
const TAG = /#[0-9A-Za-z가-힣_]+/g;
const MAX_LENGTH = 10;
const MAX_COUNT = 5;

// 리뷰 글에서 태그 이름만 뽑는다. 글에 나온 차례대로 담고 같은 이름은 한 번만 담는다.
function extractTags(content) {
  // 태그가 하나도 없으면 match 가 null 을 돌려주므로 빈 배열로 바꿔 둔다.
  const found = content.match(TAG) ?? [];

  // 앞의 # 을 떼고 소문자로 맞춘다. #Black 과 #black 은 같은 태그다.
  const lowered = found.map((tag) => tag.slice(1).toLowerCase());
  const names = [...new Set(lowered)];

  if (names.some((name) => name.length > MAX_LENGTH)) throw new Error('태그는 10자까지 쓸 수 있어요');
  if (names.length > MAX_COUNT) throw new Error('태그는 리뷰 하나에 5개까지 쓸 수 있어요');

  return names;
}

const samples = [
  '음질이 생각보다 좋아요 #음질 #가성비',
  '#가성비 최고예요 또 사고 싶어요 #가성비',
  '케이스는 #Black 이 예뻐요 #BLACK',
  '운동할 때 좋아요, #운동, #러닝!',
  '태그가 없는 리뷰예요',
  '이름이 너무 긴 #가나다라마바사아자차카 태그',
  '#하나 #둘 #셋 #넷 #다섯 #여섯 다 쓰면',
];

for (const content of samples) {
  console.log(content);

  // 태그가 규칙을 넘으면 extractTags 가 에러를 던진다. 에러가 나도 다음 문장으로 넘어간다.
  try {
    console.log('  태그', extractTags(content));
  } catch (error) {
    console.log('  안 돼요:', error.message);
  }
}
