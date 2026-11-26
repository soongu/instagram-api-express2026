// ~/instagram-api/lab/p3-67/public/customer.js
// 손님 쪽 시험 화면 - 고른 손님으로 연결하고, 그 손님의 문의방에 보낸다. 칠 때마다 입력 중을 알린다.
const ROOM = { seoyeon: 1, sujin: 2, taeyang: 4 };
let socket = null;

document.querySelector('#who').addEventListener('submit', (event) => {
  event.preventDefault();
  const user = document.querySelector('#user').value;
  if (socket) socket.disconnect();
  socket = io({ query: { user } });
  socket.on('connect', () => { document.querySelector('#status').textContent = `${user} 로 연결됐어요`; });
  socket.on('inquiry:message', (message) => {
    const li = document.createElement('li');
    li.textContent = `${message.senderId === 2 ? 'jaehoon' : user}: ${message.content}`;
    document.querySelector('#list').append(li);
  });
});

// 개발용 - jaehoon(실습 화면)의 연결을 끊고 10초 동안 다시 붙지 못하게 한다.
document.querySelector('#drop').addEventListener('click', async () => {
  const res = await fetch('/dev/drop?user=jaehoon', { method: 'POST' });
  const { closedCount } = await res.json();
  document.querySelector('#dropped').textContent = `jaehoon의 연결 ${closedCount}개를 끊었어요 - 10초 동안 다시 못 붙어요`;
});

document.querySelector('#text').addEventListener('input', (event) => {
  const user = document.querySelector('#user').value;
  socket?.emit('inquiry:typing', { inquiryId: ROOM[user], typing: event.target.value !== '' });
});

document.querySelector('#send').addEventListener('submit', (event) => {
  event.preventDefault();
  const user = document.querySelector('#user').value;
  const input = document.querySelector('#text');
  socket?.emit('inquiry:send', { inquiryId: ROOM[user], content: input.value });
  socket?.emit('inquiry:typing', { inquiryId: ROOM[user], typing: false });
  input.value = '';
});
