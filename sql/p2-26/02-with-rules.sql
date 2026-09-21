-- Step 6 — 같은 표에 규칙을 걸어 다시 그린 판
CREATE TABLE posts (
  id         SERIAL      PRIMARY KEY,
  username   VARCHAR(50) NOT NULL,
  post_image TEXT        NOT NULL,
  content    TEXT,
  like_count INTEGER     NOT NULL DEFAULT 0
);
