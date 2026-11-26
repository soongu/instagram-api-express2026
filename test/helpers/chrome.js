// 내부 검증 전용 - 교안에 한 줄도 인용하지 않는다.
//
// 헤드리스 Chrome + DevTools Protocol. `p3-62` 실습 페이지를 학생 브라우저처럼 열고,
// 개발자 도구 Network 탭이 보여 주는 것(요청 · WebSocket 핸드셰이크 · 주고받은 메시지)을 CDP 이벤트로 잰다.
// `instagram-next/.verify` 의 `connectTab` 과 같은 방식이다(Node 24 전역 WebSocket 으로 CDP 에 붙는다).
// 🚫 pkill 류는 쓰지 않는다 - 띄운 Chrome 은 자기 프로세스 그룹만 끈다.
import { spawn } from 'node:child_process';
import { existsSync, mkdtempSync, rmSync } from 'node:fs';
import net from 'node:net';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { setTimeout as sleep } from 'node:timers/promises';

export const CHROME = [
  '/Applications/Google Chrome 2.app/Contents/MacOS/Google Chrome',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
].find((p) => existsSync(p));

function freePort() {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const { port } = server.address();
      server.close(() => resolve(port));
    });
  });
}

async function cdp(wsUrl) {
  const ws = new WebSocket(wsUrl);
  await new Promise((ok, fail) => { ws.addEventListener('open', ok); ws.addEventListener('error', fail); });
  let id = 0;
  const pending = new Map();
  const events = [];
  ws.addEventListener('message', (e) => {
    const m = JSON.parse(e.data);
    if (m.id !== undefined && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); return; }
    events.push({ ...m, at: Date.now() });
  });
  const send = (method, params = {}) => new Promise((ok, fail) => {
    const i = ++id;
    pending.set(i, (m) => (m.error ? fail(new Error(`${method}: ${m.error.message}`)) : ok(m.result)));
    ws.send(JSON.stringify({ id: i, method, params }));
  });
  return { ws, send, events };
}

async function tabOf(wsUrl) {
  const { ws, send, events } = await cdp(wsUrl);
  for (const d of ['Runtime', 'Page', 'Network', 'Log']) await send(`${d}.enable`);
  const tab = {
    events, send,
    /** 이 시점까지 쌓인 이벤트 수 - 뒤에 `since(mark)` 로 그 뒤 것만 본다. */
    mark: () => events.length,
    since: (mark = 0, method = null) => events.slice(mark).filter((e) => method === null || e.method === method),
    async evaluate(expression) {
      const r = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
      if (r.exceptionDetails) throw new Error(`evaluate 실패: ${r.exceptionDetails.text} ${r.exceptionDetails.exception?.description ?? ''}`);
      return r.result.value;
    },
    async waitUntil(expression, timeoutMs = 30_000) {
      const t0 = Date.now();
      for (;;) {
        let ok = false;
        try { ok = await tab.evaluate(`Boolean(${expression})`); } catch { /* 이동 중 */ }
        if (ok) return Date.now() - t0;
        if (Date.now() - t0 > timeoutMs) throw new Error(`«${expression.slice(0, 200)}» 가 ${timeoutMs}ms 안에 참이 안 됐다.`);
        await sleep(20);
      }
    },
    async open(url) {
      await send('Page.navigate', { url });
      await tab.waitUntil("document.readyState === 'complete'");
    },
    /** 화면에 보이는 채팅 줄(`#list li`)의 글자. */
    lines: () => tab.evaluate("[...document.querySelectorAll('#list li')].map((li) => li.textContent)"),
    /** 학생이 입력 칸에 치고 «보내기» 를 누르는 것과 같은 일. */
    async say(text) {
      await tab.evaluate(`(() => {
        const input = document.querySelector('#text');
        input.value = ${JSON.stringify(text)};
        document.querySelector('#form').requestSubmit();
      })()`);
    },
    close: () => { try { ws.close(); } catch { /* 이미 닫힘 */ } },
  };
  return tab;
}

/** Chrome 을 하나 띄운다. `newTab()` 은 같은 브라우저(같은 쿠키)에 탭을 더 연다. */
export async function launchChrome() {
  if (!CHROME) throw new Error('Chrome 이 없습니다 - /Applications 에 Google Chrome 을 두세요.');
  const port = await freePort();
  const profile = mkdtempSync(join(tmpdir(), 'p362-chrome-'));
  const child = spawn(CHROME, [
    '--headless', '--use-mock-keychain', '--disable-gpu', '--no-sandbox', '--no-first-run', '--disable-extensions',
    `--remote-debugging-port=${port}`, `--user-data-dir=${profile}`, 'about:blank',
  ], { detached: true, stdio: 'ignore' });
  const exited = new Promise((ok) => child.on('exit', ok));
  let version = null;
  const t0 = Date.now();
  while (!version) {
    if (Date.now() - t0 > 15_000) throw new Error('Chrome 디버깅 포트가 안 열렸다');
    try { version = await (await fetch(`http://127.0.0.1:${port}/json/version`)).json(); } catch { await sleep(100); }
  }
  const browser = await cdp(version.webSocketDebuggerUrl);
  const tabs = [];
  return {
    async newTab() {
      const { targetId } = await browser.send('Target.createTarget', { url: 'about:blank' });
      let target = null;
      for (let i = 0; i < 50 && !target; i += 1) {
        target = (await (await fetch(`http://127.0.0.1:${port}/json/list`)).json()).find((t) => t.id === targetId);
        if (!target) await sleep(100);
      }
      const tab = await tabOf(target.webSocketDebuggerUrl);
      tabs.push(tab);
      return tab;
    },
    async close() {
      for (const t of tabs) t.close();
      browser.ws.close();
      try { process.kill(-child.pid, 'SIGTERM'); } catch { /* 이미 없음 */ }
      await Promise.race([exited, sleep(5000)]);
      try { process.kill(-child.pid, 'SIGKILL'); } catch { /* 이미 없음 */ }
      rmSync(profile, { recursive: true, force: true });
    },
  };
}
