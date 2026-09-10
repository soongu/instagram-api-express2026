// p2-26 「관계형 DB 와 테이블」 게이트
//
// 🚨 학생은 psql 을 안 친다 — VS Code PostgreSQL 확장(ms-ossdata.vscode-pgsql)으로
//    SQL 을 실행한다. 그래서 이 게이트는 «학생이 붙는 그 포트»(localhost:5432)로
//    똑같이 왕복하고, 교안에는 psql 메타명령(\d 등)을 한 줄도 인용하지 않는다.
//    (p2-22 가 supertest 대신 실제 포트를 쓴 것과 같은 이유다.)
//
// 전제: docker run -d --name instagram-db -p 5432:5432 \
//         -e POSTGRES_PASSWORD=postgres -e POSTGRES_DB=instagram postgres:18
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { readFileSync } from 'node:fs';
import pg from 'pg';
import mongoose from 'mongoose';
import { LOCAL_MONGO_URL } from './helpers/boot.js';

const PG = { host: 'localhost', port: 5432, database: 'instagram', user: 'postgres', password: 'postgres' };
const sql = (n) => readFileSync(new URL(`../sql/p2-26/${n}`, import.meta.url), 'utf8');

let db;
beforeAll(async () => {
  db = new pg.Client(PG);
  await db.connect();
  await db.query('DROP TABLE IF EXISTS posts');
  await db.query(sql('02-posts.sql'));
  await db.query(sql('03-insert.sql'));
}, 30000);
afterAll(async () => { await db?.end(); });

// 실패를 «에러 객체»로 받는다 — 교안이 인용할 메시지가 여기서 나온다
async function refused(text, params = []) {
  try { await db.query(text, params); return null; }
  catch (e) { return { code: e.code, message: e.message }; }
}

describe('Step 5·8 — 교안이 인용하는 DDL 이 postgres:18 에서 그대로 돈다', () => {
  it('학생이 붙는 포트가 곧 게이트가 붙는 포트다', async () => {
    const { rows } = await db.query('SELECT current_database() AS db, current_user AS usr');
    expect(rows[0]).toEqual({ db: 'instagram', usr: 'postgres' });
  });

  it('표 모양이 교안이 그려 보일 그것과 같다', async () => {
    const { rows } = await db.query(`
      SELECT column_name, data_type, character_maximum_length AS len,
             is_nullable, column_default
        FROM information_schema.columns
       WHERE table_name = 'posts' ORDER BY ordinal_position`);
    expect(rows.map(r => r.column_name)).toEqual([
      'id', 'username', 'profile_image', 'post_image', 'post_alt',
      'content', 'minutes_ago', 'like_count', 'comment_count',
    ]);
    const by = Object.fromEntries(rows.map(r => [r.column_name, r]));
    // SERIAL 은 «자료형» 이 아니라 integer + nextval 기본값이다 — 교안이 이걸 짚는다
    expect(by.id.data_type).toBe('integer');
    expect(by.id.column_default).toBe("nextval('posts_id_seq'::regclass)");
    expect(by.username.data_type).toBe('character varying');
    expect(by.username.len).toBe(50);
    expect(by.username.is_nullable).toBe('NO');
    expect(by.post_image.is_nullable).toBe('NO');
    expect(by.profile_image.is_nullable).toBe('YES');
    expect(by.like_count.column_default).toBe('0');
  });

  it('PRIMARY KEY 가 실제로 걸려 있다', async () => {
    const { rows } = await db.query(`
      SELECT c.conname, c.contype FROM pg_constraint c
        JOIN pg_class t ON t.oid = c.conrelid
       WHERE t.relname = 'posts' AND c.contype = 'p'`);
    expect(rows).toHaveLength(1);
    expect(rows[0].conname).toBe('posts_pkey');
  });

  it('넣은 게시물 셋이 그대로 있고 번호는 우리가 안 적었다', async () => {
    const { rows } = await db.query('SELECT id, username, like_count FROM posts ORDER BY id');
    expect(rows).toEqual([
      { id: 1, username: 'jaehoon',  like_count: 128 },
      { id: 2, username: 'minji',    like_count: 512 },
      { id: 3, username: 'seungwoo', like_count: 76 },
    ]);
  });

  it('DEFAULT 는 «칸을 안 적었을 때만» 채운다', async () => {
    await db.query(`INSERT INTO posts (username, post_image) VALUES ('nayeon', '/images/p4.jpg')`);
    const { rows } = await db.query(`SELECT minutes_ago, like_count, comment_count, content
                                       FROM posts WHERE username = 'nayeon'`);
    expect(rows[0]).toEqual({ minutes_ago: 0, like_count: 0, comment_count: 0, content: null });
  });
});

