// ~/instagram-api/lab/p3-69/public/watch.js
const status = document.querySelector('#status');
const list = document.querySelector('#list');

// 같은 주소(4072)로 연결을 연다 - 수업 백엔드에서 로그인할 때 받은 쿠키가 함께 간다.
const socket = io();

socket.on('connect', () => {
  status.textContent = '연결됐어요';
});

socket.on('connect_error', (error) => {
  status.textContent = `연결하지 못했어요 - ${error.message}`;
});

// 서버가 보내는 이벤트는 이름이 무엇이든 받은 차례대로 한 줄씩 적는다.
socket.onAny((event, payload) => {
  const li = document.createElement('li');
  li.textContent = `${event} ${JSON.stringify(payload)}`;
  list.append(li);
});
