// 내부 검증 전용 - 교안에 한 줄도 인용하지 않는다.
// `p3-62` 판정 두 파일(`p3-62.test.js` 본문 · `p3-62.lab.test.js` 실습)이 함께 쓰는 것.
// 커밋은 북마크 `code/p3-62`(없으면 HEAD)의 로그에서 제목 `feat(p3-62): … (표지)` 로 찾는다 - 표지는 `Step N` · `직접 해보기 N` · `과제 자료` · `과제 [기초]` 등.
import { expect } from 'vitest';
import { execFileSync } from 'node:child_process';
import { appendFileSync, cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { boot, portIsFree } from './boot.js';

export const ROOT = new URL('../../', import.meta.url).pathname;
const git = (...args) => execFileSync('git', args, { cwd: ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
const hasRef = (ref) => { try { git('rev-parse', '--verify', '--quiet', ref); return true; } catch { return false; } };
const LINE = process.env.P362_LINE ?? (hasRef('refs/heads/code/p3-62') ? 'code/p3-62' : 'HEAD');

/** 제목이 `feat(p3-62):` 로 시작하고 `(표지)` 로 끝나는 커밋 가운데 가장 뒤의 것(없으면 null). */
export const commitSha = (tag) => git('log', LINE, '--format=%H %s', '--fixed-strings', '--grep=feat(p3-62):')
  .split('\n').filter((l) => l.endsWith(`(${tag})`)).map((l) => l.slice(0, 40))[0] ?? null;

/** 그 커밋(없으면 작업트리)의 `lab/p3-62` 를 풀어 둔 폴더. */
export function commitDir(tag) {
  const sha = commitSha(tag);
  const dir = mkdtempSync(join(tmpdir(), 'p362-'));
  if (sha) {
    const tar = execFileSync('git', ['archive', '--format=tar', sha, 'lab/p3-62'], { cwd: ROOT, maxBuffer: 1 << 28 });
    execFileSync('tar', ['-x', '-C', dir], { input: tar });
  } else {
    mkdirSync(join(dir, 'lab'), { recursive: true });
    cpSync(join(ROOT, 'lab/p3-62'), join(dir, 'lab/p3-62'), { recursive: true });
  }
  symlinkSync(join(ROOT, 'node_modules'), join(dir, 'node_modules'));
  return { dir, from: sha ? sha.slice(0, 7) : '작업트리', cleanup: () => rmSync(dir, { recursive: true, force: true }) };
}

/** 풀어 둔 사본의 파일 한 곳을 바꾼다(틀린 판 · «이걸 빼면» 판). 바꿀 글자가 정확히 한 곳이어야 한다. */
export function patch(step, file, before, after) {
  const path = join(step.dir, file);
  const text = readFileSync(path, 'utf8');
  if (text.split(before).length !== 2) throw new Error(`${file} 에 «${before.slice(0, 60)}» 가 한 곳이 아니다`);
  writeFileSync(path, text.replace(before, after));
}

/**
 * 실습 파일을 띄운다. 🚨 학생 파일은 포트(4001 등)를 박아 두었는데 그 포트는 다른 작업(낭독 환경 등)이 자주 쓴다.
 * 그래서 풀어 둔 사본에서만 그 숫자를 빈 포트로 바꿔 띄우고, «바뀐 것은 그 숫자뿐» 을 여기서 확인한다.
 * 돌려주는 `log` 는 숫자를 학생 포트로 되돌린 글자다(교안 인용과 대조하려고).
 */
export async function serve(step, file, studentPort, ready) {
  const path = join(step.dir, file);
  const original = readFileSync(path, 'utf8');
  const port = await freePortIn(4300, 4399);
  const changed = original.replaceAll(String(studentPort), String(port));
  expect(changed.replaceAll(String(port), String(studentPort))).toBe(original);
  writeFileSync(path, changed);
  const server = await boot(file, { port, cwd: step.dir, ready });
  return { ...server, port, log: server.log.replaceAll(String(port), String(studentPort)), tail: () => server.tail().replaceAll(String(port), String(studentPort)) };
}

export async function freePortIn(lo, hi) {
  for (let p = lo; p <= hi; p += 1) if (await portIsFree(p)) return p;
  throw new Error(`${lo}~${hi} 에 빈 포트가 없다`);
}

/** 잰 값을 남긴다(통과한 테스트의 console 은 vitest 가 숨긴다) - `$TMPDIR/p362-measure.log`. */
export const note = (...parts) => appendFileSync(join(tmpdir(), 'p362-measure.log'), `${new Date().toISOString()} ${parts.join(' ')}\n`);

export const PAGE = (port, file, name) => `http://localhost:${port}/${file}?name=${name}`;