describe('Step 7 — 데이터베이스가 «직접» 막는 것 셋', () => {
  it('① 모르는 칸은 에러다 (몽고는 조용히 버렸다)', async () => {
    const e = await refused(`INSERT INTO posts (username, post_image, mood) VALUES ('minji','/i.jpg','happy')`);
    expect(e.code).toBe('42703');
    expect(e.message).toBe('column "mood" of relation "posts" does not exist');
  });

  it('② 필수 칸을 비우면 에러다', async () => {
    const e = await refused(`INSERT INTO posts (username, post_image) VALUES ('minji', NULL)`);
    expect(e.code).toBe('23502');
    expect(e.message).toBe('null value in column "post_image" of relation "posts" violates not-null constraint');
  });

  it('③ 숫자 칸에 말을 넣으면 에러다', async () => {
    const e = await refused(`INSERT INTO posts (username, post_image, like_count) VALUES ('minji','/i.jpg','많아요')`);
    expect(e.code).toBe('22P02');
    expect(e.message).toBe('invalid input syntax for type integer: "많아요"');
  });
});

describe('🚨 그런데 관계형도 다 막지는 않는다 — 교안이 단정하지 않게 잡아두는 축', () => {
  it('④ 글자 칸에 숫자를 넣으면 «통과»하고 글자로 바뀐다', async () => {
    const { rows } = await db.query(
      `INSERT INTO posts (username, post_image) VALUES (123, '/i.jpg') RETURNING username`);
    expect(rows[0].username).toBe('123');
    expect(typeof rows[0].username).toBe('string');
  });

  it('⑤ 숫자로 읽히는 말은 «통과»하고 숫자로 바뀐다 — Mongoose 와 같은 결과다', async () => {
    const { rows } = await db.query(
      `INSERT INTO posts (username, post_image, like_count) VALUES ('minji','/i.jpg','42') RETURNING like_count`);
    expect(rows[0].like_count).toBe(42);
  });

  // 🚨 초고가 「막힌 INSERT 는 번호를 쓴다」로 뭉뚱그렸다가 실행에 반증됐다.
  //    셋 중 «NOT NULL 하나만» 쓴다 — 나머지 둘은 줄을 만들기 «전에» 터진다.
  const seq = async () => Number((await db.query('SELECT last_value FROM posts_id_seq')).rows[0].last_value);

  it('타입 변환 실패는 번호를 «안» 쓴다', async () => {
    const before = await seq();
    await refused(`INSERT INTO posts (username, post_image, like_count) VALUES ('x','/i.jpg','많아요')`);
    expect(await seq()).toBe(before);
  });

  it('모르는 칸도 번호를 «안» 쓴다', async () => {
    const before = await seq();
    await refused(`INSERT INTO posts (username, post_image, mood) VALUES ('x','/i.jpg','happy')`);
    expect(await seq()).toBe(before);
  });

  it('NOT NULL 위반만 번호를 «쓴다» — 에러 본문이 그 번호를 직접 보여준다', async () => {
    const before = await seq();
    const e = await refused(`INSERT INTO posts (username, post_image) VALUES ('x', NULL)`);
    expect(await seq()).toBe(before + 1);
    // 줄이 이미 만들어졌다는 증거가 에러에 그대로 찍힌다
    expect(e.message).toContain('violates not-null constraint');
  });
});

describe('오프닝 — 앱을 «안 거치면» 몽고에는 그대로 들어간다', () => {
  it('Mongoose 를 건너뛰면 규칙이 하나도 안 남는다', async () => {
    await mongoose.connect(LOCAL_MONGO_URL);
    const raw = mongoose.connection.db.collection('p226_opening');
    await raw.deleteMany({});
    await raw.insertOne({ username: 123, postImage: null, likeCount: '많아요', mood: 'happy' });
    const [doc] = await raw.find().toArray();
    expect(doc.username).toBe(123);       // 숫자 그대로
    expect(doc.postImage).toBeNull();     // 필수인데 비어 있다
    expect(doc.likeCount).toBe('많아요');  // 숫자 칸에 말이
    expect(doc.mood).toBe('happy');       // 스키마에 없는 칸까지
    await raw.deleteMany({});
    await mongoose.disconnect();
  }, 30000);
});
