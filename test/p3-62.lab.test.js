// p3-62 「WebSocket 원리와 Socket.IO」 게이트 - 실습(직접 해보기 1·2 · 과제 [기초]·[응용])
// 내부 검증 전용 - 교안에 한 줄도 인용하지 않는다.
//
// 소재는 실시간 경매 입찰(「`p3-62` 착수 결정」 실습 줄). 화면(HTML)은 강의 자료로 나눠 주고 학생은 서버(와 과제의 화면)를 채운다.
// 🔑 틀린 판 - «빈칸만 잘못 채운» 판이다(빈칸 밖까지 바꾼 판은 학생이 낼 수 없다 · `p3-61` 정독 지적). 그 판이 처음 어긋나는 확인을 잠근다.
// 🔑 포트 - 학생 파일은 4004~4007. 판정은 사본에서 그 숫자만 빈 포트로 바꿔 띄운다(`helpers/p362.js` 의 `serve`).
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { setTimeout as sleep } from 'node:timers/promises';
import { launchChrome } from './helpers/chrome.js';
import { commitDir, patch, serve, note, PAGE } from './helpers/p362.js';

let chrome;
beforeAll(async () => { chrome = await launchChrome(); }, 30_000);
afterAll(async () => { await chrome?.close(); });

const text = (tab, sel) => tab.evaluate(`document.querySelector('${sel}')?.textContent ?? null`);
const view = async (tab) => ({ title: await text(tab, 'h1'), price: await text(tab, '#price'), bidder: await text(tab, '#bidder'), notice: await text(tab, '#notice') });
async function bid(tab, amount) {
  await tab.evaluate(`(() => { document.querySelector('#amount').value = '${amount}'; document.querySelector('#form').requestSubmit(); })()`);
}
/** 끈다 - 틀린 판에서 서버가 이미 죽었으면 `stop()` 이 끝나지 않으니 2초에서 끊는다. */
const stop = (server) => Promise.race([server.stop(), sleep(2000)]);
const priceIs = (p) => `document.querySelector('#price').textContent === ${JSON.stringify(p)}`;

/** 직접 해보기 1 - 두 탭(jaehoon · minji). 확인 번호마다 화면을 남긴다. */
async function practice1(tag, edit = null) {
  const step = commitDir(tag);
  try {
    if (edit) patch(step, 'lab/p3-62/practice1.js', ...edit);
    const server = await serve(step, 'lab/p3-62/practice1.js', 4004, '기다리고 있어요');
    const a = await chrome.newTab();
    const b = await chrome.newTab();
    const out = {};
    try {
      await a.open(PAGE(server.port, 'auction-ws.html', 'jaehoon'));
      await b.open(PAGE(server.port, 'auction-ws.html', 'minji'));
      await b.waitUntil(priceIs('10,000'), 3000).catch(() => {});
      out.open = [await view(a), await view(b)];
      await bid(a, 12000);
      await sleep(400);
      out.bid1 = [await view(a), await view(b)];
      await bid(b, 11000);
      await sleep(400);
      out.low = [await view(a), await view(b)];
      await bid(b, 12000);
      await sleep(400);
      out.same = [await view(a), await view(b)];
      out.serverAlive = !/Error/.test(server.tail());
      return out;
    } finally { a.close(); b.close(); await stop(server); }
  } finally { step.cleanup(); }
}

const V = (price, bidder, notice = '') => ({ title: '필름 카메라 경매', price, bidder, notice });

