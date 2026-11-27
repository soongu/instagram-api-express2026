// ~/instagram-api/lab/p3-70/public/cookie-site.js
const log = (line) => {
  document.querySelector('#log').textContent += `${line}\n`;
};

// 로그인한 뒤 «나는 누구» 를 물어 쿠키가 따라갔는지 본다.
async function tryLogin(base, sameSite) {
  const login = await fetch(`${base}/api/login?sameSite=${sameSite}`, { method: 'POST', credentials: 'include' });
  log(`로그인 ${login.status} ${(await login.json()).message}`);
  const me = await fetch(`${base}/api/me`, { credentials: 'include' });
  log(`나는 누구 ${me.status} ${JSON.stringify(await me.json())}`);
}

document.querySelector('#direct-lax').addEventListener('click', () => tryLogin('http://127.0.0.1:4077', 'lax'));
document.querySelector('#direct-none').addEventListener('click', () => tryLogin('http://127.0.0.1:4077', 'none'));
document.querySelector('#same').addEventListener('click', () => tryLogin('', 'lax'));
