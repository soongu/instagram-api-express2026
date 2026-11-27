// ~/instagram-api/lab/p3-62/ws-client.js
const socket = new WebSocket('ws://localhost:4002');

socket.addEventListener('open', () => {
  console.log('연결됐어요.');
  socket.send('terminal: 터미널에서도 인사해요');
});

socket.addEventListener('message', (event) => {
  console.log('받았어요 -', event.data);
});
