// p2-29 「Prisma 시작과 마이그레이션 — schema.prisma · migrate」 게이트
//
// 🚨 이 회차는 «명령이 만든 파일» 을 교안이 인용한다. 손으로 옮겨 적으면 그 자리가 곧
//    「다이어그램-코드 드리프트」가 되므로, 교안이 인용하는 것은 전부 코드베이스 파일과
//    글자 단위로 대조한다.
// 🚨 진짜 instagram DB 를 안 건드린다 — 전용 DB(p229_gate)를 p2-28 종료 상태로 세워서 쓴다.
//    p2-26~28 게이트가 같은 DB 를 쓰는데, 이 회차가 _prisma_migrations 와 created_at 을
//    남기면 그 회차들의 reset 이 다른 상태에서 출발한다.
// 🚨 시각과 폴더 이름은 «돌릴 때마다 다르다» — 값이 아니라 성질을 잰다.
//    (20260910232755_add_created_at 의 앞자리는 마이그레이션을 «만든 순간»이다.)
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { readFileSync, readdirSync, writeFileSync, copyFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import pg from 'pg';
import { setupP229 } from '../sql/p2-29/setup.mjs';

const ROOT = new URL('../', import.meta.url);
const P = (rel) => new URL(rel, ROOT).pathname;
const GATE_URL = 'postgresql://postgres:postgres@localhost:5432/p229_gate';
const SHADOW_URL = 'postgresql://postgres:postgres@localhost:5432/p229_shadow';
const ADMIN = { host: 'localhost', port: 5432, database: 'postgres', user: 'postgres', password: 'postgres' };
const GATE = { ...ADMIN, database: 'p229_gate' };

const LECTURE = P('../../part2/5-db-prisma/p2-29-prisma-migrate-lecture.md');
const ANSWERS = P('../../part2/5-db-prisma/p2-29-prisma-migrate-answers.md');
const read = (p) => readFileSync(p, 'utf8');
const exists = (p) => { try { readFileSync(p); return true; } catch { return false; } };
const blocksOf = (p, lang) =>
  exists(p) ? [...read(p).matchAll(new RegExp('```' + lang + '\\n([\\s\\S]*?)```', 'g'))].map((m) => m[1].trimEnd()) : [];

/** prisma CLI 를 학생과 «같은 방식으로» 부른다. */
const prisma = (args, env = {}) =>
  execFileSync(P('node_modules/.bin/prisma'), args, {
    cwd: P('.'), encoding: 'utf8',
    env: { ...process.env, DATABASE_URL: GATE_URL, SHADOW_DATABASE_URL: SHADOW_URL, ...env },
  });

/** 종료 코드가 0 이 아니어도 출력을 돌려준다 — `migrate status` 는 «남은 것이 있으면» 1 로 끝난다. */
const prismaSoft = (args, env = {}) => {
  try { return prisma(args, env); }
  catch (e) { return `${e.stdout ?? ''}${e.stderr ?? ''}`; }
};

const migrationDir = (suffix) =>
  readdirSync(P('prisma/migrations')).find((d) => d.endsWith(suffix));

let db;

beforeAll(async () => {
  const admin = new pg.Client(ADMIN);
  await admin.connect();
  for (const name of ['p229_gate', 'p229_shadow']) {
    await admin.query(`DROP DATABASE IF EXISTS ${name}`);
    await admin.query(`CREATE DATABASE ${name}`);
  }
  await admin.end();
  db = new pg.Client(GATE);
  await db.connect();
  await setupP229(db);
}, 60000);

afterAll(async () => {
  await db?.end();
  const admin = new pg.Client(ADMIN);
  await admin.connect();
  for (const name of ['p229_gate', 'p229_shadow']) await admin.query(`DROP DATABASE IF EXISTS ${name}`);
  await admin.end();
});

describe('착수 상태 — 「지난 시간 그대로」에서 출발한다', () => {
  it('p2-28 을 끝낸 학생의 표 둘이 그대로 서 있다', async () => {
    const r = await db.query('select (select count(*)::int from posts) p, (select count(*)::int from comments) c');
    expect(r.rows[0]).toEqual({ p: 5, c: 9 });
  });

  it('p2-28 이 건 외래 키가 실재한다', async () => {
    const r = await db.query(
      "select conname from pg_constraint where contype='f' and conrelid='comments'::regclass");
    expect(r.rows.map((x) => x.conname)).toContain('comments_post_id_fkey');
  });
});

describe('db pull — 손으로 만든 표가 파일이 된다', () => {
  it('스켈레톤에서 뽑으면 스냅숏과 «글자 단위로» 같다', () => {
    copyFileSync(P('snapshots/p2-29/schema-skeleton.prisma'), P('snapshots/p2-29/schema-pulled.prisma'));
    prisma(['db', 'pull', '--config', 'snapshots/p2-29/pull.config.js']);
    // 스냅숏은 커밋돼 있고, 방금 뽑은 것이 그것과 같아야 한다.
    expect(read(P('snapshots/p2-29/schema-pulled.prisma'))).toMatchSnapshot();
  });

  it('p2-28 의 외래 키가 «관계»로 적힌다 — 양쪽 모두', () => {
    const s = read(P('snapshots/p2-29/schema-pulled.prisma'));
    expect(s).toContain('posts       posts  @relation(fields: [post_id], references: [id]');
    expect(s).toContain('comments      comments[]');
  });

  it('칸 이름은 DB 가 쓰는 그대로 — camelCase 는 «한 글자도» 없다', () => {
    const s = read(P('snapshots/p2-29/schema-pulled.prisma'));
    for (const raw of ['profile_image', 'post_image', 'post_alt', 'minutes_ago', 'like_count', 'comment_count'])
      expect(s).toContain(raw);
    for (const camel of ['profileImage', 'postImage', 'likeCount', 'commentCount'])
      expect(s).not.toContain(camel);
  });

  it('🚨 db pull 은 맨 윗줄 경로 주석을 «지운다»', () => {
    const path = P('snapshots/p2-29/schema-pulled.prisma');
    writeFileSync(path, '// ~/instagram-api/prisma/schema.prisma\n' + read(path));
    expect(read(path).startsWith('//')).toBe(true);
    prisma(['db', 'pull', '--config', 'snapshots/p2-29/pull.config.js']);
    expect(read(path).startsWith('//')).toBe(false);
  });
});

describe('@map — 이름만 갈라놓으면 DB 는 «안» 바뀐다', () => {
  it('DB 와 camelCase 스키마 사이의 차이가 0 이다', () => {
    const out = prisma(['migrate', 'diff', '--from-config-datasource',
      '--to-schema', 'snapshots/p2-29/schema-mapped.prisma', '--script']);
    expect(out).toContain('This is an empty migration');
  });
});

describe('베이스라인 — 이미 있는 표를 이력의 첫 칸으로', () => {
  it('뽑히는 SQL 이 0_init/migration.sql 과 «글자 단위로» 같다', () => {
    const out = prisma(['migrate', 'diff', '--from-empty',
      '--to-schema', 'snapshots/p2-29/schema-mapped.prisma', '--script']);
    const committed = read(P('prisma/migrations/0_init/migration.sql'));
    expect(out.replace(/^Loaded Prisma config.*\n\n?/, '').trim()).toBe(committed.trim());
  });

  it('그 SQL 은 학생이 세 회차 동안 «손으로 쓴 그것»이다', () => {
    const sql = read(P('prisma/migrations/0_init/migration.sql'));
    expect(sql).toContain('CREATE TABLE "posts"');
    expect(sql).toContain('CREATE TABLE "comments"');
    expect(sql).toContain('ADD CONSTRAINT "comments_post_id_fkey" FOREIGN KEY ("post_id") REFERENCES "posts"("id")');
  });

  it('resolve 하면 이력의 첫 칸이 「이미 적용됨」으로 박히고 데이터가 «그대로» 남는다', async () => {
    prisma(['migrate', 'resolve', '--applied', '0_init']);

    const applied = await db.query(
      'select migration_name, finished_at from _prisma_migrations order by started_at');
    expect(applied.rows.map((x) => x.migration_name)).toContain('0_init');
    expect(applied.rows[0].finished_at).not.toBeNull();

    // 표를 다시 만든 것이 아니라 «이미 있던 표를 이력에 등재»한 것이다.
    const r = await db.query('select (select count(*)::int from posts) p, (select count(*)::int from comments) c');
    expect(r.rows[0]).toEqual({ p: 5, c: 9 });

    // 그리고 DB 는 여전히 baseline 스키마와 «차이가 0» 이다.
    const diff = prisma(['migrate', 'diff', '--from-config-datasource',
      '--to-schema', 'snapshots/p2-29/schema-mapped.prisma', '--script']);
    expect(diff).toContain('This is an empty migration');
  });
});

describe('migrate — 칸을 하나 더하면 이력이 자란다', () => {
  it('뽑히는 SQL 이 add_created_at 마이그레이션과 같다', () => {
    const out = prisma(['migrate', 'diff',
      '--from-schema', 'snapshots/p2-29/schema-mapped.prisma',
      '--to-schema', 'prisma/schema.prisma', '--script']);
    const dir = migrationDir('_add_created_at');
    expect(dir).toBeTruthy();
    const committed = read(P(`prisma/migrations/${dir}/migration.sql`));
    expect(out.replace(/^Loaded Prisma config.*\n\n?/, '').trim()).toBe(committed.trim());
  });

  it('🚨 이미 든 5줄은 «전부 같은 시각»을 받는다 — minutes_ago 와 어긋난다', async () => {
    prisma(['migrate', 'deploy']);
    const r = await db.query('select minutes_ago, created_at from posts order by id');
    expect(r.rows).toHaveLength(5);
    const stamps = new Set(r.rows.map((x) => x.created_at.getTime()));
    expect(stamps.size).toBe(1);                       // 다섯 줄이 «한» 시각
    expect(new Set(r.rows.map((x) => x.minutes_ago)).size).toBeGreaterThan(1); // 원래 값은 제각각
  });

  it('이력만으로 스키마가 «그대로» 되살아난다', () => {
    const out = prisma(['migrate', 'diff', '--config', 'snapshots/p2-29/history.config.js',
      '--from-migrations', './prisma/migrations', '--to-schema', './prisma/schema.prisma', '--script']);
    expect(out).toContain('This is an empty migration');
  });
});

describe('첫 쿼리 — JS 쪽은 camelCase 로 돌아온다', () => {
  it('check.js 가 게시물 5개를 읽고 camelCase 로 찍는다', () => {
    prisma(['generate']);
    const out = execFileSync(process.execPath, [P('check.js')], {
      cwd: P('.'), encoding: 'utf8', env: { ...process.env, DATABASE_URL: GATE_URL },
    });
    expect(out).toContain('게시물 5개를 읽었어요.');
    for (const camel of ['profileImage', 'postImage', 'postAlt', 'minutesAgo', 'likeCount', 'commentCount', 'createdAt'])
      expect(out).toContain(camel);
    for (const raw of ['profile_image', 'post_image', 'like_count'])
      expect(out).not.toContain(raw);
  });
});

describe('교안 ↔ 코드베이스 — 인용한 것이 실재한다', () => {
  const schemaSources = () => [
    'snapshots/p2-29/schema-skeleton.prisma',
    'snapshots/p2-29/schema-pulled.prisma',
    'snapshots/p2-29/schema-mapped.prisma',
    'prisma/schema.prisma',
  ].map((f) => read(P(f)));

  const sqlSources = () =>
    readdirSync(P('prisma/migrations'))
      .filter((d) => !d.endsWith('.toml'))
      .map((d) => read(P(`prisma/migrations/${d}/migration.sql`)));

  it.runIf(exists(LECTURE))('교안의 ```prisma 블록이 전부 코드베이스 스키마 안에 실재한다', () => {
    const srcs = schemaSources();
    const missing = blocksOf(LECTURE, 'prisma').filter((b) => !srcs.some((s) => s.includes(b)));
    expect(missing).toEqual([]);
  });

  it.runIf(exists(LECTURE))('교안의 ```sql 블록이 전부 마이그레이션 파일 안에 실재한다', () => {
    const srcs = sqlSources();
    const missing = blocksOf(LECTURE, 'sql').filter((b) => !srcs.some((s) => s.includes(b)));
    expect(missing).toEqual([]);
  });

  it.runIf(exists(ANSWERS))('답안의 ```prisma 블록도 마찬가지다', () => {
    const srcs = [...schemaSources(), ...blocksOf(ANSWERS, 'prisma')].slice(0, 4);
    const missing = blocksOf(ANSWERS, 'prisma').filter((b) => !srcs.some((s) => s.includes(b)));
    expect(missing).toEqual([]);
  });
});
