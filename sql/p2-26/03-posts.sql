-- Step 8 — 게시물 표 완성판 (실제로 쓰는 칸을 전부 · 「몇 분 전」 대신 올린 시각)
CREATE TABLE posts (
  id            SERIAL       PRIMARY KEY,
  username      VARCHAR(50)  NOT NULL,
  profile_image TEXT,
  post_image    TEXT         NOT NULL,
  post_alt      TEXT,
  content       TEXT,
  like_count    INTEGER      NOT NULL DEFAULT 0,
  comment_count INTEGER      NOT NULL DEFAULT 0,
  created_at    TIMESTAMP(3) NOT NULL DEFAULT now()
);
