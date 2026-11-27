// p3-70 「인증을 끝까지 잇기」 게이트 - 실습(직접 해보기 1 · 과제 [기초])
// 내부 검증 전용 - 교안에 한 줄도 인용하지 않는다.
//
// 직접 해보기 1 - 동네 책장 서버(`lab/p3-70/practice1.js` · 4078)의 `findMember` 빈칸 셋. 빈칸 판은 `snapshots/p3-70/practice1.blank.js`.
// 과제 [기초] - 동네 책장 과제 서버(`lab/p3-70/homework1.js` · 4080). 강의 자료 판은 `snapshots/p3-70/homework1.start.js`.
// .http 는 위에서부터 한 요청씩 보낸다(학생이 차례로 누르는 것과 같다).
// 🔑 틀린 판 - 정답 판과 «처음 달라지는 요청» 의 제목을 잠근다. 그 요청이 그 틀린 답을 가려내는 확인 번호다.
// 🔑 포트는 실습 서버가 정한 4078 · 4080 - 이미 쓰고 있으면 멈춘다(boot).
import { describe, it, expect, afterAll, vi } from 'vitest';

vi.setConfig({ testTimeout: 60_000 });
import { readFileSync, writeFileSync, mkdtempSync, rmSync, symlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { boot } from './helpers/boot.js';

const ROOT = new URL('../', import.meta.url);
const P = (rel) => new URL(rel, ROOT).pathname;
const read = (path) => readFileSync(path, 'utf8');
const dirs = [];
afterAll(() => { for (const d of dirs) rmSync(d, { recursive: true, force: true }); });

/** .http 를 요청 목록으로 - { title, method, url, body }. */
const requests = (file) => read(P(file)).split(/^### /m).filter(Boolean).map((chunk) => {
  const [title, ...rest] = chunk.split('\n');
  const text = rest.join('\n').trim();
  const [line] = text.split('\n');
  const [method, url] = line.split(' ');
  const at = text.indexOf('\n\n');
  return { title: title.trim(), method, url, body: at < 0 ? undefined : text.slice(at + 2).trim() };
});
/** 그 소스로 서버를 띄우고 요청을 차례로 보낸다 - [제목, 상태, 본문] 목록. */
const run = async (source, file, port, ready, httpFile) => {
  const dir = mkdtempSync(join(tmpdir(), 'p370-lab-'));
  dirs.push(dir);
  symlinkSync(P('node_modules'), join(dir, 'node_modules'));
  writeFileSync(join(dir, file), source);
  const srv = await boot(join(dir, file), { port, cwd: dir, ready });
  try {
    const out = [];
    for (const r of requests(httpFile)) {
      const res = await fetch(r.url, { method: r.method, headers: r.body ? { 'Content-Type': 'application/json' } : {}, body: r.body });
      const text = await res.text();
      let body;
      try { body = JSON.parse(text); } catch { body = text; }
      out.push([r.title, res.status, body]);
    }
    return { out, log: srv.tail() };
  } finally {
    await srv.stop();
  }
};
const firstDiff = (a, b) => a.find((row, i) => JSON.stringify(row) !== JSON.stringify(b[i]))?.[0];

