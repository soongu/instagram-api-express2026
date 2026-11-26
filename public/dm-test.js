// ~/instagram-api/public/dm-test.js
const status = document.querySelector('#status');
const result = document.querySelector('#result');
const typingLine = document.querySelector('#typing');
const list = document.querySelector('#list');
const room = document.querySelector('#room');
const text = document.querySelector('#text');
let socket;
let typingTimer;
let typing = false;

// 로그인하면 서버가 로그인 쿠키를 준다. 그다음에 연결을 열면 그 쿠키가 함께 간다.
document.querySelector('#login').addEventListener('submit', async (event) => {
  event.preventDefault();
  const res = await fetch('/api/v2/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      username: document.querySelector('#username').value,
      password: document.querySelector('#password').value,
    }),
  });
  status.textContent = res.ok ? '로그인했어요. 연결하는 중...' : '로그인하지 못했어요';
  connect();
});

function connect() {
  // 다른 사람으로 다시 로그인했으면 앞 연결을 닫고 새로 연다.
  socket?.disconnect();
  socket = io();

  socket.on('connect', () => {
    status.textContent = '연결됐어요';
  });

  socket.on('connect_error', (error) => {
    status.textContent = `연결하지 못했어요 - ${error.message}`;
  });

  socket.on('disconnect', () => {
    status.textContent = '연결이 끊겼어요';
  });

  socket.on('dm:message', (message) => {
    const li = document.createElement('li');
    li.textContent = `${message.conversationId}번 방 · ${message.senderId}번 사용자: ${message.content}`;
    list.append(li);
  });

  socket.on('dm:typing', (event) => {
    typingLine.textContent = event.typing ? `${event.conversationId}번 방 · ${event.senderId}번 사용자가 입력 중이에요...` : '';
  });
}

// 입력 중이라고 한 번 알리고, 3초 동안 더 치지 않으면 멈췄다고 알린다.
function setTyping(value) {
  if (typing === value) return;
  typing = value;
  socket.emit('dm:typing', { conversationId: Number(room.value), typing: value });
}

text.addEventListener('input', () => {
  setTyping(true);
  clearTimeout(typingTimer);
  typingTimer = setTimeout(() => setTyping(false), 3000);
});

// 보내고 5초 안에 서버가 답하지 않으면 그 사실을 적는다.
document.querySelector('#send').addEventListener('submit', (event) => {
  event.preventDefault();
  clearTimeout(typingTimer);
  setTyping(false);
  result.textContent = '보내는 중...';
  socket.timeout(5000).emit('dm:send', { conversationId: Number(room.value), content: text.value }, (error, response) => {
    result.textContent = error ? '5초 동안 서버가 답하지 않았어요' : JSON.stringify(response);
  });
  text.value = '';
});
