-- Step 8 — 게시물 표 완성판 (실제로 쓰는 칸을 전부)
CREATE TABLE posts (
  id            SERIAL      PRIMARY KEY,
  username      VARCHAR(50) NOT NULL,
  profile_image TEXT,
  post_image    TEXT        NOT NULL,
  post_alt      TEXT,
  content       TEXT,
  minutes_ago   INTEGER     NOT NULL DEFAULT 0,
  like_count    INTEGER     NOT NULL DEFAULT 0,
  comment_count INTEGER     NOT NULL DEFAULT 0
);