describe('직접 해보기 1 - 맨 WebSocket 경매', () => {
  it('정답 - ① 처음 10,000·없음 ② jaehoon 12,000 은 두 탭 모두 ③ minji 11,000 은 minji 에게만 거절 ④ 같은 값 12,000 도 거절', async () => {
    const r = await practice1('직접 해보기 1');
    expect(r.open).toEqual([V('10,000', '없음'), V('10,000', '없음')]);
    expect(r.bid1).toEqual([V('12,000', 'jaehoon'), V('12,000', 'jaehoon')]);
    expect(r.low).toEqual([V('12,000', 'jaehoon'), V('12,000', 'jaehoon', '지금 가격(12,000원)보다 높게 불러 주세요.')]);
    expect(r.same).toEqual(r.low);
    expect(r.serverAlive).toBe(true);
  }, 30_000);

  it('틀린 판 - 첫 빈칸에 < 를 쓰면 ④ 에서 같은 값 12,000 이 받아들여져 최고 입찰자가 minji', async () => {
    const r = await practice1('직접 해보기 1', ['    if (message.price <= price) {', '    if (message.price < price) {']);
    expect(r.low[1].notice).toBe('지금 가격(12,000원)보다 높게 불러 주세요.');
    expect(r.same).toEqual([V('12,000', 'minji'), V('12,000', 'minji')]);
  }, 30_000);

  it("틀린 판 - 거절을 socket 대신 client 로 보내면 ③ 에서 서버가 ReferenceError 로 끝나고 거절 문장이 안 뜬다", async () => {
    const r = await practice1('직접 해보기 1', ["      socket.send(JSON.stringify({ type: 'rejected', price }));", "      client.send(JSON.stringify({ type: 'rejected', price }));"]);
    expect(r.bid1).toEqual([V('12,000', 'jaehoon'), V('12,000', 'jaehoon')]);
    expect(r.low[1].notice).toBe('');
    expect(r.serverAlive).toBe(false);
  }, 30_000);

  it('틀린 판 - 모두에게 보낼 자리에 [socket] 을 쓰면 ② 에서 minji 탭이 10,000 그대로', async () => {
    const r = await practice1('직접 해보기 1', ['    for (const client of wss.clients) {', '    for (const client of [socket]) {']);
    expect(r.bid1).toEqual([V('12,000', 'jaehoon'), V('10,000', '없음')]);
  }, 30_000);

  it("틀린 판 - 새 가격의 type 을 'bid' 로 쓰면 ② 에서 두 탭 모두 10,000 그대로(화면은 price 만 그린다)", async () => {
    const r = await practice1('직접 해보기 1', ["      client.send(JSON.stringify({ type: 'price', price, bidder }));", "      client.send(JSON.stringify({ type: 'bid', price, bidder }));"]);
    expect(r.bid1).toEqual([V('10,000', '없음'), V('10,000', '없음')]);
  }, 30_000);
});

/** 직접 해보기 2 - 필름 카메라(1)를 보는 jaehoon · minji, 턴테이블(2)을 보는 seoyeon. */
async function practice2(edit = null) {
  const step = commitDir('직접 해보기 2');
  try {
    if (edit) patch(step, 'lab/p3-62/practice2.js', ...edit);
    const server = await serve(step, 'lab/p3-62/practice2.js', 4005, '기다리고 있어요');
    const tabs = [await chrome.newTab(), await chrome.newTab(), await chrome.newTab()];
    const [a, b, c] = tabs;
    const out = {};
    const all = async () => Promise.all(tabs.map(view));
    try {
      await a.open(`http://localhost:${server.port}/auction-io.html?item=1&name=jaehoon`);
      await b.open(`http://localhost:${server.port}/auction-io.html?item=1&name=minji`);
      await c.open(`http://localhost:${server.port}/auction-io.html?item=2&name=seoyeon`);
      await sleep(800);
      out.open = await all();
      await bid(a, 12000);
      await sleep(400);
      out.bid1 = await all();
      await bid(c, 31000);
      await sleep(400);
      out.bid2 = await all();
      await bid(b, 11000);
      await sleep(400);
      out.low = await all();
      return out;
    } finally { for (const t of tabs) t.close(); await server.stop(); }
  } finally { step.cleanup(); }
}
const W = (title, price, bidder, notice = '') => ({ title: `${title} 경매`, price, bidder, notice });

describe('직접 해보기 2 - Socket.IO 로 물건마다 방', () => {
  it('정답 - ① 저마다 자기 물건 ② 카메라 입찰은 카메라 둘에게만 ③ 턴테이블 입찰은 seoyeon 에게만 ④ 거절은 minji 에게만', async () => {
    const r = await practice2();
    expect(r.open).toEqual([W('필름 카메라', '10,000', '없음'), W('필름 카메라', '10,000', '없음'), W('턴테이블', '30,000', '없음')]);
    expect(r.bid1).toEqual([W('필름 카메라', '12,000', 'jaehoon'), W('필름 카메라', '12,000', 'jaehoon'), W('턴테이블', '30,000', '없음')]);
    expect(r.bid2).toEqual([W('필름 카메라', '12,000', 'jaehoon'), W('필름 카메라', '12,000', 'jaehoon'), W('턴테이블', '31,000', 'seoyeon')]);
    expect(r.low).toEqual([W('필름 카메라', '12,000', 'jaehoon'), W('필름 카메라', '12,000', 'jaehoon', '지금 가격(12,000원)보다 높게 불러 주세요.'), W('턴테이블', '31,000', 'seoyeon')]);
  }, 30_000);

  it('틀린 판 - 방 대신 io.emit 으로 보내면 ② 에서 seoyeon 의 턴테이블 화면이 필름 카메라로 바뀐다', async () => {
    const r = await practice2(["    io.to(room).emit('price', item);", "    io.emit('price', item);"]);
    expect(r.bid1[2]).toEqual(W('필름 카메라', '12,000', 'jaehoon'));
  }, 30_000);

  it('틀린 판 - join 의 빈칸에 id 를 쓰면 ② 에서 세 창 모두 그대로(연결은 1 방 · 새 가격은 item:1 방)', async () => {
    const r = await practice2(['  socket.join(room);', '  socket.join(id);']);
    expect(r.bid1.map((v) => v.price)).toEqual(['10,000', '10,000', '30,000']);
  }, 30_000);

  it('틀린 판 - 거절을 io.to(room) 으로 보내면 ④ 에서 jaehoon 에게도 거절 문장이 뜬다', async () => {
    const r = await practice2(["      socket.emit('rejected', item.price);", "      io.to(room).emit('rejected', item.price);"]);
    expect(r.low[0].notice).toBe('지금 가격(12,000원)보다 높게 불러 주세요.');
  }, 30_000);
});

