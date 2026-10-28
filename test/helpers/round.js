// 회차 북마크(`code/pN-NN`)를 임시 폴더에 풀어, 그 회차 «당시» 의 학생 파일로 판정한다.
//
// 🚨 앞 회차 판정이 작업트리를 읽으면, 다음 회차가 같은 파일(`routes/auth.js` 등)을 고치는 순간
//    앞 회차 판정이 빨개진다 — 교안은 그대로인데 판정만 거짓으로 움직인다(`p3-20` 이 `p3-19` 의
//    `userId` 쿠키를 세션 ID 로 갈아 끼우면서 실제로 만날 뻔했다). 그래서 앞 회차는 북마크를 푼다.
// 🔑 북마크가 아직 없으면(그 회차를 짓는 중) 작업트리 그대로를 돌려준다 — 회차를 닫으면서
//    `code/pN-NN` 을 찍는 순간부터 그 회차 판정은 북마크를 읽는다.
import { execFileSync } from 'node:child_process';
import { mkdtempSync, symlinkSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

export function hasBranch(branch) {
  try {
    execFileSync('git', ['rev-parse', '--verify', '--quiet', `refs/heads/${branch}`], { cwd: ROOT, stdio: 'pipe' });
    return true;
  } catch {
    return false;
  }
}

/** 북마크를 풀어 둔 폴더(없으면 저장소 루트)와 그 폴더를 지우는 함수를 돌려준다. */
export function roundDir(branch) {
  if (!hasBranch(branch)) return { dir: ROOT, fromBookmark: false, cleanup: () => {} };
  const dir = mkdtempSync(path.join(tmpdir(), `${branch.replace('/', '-')}-`));
  const tar = execFileSync('git', ['archive', '--format=tar', branch], { cwd: ROOT, maxBuffer: 1 << 28 });
  execFileSync('tar', ['-x', '-C', dir], { input: tar });
  symlinkSync(path.join(ROOT, 'node_modules'), path.join(dir, 'node_modules'));
  return { dir, fromBookmark: true, cleanup: () => rmSync(dir, { recursive: true, force: true }) };
}
