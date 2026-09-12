// 내부 검증 전용 — 교안에 한 줄도 인용하지 않는다.
//
// 🚨 supertest 를 못 쓰는 이유가 있다. `p2-22` 의 `app.js` 는 학생이 실제로 쓰는
//    모양 그대로 «파일 끝에서 `app.listen()` 을 부르고 `app` 을 내보내지 않는다».
//    supertest 는 app 객체를 받아야 하므로, 그것을 쓰려면 교안이 app/server 를
//    쪼개야 하는데 첫 회차에 그 간접층을 넣을 이유가 없다.
//    그래서 **학생이 치는 그 명령(`node app.js`)을 그대로 띄우고** 실제 포트로
//    왕복한다. 「테스트가 쓰는 도구가 학생이 쓰는 도구와 같은가」를 지키는 쪽이다.
import { spawn } from 'node:child_process';
import { readFileSync, writeFileSync, unlinkSync } from 'node:fs';
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
// 🚨 `ready` 를 받는 이유 (2026-09-06 `p2-24`) — DB 가 붙으면서 첫 줄이 «연결됐어요»
//    로 바뀌었다. 첫 줄에서 풀어주면 `app.listen` 이 아직 안 열렸는데 요청이 나가
//    ECONNREFUSED 로 죽는다. 그 죽음은 코드 결함이 아니라 경주라 판정이 거짓이 된다.
// 🚨 `env` 를 받는 이유 (2026-09-07 `p2-25`) — 이 회차가 `MONGO_URL` 을 파일 밖으로
//    빼면서 `const MONGO_URL = '...'` 줄이 «사라진다». 그러면 아래 `localSource` 가
//    바꿔 칠 줄이 없어 `withLocalMongo` 가 못 쓰인다. 대신 학생이 `--env-file` 로
//    넣어주는 그 자리에 게이트가 자기 값을 넣는다 — **파일은 한 글자도 안 건드린다.**
export async function boot(file, { port = 3000, timeoutMs = 8000, ready = '\n', env: extraEnv = null } = {}) {
  if (!(await portIsFree(port))) {
    throw new Error(
      `포트 ${port} 가 이미 물려 있습니다. 교안이 틀린 게 아니라 환경입니다 — ` +
      `그 포트를 쓰는 프로세스를 끄고 다시 도세요.`);
  }
  // 🚨 **학생 환경과 같게 띄운다.** vitest 는 `NODE_ENV=test` 를 물려주는데,
  //    Express 는 그때 에러 로그를 «일부러 숨긴다»
  //    (`express/lib/application.js`: `if (this.get('env') !== 'test') console.error(...)`).
  //    그대로 두면 「터미널에 이런 에러가 찍혀요」를 검증할 때 게이트만 조용해서
  //    거짓 반증이 난다 — 학생은 `node app.js` 를 그냥 치므로 development 다.
  const env = { ...process.env };
  delete env.NODE_ENV;
  delete env.VITEST;
  // extraEnv 는 «지우기 뒤» 에 얹는다 — 순서를 뒤집으면 `NODE_ENV` 를 일부러 주는
  // 검사(배포본 흉내)가 그 지우기에 조용히 먹힌다.
  Object.assign(env, extraEnv ?? {});
  const child = spawn(process.execPath, [file], { cwd: ROOT, env });
  let log = '';
  const first = await new Promise((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new Error(`${file} 가 ${timeoutMs}ms 안에 아무 말도 안 했습니다.\n${log}`)),
      timeoutMs);
    child.stdout.on('data', (buf) => {
      log += buf.toString();
      if (log.includes(ready)) { clearTimeout(timer); resolve(log); }
    });
    child.stderr.on('data', (buf) => { log += buf.toString(); });
    child.on('exit', (code) => {
      clearTimeout(timer);
      reject(new Error(`${file} 가 뜨자마자 끝났습니다 (exit ${code}).\n${log}`));
    });
  });
  // 🚨 뜬 «뒤» 의 출력도 계속 모은다 — 위 리스너가 그대로 살아 있어서 계속 쌓인다.
  //    Express 는 라우트 안에서 난 예외를 자기 에러 처리로 삼켜서
  //    uncaughtException 에 안 올려주고 **터미널에만** 찍는다. 학생이 보는 곳이
  //    거기라, 거기서 재야 「터진다」를 판정할 수 있다.
  // 🚨 여기에 리스너를 «하나 더» 달면 뜬 뒤의 모든 줄이 log 에 **두 번** 들어간다.
  //    실제로 그랬고, p2-35 가 「질의 3개」를 세다 6 을 받아서 드러났다.
  //    「보인다」와 「한 번만 보인다」는 다른 사실이다 — 세는 검사가 처음 생길 때까지
  //    아무도 못 봤다.
  return {
    log: first,
    tail: () => log,
    base: `http://localhost:${port}`,
    stop: () => new Promise((resolve) => {
      child.on('exit', resolve);
      child.kill();
    }),
  };
}