describe('과제 [기초] - 묻는 경매를 알려 주는 경매로', () => {
  async function homework1(tag, edits = []) {
    const step = commitDir(tag);
    try {
      for (const e of edits) patch(step, e[0], e[1], e[2]);
      const server = await serve(step, 'lab/p3-62/homework1.js', 4006, '기다리고 있어요');
      const a = await chrome.newTab();
      const b = await chrome.newTab();
      const out = {};
      try {
        await a.open(PAGE(server.port, 'homework1.html', 'jaehoon'));
        const markB = b.mark();
        await b.open(PAGE(server.port, 'homework1.html', 'minji'));
        await sleep(6200);
        out.gets = b.since(markB, 'Network.requestWillBeSent').filter((e) => new URL(e.params.request.url).pathname === '/item').length;
        const t0 = Date.now();
        await bid(a, 55000);
        out.seenIn = await b.waitUntil(priceIs('55,000'), 3000).then(() => Date.now() - t0).catch(() => null);
        await bid(b, 52000);
        await sleep(400);
        out.low = [await view(a), await view(b)];
        return out;
      } finally { a.close(); b.close(); await stop(server); }
    } finally { step.cleanup(); }
  }
  const H = (price, bidder, notice = '') => ({ title: '빈티지 자전거 경매', price, bidder, notice });

  it('정답 - ① 붙을 때 GET /item 한 번뿐 ② jaehoon 의 입찰이 minji 화면에 곧바로 ③ 낮은 입찰의 문장은 minji 에게만(HTTP 400 응답)', async () => {
    const r = await homework1('과제 [기초]');
    note('[과제 기초] 정답 - 6.2초 동안 GET /item:', r.gets, '· minji 에 보이기까지(ms):', r.seenIn);
    expect(r.gets).toBe(1);
    expect(r.seenIn).toBeLessThan(300);
    expect(r.low).toEqual([H('55,000', 'jaehoon'), H('55,000', 'jaehoon', '지금 가격(55,000원)보다 높게 불러 주세요.')]);
  }, 30_000);

  it('틀린 판 - setInterval 을 남겨 두면 ① 에서 GET /item 이 그대로 네 번', async () => {
    const r = await homework1('과제 [기초]', [['lab/p3-62/public/homework1.html', "      socket.on('price', show);\n", "      socket.on('price', show);\n      setInterval(load, 2000);\n"]]);
    expect(r.gets).toBe(4);
  }, 30_000);

  it('틀린 판 - io.emit 을 가격을 바꾸기 전에 두면 ② 에서 minji 창이 50,000 그대로', async () => {
    const r = await homework1('과제 [기초]', [['lab/p3-62/homework1.js', `  item.price = price;
  item.bidder = name;
  res.status(201).json(item);

  // 받아들인 입찰은 연결로 모두에게 알린다.
  io.emit('price', item);
`, `  // 받아들인 입찰은 연결로 모두에게 알린다.
  io.emit('price', item);

  item.price = price;
  item.bidder = name;
  res.status(201).json(item);
`]]);
    expect(r.seenIn).toBeNull();
  }, 30_000);

  it('강의 자료 그대로 - 6.2초 동안 GET /item 네 번(2초마다) · 늦으면 2초 가까이 걸린다', async () => {
    const r = await homework1('과제 자료');
    note('[과제 기초] 자료 - 6.2초 동안 GET /item:', r.gets, '· minji 에 보이기까지(ms):', r.seenIn);
    expect(r.gets).toBe(4);
    expect(r.seenIn).toBeGreaterThan(0);
  }, 30_000);
});

describe('과제 [기초] 흔한 실수 - new Server(app)', () => {
  it('Express 앱을 넘기면 서버가 뜨지 않고 Socket.IO 가 http.Server 를 달라고 말한다', async () => {
    const step = commitDir('과제 [기초]');
    try {
      patch(step, 'lab/p3-62/homework1.js', 'const io = new Server(server);', 'const io = new Server(app);');
      const err = await serve(step, 'lab/p3-62/homework1.js', 4006, '기다리고 있어요').then(async (sv) => { await sleep(500); const t = sv.tail(); await stop(sv); return t; }, (e) => e.message);
      note('[과제 기초 흔한 실수] new Server(app):\n' + err);
      expect(err).toContain('You are trying to attach socket.io to an express request handler function. Please pass a http.Server instance.');
    } finally { step.cleanup(); }
  }, 30_000);
});

