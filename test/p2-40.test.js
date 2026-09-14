// p2-40 「같이 일할 준비를 해요」 게이트
//
// 🚨 이 회차도 서버 코드를 안 쓴다. `p2-39` 가 만든 `~/nanum/` 폴더를 «팀 저장소» 로 올리고
//    GitHub 위에서 같이 일하는 규칙을 세운다. 판정 축은 셋이다.
//    ① 파일 — `.gitignore` · `CONTRIBUTING.md` · 이슈·PR 템플릿이 교안이 주장하는 대로 생겼다.
//    ② 로컬 git — 교안이 인용하는 git 출력이 «실제로» 그렇게 나온다.
//       GitHub 대신 로컬 bare 저장소를 원격으로 두고, Squash 병합은 `merge --squash` 로 흉내 낸다.
//       (충돌 · rebase · 거절되는 push · Squash 뒤 `branch -d` 거절은 원격 종류와 무관한 git 동작이다)
//    ③ GitHub — 룰셋 거절 문구처럼 GitHub 만 내는 출력은 매번 GitHub 를 부를 수 없어서,
//       2026-09-14 임시 공개 저장소에서 잰 것을 `snapshots/p2-40/github/` 에 얼려두고 교안과 대조한다.
// 🚨 git 설정은 «학생의 설정» 으로 돈다 — 전역 설정을 비우고 파트1 이 학생에게 «전역으로» 시킨 줄만 준다.
//    `p1-10` init.defaultBranch · core.autocrlf / `p1-13` pull.rebase false / `p1-15` push.useForceIfIncludes true.
//    내 컴퓨터의 별칭이 끼면 출력이 학생 화면과 달라지고, 반대로 학생 설정을 «빼면» 학생 화면과 달라진다.
//    (2026-09-14 재정독 — 처음 판이 init.defaultBranch 만 줘서 `git pull` 이 «정하라며 멈춘다» 로 쟀는데,
//     `p1-13` 이 pull.rebase false 를 시켜뒀으니 학생 화면에서는 멈추지 않고 곧바로 병합한다)
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { readFileSync, mkdtempSync, rmSync, mkdirSync, copyFileSync, writeFileSync, appendFileSync, realpathSync, cpSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';

const ROOT = new URL('../', import.meta.url);
const P = (rel) => new URL(rel, ROOT).pathname;
const read = (p) => readFileSync(p, 'utf8');

const LAB = 'lab/p2-40';
const P239 = 'lab/p2-39';

// macOS 의 `/var` 는 `/private/var` 로 풀린다 — git 이 찍는 경로와 맞추려고 실제 경로로 받는다
const tmp = realpathSync(mkdtempSync(join(tmpdir(), 'p240-')));
const GLOBAL = join(tmp, 'student.gitconfig');
writeFileSync(GLOBAL, [
  '[init]', '\tdefaultBranch = main',
  '[core]', '\tautocrlf = input',
  '[pull]', '\trebase = false',
  '[push]', '\tuseForceIfIncludes = true', '',
].join('\n'));
// 교안 Step 2 가 맥 사용자에게 시키는 «내 컴퓨터에만 적용되는 무시 목록» — ~/.config/git/ignore
const XDG = join(tmp, 'xdg');
mkdirSync(join(XDG, 'git'), { recursive: true });
writeFileSync(join(XDG, 'git/ignore'), '.DS_Store\n');

const ENV = {
  ...process.env,
  XDG_CONFIG_HOME: XDG,
  GIT_CONFIG_GLOBAL: GLOBAL,
  GIT_CONFIG_NOSYSTEM: '1',
  GIT_AUTHOR_NAME: 'hong',
  GIT_AUTHOR_EMAIL: 'hong@example.com',
  GIT_COMMITTER_NAME: 'hong',
  GIT_COMMITTER_EMAIL: 'hong@example.com',
  GIT_EDITOR: 'true',
  LC_ALL: 'C',
};

/** git 한 번 — 학생 화면처럼 stdout·stderr 를 한데 모은다. */
const git = (cwd, ...args) => {
  const r = spawnSync('git', args, { cwd, env: ENV, encoding: 'utf8' });
  return { status: r.status, out: (r.stdout + r.stderr).replace(/[ \t]+$/gm, '') };
};

const ORIGIN = join(tmp, 'origin.git');
const ME = join(tmp, 'nanum');
const MATE = join(tmp, 'nanum-mate');
const MERGER = join(tmp, 'github');

/** GitHub 의 Squash and merge 흉내 — 브랜치 커밋들을 main 위에 새 커밋 하나로 얹고, 원격 브랜치를 지운다. */
const squashMerge = (branch, title) => {
  git(MERGER, 'fetch', '--prune');
  git(MERGER, 'switch', 'main');
  git(MERGER, 'reset', '--hard', 'origin/main');
  const m = git(MERGER, 'merge', '--squash', `origin/${branch}`);
  expect(m.status, m.out).toBe(0);
  git(MERGER, 'commit', '-m', title);
  expect(git(MERGER, 'push', 'origin', 'main').status).toBe(0);
  expect(git(MERGER, 'push', 'origin', '--delete', branch).status).toBe(0);
};

const RULE4_MATE = '4. 브랜치 이름은 `feat/`·`fix/`·`docs/` 중 하나로 시작한다.';
const RULE4_ME = '4. PR은 연 날 안에 한 사람이 읽고 댓글을 남긴다.';

afterAll(() => rmSync(tmp, { recursive: true, force: true }));

describe('p2-40 ① 파일 — 교안이 주장하는 모양', () => {
  it('`.gitignore` 는 연습 폴더 `lab/` 과 비밀 파일 `.env` 를 뺀다 — 공개 저장소라서 (적대적 정독 반영)', () => {
    const lines = read(P(`${LAB}/.gitignore`)).trimEnd().split('\n');
    expect(lines[0]).toBe('# ~/nanum/.gitignore');
    expect(lines.filter((l) => l && !l.startsWith('#'))).toEqual(['lab/', '.env']);
  });

  it('`CONTRIBUTING.md` 에는 `p1-15` 과제의 세 줄(병합 방식 · 강제 push · 같이 쓰는 브랜치)이 규칙으로 들어간다', () => {
    const text = read(P(`${LAB}/CONTRIBUTING.md`));
    const rules = text.split('\n').filter((l) => /^\d+\. /.test(l));
    expect(rules).toHaveLength(3);
    expect(rules[0]).toMatch(/Squash/);
    expect(rules[1]).toMatch(/--force-with-lease/);
    expect(rules[2]).toMatch(/같이 쓰게 되면/);
  });

  it('이슈 템플릿 이름은 3자보다 길다 — `기능` 두 글자는 GitHub 가 템플릿으로 안 잡았다(2026-09-14 실측)', () => {
    const text = read(P(`${LAB}/.github/ISSUE_TEMPLATE/feature.md`));
    const front = text.match(/^---\n([\s\S]*?)\n---\n/);
    expect(front, '첫 줄이 --- 로 시작하는 머리말이어야 한다').not.toBeNull();
    const name = front[1].match(/^name: (.+)$/m)[1];
    expect([...name].length).toBeGreaterThan(3);
    expect(front[1]).toMatch(/^about: .+$/m);
    // p2-39 Step 7 의 이슈 형식 — 할 일 · 끝났다고 볼 기준
    expect(text).toContain('## 할 일');
    expect(text).toContain('## 끝났다고 볼 기준');
  });

  it('과제 [기초] 의 버그 템플릿도 이름이 3자보다 길고 세 부분을 둔다', () => {
    const text = read(P(`${LAB}/homework1/.github/ISSUE_TEMPLATE/bug.md`));
    const name = text.match(/^---\nname: (.+)$/m)[1];
    expect([...name].length).toBeGreaterThan(3);
    for (const h of ['## 무엇이 이상한가요', '## 다시 해보는 순서', '## 원래 기대한 결과']) expect(text).toContain(h);
  });

  it('PR 템플릿은 확인한 방법과 `Closes #` 자리를 둔다', () => {
    const text = read(P(`${LAB}/.github/pull_request_template.md`));
    expect(text).toContain('## 확인한 방법');
    expect(text).toMatch(/^Closes #$/m);
  });
});

describe('p2-40 ② 로컬 git — 교안이 인용하는 출력이 실제로 나온다', () => {
  // 학생 폴더 — `p2-39` 가 남긴 셋(README.md · api.http · prisma/schema.prisma) + lab/ 연습 파일 둘,
  // 그리고 이 회차 Step 1 이 «git init 전에» 만든 CONTRIBUTING.md
  beforeAll(() => {
    expect(git(tmp, 'init', '--bare', ORIGIN).status).toBe(0);
    mkdirSync(join(ME, 'prisma'), { recursive: true });
    mkdirSync(join(ME, 'lab'), { recursive: true });
    writeFileSync(join(ME, 'README.md'), '# 동네 나눔\n');
    copyFileSync(P(`${P239}/api.http`), join(ME, 'api.http'));
    copyFileSync(P(`${P239}/schema.prisma`), join(ME, 'prisma/schema.prisma'));
    copyFileSync(P(`${P239}/practice2.http`), join(ME, 'lab/practice2.http'));
    copyFileSync(P(`${P239}/homework1.prisma`), join(ME, 'lab/homework1.prisma'));
    writeFileSync(join(ME, 'lab/homework1.md'), '# 받을 사람 고르기\n');
    copyFileSync(P(`${LAB}/CONTRIBUTING.md`), join(ME, 'CONTRIBUTING.md'));
    // 맥이 폴더를 열 때 만드는 파일 — 학생 폴더에 있다고 두고, 개인 무시 목록이 빼는지 본다
    writeFileSync(join(ME, '.DS_Store'), '');
    writeFileSync(join(ME, 'prisma/.DS_Store'), '');
  });

  it('`git init` 은 폴더 안에 `.git` 을 만든다고 알린다', () => {
    const r = git(ME, 'init');
    expect(r.status).toBe(0);
    expect(r.out).toBe(`Initialized empty Git repository in ${ME}/.git/\n`);
  });

  it('`.DS_Store` 는 개인 무시 목록(~/.config/git/ignore)이 없으면 후보로 보이고, 있으면 빠진다', () => {
    const noPersonal = git(ME, '-c', 'core.excludesFile=/dev/null', 'status', '--short');
    expect(noPersonal.out).toBe('?? .DS_Store\n?? CONTRIBUTING.md\n?? README.md\n?? api.http\n?? lab/\n?? prisma/\n');
    // 폴더 안의 `.DS_Store` 는 목록에 «폴더 이름» 으로만 보인다 — 담아보면 들어간다
    const addNoPersonal = git(ME, '-c', 'core.excludesFile=/dev/null', 'add', '--dry-run', '.');
    expect(addNoPersonal.out).toContain("add 'prisma/.DS_Store'");
    expect(git(ME, 'add', '--dry-run', '.').out).not.toContain('.DS_Store');
  });

  it('`.gitignore` 전에는 `lab/` 이 올라갈 후보로 보이고, 뒤에는 사라진다', () => {
    expect(git(ME, 'status', '--short').out).toBe('?? CONTRIBUTING.md\n?? README.md\n?? api.http\n?? lab/\n?? prisma/\n');
    copyFileSync(P(`${LAB}/.gitignore`), join(ME, '.gitignore'));
    expect(git(ME, 'status', '--short').out).toBe('?? .gitignore\n?? CONTRIBUTING.md\n?? README.md\n?? api.http\n?? prisma/\n');
  });

  it('첫 커밋을 `main` 으로 올리고, 동료 폴더가 같은 저장소를 받는다', () => {
    git(ME, 'add', '.');
    expect(git(ME, 'commit', '-m', '동네 나눔 설계 문서와 팀 규칙').status).toBe(0);
    expect(git(ME, 'status').out).toBe('On branch main\nnothing to commit, working tree clean\n');

    // 직접 해보기 1 — 커밋 뒤에 `lab/` 줄만 지우고 보기만 한다
    writeFileSync(join(ME, '.gitignore'), read(P(`${LAB}/.gitignore`)).replace('lab/\n', ''));
    expect(git(ME, 'status', '--short').out).toBe(' M .gitignore\n?? lab/\n');
    expect(git(ME, 'add', '--dry-run', '.').out).toBe(
      "add '.gitignore'\nadd 'lab/homework1.md'\nadd 'lab/homework1.prisma'\nadd 'lab/practice2.http'\n");
    expect(git(ME, 'restore', '.gitignore').status).toBe(0);
    expect(git(ME, 'status', '--short').out).toBe('');
    expect(read(join(ME, '.gitignore'))).toBe(read(P(`${LAB}/.gitignore`)));
    git(ME, 'remote', 'add', 'origin', ORIGIN);
    expect(git(ME, 'push', '-u', 'origin', 'main').status).toBe(0);

    // Step 4 — main 에 바로 올릴 커밋을 만들었다가(GitHub 가 거절한다) 되감는다
    appendFileSync(join(ME, 'README.md'), '\n규칙을 README 에도 적어둔다\n');
    git(ME, 'commit', '-am', 'main 에 바로 올려본다');
    const back = git(ME, 'reset', '--hard', 'HEAD~1');
    expect(back.out).toMatch(/^HEAD is now at [0-9a-f]{7} 동네 나눔 설계 문서와 팀 규칙\n$/);
    expect(git(ME, 'status', '--short').out).toBe('');

    // 직접 해보기 2 — 올라간 첫 커밋을 amend 로 고쳐 쓴다(GitHub 는 강제 push 를 거절한다). 첫 커밋이라
    // HEAD~1 이 없으므로 원격에 있는 모양으로 되감는다.
    expect(git(ME, 'ls-files').out).not.toContain('.DS_Store');
    expect(git(ME, 'commit', '--amend', '-m', '커밋 메시지를 고친다').status).toBe(0);
    expect(git(ME, 'reset', '--hard', 'HEAD~1').status).not.toBe(0);
    const toRemote = git(ME, 'reset', '--hard', 'origin/main');
    expect(toRemote.out).toMatch(/^HEAD is now at [0-9a-f]{7} 동네 나눔 설계 문서와 팀 규칙\n$/);
    expect(git(ME, 'status').out).toBe("On branch main\nYour branch is up to date with 'origin/main'.\n\nnothing to commit, working tree clean\n");

    const cloned = git(tmp, 'clone', ORIGIN, MATE);
    expect(cloned.status).toBe(0);
    expect(cloned.out.split('\n')[0]).toBe(`Cloning into '${MATE}'...`);
    expect(git(tmp, 'clone', ORIGIN, MERGER).status).toBe(0);
    expect(git(MATE, 'ls-files').out).not.toContain('lab/');
  });

  describe('둘이 같은 줄을 고치면', () => {
    let rebase;
    let status;
    let conflicted;
    let cont;
    let plainPush;
    let hintPull;
    let hintPullLog;
    let lease;
    let matePull;

    beforeAll(() => {
      // 나 — 동료보다 먼저 브랜치를 땄다
      git(ME, 'switch', '-c', 'docs/review-rule');
      appendFileSync(join(ME, 'CONTRIBUTING.md'), `${RULE4_ME}\n`);
      git(ME, 'commit', '-am', 'PR을 읽는 규칙을 더한다');
      git(ME, 'push', '-u', 'origin', 'docs/review-rule');

      // 동료 — 같은 자리에 다른 규칙을 더하고 먼저 합쳐졌다
      git(MATE, 'switch', '-c', 'docs/branch-name-rule');
      appendFileSync(join(MATE, 'CONTRIBUTING.md'), `${RULE4_MATE}\n`);
      git(MATE, 'commit', '-am', '브랜치 이름 규칙을 더한다');
      git(MATE, 'push', '-u', 'origin', 'docs/branch-name-rule');
      squashMerge('docs/branch-name-rule', '브랜치 이름 규칙을 더한다 (#4)');
      // 동료 폴더는 합쳐져 지워진 브랜치에 그대로 서 있다
      matePull = git(MATE, 'pull');

      // 나 — main 을 받아 내 브랜치를 그 위로 옮긴다
      git(ME, 'switch', 'main');
      git(ME, 'pull');
      git(ME, 'switch', 'docs/review-rule');
      rebase = git(ME, 'rebase', 'main');
      status = git(ME, 'status');
      conflicted = read(join(ME, 'CONTRIBUTING.md'));
      writeFileSync(join(ME, 'CONTRIBUTING.md'), read(P(`${LAB}/CONTRIBUTING.resolved.md`)));
      git(ME, 'add', 'CONTRIBUTING.md');
      cont = git(ME, 'rebase', '--continue');
      plainPush = git(ME, 'push');
      // hint 대로 `git pull` 을 치면 어떻게 되나 — 흐름을 안 흔들게 복사본에서 잰다
      const copy = join(tmp, 'nanum-hint-pull');
      cpSync(ME, copy, { recursive: true });
      hintPull = git(copy, 'pull');
      writeFileSync(join(copy, 'CONTRIBUTING.md'), read(P(`${LAB}/CONTRIBUTING.resolved.md`)));
      git(copy, 'add', 'CONTRIBUTING.md');
      git(copy, 'commit', '--no-edit');
      hintPullLog = git(copy, 'log', '--oneline', 'main..HEAD');
      lease = git(ME, 'push', '--force-with-lease');
    });

    it('rebase 한 브랜치에서 hint 대로 `git pull` 하면 멈추지 않고 옛 커밋을 곧바로 병합하려다 충돌하고, 풀어도 옛·새 커밋이 병합 커밋과 함께 남는다 (pull.rebase false)', () => {
      expect(hintPull.status).not.toBe(0);
      expect(hintPull.out).not.toContain('Need to specify how to reconcile');
      expect(hintPull.out).toContain('CONFLICT (content): Merge conflict in CONTRIBUTING.md');
      expect(hintPull.out).toContain('Automatic merge failed; fix conflicts and then commit the result.');
      const subjects = hintPullLog.out.trim().split('\n').map((l) => l.replace(/^[0-9a-f]{7} /, ''));
      expect(subjects).toHaveLength(3);
      expect(subjects.filter((s) => s === 'PR을 읽는 규칙을 더한다')).toHaveLength(2);
      expect(subjects[0]).toMatch(/^Merge branch 'docs\/review-rule'/);
    });

    it('rebase 가 같은 파일의 같은 자리에서 멈춘다', () => {
      expect(rebase.status).not.toBe(0);
      expect(rebase.out).toContain('CONFLICT (content): Merge conflict in CONTRIBUTING.md');
      expect(rebase.out).toMatch(/^error: could not apply [0-9a-f]{7}\.\.\. PR을 읽는 규칙을 더한다$/m);
      expect(status.out).toContain('both modified:   CONTRIBUTING.md');
    });

    it('표시 윗칸(HEAD)은 «동료 것», 아랫칸이 «내 것» 이다 — rebase 는 main 위에서 내 커밋을 다시 얹기 때문에', () => {
      const [, upper, lower] = conflicted.match(/<<<<<<< HEAD\n([\s\S]*?)=======\n([\s\S]*?)>>>>>>> /);
      expect(upper).toBe(`${RULE4_MATE}\n`);
      expect(lower).toBe(`${RULE4_ME}\n`);
    });

    it('둘 다 살린 판(규칙 4 · 5)으로 이어가면 rebase 가 끝난다', () => {
      const rules = read(P(`${LAB}/CONTRIBUTING.resolved.md`)).split('\n').filter((l) => /^\d+\. /.test(l));
      expect(rules.map((r) => r.slice(0, 2))).toEqual(['1.', '2.', '3.', '4.', '5.']);
      expect(rules[3]).toBe(RULE4_MATE);
      expect(rules[4]).toBe(RULE4_ME.replace(/^4\./, '5.'));
      expect(cont.status, cont.out).toBe(0);
      expect(cont.out).toContain('Successfully rebased and updated refs/heads/docs/review-rule.');
    });

    it('합쳐져 원격에서 지워진 브랜치에 선 채로 `git pull` 하면 받을 브랜치가 없다고 멈춘다', () => {
      expect(matePull.status).not.toBe(0);
      expect(matePull.out).toContain('from the remote, but no such ref was fetched.');
    });

    it('옮긴 브랜치는 평범한 push 가 거절되고, `--force-with-lease` 는 통과한다', () => {
      expect(plainPush.status).not.toBe(0);
      expect(plainPush.out).toMatch(/! \[rejected\]\s+docs\/review-rule -> docs\/review-rule \(non-fast-forward\)/);
      expect(lease.status, lease.out).toBe(0);
      expect(lease.out).toMatch(/\+ [0-9a-f]{7}\.\.\.[0-9a-f]{7} docs\/review-rule -> docs\/review-rule \(forced update\)/);
    });
  });

  describe('Squash 로 합친 뒤 뒷정리', () => {
    let prune;
    let deleteSmall;

    beforeAll(() => {
      squashMerge('docs/review-rule', 'PR을 읽는 규칙을 더한다 (#5)');
      git(ME, 'switch', 'main');
      git(ME, 'pull');
      prune = git(ME, 'fetch', '--prune');
      deleteSmall = git(ME, 'branch', '-d', 'docs/review-rule');
    });

    it('`fetch --prune` 이 GitHub 가 지운 브랜치의 흔적을 치운다', () => {
      expect(prune.out).toMatch(/- \[deleted\]\s+\(none\)\s+-> origin\/docs\/review-rule/);
    });

    it('`branch -d` 는 거절한다 — Squash 가 만든 새 커밋은 내 브랜치의 커밋과 다르다', () => {
      expect(deleteSmall.status).not.toBe(0);
      expect(deleteSmall.out).toContain("error: the branch 'docs/review-rule' is not fully merged");
    });

    it('그래도 내용은 main 에 들어 있다 — 규칙 다섯 줄', () => {
      expect(read(join(ME, 'CONTRIBUTING.md'))).toBe(read(P(`${LAB}/CONTRIBUTING.resolved.md`)));
    });
  });

  describe('직접 해보기 3 — 같은 값을 둘이 다르게 고치면', () => {
    const LINE = 'GET http://localhost:3000/api/shares?categoryId=1&limit=10\n';
    const mine = LINE.replace('limit=10', 'limit=12');
    const theirs = LINE.replace('limit=10', 'limit=20');
    let rebase;
    let conflicted;
    let cont;
    let status;
    let skip;
    let pullDiverged;
    let sameCommit;
    let logMine;
    let diffMine;
    let apiMine;
    let delOnBranch;
    let delBeforePrune;
    let prune3;
    let delAfterPrune;

    beforeAll(() => {
      git(ME, 'switch', 'main');
      git(ME, 'pull');
      git(ME, 'switch', '-c', 'docs/list-limit-12');
      writeFileSync(join(ME, 'api.http'), read(join(ME, 'api.http')).replace(LINE, mine));
      git(ME, 'commit', '-am', '목록을 12개씩 받는다');
      git(ME, 'push', '-u', 'origin', 'docs/list-limit-12');

      git(MATE, 'switch', 'main');
      git(MATE, 'pull');
      git(MATE, 'switch', '-c', 'docs/list-limit-20');
      writeFileSync(join(MATE, 'api.http'), read(join(MATE, 'api.http')).replace(LINE, theirs));
      git(MATE, 'commit', '-am', '목록을 20개씩 받는다');
      git(MATE, 'push', '-u', 'origin', 'docs/list-limit-20');
      squashMerge('docs/list-limit-20', '목록을 20개씩 받는다 (#7)');

      git(ME, 'switch', 'main');
      git(ME, 'pull');
      git(ME, 'switch', 'docs/list-limit-12');
      rebase = git(ME, 'rebase', 'main');
      conflicted = read(join(ME, 'api.http'));
      // 팀이 동료의 값(20)을 고르기로 했다 — 표시 세 줄과 내 줄을 지운다
      writeFileSync(join(ME, 'api.http'), conflicted.replace(/<<<<<<< HEAD\n([\s\S]*?)=======\n[\s\S]*?>>>>>>> [^\n]*\n/, '$1'));
      git(ME, 'add', 'api.http');
      cont = git(ME, 'rebase', '--continue');
      status = git(ME, 'status');
      skip = git(ME, 'rebase', '--skip');
      // 지우기 전에 브랜치 상태를 잰다
      logMine = git(ME, 'log', '--oneline', 'main..docs/list-limit-12');
      diffMine = git(ME, 'diff', 'main', '--stat');
      apiMine = read(join(ME, 'api.http'));
      sameCommit = git(ME, 'rev-parse', 'docs/list-limit-12').out === git(ME, 'rev-parse', 'main').out;
      // status 의 hint 대로 `git pull` 을 치면 — 흐름을 안 흔들게 복사본에서 잰다
      const copy = join(tmp, 'nanum-diverged-pull');
      cpSync(ME, copy, { recursive: true });
      pullDiverged = git(copy, 'pull');

      // PR 을 합치지 않고 닫은 뒤 브랜치 지우기 — 셋 다 교안이 안내하는 순서로 잰다
      delOnBranch = git(ME, 'branch', '-d', 'docs/list-limit-12');
      git(ME, 'switch', 'main');
      delBeforePrune = git(ME, 'branch', '-d', 'docs/list-limit-12');
      // 닫은 PR 의 브랜치는 저절로 안 지워져서 GitHub 에서 직접 지운다
      expect(git(MERGER, 'push', 'origin', '--delete', 'docs/list-limit-12').status).toBe(0);
      prune3 = git(ME, 'fetch', '--prune');
      delAfterPrune = git(ME, 'branch', '-d', 'docs/list-limit-12');
    });

    it('같은 줄의 값이 달라서 api.http 에서 멈춘다', () => {
      expect(rebase.out).toContain('CONFLICT (content): Merge conflict in api.http');
      const [, upper, lower] = conflicted.match(/<<<<<<< HEAD\n([\s\S]*?)=======\n([\s\S]*?)>>>>>>> /);
      expect(upper).toBe(theirs);
      expect(lower).toBe(mine);
    });

    it('동료의 값을 고르면 `--continue` 가 «성공» 하면서 내 커밋을 조용히 없앤다 (2026-09-14 실측 — 멈출 거라던 추측이 틀렸다)', () => {
      expect(cont.status, cont.out).toBe(0);
      expect(cont.out).toContain('Successfully rebased and updated refs/heads/docs/list-limit-12.');
      expect(logMine.out).toBe('');
      expect(diffMine.out).toBe('');
      expect(apiMine).toContain(theirs);
    });

    it('rebase 가 내 커밋을 빼서 브랜치가 `main` 과 «같은 커밋» 을 가리킨다 — Step 6 은 내용만 같고 커밋이 달랐다', () => {
      expect(sameCommit).toBe(true);
    });

    it('갈라진 브랜치에서 hint 대로 `git pull` 하면 멈추지 않고 GitHub 의 옛 12 커밋을 병합하려다 충돌한다 (pull.rebase false)', () => {
      expect(pullDiverged.status).not.toBe(0);
      expect(pullDiverged.out).not.toContain('Need to specify how to reconcile');
      expect(pullDiverged.out).toContain('CONFLICT (content): Merge conflict in api.http');
    });

    it('닫은 PR 의 브랜치는 서 있는 동안도, 원격 흔적이 남은 동안도 `-d` 가 거절하고, 지우고 prune 한 뒤에야 통과한다', () => {
      expect(delOnBranch.out).toContain("error: cannot delete branch 'docs/list-limit-12' used by worktree");
      expect(delBeforePrune.out).toContain("error: the branch 'docs/list-limit-12' is not fully merged");
      expect(prune3.out).toMatch(/- \[deleted\]\s+\(none\)\s+-> origin\/docs\/list-limit-12/);
      expect(delAfterPrune.status, delAfterPrune.out).toBe(0);
      expect(delAfterPrune.out).toMatch(/^Deleted branch docs\/list-limit-12 \(was [0-9a-f]{7}\)\.$/m);
    });

    it('원격의 내 브랜치와는 서로 한 커밋씩 갈라졌다고 나오고, 끝난 rebase 에는 `--skip` 할 것이 없다', () => {
      expect(status.out).toContain("Your branch and 'origin/docs/list-limit-12' have diverged,\nand have 1 and 1 different commits each, respectively.");
      expect(skip.status).not.toBe(0);
      expect(skip.out).toContain('fatal: no rebase in progress');
    });
  });

  describe('답안 [응용] — 확인용 브랜치 정리', () => {
    let delWip;
    let pruneList;
    let delList;
    let pruneApproval;
    let delApprovalSmall;
    let delApprovalBig;

    beforeAll(() => {
      git(ME, 'switch', 'main');
      git(ME, 'pull');
      // 2번 — 틀린 이름은 GitHub 가 거절해서 upstream 이 안 생긴다(여기선 push 를 안 한다), 맞는 이름은 올라간다
      git(ME, 'switch', '-c', 'wip-test');
      git(ME, 'switch', '-c', 'feat/list-page');
      git(ME, 'push', '-u', 'origin', 'feat/list-page');
      git(ME, 'switch', 'main');
      delWip = git(ME, 'branch', '-d', 'wip-test');
      expect(git(MERGER, 'push', 'origin', '--delete', 'feat/list-page').status).toBe(0);
      pruneList = git(ME, 'fetch', '--prune');
      delList = git(ME, 'branch', '-d', 'feat/list-page');

      // 3번 — 합치지 않은 커밋이 든 브랜치로 연 PR 을 닫고 브랜치를 지운다
      git(ME, 'switch', '-c', 'docs/approval-check');
      appendFileSync(join(ME, 'README.md'), '\n승인이 몇 명 필요한지 확인한다\n');
      git(ME, 'commit', '-am', '승인 규칙을 확인한다');
      git(ME, 'push', '-u', 'origin', 'docs/approval-check');
      git(ME, 'switch', 'main');
      expect(git(MERGER, 'push', 'origin', '--delete', 'docs/approval-check').status).toBe(0);
      pruneApproval = git(ME, 'fetch', '--prune');
      delApprovalSmall = git(ME, 'branch', '-d', 'docs/approval-check');
      delApprovalBig = git(ME, 'branch', '-D', 'docs/approval-check');
    });

    it('커밋을 더하지 않은 `wip-test`·`feat/list-page` 는 prune 뒤 `-d` 로 지워진다', () => {
      expect(delWip.status, delWip.out).toBe(0);
      expect(pruneList.out).toMatch(/- \[deleted\]\s+\(none\)\s+-> origin\/feat\/list-page/);
      expect(delList.status, delList.out).toBe(0);
    });

    it('합치지 않은 커밋이 남은 `docs/approval-check` 는 prune 뒤에도 `-d` 가 거절하고 `-D` 로만 지워진다', () => {
      expect(pruneApproval.out).toMatch(/- \[deleted\]\s+\(none\)\s+-> origin\/docs\/approval-check/);
      expect(delApprovalSmall.status).not.toBe(0);
      expect(delApprovalSmall.out).toContain("error: the branch 'docs/approval-check' is not fully merged");
      expect(delApprovalBig.status, delApprovalBig.out).toBe(0);
    });
  });
});

describe('p2-40 ③ GitHub — 얼려둔 실측', () => {
  const snap = (name) => read(P(`snapshots/p2-40/github/${name}`));

  it('`main` 에 바로 push 하면 PR 을 거치라며 거절한다', () => {
    const t = snap('direct-push-main.txt');
    expect(t).toContain('remote: - Changes must be made through a pull request.');
    expect(t).toContain('! [remote rejected] main -> main (push declined due to repository rule violations)');
    expect(t).not.toContain('Cannot force-push');
  });

  it('`main` 을 강제로 덮어쓰려 하면 위반이 둘 나온다', () => {
    const t = snap('force-push-main.txt');
    expect(t).toContain('remote: - Cannot force-push to this branch');
    expect(t).toContain('remote: - Changes must be made through a pull request.');
  });
});

describe('p2-40 ④ 교안 — 인용한 파일과 출력이 코드베이스·실측과 한 글자도 다르지 않다', () => {
  const LECTURE = P('../../part2/6-fullstack-join/p2-40-team-repo-lecture.md');
  const fences = () => {
    const out = [];
    const re = /^```(\w*)\n([\s\S]*?)^```$/gm;
    let m;
    const text = read(LECTURE);
    while ((m = re.exec(text))) out.push({ lang: m[1], body: m[2].replace(/\n$/, '') });
    return out;
  };
  const has = (lang, body) => fences().some((f) => f.lang === lang && f.body === body.replace(/\n$/, ''));
  const snapFor = (name) => read(P(`snapshots/p2-40/github/${name}`)).replaceAll('soongu/p2-40-ruleset-probe', 'nanum-hong/nanum');

  it('파일 넷(.gitignore · CONTRIBUTING · 두 템플릿)과 충돌을 푼 판을 코드베이스 그대로 싣는다', () => {
    expect(has('gitignore', read(P(`${LAB}/.gitignore`)))).toBe(true);
    expect(has('markdown', read(P(`${LAB}/CONTRIBUTING.md`)))).toBe(true);
    expect(has('markdown', read(P(`${LAB}/CONTRIBUTING.resolved.md`)))).toBe(true);
    expect(has('markdown', read(P(`${LAB}/.github/ISSUE_TEMPLATE/feature.md`)))).toBe(true);
    expect(has('markdown', read(P(`${LAB}/.github/pull_request_template.md`)))).toBe(true);
  });

  it('GitHub 가 낸 출력 셋을 얼려둔 실측 그대로 싣는다 (조직 이름만 바꿔서)', () => {
    for (const name of ['direct-push-main.txt', 'force-push-main.txt', 'push-feature-branch.txt']) {
      expect(has('', snapFor(name)), name).toBe(true);
    }
  });

  it('직접 해보기 3 이 보여주는 `api.http` 두 줄은 지난 시간 파일에 그대로 붙어 있다', () => {
    const snippet = '### 나눔 목록 — 한 분류만, 한 번에 10개씩\nGET http://localhost:3000/api/shares?categoryId=1&limit=10';
    expect(read(P(`${P239}/api.http`))).toContain(snippet);
    expect(has('http', snippet)).toBe(true);
    // 10 이 적힌 곳은 셋이다 — 주석 「한 번에 10개씩」 · 목록 `limit=10` · 다음 목록 `limit=10&cursor=11`
    //    (해설이 «세 곳을 함께 고쳐야 했다» 고 말한다)
    expect(read(P(`${P239}/api.http`)).match(/10/g)).toHaveLength(3);
  });

  it('로컬 git 출력 — ② 가 실제로 뽑은 문자열과 교안 블록이 같다', () => {
    expect(has('', '?? CONTRIBUTING.md\n?? README.md\n?? api.http\n?? lab/\n?? prisma/')).toBe(true);
    expect(has('', '?? .gitignore\n?? CONTRIBUTING.md\n?? README.md\n?? api.http\n?? prisma/')).toBe(true);
    expect(has('', 'On branch main\nnothing to commit, working tree clean')).toBe(true);
    expect(has('', ' M .gitignore\n?? lab/')).toBe(true);
    expect(has('', "add '.gitignore'\nadd 'lab/homework1.md'\nadd 'lab/homework1.prisma'\nadd 'lab/practice2.http'")).toBe(true);
    expect(has('', "On branch main\nYour branch is up to date with 'origin/main'.\n\nnothing to commit, working tree clean")).toBe(true);
    expect(has('', "error: the branch 'docs/templates' is not fully merged\nhint: If you are sure you want to delete it, run 'git branch -D docs/templates'\nhint: Disable this message with \"git config set advice.forceDeleteBranch false\"")).toBe(true);
    expect(has('', 'Successfully rebased and updated refs/heads/docs/review-rule.')).toBe(true);
    expect(has('', 'Successfully rebased and updated refs/heads/docs/list-limit-12.')).toBe(true);
  });

  it('맥 사용자의 개인 무시 목록 두 줄은 ② 가 쓴 파일 위치(~/.config/git/ignore)와 같다', () => {
    expect(has('bash', 'mkdir -p ~/.config/git\necho ".DS_Store" >> ~/.config/git/ignore')).toBe(true);
  });
});

describe('p2-40 ⑤ 답안 — 인용한 파일과 거절 메시지가 코드베이스·실측과 같다', () => {
  const ANSWERS = P('../../part2/6-fullstack-join/p2-40-team-repo-answers.md');
  const fences = () => {
    const out = [];
    const re = /^```(\w*)\n([\s\S]*?)^```$/gm;
    let m;
    const text = read(ANSWERS);
    while ((m = re.exec(text))) out.push({ lang: m[1], body: m[2].replace(/\n$/, '') });
    return out;
  };
  const has = (lang, body) => fences().some((f) => f.lang === lang && f.body === body.replace(/\n$/, ''));

  it('[기초] 버그 템플릿 · [응용] 표를 코드베이스 그대로 싣는다', () => {
    expect(has('markdown', read(P(`${LAB}/homework1/.github/ISSUE_TEMPLATE/bug.md`)))).toBe(true);
    expect(has('markdown', read(P(`${LAB}/homework2.md`)))).toBe(true);
  });

  it('[응용] Restrict creations 가 틀린 이름을 거절한 실측을 그대로 싣는다', () => {
    const snap = read(P('snapshots/p2-40/github/push-bad-branch-name.txt')).replaceAll('soongu/p2-40-ruleset-probe', 'nanum-hong/nanum');
    expect(snap).toContain('remote: - Cannot create ref due to creations being restricted.');
    expect(has('', snap)).toBe(true);
  });

  it('[응용] 확인용 브랜치 정리 명령은 ② 가 실제로 돌린 순서와 옵션(-d / -D)이다', () => {
    expect(has('bash', 'git switch main\ngit fetch --prune\ngit branch -d wip-test\ngit branch -d feat/list-page')).toBe(true);
    expect(has('bash', 'git switch main\ngit fetch --prune\ngit branch -D docs/approval-check')).toBe(true);
  });
});
