// ~/instagram-api/lab/p3-37/homework2.js

// 에러 코드마다 문장을 보여 줄 입력 칸 — 가입 화면의 칸 이름(name 속성)과 같다.
const FIELD = {
  USERNAME_TAKEN: 'username',
  EMAIL_TAKEN: 'emailOrPhone',
  PHONE_TAKEN: 'emailOrPhone',
};

async function signup(form) {
  const response = await fetch('http://localhost:3000/api/v2/auth/signup', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(form),
  });
  const body = await response.json();

  if (response.ok) {
    console.log('가입했어요', body.data.username);
    return;
  }

  // 칸을 고르는 데는 코드만 쓴다 — 문장은 사람에게 보여 주기만 한다. 표에 없는 코드는 폼 아래(form)에.
  const field = FIELD[body.error.code] ?? 'form';
  console.log(`[${field}] ${body.error.message}`);
}

await signup({ emailOrPhone: '010-4242-7777', name: '한태양', username: 'taeyang9', password: 'taeyang12' });
await signup({ emailOrPhone: '010-4242-9999', name: '김재훈', username: 'jaehoon', password: 'jaehoon12' });
await signup({ emailOrPhone: 'x', name: '', username: 'a', password: '1' });