describe('과제 [응용] - 다시 붙으면 놓친 입찰을 HTTP 로', () => {
  async function homework2(tag, edits = []) {
    const step = commitDir(tag);
    try {
      for (const e of edits) patch(step, e[0], e[1], e[2]);
      const server = await serve(step, 'lab/p3-62/homework2.js', 4007, '기다리고 있어요');
      const a = await chrome.newTab();
      let b = await chrome.newTab();
      const lines = (t) => t.evaluate("[...document.querySelectorAll('#list li')].map((li) => li.textContent)");
      const out = {};
      try {
        await a.open(PAGE(server.port, 'homework2.html', 'jaehoon'));
        await b.open(PAGE(server.port, 'homework2.html', 'minji'));
        await sleep(600);
        await bid(a, 21000);
        await sleep(300);
        out.first = await lines(b);
        await b.send('Page.close');
        await sleep(300);
        await bid(a, 23000);
        await sleep(300);
        b = await chrome.newTab();
        await b.open(PAGE(server.port, 'homework2.html', 'minji'));
        await sleep(800);
        out.reopened = await lines(b);
        await b.evaluate('void socket.disconnect()');
        await sleep(300);
        out.offStatus = await text(b, '#status');
        await bid(a, 25000);
        await sleep(300);
        await b.evaluate('void socket.connect()');
        await sleep(800);
        out.onStatus = await text(b, '#status');
        out.reconnected = await lines(b);
        await bid(b, 27000);
        await sleep(400);
        out.after = await lines(b);
        out.a = await lines(a);
        return out;
      } finally { a.close(); b.close(); await stop(server); }
    } finally { step.cleanup(); }
  }
  const HTML = 'lab/p3-62/public/homework2.html';

  it('정답 - 다시 연 탭에 21,000 · 23,000 · Console 로 끊었다 붙이면 25,000 이 채워진다 · 겹치지 않는다', async () => {
    const r = await homework2('과제 [응용]');
    expect(r.first).toEqual(['jaehoon 21,000원']);
    expect(r.reopened).toEqual(['jaehoon 21,000원', 'jaehoon 23,000원']);
    expect([r.offStatus, r.onStatus]).toEqual(['연결이 끊겼어요', '연결됐어요']);
    expect(r.reconnected).toEqual(['jaehoon 21,000원', 'jaehoon 23,000원', 'jaehoon 25,000원']);
    expect(r.after).toEqual([...r.reconnected, 'minji 27,000원']);
    expect(r.a).toEqual(r.after);
  }, 40_000);

  it('강의 자료 그대로 - 다시 연 탭은 빈 목록 · 다시 붙어도 25,000 이 없다', async () => {
    const r = await homework2('과제 자료');
    expect(r.reopened).toEqual([]);
    expect(r.reconnected).toEqual([]);
    expect(r.after).toEqual(['minji 27,000원']);
  }, 40_000);

  it('틀린 판 - 페이지를 열 때 한 번만 받으면(connect 밖) 다시 연 탭은 맞지만 다시 붙은 뒤 25,000 이 없다', async () => {
    const r = await homework2('과제 [응용]', [[HTML, `      socket.on('connect', async () => {
        status.textContent = '연결됐어요';
        const response = await fetch(\`/bids?after=\${lastId}\`);
        const missed = await response.json();
        missed.forEach(show);
      });`, `      (async () => {
        const response = await fetch(\`/bids?after=\${lastId}\`);
        const missed = await response.json();
        missed.forEach(show);
      })();

      socket.on('connect', () => {
        status.textContent = '연결됐어요';
      });`]]);
    expect(r.reopened).toEqual(['jaehoon 21,000원', 'jaehoon 23,000원']);
    expect(r.reconnected).toEqual(['jaehoon 21,000원', 'jaehoon 23,000원']);
  }, 40_000);

  it('틀린 판 - 다시 붙을 때 after=0 으로 다 받고 건너뛰지 않으면 다시 붙은 뒤 21,000 · 23,000 이 두 번', async () => {
    const r = await homework2('과제 [응용]', [
      [HTML, 'const response = await fetch(`/bids?after=${lastId}`);', 'const response = await fetch(`/bids?after=0`);'],
      [HTML, `        if (bid.id <= lastId) {
          return;
        }
`, ''],
    ]);
    expect(r.reconnected).toEqual(['jaehoon 21,000원', 'jaehoon 23,000원', 'jaehoon 21,000원', 'jaehoon 23,000원', 'jaehoon 25,000원']);
  }, 40_000);
});
