// ~/instagram-api/lab/p3-70/public/homework2.js
const log = (line) => {
  document.querySelector('#log').textContent += `${line}\n`;
};
const setStatus = (text) => {
  document.querySelector('#status').textContent = text;
};

// 연결은 로그인한 뒤에 연다 - 처음부터 열면 쿠키가 없어 거절된다.
const socket = io({ autoConnect: false });

socket.on('connect', () => setStatus('연결됐어요'));
socket.on('disconnect', () => setStatus('끊겼어요'));
socket.on('notice', (notice) => {
  const item = document.createElement('li');
  item.textContent = notice.text;
  document.querySelector('#notices').append(item);
});

// 새 토큰을 받는다 - 실패하면 에러를 던진다.
async function reissue() {
  const response = await fetch('/api/reissue', { method: 'POST' });
  if (!response.ok) throw new Error('새 토큰을 받지 못했어요');
  log('새 토큰을 받았어요');
}

// 서버가 연결을 거절하면 socket.io-client 는 스스로 다시 시도하지 않는다.
socket.on('connect_error', async (error) => {
  log(`연결이 거절됐어요 - ${error.data?.code}`);
  if (error.data?.code !== 'TOKEN_EXPIRED') return;
  await reissue();
  socket.connect();
});

document.querySelector('#login').addEventListener('click', async () => {
  await fetch('/api/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: 'sujin' }) });
  log('sujin으로 로그인했어요');
  socket.connect();
});
