// p3-62 「WebSocket 원리와 Socket.IO」 게이트 - 교안 Step 본문(실습 서버 `lab/p3-62/`)
// 내부 검증 전용 - 교안에 한 줄도 인용하지 않는다.
//
// 이 회차는 Step 본문도 실습 서버다(「`p3-62` 착수 결정」 ①). 같은 파일(`chat-http.js` 등)이 Step 마다 자라므로
// 판정은 «그 Step 커밋» 을 풀어서 띄운다 - 북마크 `code/p3-62`(없으면 HEAD)의 로그에서 제목 `feat(p3-62): … (Step N)` 으로 찾는다.
// 커밋이 아직 없으면(짓는 중) 작업트리를 쓴다.
// 화면 쪽 주장(Network 탭에 무엇이 몇 번 · 다른 탭에 언제 보이나)은 헤드리스 Chrome 으로 잰다(`helpers/chrome.js`).
// 🔑 포트 - 학생 파일은 4001(폴링·롱 폴링) · 4002(맨 WebSocket) · 4003(Socket.IO). 판정은 사본에서 그 숫자만 4300~4399 의 빈 포트로 바꿔 띄운다(`serve`).
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { execFileSync, spawn, spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { setTimeout as sleep } from 'node:timers/promises';
import { boot, portIsFree } from './helpers/boot.js';
import { launchChrome } from './helpers/chrome.js';
import { ROOT, commitSha, commitDir, serve, note, PAGE } from './helpers/p362.js';

const git = (...args) => execFileSync('git', args, { cwd: ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
const stepSha = (n) => commitSha(`Step ${n}`);
const stepDir = (n) => commitDir(`Step ${n}`);

/** 그 탭이 그 주소로 보낸 요청(Network 탭 한 줄)들. */
const requestsTo = (tab, mark, path) => tab.since(mark, 'Network.requestWillBeSent')
  .filter((e) => new URL(e.params.request.url).pathname === path)
  .map((e) => ({ method: e.params.request.method, url: e.params.request.url, at: e.at }));

let chrome;
beforeAll(async () => { chrome = await launchChrome(); }, 30_000);
afterAll(async () => { await chrome?.close(); });

describe('Step 2 - 폴링: 2초마다 묻는다', () => {
  let step, server, a, b;
  beforeAll(async () => {
    step = stepDir(2);
    server = await serve(step, 'lab/p3-62/chat-http.js', 4001, '기다리고 있어요');
    a = await chrome.newTab();
    b = await chrome.newTab();
    await a.open(PAGE(server.port, 'polling.html', 'jaehoon'));
    await b.open(PAGE(server.port, 'polling.html', 'minji'));
  }, 30_000);
  afterAll(async () => { await server?.stop(); step?.cleanup(); });

  it('서버를 띄우면 문장 한 줄이 찍힌다', () => {
    expect(server.log.trim()).toBe('채팅 서버가 http://localhost:4001 에서 기다리고 있어요.');
  });

  it('아무도 말하지 않아도 탭마다 2초에 한 번 GET /messages 가 나가고 답은 빈 배열이다', async () => {
    const mark = b.mark();
    await sleep(10_200);
    const polls = requestsTo(b, mark, '/messages').filter((r) => r.method === 'GET');
    // 10.2초 동안 5번(2초 간격) - 1분이면 30번
    expect(polls.length).toBe(5);
    const gaps = polls.slice(1).map((r, i) => r.at - polls[i].at);
    for (const g of gaps) expect(g).toBeGreaterThan(1800), expect(g).toBeLessThan(2300);
    const bodies = await b.evaluate(`fetch('/messages?after=0').then((r) => r.json())`);
    expect(bodies).toEqual([]);
  }, 30_000);

  it('A 탭에서 보내면 B 탭에는 다음 물음 때 보인다 - 늦어도 2초 안쪽', async () => {
    const waits = [];
    for (let i = 1; i <= 5; i += 1) {
      await sleep(Math.round(Math.random() * 2000));
      const before = (await b.lines()).length;
      const t0 = Date.now();
      await a.say(`안녕 ${i}`);
      await b.waitUntil(`document.querySelectorAll('#list li').length > ${before}`, 5000);
      waits.push(Date.now() - t0);
    }
    note('[Step 2] A 가 보낸 뒤 B 에 보이기까지(ms):', waits.join(' · '));
    for (const w of waits) expect(w).toBeLessThan(2300);
    expect(await b.lines()).toEqual(['jaehoon: 안녕 1', 'jaehoon: 안녕 2', 'jaehoon: 안녕 3', 'jaehoon: 안녕 4', 'jaehoon: 안녕 5']);
  }, 60_000);

  it('보낸 사람 자기 탭에도 POST 응답이 아니라 다음 물음 때 보인다', async () => {
    const before = (await a.lines()).length;
    await sleep(100); // 방금 물은 직후를 피한다
    const mark = a.mark();
    await a.say('내 화면에는?');
    const posted = requestsTo(a, mark, '/messages').find((r) => r.method === 'POST');
    expect(posted).toBeTruthy();
    await a.waitUntil(`document.querySelectorAll('#list li').length > ${before}`, 5000);
    const lastGet = requestsTo(a, mark, '/messages').filter((r) => r.method === 'GET').at(-1);
    expect(lastGet.at).toBeGreaterThan(posted.at);
  }, 30_000);
});

describe('Step 3 - 롱 폴링: 새 메시지가 올 때까지 응답을 붙잡는다', () => {
  let step, server, a, b, markB;
  beforeAll(async () => {
    step = stepDir(3);
    server = await serve(step, 'lab/p3-62/chat-http.js', 4001, '기다리고 있어요');
    a = await chrome.newTab();
    b = await chrome.newTab();
    await a.open(PAGE(server.port, 'long-polling.html', 'jaehoon'));
    markB = b.mark();
    await b.open(PAGE(server.port, 'long-polling.html', 'minji'));
  }, 30_000);
  afterAll(async () => { await server?.stop(); step?.cleanup(); });

  /** 그 탭의 `/messages/wait` 요청마다 보낸 시각과 끝난 시각(끝나지 않았으면 null). */
  const waits = (tab, mark) => {
    const sent = tab.since(mark, 'Network.requestWillBeSent').filter((e) => e.params.request.url.includes('/messages/wait'));
    const done = new Map(tab.since(mark, 'Network.loadingFinished').map((e) => [e.params.requestId, e.at]));
    return sent.map((e) => ({ at: e.at, end: done.get(e.params.requestId) ?? null }));
  };

  it('아무도 말하지 않으면 요청 하나가 끝나지 않은 채 남는다 - 10초 동안 새 요청 0', async () => {
    await sleep(10_000);
    const w = waits(b, markB);
    expect(w.length).toBe(1);
    expect(w[0].end).toBeNull();
  }, 30_000);

  it('25초가 지나면 빈 배열로 끝나고 곧바로 다음 요청이 나간다', async () => {
    await b.waitUntil('true');
    const t0 = waits(b, markB)[0].at;
    for (;;) {
      if (waits(b, markB).length >= 2) break;
      if (Date.now() - t0 > 30_000) throw new Error('25초 뒤 다음 요청이 안 나갔다');
      await sleep(50);
    }
    const [first, second] = waits(b, markB);
    note('[Step 3] 첫 요청이 끝나기까지(ms):', first.end - first.at, '· 끝난 뒤 다음 요청까지(ms):', second.at - first.end);
    expect(first.end - first.at).toBeGreaterThan(24_900);
    expect(first.end - first.at).toBeLessThan(25_600);
    expect(second.at - first.end).toBeLessThan(100);
    expect(await b.lines()).toEqual([]);
  }, 40_000);

  it('A 탭에서 보내면 B 탭에 곧바로 보이고, 메시지 하나마다 요청 하나가 끝나고 다음 요청이 시작된다', async () => {
    const result = [];
    for (let i = 1; i <= 5; i += 1) {
      await sleep(300 + Math.round(Math.random() * 700));
      const before = (await b.lines()).length;
      const count = waits(b, markB).length;
      const t0 = Date.now();
      await a.say(`안녕 ${i}`);
      await b.waitUntil(`document.querySelectorAll('#list li').length > ${before}`, 5000);
      result.push(Date.now() - t0);
      await sleep(100);
      expect(waits(b, markB).length).toBe(count + 1);
    }
    note('[Step 3] A 가 보낸 뒤 B 에 보이기까지(ms):', result.join(' · '));
    for (const ms of result) expect(ms).toBeLessThan(300);
    expect(await b.lines()).toEqual(['jaehoon: 안녕 1', 'jaehoon: 안녕 2', 'jaehoon: 안녕 3', 'jaehoon: 안녕 4', 'jaehoon: 안녕 5']);
    expect(await a.lines()).toEqual(await b.lines());
  }, 60_000);
});

describe("Step 3 🙋 - cache: 'no-store' 를 빼면 둘째 탭의 요청이 앞 탭 요청 뒤에 서 있는다", () => {
  let step, server, a, b, markB, t0;
  beforeAll(async () => {
    step = stepDir(3);
    const page = join(step.dir, 'lab/p3-62/public/long-polling.html');
    const src = readFileSync(page, 'utf8');
    const without = src.replace(", { cache: 'no-store' }", '');
    expect(without).not.toBe(src);
    expect(without).not.toMatch(/fetch\([^\n]*no-store/);
    writeFileSync(page, without);
    server = await serve(step, 'lab/p3-62/chat-http.js', 4001, '기다리고 있어요');
    a = await chrome.newTab();
    b = await chrome.newTab();
    await a.open(PAGE(server.port, 'long-polling.html', 'jaehoon'));
    markB = b.mark();
    t0 = Date.now();
    await b.open(PAGE(server.port, 'long-polling.html', 'minji'));
  }, 30_000);
  afterAll(async () => { await server?.stop(); step?.cleanup(); });

  it('둘째 탭의 /messages/wait 는 Network 탭에 줄은 생기지만 서버로는 20초쯤 뒤에야 나간다', async () => {
    await sleep(23_000);
    const listed = b.since(markB, 'Network.requestWillBeSent').filter((e) => e.params.request.url.includes('/messages/wait'));
    expect(listed.length).toBe(1);
    // requestWillBeSentExtraInfo 는 실제로 보낸 요청 헤더가 나올 때 온다 - 페이지 요청 다음 것이 wait 요청이다
    const sentAt = b.since(markB, 'Network.requestWillBeSentExtraInfo')
      .filter((e) => e.params.requestId === listed[0].params.requestId).map((e) => e.at - t0);
    note('[Step 3 🙋] no-store 없는 판 - 둘째 탭 wait 가 실제로 나간 때(ms):', sentAt.join(' · '));
    expect(sentAt.length).toBe(1);
    expect(sentAt[0]).toBeGreaterThan(19_000);
    expect(sentAt[0]).toBeLessThan(21_500);
  }, 40_000);
});

/** RFC 6455 4.2.2 - Accept 는 Key 뒤에 정해진 글자를 붙여 SHA-1 로 해시한 값의 base64 다. */
const acceptOf = (key) => createHash('sha1').update(`${key}258EAFA5-E914-47DA-95CA-C5AB0DC85B11`).digest('base64');

describe('Step 4 - 연결을 열어 두기: HTTP 요청으로 시작해 101 로 갈아탄다', () => {
  let step, server, tab, mark;
  beforeAll(async () => {
    step = stepDir(4);
    server = await serve(step, 'lab/p3-62/chat-ws.js', 4002, '기다리고 있어요');
  }, 30_000);
  afterAll(async () => { await server?.stop(); step?.cleanup(); });

  it('package.json 에 ws 가 dependencies 로 들어간다(이 Step 에서 처음)', () => {
    const at = (n) => JSON.parse(execFileSync('git', ['show', `${stepSha(n)}:package.json`], { cwd: ROOT, encoding: 'utf8' }));
    if (!stepSha(4)) return; // 짓는 중
    expect(at(3).dependencies.ws).toBeUndefined();
    expect(at(4).dependencies.ws).toMatch(/^\^8\./);
  });

  it('curl 로 Upgrade 요청을 보내면 101 Switching Protocols 와 Sec-WebSocket-Accept 가 온다', async () => {
    const key = 'dGhlIHNhbXBsZSBub25jZQ==';
    const r = spawnSync('curl', ['-i', '-N', '-s', '-m', '2',
      '-H', 'Connection: Upgrade', '-H', 'Upgrade: websocket', '-H', 'Sec-WebSocket-Version: 13', '-H', `Sec-WebSocket-Key: ${key}`,
      `http://localhost:${server.port}/`], { encoding: 'utf8' });
    const out = r.stdout.replace(/\r/g, '');
    note('[Step 4] curl 출력:\n' + out);
    expect(out).toBe([
      'HTTP/1.1 101 Switching Protocols',
      'Upgrade: websocket',
      'Connection: Upgrade',
      `Sec-WebSocket-Accept: ${acceptOf(key)}`,
      '', '',
    ].join('\n'));
    expect(acceptOf(key)).toBe('s3pPLMBiTxaQ9kYGzzhZRbK+xOo='); // RFC 6455 1.3 의 예와 같다
    expect(r.status).toBe(28); // -m 2 로 끊었다(연결이 닫히지 않으니 curl 은 스스로 안 끝난다)
    await sleep(200);
    expect(server.tail()).toContain('연결이 하나 열렸어요. 지금 연결은 1개예요.\n연결이 하나 닫혔어요. 지금 연결은 0개예요.');
  });

  it('브라우저가 페이지를 열면 Network 탭에 ws:// 요청 하나 - 요청 헤더에 Upgrade 와 Key, 응답은 101 과 Accept', async () => {
    tab = await chrome.newTab();
    mark = tab.mark();
    await tab.open(`http://localhost:${server.port}/ws.html`);
    await tab.waitUntil("document.querySelector('#status').textContent === '연결됐어요'", 5000);
    const created = tab.since(mark, 'Network.webSocketCreated');
    expect(created.map((e) => e.params.url)).toEqual([`ws://localhost:${server.port}/`]);
    const req = tab.since(mark, 'Network.webSocketWillSendHandshakeRequest')[0].params.request.headers;
    const res = tab.since(mark, 'Network.webSocketHandshakeResponseReceived')[0].params.response;
    note('[Step 4] 브라우저 핸드셰이크 요청 헤더:', JSON.stringify(req), '\n응답:', res.status, res.statusText, JSON.stringify(res.headers));
    expect(req.Upgrade).toBe('websocket');
    expect(req.Connection).toBe('Upgrade');
    expect(req['Sec-WebSocket-Version']).toBe('13');
    expect(req['Sec-WebSocket-Key']).toMatch(/^[A-Za-z0-9+/]{22}==$/);
    expect(res.status).toBe(101);
    expect(res.headers['Sec-WebSocket-Accept'] ?? res.headers['sec-websocket-accept']).toBe(acceptOf(req['Sec-WebSocket-Key']));
    await sleep(200);
    expect(server.tail()).toContain('연결이 하나 열렸어요. 지금 연결은 1개예요.');
  });

  it('탭을 하나 더 열면 연결이 2개, 탭을 닫으면 닫혔다는 줄이 찍힌다', async () => {
    const second = await chrome.newTab();
    await second.open(`http://localhost:${server.port}/ws.html`);
    await second.waitUntil("document.querySelector('#status').textContent === '연결됐어요'", 5000);
    await sleep(100);
    expect(server.tail()).toContain('연결이 하나 열렸어요. 지금 연결은 2개예요.');
    // 🚨 다른 주소로 옮기기만 하면 연결이 닫히지 않는다(8초 넘게 남는다 - 뒤로 가기 캐시로 보인다 · 2026-11-26 실측).
    //    교안은 «탭을 닫으면» 만 말한다. 탭 닫기와 새로고침은 50ms 안쪽에 닫힌다.
    await second.send('Page.close');
    await sleep(500);
    expect(server.tail().trim().split('\n').at(-1)).toBe('연결이 하나 닫혔어요. 지금 연결은 1개예요.');
  });
});

/** Node 스크립트(학생이 `node lab/p3-62/xxx.js` 로 치는 것)를 사본에서 포트만 바꿔 띄운다 - 출력은 계속 모은다. */
function runScript(step, file, studentPort, port) {
  const path = join(step.dir, file);
  const original = readFileSync(path, 'utf8');
  writeFileSync(path, original.replaceAll(String(studentPort), String(port)));
  const env = { ...process.env };
  delete env.NODE_ENV;
  delete env.VITEST;
  const child = spawn(process.execPath, [file], { cwd: step.dir, env });
  let out = '';
  child.stdout.on('data', (b) => { out += b; });
  child.stderr.on('data', (b) => { out += b; });
  return { out: () => out.replaceAll(String(port), String(studentPort)), stop: () => new Promise((ok) => { child.on('exit', ok); child.kill('SIGINT'); }) };
}

const statusIs = (text) => `document.querySelector('#status').textContent === ${JSON.stringify(text)}`;

describe('Step 5 - 맨 WebSocket 으로 채팅: 서버가 모든 연결로 보낸다', () => {
  let step, server, a, b, markA, markB, client;
  beforeAll(async () => {
    step = stepDir(5);
    server = await serve(step, 'lab/p3-62/chat-ws.js', 4002, '기다리고 있어요');
    a = await chrome.newTab();
    b = await chrome.newTab();
    await a.open(PAGE(server.port, 'ws.html', 'jaehoon'));
    await b.open(PAGE(server.port, 'ws.html', 'minji'));
    await a.waitUntil(statusIs('연결됐어요'));
    await b.waitUntil(statusIs('연결됐어요'));
  }, 30_000);
  afterAll(async () => { await client?.stop(); await server?.stop(); step?.cleanup(); });

  it('A 탭에서 보내면 A 와 B 두 탭에 곧바로 보이고, 그동안 HTTP 요청은 하나도 안 나간다', async () => {
    markA = a.mark();
    markB = b.mark();
    const result = [];
    for (let i = 1; i <= 5; i += 1) {
      await sleep(300);
      const t0 = Date.now();
      await a.say(`안녕 ${i}`);
      await b.waitUntil(`document.querySelectorAll('#list li').length === ${i}`, 3000);
      result.push(Date.now() - t0);
    }
    note('[Step 5] A 가 보낸 뒤 B 에 보이기까지(ms):', result.join(' · '));
    for (const ms of result) expect(ms).toBeLessThan(150);
    const want = [1, 2, 3, 4, 5].map((i) => `jaehoon: 안녕 ${i}`);
    expect(await b.lines()).toEqual(want);
    await a.waitUntil(`document.querySelectorAll('#list li').length === 5`, 3000);
    expect(await a.lines()).toEqual(want);
    expect(a.since(markA, 'Network.requestWillBeSent')).toEqual([]);
    expect(b.since(markB, 'Network.requestWillBeSent')).toEqual([]);
    // 개발자 도구의 메시지 칸 - A 는 보낸 줄(↑)과 받은 줄(↓)이 다섯씩, B 는 받은 줄만 다섯
    expect(a.since(markA, 'Network.webSocketFrameSent').map((e) => e.params.response.payloadData)).toEqual(want);
    expect(a.since(markA, 'Network.webSocketFrameReceived').map((e) => e.params.response.payloadData)).toEqual(want);
    expect(b.since(markB, 'Network.webSocketFrameSent')).toEqual([]);
    expect(b.since(markB, 'Network.webSocketFrameReceived').map((e) => e.params.response.payloadData)).toEqual(want);
  }, 30_000);

  it('Node 24 의 전역 WebSocket 으로 띄운 스크립트도 같은 서버에 붙어 주고받는다', async () => {
    client = runScript(step, 'lab/p3-62/ws-client.js', 4002, server.port);
    await b.waitUntil(`document.querySelectorAll('#list li').length === 6`, 5000);
    expect((await b.lines()).at(-1)).toBe('terminal: 터미널에서도 인사해요');
    await a.say('터미널 들려요?');
    await b.waitUntil(`document.querySelectorAll('#list li').length === 7`, 3000);
    await sleep(200);
    note('[Step 5] ws-client.js 출력:\n' + client.out());
    expect(client.out()).toBe('연결됐어요.\n받았어요 - terminal: 터미널에서도 인사해요\n받았어요 - jaehoon: 터미널 들려요?\n');
    expect(server.tail()).toContain('연결이 하나 열렸어요. 지금 연결은 3개예요.');
  }, 30_000);
});

describe('Step 5 🙋 - data.toString() 을 빼면 브라우저에는 [object Blob] 이 찍힌다', () => {
  let step, server, a;
  beforeAll(async () => {
    step = stepDir(5);
    const file = join(step.dir, 'lab/p3-62/chat-ws.js');
    const src = readFileSync(file, 'utf8');
    const without = src.replace('const text = data.toString();', 'const text = data;');
    expect(without).not.toBe(src);
    writeFileSync(file, without);
    server = await serve(step, 'lab/p3-62/chat-ws.js', 4002, '기다리고 있어요');
    a = await chrome.newTab();
    await a.open(PAGE(server.port, 'ws.html', 'jaehoon'));
    await a.waitUntil(statusIs('연결됐어요'));
  }, 30_000);
  afterAll(async () => { await server?.stop(); step?.cleanup(); });

  it('Buffer 를 그대로 보내면 바이너리 프레임이 되고 화면 줄은 [object Blob]', async () => {
    const mark = a.mark();
    await a.say('안녕');
    await a.waitUntil(`document.querySelectorAll('#list li').length === 1`, 3000);
    expect(await a.lines()).toEqual(['[object Blob]']);
    const frame = a.since(mark, 'Network.webSocketFrameReceived')[0].params.response;
    expect(frame.opcode).toBe(2); // 바이너리
  }, 20_000);
});

const typingText = (tab) => tab.evaluate("document.querySelector('#typing').textContent");

describe('Step 6 겪기 - Step 5 판에서 «입력 중» 을 글자로 보내면 채팅 줄로 찍힌다', () => {
  let step, server, a, b;
  beforeAll(async () => {
    step = stepDir(5);
    server = await serve(step, 'lab/p3-62/chat-ws.js', 4002, '기다리고 있어요');
    a = await chrome.newTab();
    b = await chrome.newTab();
    await a.open(PAGE(server.port, 'ws.html', 'jaehoon'));
    await b.open(PAGE(server.port, 'ws.html', 'minji'));
    await b.waitUntil(statusIs('연결됐어요'));
  }, 30_000);
  afterAll(async () => { await server?.stop(); step?.cleanup(); });

  it("Console 에서 socket.send('minji님이 입력 중이에요...') 를 치면 두 탭 모두 채팅 목록에 한 줄이 생긴다", async () => {
    await b.evaluate("socket.send('minji님이 입력 중이에요...')");
    await a.waitUntil(`document.querySelectorAll('#list li').length === 1`, 3000);
    await b.waitUntil(`document.querySelectorAll('#list li').length === 1`, 3000);
    expect(await a.lines()).toEqual(['minji님이 입력 중이에요...']);
    expect(await b.lines()).toEqual(['minji님이 입력 중이에요...']);
  });
});

describe('Step 6 - 메시지에 종류를 붙인다 · 다시 붙지 않는다', () => {
  let step, server, a, b;
  beforeAll(async () => {
    step = stepDir(6);
    server = await serve(step, 'lab/p3-62/chat-ws.js', 4002, '기다리고 있어요');
    a = await chrome.newTab();
    b = await chrome.newTab();
    await a.open(PAGE(server.port, 'ws.html', 'jaehoon'));
    await b.open(PAGE(server.port, 'ws.html', 'minji'));
    await a.waitUntil(statusIs('연결됐어요'));
    await b.waitUntil(statusIs('연결됐어요'));
  }, 30_000);
  afterAll(async () => { await server?.stop(); step?.cleanup(); });

  it('B 가 입력 칸에 치면 A 에만 «minji님이 입력 중이에요...» 가 보이고 3초 뒤 사라진다 · 채팅 목록은 그대로', async () => {
    // 🚨 뒤에 있는 탭은 Chrome 이 타이머를 1초 단위로 미뤄 3초가 3.8초쯤 된다 - 학생은 두 창을 나란히 둔다(둘 다 보인다).
    await a.send('Page.bringToFront');
    await b.evaluate(`(() => { const i = document.querySelector('#text'); i.value = '안'; i.dispatchEvent(new Event('input')); })()`);
    await a.waitUntil(`document.querySelector('#typing').textContent === 'minji님이 입력 중이에요...'`, 3000);
    const t0 = Date.now();
    expect(await typingText(b)).toBe('');
    expect(await a.lines()).toEqual([]);
    await a.waitUntil(`document.querySelector('#typing').textContent === ''`, 5000);
    const gone = Date.now() - t0;
    note('[Step 6] 입력 중 표시가 사라지기까지(ms):', gone);
    expect(gone).toBeGreaterThan(2900);
    expect(gone).toBeLessThan(3400);
  }, 20_000);

  it('B 가 보내면 두 탭에 채팅 줄이 생기고 A 의 «입력 중» 은 바로 지워진다', async () => {
    await b.evaluate(`(() => { const i = document.querySelector('#text'); i.value = '안녕'; i.dispatchEvent(new Event('input')); })()`);
    await a.waitUntil(`document.querySelector('#typing').textContent !== ''`, 3000);
    await b.evaluate("document.querySelector('#form').requestSubmit()");
    await a.waitUntil(`document.querySelectorAll('#list li').length === 1`, 3000);
    expect(await typingText(a)).toBe('');
    expect(await a.lines()).toEqual(['minji: 안녕']);
    await b.waitUntil(`document.querySelectorAll('#list li').length === 1`, 3000);
    expect(await b.lines()).toEqual(['minji: 안녕']);
  }, 20_000);

  it('JSON 이 아닌 글자(Step 5 의 ws-client.js 인사)는 서버가 버린다 - 아무 탭에도 안 보이고 서버는 그대로 산다', async () => {
    const client = runScript(step, 'lab/p3-62/ws-client.js', 4002, server.port);
    await sleep(800);
    await client.stop();
    expect(await a.lines()).toEqual(['minji: 안녕']);
    expect(client.out()).toBe('연결됐어요.\n');
    await a.say('아직 살아 있어요?');
    await b.waitUntil(`document.querySelectorAll('#list li').length === 2`, 3000);
  }, 20_000);

  it('서버를 끄면 두 탭이 «연결이 끊겼어요» · 다시 켜도 5초 동안 아무도 다시 붙지 않는다 · 보내기는 Console 에 경고만', async () => {
    await server.stop();
    await a.waitUntil(statusIs('연결이 끊겼어요'), 3000);
    await b.waitUntil(statusIs('연결이 끊겼어요'), 3000);
    server = await boot('lab/p3-62/chat-ws.js', { port: server.port, cwd: step.dir, ready: '기다리고 있어요' });
    await sleep(5000);
    expect(server.tail()).not.toContain('연결이 하나 열렸어요');
    expect(await a.evaluate("document.querySelector('#status').textContent")).toBe('연결이 끊겼어요');
    const mark = a.mark();
    await a.say('들리나요?');
    await sleep(300);
    const logs = a.since(mark).filter((e) => e.method === 'Runtime.consoleAPICalled' || e.method === 'Log.entryAdded' || e.method === 'Runtime.exceptionThrown');
    const texts = logs.map((e) => e.params.entry?.text ?? e.params.args?.map((x) => x.value).join(' ') ?? e.params.exceptionDetails?.text);
    note('[Step 6] 끊긴 뒤 보내기 - Console:', JSON.stringify(texts));
    expect(texts).toContain('WebSocket is already in CLOSING or CLOSED state.');
    expect(await b.lines()).toHaveLength(2);
  }, 30_000);
});

describe('Step 6 🙋 - try 없이 JSON.parse 하면 JSON 이 아닌 메시지 하나에 서버가 죽는다', () => {
  let step, server, a;
  beforeAll(async () => {
    step = stepDir(6);
    const file = join(step.dir, 'lab/p3-62/chat-ws.js');
    const src = readFileSync(file, 'utf8');
    const without = src.replace(`    let message;
    try {
      message = JSON.parse(data.toString());
    } catch {
      return; // JSON 이 아니면 버린다
    }
`, `    const message = JSON.parse(data.toString());
`);
    expect(without).not.toBe(src);
    writeFileSync(file, without);
    server = await serve(step, 'lab/p3-62/chat-ws.js', 4002, '기다리고 있어요');
    a = await chrome.newTab();
    await a.open(PAGE(server.port, 'ws.html', 'jaehoon'));
    await a.waitUntil(statusIs('연결됐어요'));
  }, 30_000);
  afterAll(async () => { step?.cleanup(); });

  it("Console 에서 socket.send('안녕') 한 줄이면 서버가 SyntaxError 로 끝나고 탭은 «연결이 끊겼어요»", async () => {
    await a.evaluate("socket.send('안녕')");
    await a.waitUntil(statusIs('연결이 끊겼어요'), 3000);
    await sleep(200);
    note('[Step 6 🙋] try 없는 판 서버 끝 출력:\n' + server.tail());
    expect(server.tail()).toContain('SyntaxError: Unexpected token');
    expect(await portIsFree(server.port)).toBe(true);
  }, 20_000);
});

describe('Step 7 - Socket.IO: 이벤트 이름 · 방 · 다시 붙기', () => {
  let step, server, a, b, c, markA;
  beforeAll(async () => {
    step = stepDir(7);
    server = await serve(step, 'lab/p3-62/chat-io.js', 4003, '기다리고 있어요');
    a = await chrome.newTab();
    b = await chrome.newTab();
    c = await chrome.newTab();
    markA = a.mark();
    await a.open(PAGE(server.port, 'io.html', 'jaehoon'));
    await b.open(PAGE(server.port, 'io.html', 'minji'));
    await c.open(PAGE(server.port, 'io.html', 'seoyeon'));
    for (const t of [a, b, c]) await t.waitUntil(statusIs('연결됐어요'), 5000);
    await sleep(500);
  }, 30_000);
  afterAll(async () => { await server?.stop(); step?.cleanup(); });

  it('package.json 에 socket.io 가 이 Step 에서 들어간다', () => {
    if (!stepSha(7)) return;
    const at = (n) => JSON.parse(execFileSync('git', ['show', `${stepSha(n)}:package.json`], { cwd: ROOT, encoding: 'utf8' }));
    expect(at(6).dependencies['socket.io']).toBeUndefined();
    expect(at(7).dependencies['socket.io']).toMatch(/^\^4\./);
  });

  it('Network 탭 - socket.io.js 를 받고, HTTP(polling)로 먼저 붙은 뒤 websocket 으로 갈아탄다(101)', () => {
    const reqs = a.since(markA, 'Network.requestWillBeSent').map((e) => {
      const u = new URL(e.params.request.url);
      return `${e.params.request.method} ${u.pathname}${u.searchParams.get('transport') ? `?transport=${u.searchParams.get('transport')}` : ''}`;
    });
    const ws = a.since(markA, 'Network.webSocketCreated').map((e) => new URL(e.params.url));
    const res101 = a.since(markA, 'Network.webSocketHandshakeResponseReceived').map((e) => e.params.response.status);
    note('[Step 7] 요청 차례:', JSON.stringify(reqs), '· ws:', ws.map((u) => u.pathname + u.search).join(' '), '·', JSON.stringify(res101));
    expect(reqs.slice(0, 3)).toEqual(['GET /io.html', 'GET /socket.io/socket.io.js', 'GET /socket.io/?transport=polling']);
    expect(reqs).toContain('POST /socket.io/?transport=polling');
    expect(ws).toHaveLength(1);
    expect(ws[0].pathname).toBe('/socket.io/');
    expect(ws[0].searchParams.get('EIO')).toBe('4');
    expect(ws[0].searchParams.get('transport')).toBe('websocket');
    expect(ws[0].searchParams.get('sid')).toBeTruthy();
    expect(res101).toEqual([101]);
  });

  it('셋이 채팅 - 보낸 글자가 그대로 객체로 오가고(42["chat",…]) 세 탭 모두 보인다 · 입력 중은 나머지 둘에게만', async () => {
    const mark = a.mark();
    await a.say('안녕');
    for (const t of [a, b, c]) await t.waitUntil(`document.querySelectorAll('#list li').length === 1`, 3000);
    for (const t of [a, b, c]) expect(await t.lines()).toEqual(['jaehoon: 안녕']);
    const sent = a.since(mark, 'Network.webSocketFrameSent').map((e) => e.params.response.payloadData);
    const got = a.since(mark, 'Network.webSocketFrameReceived').map((e) => e.params.response.payloadData);
    note('[Step 7] A 가 보낸 프레임:', JSON.stringify(sent), '받은 프레임:', JSON.stringify(got));
    expect(sent).toContain('42["chat","안녕"]');
    expect(got).toContain('42["chat",{"name":"jaehoon","text":"안녕"}]');
    await a.send('Page.bringToFront');
    await b.evaluate(`(() => { const i = document.querySelector('#text'); i.value = '안'; i.dispatchEvent(new Event('input')); })()`);
    await a.waitUntil(`document.querySelector('#typing').textContent === 'minji님이 입력 중이에요...'`, 3000);
    await c.waitUntil(`document.querySelector('#typing').textContent === 'minji님이 입력 중이에요...'`, 3000);
    expect(await typingText(b)).toBe('');
  }, 20_000);

  it('받는 사람을 적으면 그 사람과 나에게만 간다 - 세 번째 사람에게는 안 간다', async () => {
    await a.evaluate("document.querySelector('#to').value = 'minji'");
    await a.say('비밀이에요');
    await b.waitUntil(`document.querySelectorAll('#list li').length === 2`, 3000);
    await a.waitUntil(`document.querySelectorAll('#list li').length === 2`, 3000);
    await sleep(300);
    expect((await b.lines()).at(-1)).toBe('jaehoon: (귓속말) 비밀이에요');
    expect((await a.lines()).at(-1)).toBe('jaehoon: (귓속말) 비밀이에요');
    expect(await c.lines()).toEqual(['jaehoon: 안녕']);
    await a.evaluate("document.querySelector('#to').value = ''");
  }, 20_000);

  it('서버를 끄면 «연결이 끊겼어요» · 다시 켜면 페이지를 건드리지 않아도 다시 붙는다', async () => {
    await server.stop();
    for (const t of [a, b, c]) await t.waitUntil(statusIs('연결이 끊겼어요'), 3000);
    const t0 = Date.now();
    server = await boot('lab/p3-62/chat-io.js', { port: server.port, cwd: step.dir, ready: '기다리고 있어요' });
    const back = [];
    for (const t of [a, b, c]) { await t.waitUntil(statusIs('연결됐어요'), 15_000); back.push(Date.now() - t0); }
    note('[Step 7] 다시 켠 뒤 다시 붙기까지(ms):', back.join(' · '));
    for (const ms of back) expect(ms).toBeLessThan(10_000);
    await sleep(300);
    for (const who of ['jaehoon', 'minji', 'seoyeon']) expect(server.tail()).toContain(`${who} 연결이 열렸어요.`);
    await b.say('다시 왔어요');
    await a.waitUntil(`[...document.querySelectorAll('#list li')].some((li) => li.textContent === 'minji: 다시 왔어요')`, 3000);
  }, 40_000);

  it('맨 new WebSocket 으로는 Socket.IO 서버에 못 붙는다 - 주소 / 는 끊기고, /socket.io/ 주소는 붙지만 첫 메시지가 Socket.IO 의 규칙 글자다', async () => {
    const plain = await a.evaluate(`new Promise((ok) => {
      const w = new WebSocket('ws://' + location.host);
      w.onopen = () => ok('open');
      w.onclose = (e) => ok('close ' + e.code);
    })`);
    const eio = await a.evaluate(`new Promise((ok) => {
      const w = new WebSocket('ws://' + location.host + '/socket.io/?EIO=4&transport=websocket');
      w.onmessage = (e) => { ok(e.data); w.close(); };
      w.onclose = (e) => ok('close ' + e.code);
    })`);
    note('[Step 7] 맨 WebSocket - 주소 / :', plain, '· /socket.io/ 첫 메시지:', eio);
    expect(plain).toBe('close 1006');
    expect(eio).toMatch(/^0\{"sid":"[^"]+","upgrades":\[\],"pingInterval":25000,"pingTimeout":20000,"maxPayload":1000000\}$/);
  }, 20_000);
});

/** B 탭을 닫았다가 같은 주소로 다시 여는 동안 A 가 보낸다 - Step 7 판과 Step 8 판에 같은 흐름. */
async function closeAndReopen(port) {
  const a = await chrome.newTab();
  let b = await chrome.newTab();
  await a.open(PAGE(port, 'io.html', 'jaehoon'));
  await b.open(PAGE(port, 'io.html', 'minji'));
  await a.waitUntil(statusIs('연결됐어요'), 5000);
  await b.waitUntil(statusIs('연결됐어요'), 5000);
  await a.say('안녕');
  await b.waitUntil(`document.querySelectorAll('#list li').length === 1`, 3000);
  await b.send('Page.close');
  await sleep(300);
  await a.say('minji 어디 갔어요?');
  await a.evaluate("document.querySelector('#to').value = 'minji'");
  await a.say('돌아오면 연락 주세요');
  await a.evaluate("document.querySelector('#to').value = ''");
  await a.say('다들 잘 자요');
  await sleep(300);
  b = await chrome.newTab();
  await b.open(PAGE(port, 'io.html', 'minji'));
  await b.waitUntil(statusIs('연결됐어요'), 5000);
  await sleep(500);
  const reopened = await b.lines();
  await a.say('다시 왔네요');
  await b.waitUntil(`[...document.querySelectorAll('#list li')].some((li) => li.textContent === 'jaehoon: 다시 왔네요')`, 3000);
  return { a, b, reopened, after: await b.lines() };
}

describe('Step 8 겪기 - Step 7 판에서는 탭을 닫은 동안 온 메시지를 다시 열어도 못 본다', () => {
  let step, server;
  beforeAll(async () => {
    step = stepDir(7);
    server = await serve(step, 'lab/p3-62/chat-io.js', 4003, '기다리고 있어요');
  }, 30_000);
  afterAll(async () => { await server?.stop(); step?.cleanup(); });

  it('다시 연 B 탭은 빈 목록 - 그 뒤에 온 메시지만 보인다', async () => {
    const { a, reopened, after } = await closeAndReopen(server.port);
    expect(reopened).toEqual([]);
    expect(after).toEqual(['jaehoon: 다시 왔네요']);
    expect((await a.lines())).toEqual(['jaehoon: 안녕', 'jaehoon: minji 어디 갔어요?', 'jaehoon: (귓속말) 돌아오면 연락 주세요', 'jaehoon: 다들 잘 자요', 'jaehoon: 다시 왔네요']);
  }, 30_000);
});

describe('Step 8 - 지난 이야기는 HTTP 로 채운다', () => {
  let step, server;
  beforeAll(async () => {
    step = stepDir(8);
    server = await serve(step, 'lab/p3-62/chat-io.js', 4003, '기다리고 있어요');
  }, 30_000);
  afterAll(async () => { await server?.stop(); step?.cleanup(); });

  it('다시 연 B 탭은 붙자마자 GET /messages?after=0 으로 지난 메시지를 받는다 - 귓속말은 기록하지 않아 안 보인다', async () => {
    const { b, reopened, after } = await closeAndReopen(server.port);
    expect(reopened).toEqual(['jaehoon: 안녕', 'jaehoon: minji 어디 갔어요?', 'jaehoon: 다들 잘 자요']);
    expect(after).toEqual([...reopened, 'jaehoon: 다시 왔네요']);
    const gets = b.since(0, 'Network.requestWillBeSent').map((e) => new URL(e.params.request.url)).filter((u) => u.pathname === '/messages').map((u) => u.search);
    expect(gets).toEqual(['?after=0']);
  }, 30_000);

  it('Network 탭 - 연결이 먼저 열리고(polling 첫 요청) 그다음에 /messages 요청이 나간다', async () => {
    const t = await chrome.newTab();
    const mark = t.mark();
    await t.open(PAGE(server.port, 'io.html', 'seoyeon'));
    await t.waitUntil(statusIs('연결됐어요'), 5000);
    await sleep(500);
    const order = t.since(mark, 'Network.requestWillBeSent').map((e) => new URL(e.params.request.url)).map((u) => u.pathname + (u.searchParams.get('transport') ? `?transport=${u.searchParams.get('transport')}` : u.search));
    note('[Step 8] 새 탭 요청 차례:', JSON.stringify(order));
    expect(order.indexOf('/messages?after=0')).toBeGreaterThan(order.indexOf('/socket.io/?transport=polling'));
    expect(await t.lines()).toEqual(['jaehoon: 안녕', 'jaehoon: minji 어디 갔어요?', 'jaehoon: 다들 잘 자요', 'jaehoon: 다시 왔네요']);
  }, 30_000);
});

describe('Step 8 🙋 - Offline 으로 끊으면 45초쯤 «연결됐어요» 그대로 · 끊긴 걸 안 뒤 온 메시지는 다시 붙을 때 HTTP 로 채운다', () => {
  let step, server;
  beforeAll(async () => {
    step = stepDir(8);
    server = await serve(step, 'lab/p3-62/chat-io.js', 4003, '기다리고 있어요');
  }, 30_000);
  afterAll(async () => { await server?.stop(); step?.cleanup(); });

  it('끊긴 줄을 아는 데 pingInterval 25초 + pingTimeout 20초 안쪽', async () => {
    const offline = (t, v) => t.send('Network.emulateNetworkConditions', { offline: v, latency: 0, downloadThroughput: -1, uploadThroughput: -1 });
    const a = await chrome.newTab();
    const b = await chrome.newTab();
    await a.open(PAGE(server.port, 'io.html', 'jaehoon'));
    await b.open(PAGE(server.port, 'io.html', 'minji'));
    await b.waitUntil(statusIs('연결됐어요'), 5000);
    await sleep(300);
    await offline(b, true);
    const noticed = await b.waitUntil(statusIs('연결이 끊겼어요'), 60_000);
    await sleep(500);
    const serverSaw = server.tail().includes('minji 연결이 닫혔어요.');
    note('[Step 8 🙋] Offline 뒤 «연결이 끊겼어요» 까지(ms):', noticed, '· 서버도 닫힘을 알았나:', serverSaw);
    expect(noticed).toBeGreaterThan(20_000);
    expect(noticed).toBeLessThan(46_000);
    expect(serverSaw).toBe(true);
    await a.say('터널 지났어요?');
    await sleep(300);
    await offline(b, false);
    await b.waitUntil(statusIs('연결됐어요'), 15_000);
    await b.waitUntil(`document.querySelectorAll('#list li').length === 1`, 3000);
    expect(await b.lines()).toEqual(['jaehoon: 터널 지났어요?']);
  }, 90_000);
});

describe('Step 3 🙋 - clearTimeout 을 빼면 메시지로 답한 응답에 25초 뒤 또 답하려다 서버가 멈춘다', () => {
  let step, server, a;
  beforeAll(async () => {
    step = commitDir('Step 3');
    const file = join(step.dir, 'lab/p3-62/chat-http.js');
    const src = readFileSync(file, 'utf8');
    const without = src.replace('    clearTimeout(waiter.timer);\n', '');
    expect(without).not.toBe(src);
    writeFileSync(file, without);
    server = await serve(step, 'lab/p3-62/chat-http.js', 4001, '기다리고 있어요');
    a = await chrome.newTab();
    await a.open(PAGE(server.port, 'long-polling.html', 'jaehoon'));
  }, 30_000);
  afterAll(async () => { await Promise.race([server?.stop(), sleep(2000)]); step?.cleanup(); });

  it('메시지 하나를 보내고 25초를 기다리면 ERR_HTTP_HEADERS_SENT 로 서버가 끝난다', async () => {
    await sleep(500);
    await a.say('안녕');
    await a.waitUntil(`document.querySelectorAll('#list li').length === 1`, 3000);
    await sleep(26_000);
    note('[Step 3 🙋] clearTimeout 없는 판 서버 끝 출력:\n' + server.tail());
    expect(server.tail()).toContain('ERR_HTTP_HEADERS_SENT');
    expect(await portIsFree(server.port)).toBe(true);
  }, 40_000);
});

describe('Step 4 - 브라우저 탭이 붙은 채로 curl 을 보내면', () => {
  let step, server, tab;
  beforeAll(async () => {
    step = stepDir(4);
    server = await serve(step, 'lab/p3-62/chat-ws.js', 4002, '기다리고 있어요');
    tab = await chrome.newTab();
    await tab.open(`http://localhost:${server.port}/ws.html`);
    await tab.waitUntil(statusIs('연결됐어요'), 5000);
  }, 30_000);
  afterAll(async () => { await server?.stop(); step?.cleanup(); });

  it('«열렸어요 2개» 뒤 2초 뒤 «닫혔어요 1개»', async () => {
    spawnSync('curl', ['-i', '-N', '-s', '-m', '2', '-H', 'Connection: Upgrade', '-H', 'Upgrade: websocket', '-H', 'Sec-WebSocket-Version: 13',
      '-H', 'Sec-WebSocket-Key: dGhlIHNhbXBsZSBub25jZQ==', `http://localhost:${server.port}/`]);
    await sleep(200);
    expect(server.tail()).toBe([
      '채팅 서버가 http://localhost:4002 에서 기다리고 있어요.',
      '연결이 하나 열렸어요. 지금 연결은 1개예요.',
      '연결이 하나 열렸어요. 지금 연결은 2개예요.',
      '연결이 하나 닫혔어요. 지금 연결은 1개예요.',
      '',
    ].join('\n'));
  }, 20_000);
});

describe('Step 7 🙋 - Socket.IO 도 이벤트 함수 안의 에러로 서버가 멈춘다 · 맨 WebSocket 실패는 Console 에 에러 줄', () => {
  let step, server, a;
  beforeAll(async () => {
    step = stepDir(7);
    server = await serve(step, 'lab/p3-62/chat-io.js', 4003, '기다리고 있어요');
    a = await chrome.newTab();
    await a.open(PAGE(server.port, 'io.html', 'jaehoon'));
    await a.waitUntil(statusIs('연결됐어요'), 5000);
  }, 30_000);
  afterAll(async () => { await Promise.race([server?.stop(), sleep(2000)]); step?.cleanup(); });

  it('맨 new WebSocket(주소 /) 은 Console 에 «Connection closed before receiving a handshake response» 에러 줄', async () => {
    const mark = a.mark();
    await a.evaluate(`new Promise((ok) => { const w = new WebSocket('ws://' + location.host); w.onclose = () => ok(); })`);
    await sleep(300);
    const texts = a.since(mark, 'Log.entryAdded').map((e) => `${e.params.entry.level} ${e.params.entry.text}`);
    note('[Step 7 🙋] 맨 WebSocket 실패 Console:', JSON.stringify(texts));
    expect(texts).toContain(`error WebSocket connection to 'ws://localhost:${server.port}/' failed: Connection closed before receiving a handshake response`);
  });

  it("Console 에서 socket.emit('whisper') 를 값 없이 보내면 TypeError 로 서버가 끝난다", async () => {
    await a.evaluate("void socket.emit('whisper')");
    await a.waitUntil(statusIs('연결이 끊겼어요'), 5000);
    await sleep(300);
    expect(server.tail()).toContain("TypeError: Cannot destructure property 'to' of 'undefined' as it is undefined.");
    expect(await portIsFree(server.port)).toBe(true);
  }, 20_000);
});
