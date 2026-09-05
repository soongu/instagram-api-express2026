// 내부 검증 전용 — 교안에 한 줄도 인용하지 않는다.
//
// 🚨 supertest 를 못 쓰는 이유가 있다. `p2-22` 의 `app.js` 는 학생이 실제로 쓰는
//    모양 그대로 «파일 끝에서 `app.listen()` 을 부르고 `app` 을 내보내지 않는다».
//    supertest 는 app 객체를 받아야 하므로, 그것을 쓰려면 교안이 app/server 를
//    쪼개야 하는데 첫 회차에 그 간접층을 넣을 이유가 없다.
//    그래서 **학생이 치는 그 명령(`node app.js`)을 그대로 띄우고** 실제 포트로
//    왕복한다. 「테스트가 쓰는 도구가 학생이 쓰는 도구와 같은가」를 지키는 쪽이다.
import { spawn } from 'node:child_process';
import net from 'node:net';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

export function portIsFree(port) {
  return new Promise((resolve) => {
    const socket = net.connect({ port, host: '127.0.0.1' });
    socket.setTimeout(400);
    socket.on('connect', () => { socket.destroy(); resolve(false); });
    socket.on('timeout', () => { socket.destroy(); resolve(true); });
    socket.on('error', () => resolve(true));
  });
}

/** `node <file>` 를 띄우고 첫 로그 줄이 나올 때까지 기다린다. */
export async function boot(file, { port = 3000, timeoutMs = 8000 } = {}) {
  if (!(await portIsFree(port))) {
    throw new Error(
      `포트 ${port} 가 이미 물려 있습니다. 교안이 틀린 게 아니라 환경입니다 — ` +
      `그 포트를 쓰는 프로세스를 끄고 다시 도세요.`);
  }
  const child = spawn(process.execPath, [file], { cwd: ROOT });
  let log = '';
  const first = await new Promise((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new Error(`${file} 가 ${timeoutMs}ms 안에 아무 말도 안 했습니다.\n${log}`)),
      timeoutMs);
    child.stdout.on('data', (buf) => {
      log += buf.toString();
      if (log.includes('\n')) { clearTimeout(timer); resolve(log); }
    });
    child.stderr.on('data', (buf) => { log += buf.toString(); });
    child.on('exit', (code) => {
      clearTimeout(timer);
      reject(new Error(`${file} 가 뜨자마자 끝났습니다 (exit ${code}).\n${log}`));
    });
  });
  return {
    log: first,
    base: `http://localhost:${port}`,
    stop: () => new Promise((resolve) => {
      child.on('exit', resolve);
      child.kill();
    }),
  };
}