// ── `p2-24`~ : 연결 문자열 한 줄만 바꿔 띄운다 ──────────────────────────────
//
// 🚨 학생의 `MONGO_URL` 은 «자기 Atlas 클러스터» 라서 저장소가 그 값을 가질 수 없다.
//    그렇다고 코드베이스를 다른 모양으로 두면 교안 인용의 byte 동일이 깨진다.
//    그래서 `p2-23` 이 스냅숏에서 쓴 수법을 그대로 쓴다 — **그 한 줄만** 바꾼 사본을
//    만들어 띄우고, «그 한 줄 말고는 한 글자도 안 다르다» 를 테스트가 함께 잠근다.
//    사본을 저장소 루트에 두는 것은 `./models/Post.js` 같은 상대 경로가 그대로
//    풀려야 하기 때문이다(`snapshots/` 에 두면 불러오는 줄을 또 고쳐야 한다).

export const LOCAL_MONGO_URL = 'mongodb://127.0.0.1:27017/instagram_gate';

const srcOf = (file) => readFileSync(new URL(`../../${file}`, import.meta.url), 'utf-8');

/**
 * 원본에서 `MONGO_URL = '...'` 한 줄만 바꾼 «문자열» 을 돌려준다 (파일을 안 건드린다).
 *
 * 🚨 `lab/p2-NN/` 아래 파일은 «한 단 더 깊다». 학생 쪽은 `~/instagram-api/lab/` 하나라
 *    `../models/Post.js` 가 맞는데, 코드베이스는 회차별 디렉토리로 한 겹을 더 두므로
 *    거기서는 `../../models/Post.js` 여야 한다. 교안 인용은 «학생 쪽» 표기가 정전이니
 *    파일은 그대로 두고 띄울 때만 고친다 — `p2-23` 이 스냅숏에서 쓴 것과 같은 수법이고,
 *    무엇이 달라졌는지는 `labPathRewrites()` 로 꺼내 테스트가 잠근다.
 */
export function localSource(file, url = LOCAL_MONGO_URL) {
  const src = srcOf(file);
  let out = src.replace(/^(const MONGO_URL = ').*(';)$/m, `$1${url}$2`);
  if (out === src) {
    throw new Error(`${file} 안에서 \`const MONGO_URL = '...'\` 줄을 못 찾았습니다.`);
  }
  if (/^lab\/p2-\d+\//.test(file)) {
    out = out.replace(/from '\.\.\/(models|data)\//g, "from '../../$1/");
  }
  // 🚨 `data/posts.js` 는 «얼린 판» 을 보게 한다 (2026-09-11 `p2-30` 착수 시).
  //    `p2-30` 이 시드를 Prisma 로 옮기며 그 파일을 «세 개짜리 배열» 에서
  //    데이터베이스에 든 다섯으로 다시 쓴다. 이 함수를 쓰는 것은 몽고 시절
  //    회차(`p2-22`~`p2-25`)뿐이라, 그 회차들이 보는 것은 그때의 셋이어야 맞다.
  out = out.replace("from '../../data/posts.js'", "from '../../snapshots/p2-22.data-posts.js'");
  return out;
}

/** lab 파일에서 «경로만» 고쳐진 줄들 — 테스트가 이것 말고는 안 달라졌음을 잠근다. */
export function labPathRewrites(file) {
  const src = srcOf(file).split('\n');
  const out = localSource(file).split('\n');
  return src.map((line, i) => [i, line, out[i]])
    .filter(([, a, b]) => a !== b && !a.startsWith('const MONGO_URL = '));
}

/** 그 사본을 저장소 루트에 써 두고 경로를 돌려준다. */
export function withLocalMongo(file, url = LOCAL_MONGO_URL) {
  const local = file.replace(/\.js$/, '.local.js');
  writeFileSync(new URL(`../../${local}`, import.meta.url), localSource(file, url));
  return local;
}

export function dropLocal(local) {
  try { unlinkSync(new URL(`../../${local}`, import.meta.url)); } catch { /* 이미 없음 */ }
}

/**
 * 사본이 원본과 «MONGO_URL 한 줄만» 다른지 — 게이트가 스스로를 검산한다.
 * 🚨 파일을 만들지도 지우지도 않는다. 처음 판은 여기서 사본을 만들었다 지웠는데,
 *    그 지우기가 `beforeAll` 이 띄우려고 만들어둔 사본을 함께 날려 15건이 죽었다.
 */
export function onlyMongoLineDiffers(file, url = LOCAL_MONGO_URL) {
  const src = srcOf(file).split('\n');
  const out = localSource(file, url).split('\n');
  return src.map((line, i) => [i, line, out[i]]).filter(([, a, b]) => a !== b);
}