describe('직접 해보기 1 - findMember 빈칸 셋', () => {
  const blank = read(P('snapshots/p3-70/practice1.blank.js'));
  const answer = read(P('lab/p3-70/practice1.js'));
  const fill = (a, b, c) => blank.replace('includes(____)', `includes(${a})`).replace('member.phone === ____', `member.phone === ${b}`).replace('member.username === ____', `member.username === ${c}`);
  const go = (src) => run(src, 'practice1.js', 4078, '4078', 'lab/p3-70/practice1.http');
  let right;

  it('정답으로 채우면 정답 판과 같다 · 다섯 요청', async () => {
    expect(fill("'@'", "loginId.replaceAll('-', '')", 'loginId')).toBe(answer);
    right = (await go(answer)).out;
    expect(right.map(([t, s, b]) => [t, s, b])).toEqual([
      ['사용자 이름으로 로그인', 200, { username: 'sujin' }],
      ['이메일로 로그인', 200, { username: 'yuna' }],
      ['하이픈 있는 휴대폰 번호로 로그인', 200, { username: 'minho' }],
      ['하이픈 없는 휴대폰 번호로 로그인', 200, { username: 'taeyang' }],
      ['다른 사람의 비밀번호로 로그인', 401, { message: '계정이나 비밀번호가 맞지 않아요' }],
    ]);
  });

  it('빈칸 그대로 켜면 뜨기는 하고 첫 요청에서 500(ReferenceError)', async () => {
    const r = await go(blank);
    expect(r.out[0][1]).toBe(500);
    expect(r.log).toContain('ReferenceError: ____ is not defined');
  });

  it('틀린 판 - 하이픈을 안 떼면 확인 3 에서 갈린다 · 사용자 이름을 소문자로 바꿔 찾아도 이 회원들로는 안 갈린다(모두 소문자)', async () => {
    expect(firstDiff((await go(fill("'@'", 'loginId', 'loginId'))).out, right)).toBe('하이픈 있는 휴대폰 번호로 로그인');
    expect(firstDiff((await go(fill("'@'", "loginId.replaceAll('-', '')", 'loginId.toLowerCase()'))).out, right)).toBe(undefined);
  });
});

describe('과제 [기초] - 가입 규칙 · 이메일 대소문자 · 앞뒤 공백', () => {
  const start = read(P('snapshots/p3-70/homework1.start.js'));
  const answer = read(P('lab/p3-70/homework1.js'));
  const go = (src) => run(src, 'homework1.js', 4080, '4080', 'lab/p3-70/homework1.http');

  it('강의 자료 판 - 번호 모양 이름도 201 · 대문자 이메일로 가입하면 소문자로는 401 · 대문자 이메일 401 · 공백 401', async () => {
    const r = (await go(start)).out.map(([t, s]) => [t, s]);
    expect(r).toEqual([
      ['휴대폰 번호 모양의 사용자 이름으로 가입', 201],
      ['대문자가 섞인 이메일로 가입', 201],
      ['소문자 이메일로 로그인', 401],
      ['대문자 이메일로 로그인', 401],
      ['앞뒤에 공백이 붙은 사용자 이름으로 로그인', 401],
    ]);
  });

  it('정답 판 - 400 · 201 · 200 hana · 200 sujin · 200 minho', async () => {
    const r = (await go(answer)).out;
    expect(r).toEqual([
      ['휴대폰 번호 모양의 사용자 이름으로 가입', 400, { message: '휴대폰 번호 모양은 사용자 이름으로 쓸 수 없어요' }],
      ['대문자가 섞인 이메일로 가입', 201, { username: 'hana' }],
      ['소문자 이메일로 로그인', 200, { username: 'hana' }],
      ['대문자 이메일로 로그인', 200, { username: 'sujin' }],
      ['앞뒤에 공백이 붙은 사용자 이름으로 로그인', 200, { username: 'minho' }],
    ]);
  });

  it('틀린 판 - 저장만 소문자로 하고 찾을 때 안 바꾸면 확인 4 · 찾을 때만 바꾸고 저장은 그대로면 확인 3', async () => {
    const right = (await go(answer)).out;
    const noFindLower = answer.replace("member.email === value.toLowerCase()", 'member.email === value');
    expect(firstDiff((await go(noFindLower)).out, right)).toBe('대문자 이메일로 로그인');
    const noStoreLower = answer.replace('{ email: emailOrPhone.toLowerCase(), phone: null }', '{ email: emailOrPhone, phone: null }');
    expect(firstDiff((await go(noStoreLower)).out, right)).toBe('소문자 이메일로 로그인');
  });
});
