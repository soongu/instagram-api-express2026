-- Step 8 — posts 표 최종형 (칸마다 규칙을 건 판)
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
